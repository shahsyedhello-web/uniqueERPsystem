import { Router } from 'express';
import { loadDB, saveDB, generateUUID, logActivity } from '../store';
import { Sale, KitchenOrder, CustomerLedger } from '../../types/pos';
import { getPrisma } from '../prismaService';
import { recordJournalEntry } from './finance';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', (req, res) => {
  const db = loadDB();
  const { status } = req.query;
  if (status) {
    return res.json(db.sales.filter((s) => s.status === status));
  }
  res.json(db.sales);
});

router.post('/', (req, res) => {
  const {
    customerId,
    customerName,
    items,
    taxAmount,
    discountAmount,
    totalAmount,
    paidAmount,
    changeAmount,
    paymentMethod,
    paymentDetails,
    cashierName,
    status, // COMPLETED or HELD
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart items cannot be empty.' });
  }

  const db = loadDB();
  const prefix = db.settings.invoicePrefix || 'USB-';
  const invoiceNo = prefix + Math.floor(100000 + Math.random() * 900000);

  const saleStatus = status || 'COMPLETED';

  let subtotal = 0;
  let hasKitchenItems = false;

  const saleItems = items.map((i: any) => {
    subtotal += Number(i.subtotal);
    if (i.isKitchenItem) hasKitchenItems = true;
    return {
      productId: i.productId,
      productName: i.productName,
      unit: i.unit || 'pcs',
      price: Number(i.price),
      quantity: Number(i.quantity),
      discount: Number(i.discount) || 0,
      taxRate: Number(i.taxRate) || 0,
      subtotal: Number(i.subtotal),
      isKitchenItem: Boolean(i.isKitchenItem),
    };
  });

  const finalTax = Number(taxAmount) || 0;
  const finalDiscount = Number(discountAmount) || 0;
  const grandTotal = Number(totalAmount) !== undefined ? Number(totalAmount) : Math.max(0, subtotal + finalTax - finalDiscount);

  const method = (paymentMethod || 'CASH').toUpperCase();

  // Strict Payment Validation for COMPLETED sales
  let paid = 0;
  let change = 0;
  let creditAmountToLedger = 0;

  if (saleStatus === 'COMPLETED') {
    if (method === 'CASH') {
      const cashReceived = paidAmount !== undefined && paidAmount !== '' ? Number(paidAmount) : grandTotal;
      if (isNaN(cashReceived) || cashReceived < grandTotal - 0.01) {
        return res.status(400).json({ error: 'Insufficient cash received.' });
      }
      paid = cashReceived;
      change = Math.max(0, paid - grandTotal);
    } else if (method === 'CARD' || method === 'MOBILE') {
      const cardPaid = paidAmount !== undefined && paidAmount !== '' ? Number(paidAmount) : grandTotal;
      if (isNaN(cardPaid) || cardPaid < grandTotal - 0.01) {
        return res.status(400).json({ error: 'Insufficient payment received.' });
      }
      paid = cardPaid;
      change = Math.max(0, paid - grandTotal);
    } else if (method === 'CREDIT') {
      if (!customerId) {
        return res.status(400).json({ error: 'Customer selection is required for CREDIT sales.' });
      }
      paid = paidAmount !== undefined && paidAmount !== '' ? Number(paidAmount) : 0;
      if (isNaN(paid) || paid < 0) {
        return res.status(400).json({ error: 'Invalid paid amount for credit sale.' });
      }
      if (paid > grandTotal + 0.01) {
        return res.status(400).json({ error: 'Paid amount cannot exceed invoice total for credit sale.' });
      }
      creditAmountToLedger = Math.max(0, grandTotal - paid);
      change = 0;
    } else if (method === 'SPLIT') {
      const details = paymentDetails || {};
      const splitCash = Number(details.splitCash) || 0;
      const splitCard = Number(details.splitCard) || 0;
      const splitMobile = Number(details.splitMobile) || 0;
      const splitCredit = Number(details.splitCredit) || 0;

      const splitTotal = splitCash + splitCard + splitMobile + splitCredit;

      if (Math.abs(splitTotal - grandTotal) > 0.01) {
        return res.status(400).json({
          error: `Split payment total (Rs. ${splitTotal}) must equal invoice total (Rs. ${grandTotal}).`,
        });
      }

      if (splitCredit > 0 && !customerId) {
        return res.status(400).json({
          error: 'Customer selection is required when allocating credit in split payment.',
        });
      }

      paid = splitCash + splitCard + splitMobile;
      creditAmountToLedger = splitCredit;
      change = Math.max(0, (paid + splitCredit) - grandTotal);
    } else {
      paid = Number(paidAmount) || grandTotal;
      change = Math.max(0, paid - grandTotal);
    }

    // Double check overall payment sufficiency
    if (paid + creditAmountToLedger < grandTotal - 0.01) {
      return res.status(400).json({ error: 'Insufficient payment received.' });
    }

    // STRICT STOCK VALIDATION: Verify available inventory before completing sale
    const allowNegative = Boolean(db.settings?.allowNegativeStock);
    if (!allowNegative) {
      for (const item of saleItems) {
        const prod = db.products.find((p) => p.id === item.productId);
        if (!prod) {
          return res.status(400).json({ error: `Product '${item.productName}' was not found in inventory database.` });
        }
        const availableStock = prod.currentStock || 0;
        if (item.quantity > availableStock) {
          return res.status(400).json({
            error: `Insufficient stock for ${prod.name}. Available quantity: ${availableStock}. Requested: ${item.quantity}.`,
            productId: prod.id,
            availableQuantity: availableStock,
            requestedQuantity: item.quantity,
          });
        }
      }
    }

    // Deduct stock and record inventory logs with full audit trail
    const mainWarehouse = (db.warehouses || []).find((w) => w.isMain) || (db.warehouses || [])[0];

    saleItems.forEach((item) => {
      const prod = db.products.find((p) => p.id === item.productId);
      if (prod) {
        const prevStock = prod.currentStock;
        const qtyDeducted = Math.abs(item.quantity);
        prod.currentStock = Math.max(0, prod.currentStock - qtyDeducted);
        prod.updatedAt = new Date().toISOString();

        // Warehouse reference
        const wh = (db.warehouses || []).find((w) => w.id === prod.warehouseId) || mainWarehouse;

        // Deduct from stock batches if applicable
        if (db.batches && db.batches.length > 0) {
          const activeBatch = db.batches.find((b) => b.productId === prod.id && b.currentQuantity > 0);
          if (activeBatch) {
            activeBatch.currentQuantity = Math.max(0, activeBatch.currentQuantity - qtyDeducted);
          }
        }

        // 1. Stock Ledger transaction with negative quantity
        db.inventoryLogs = db.inventoryLogs || [];
        db.inventoryLogs.unshift({
          id: generateUUID(),
          productId: prod.id,
          productName: prod.name,
          warehouseId: wh?.id,
          warehouseName: wh?.name,
          type: 'SALE',
          quantity: -qtyDeducted, // Negative quantity as required
          previousStock: prevStock,
          newStock: prod.currentStock,
          referenceNo: invoiceNo,
          reason: `POS Sale Invoice #${invoiceNo}`,
          createdByName: cashierName || 'Cashier',
          createdAt: new Date().toISOString(),
        });

        // 2. Inventory Audit Log entry
        db.inventoryAudits = db.inventoryAudits || [];
        db.inventoryAudits.unshift({
          id: generateUUID(),
          referenceType: 'SALE',
          referenceNo: invoiceNo,
          action: 'Deduct Stock (Sale)',
          productId: prod.id,
          productName: prod.name,
          warehouseId: wh?.id,
          oldValue: prevStock.toString(),
          newValue: prod.currentStock.toString(),
          userId: 'pos-cashier',
          userName: cashierName || 'Cashier',
          createdAt: new Date().toISOString(),
        });

        // 3. Dynamic Stock Alert check
        db.alerts = db.alerts || [];
        const minStock = prod.minStock || prod.reorderLevel || 5;
        if (prod.currentStock <= 0) {
          db.alerts.unshift({
            id: generateUUID(),
            productId: prod.id,
            productName: prod.name,
            alertType: 'OUT_OF_STOCK',
            currentStock: prod.currentStock,
            minStock,
            createdAt: new Date().toISOString(),
          });
        } else if (prod.currentStock <= minStock) {
          db.alerts.unshift({
            id: generateUUID(),
            productId: prod.id,
            productName: prod.name,
            alertType: 'LOW_STOCK',
            currentStock: prod.currentStock,
            minStock,
            createdAt: new Date().toISOString(),
          });
        }
      }
    });

    // Credit payment processing: Create customer ledger entry automatically
    if (creditAmountToLedger > 0 && customerId) {
      const cust = db.customers.find((c) => c.id === customerId);
      if (cust) {
        cust.outstandingBalance = (cust.outstandingBalance || 0) + creditAmountToLedger;
        const ledger: CustomerLedger = {
          id: generateUUID(),
          customerId,
          type: 'CREDIT_SALE',
          amount: creditAmountToLedger,
          balanceAfter: cust.outstandingBalance,
          referenceNo: invoiceNo,
          notes: `Credit Sale Invoice #${invoiceNo} (Paid: Rs. ${paid}, Due Added: Rs. ${creditAmountToLedger})`,
          createdAt: new Date().toISOString(),
        };
        db.customerLedgers.unshift(ledger);
      }
    }

    // Award loyalty points (1 point per 100 PKR)
    if (customerId) {
      const cust = db.customers.find((c) => c.id === customerId);
      if (cust) {
        cust.loyaltyPoints = (cust.loyaltyPoints || 0) + Math.floor(grandTotal / 100);
      }
    }

    // Calculate Payment Allocations for Accounts & Shifts
    let cashPaid = 0;
    let cardPaid = 0;
    let mobilePaid = 0;
    let jazzCashPaid = 0;
    let easyPaisaPaid = 0;
    let creditPaid = creditAmountToLedger;

    if (method === 'CASH') {
      cashPaid = grandTotal;
    } else if (method === 'CARD') {
      cardPaid = grandTotal;
    } else if (method === 'MOBILE') {
      mobilePaid = grandTotal;
      jazzCashPaid = grandTotal; // Default mobile wallet
    } else if (method === 'CREDIT') {
      cashPaid = Math.max(0, paid);
    } else if (method === 'SPLIT') {
      const details = paymentDetails || {};
      cashPaid = Number(details.splitCash) || 0;
      cardPaid = Number(details.splitCard) || 0;
      mobilePaid = Number(details.splitMobile) || 0;
      jazzCashPaid = mobilePaid;
      creditPaid = Number(details.splitCredit) || 0;
    }

    // 1. Update Financial Account Balances Real-Time
    db.bankAccounts = db.bankAccounts || [];
    if (cashPaid > 0) {
      const cashAcc = db.bankAccounts.find((a) => a.id === 'acc-cash-hand' || a.accountType === 'CASH');
      if (cashAcc) cashAcc.currentBalance += cashPaid;
    }
    if (cardPaid > 0) {
      const cardAcc = db.bankAccounts.find((a) => a.id === 'acc-hbl' || a.accountType === 'BANK');
      if (cardAcc) cardAcc.currentBalance += cardPaid;
    }
    if (mobilePaid > 0) {
      const walletAcc = db.bankAccounts.find((a) => a.id === 'acc-jazzcash' || a.accountType === 'MOBILE_WALLET');
      if (walletAcc) walletAcc.currentBalance += mobilePaid;
    }

    // 2. Update Active Cash Shift & Register Sales
    db.cashShifts = db.cashShifts || [];
    const activeShift = db.cashShifts.find((s) => s.status === 'OPEN');
    if (activeShift) {
      activeShift.cashSales = (activeShift.cashSales || 0) + cashPaid;
      activeShift.cardSales = (activeShift.cardSales || 0) + cardPaid;
      activeShift.mobileSales = (activeShift.mobileSales || 0) + mobilePaid;
      activeShift.jazzCashSales = (activeShift.jazzCashSales || 0) + jazzCashPaid;
      activeShift.easyPaisaSales = (activeShift.easyPaisaSales || 0) + easyPaisaPaid;
      activeShift.creditSales = (activeShift.creditSales || 0) + creditPaid;
      activeShift.totalSales = (activeShift.totalSales || 0) + grandTotal;

      if (cashPaid > 0) {
        db.cashDrawerTransactions = db.cashDrawerTransactions || [];
        db.cashDrawerTransactions.unshift({
          id: generateUUID(),
          shiftId: activeShift.id,
          registerId: activeShift.registerId || 'reg-001',
          type: 'CASH_SALE',
          amount: cashPaid,
          reason: `POS Sale Invoice #${invoiceNo}`,
          referenceNo: invoiceNo,
          userId: activeShift.cashierId,
          userName: cashierName || activeShift.cashierName,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // 3. Double-Entry Accounting Journal Entry
    let cogsTotal = 0;
    saleItems.forEach((item) => {
      const prod = db.products.find((p) => p.id === item.productId);
      const cost = prod ? (prod.costPrice || prod.purchasePrice || item.price * 0.6) : item.price * 0.6;
      cogsTotal += cost * item.quantity;
    });

    const journalItems = [
      { accountCode: '4010', accountName: 'Sales Revenue', debit: 0, credit: grandTotal },
    ];

    if (cashPaid > 0) journalItems.push({ accountCode: '1010', accountName: 'Cash in Hand', debit: cashPaid, credit: 0 });
    if (cardPaid > 0) journalItems.push({ accountCode: '1020', accountName: 'Bank Accounts (Card)', debit: cardPaid, credit: 0 });
    if (mobilePaid > 0) journalItems.push({ accountCode: '1030', accountName: 'Mobile Wallets (JazzCash)', debit: mobilePaid, credit: 0 });
    if (creditPaid > 0) journalItems.push({ accountCode: '1040', accountName: 'Accounts Receivable', debit: creditPaid, credit: 0 });

    // COGS & Inventory Asset entry
    if (cogsTotal > 0) {
      journalItems.push({ accountCode: '5010', accountName: 'Cost of Goods Sold', debit: cogsTotal, credit: 0 });
      journalItems.push({ accountCode: '1050', accountName: 'Inventory Asset', debit: 0, credit: cogsTotal });
    }

    recordJournalEntry(`POS Sale Invoice #${invoiceNo}`, journalItems, 'SALE', invoiceNo, cashierName || 'Cashier');
  }

  const sale: Sale = {
    id: generateUUID(),
    invoiceNo,
    customerId,
    customerName: customerName || 'Walk-in Customer',
    items: saleItems,
    subtotal,
    taxAmount: finalTax,
    discountAmount: finalDiscount,
    totalAmount: grandTotal,
    paidAmount: paid,
    changeAmount: change,
    paymentMethod: method,
    paymentDetails,
    status: saleStatus,
    cashierName: cashierName || 'Cashier',
    kitchenStatus: hasKitchenItems ? 'PENDING' : undefined,
    createdAt: new Date().toISOString(),
  };

  db.sales.unshift(sale);

  // Auto-route to Kitchen if kitchen items exist
  if (hasKitchenItems && saleStatus === 'COMPLETED' && db.settings.enableKitchenRouting) {
    const kitchenItems = saleItems
      .filter((i) => i.isKitchenItem)
      .map((i) => ({
        productName: i.productName,
        quantity: i.quantity,
        status: 'PENDING' as const,
      }));

    const kot: KitchenOrder = {
      id: generateUUID(),
      orderNo: 'KOT-' + Math.floor(1000 + Math.random() * 9000),
      saleId: sale.id,
      invoiceNo,
      items: kitchenItems,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    db.kitchenOrders.unshift(kot);
  }

  saveDB();
  logActivity('system', cashierName || 'Cashier', 'POS Sale', 'POS', `Completed Sale Invoice #${invoiceNo} Total: ${grandTotal}`);

  res.status(201).json(sale);
});

// Resume or Void HELD order
router.put('/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // e.g. COMPLETED or VOID
  const db = loadDB();
  const sale = db.sales.find((s) => s.id === id);

  if (!sale) {
    return res.status(404).json({ error: 'Sale invoice not found.' });
  }

  sale.status = status;
  saveDB();
  res.json(sale);
});

// Refund / Return Sale
router.post('/refund', (req, res) => {
  const { saleId, reason, refundedBy } = req.body;
  const db = loadDB();
  const sale = db.sales.find((s) => s.id === saleId);

  if (!sale) {
    return res.status(404).json({ error: 'Invoice not found.' });
  }

  if (sale.status === 'REFUNDED') {
    return res.status(400).json({ error: 'Sale is already refunded.' });
  }

  const mainWarehouse = (db.warehouses || []).find((w) => w.isMain) || (db.warehouses || [])[0];

  // Restore inventory
  sale.items.forEach((item) => {
    const prod = db.products.find((p) => p.id === item.productId);
    if (prod) {
      const prev = prod.currentStock;
      prod.currentStock += item.quantity;
      prod.updatedAt = new Date().toISOString();

      const wh = (db.warehouses || []).find((w) => w.id === prod.warehouseId) || mainWarehouse;

      // Restore to active batch if available
      if (db.batches && db.batches.length > 0) {
        const batch = db.batches.find((b) => b.productId === prod.id);
        if (batch) {
          batch.currentQuantity += item.quantity;
        }
      }

      db.inventoryLogs = db.inventoryLogs || [];
      db.inventoryLogs.unshift({
        id: generateUUID(),
        productId: prod.id,
        productName: prod.name,
        warehouseId: wh?.id,
        warehouseName: wh?.name,
        type: 'RETURN',
        quantity: item.quantity,
        previousStock: prev,
        newStock: prod.currentStock,
        referenceNo: 'REF-' + sale.invoiceNo,
        reason: reason || 'Sale Refund / Return',
        createdByName: refundedBy || 'Manager',
        createdAt: new Date().toISOString(),
      });

      db.inventoryAudits = db.inventoryAudits || [];
      db.inventoryAudits.unshift({
        id: generateUUID(),
        referenceType: 'SALE_RETURN',
        referenceNo: 'REF-' + sale.invoiceNo,
        action: 'Restore Stock (Refund)',
        productId: prod.id,
        productName: prod.name,
        warehouseId: wh?.id,
        oldValue: prev.toString(),
        newValue: prod.currentStock.toString(),
        userId: 'pos-manager',
        userName: refundedBy || 'Manager',
        createdAt: new Date().toISOString(),
      });
    }
  });

  sale.status = 'REFUNDED';
  saveDB();
  logActivity('system', refundedBy || 'Manager', 'Sale Refund', 'POS', `Refunded Invoice #${sale.invoiceNo}`);

  res.json({ message: 'Refund processed and stock restored.', sale });
});

// Helper function to VOID / REVERSE a completed sale invoice
async function processVoidSaleInvoice(
  saleIdOrInvoiceNo: string,
  voidReason: string,
  reqUser?: { userId?: string; name?: string; role?: string }
) {
  const db = loadDB();
  const sale = db.sales.find((s) => s.id === saleIdOrInvoiceNo || s.invoiceNo === saleIdOrInvoiceNo);

  if (!sale) {
    return { success: false, status: 404, error: `Sale invoice '${saleIdOrInvoiceNo}' not found.` };
  }

  if (sale.status === 'VOIDED') {
    return { success: false, status: 400, error: `Sale invoice #${sale.invoiceNo} is already voided.` };
  }

  if (sale.status === 'REFUNDED') {
    return { success: false, status: 400, error: `Sale invoice #${sale.invoiceNo} is refunded. Use refund management.` };
  }

  const userRole = reqUser?.role || 'SYSTEM';
  if (userRole !== 'SUPER_ADMIN' && userRole !== 'ADMIN' && userRole !== 'MANAGER') {
    return { success: false, status: 403, error: 'Access Denied: Only Manager or Admin can void completed sales invoices.' };
  }

  const voidedByName = reqUser?.name || 'Authorized Manager';
  const mainWarehouse = (db.warehouses || []).find((w) => w.isMain) || (db.warehouses || [])[0];

  // 1. Restore Inventory
  sale.items.forEach((item) => {
    const prod = db.products.find((p) => p.id === item.productId);
    if (prod) {
      const prevStock = prod.currentStock;
      prod.currentStock += item.quantity;
      prod.updatedAt = new Date().toISOString();

      const wh = (db.warehouses || []).find((w) => w.id === prod.warehouseId) || mainWarehouse;

      if (db.batches) {
        const batch = db.batches.find((b) => b.productId === prod.id);
        if (batch) {
          batch.currentQuantity += item.quantity;
        }
      }

      db.inventoryLogs = db.inventoryLogs || [];
      db.inventoryLogs.unshift({
        id: generateUUID(),
        productId: prod.id,
        productName: prod.name,
        warehouseId: wh?.id,
        warehouseName: wh?.name,
        type: 'RETURN',
        quantity: item.quantity,
        previousStock: prevStock,
        newStock: prod.currentStock,
        referenceNo: 'VOID-' + sale.invoiceNo,
        reason: `Sale Invoice #${sale.invoiceNo} VOIDED: ${voidReason}`,
        createdByName: voidedByName,
        createdAt: new Date().toISOString(),
      });

      db.inventoryAudits = db.inventoryAudits || [];
      db.inventoryAudits.unshift({
        id: generateUUID(),
        referenceType: 'SALE_RETURN',
        referenceNo: 'VOID-' + sale.invoiceNo,
        action: 'Restore Stock (Void Sale)',
        productId: prod.id,
        productName: prod.name,
        warehouseId: wh?.id,
        oldValue: prevStock.toString(),
        newValue: prod.currentStock.toString(),
        userId: reqUser?.userId || 'pos-manager',
        userName: voidedByName,
        createdAt: new Date().toISOString(),
      });
    }
  });

  // 2. Reverse Customer Outstanding Balance if Credit Sale
  if (sale.paymentMethod === 'CREDIT' || (sale.paymentDetails && sale.paymentDetails.splitCredit > 0)) {
    if (sale.customerId) {
      const cust = db.customers.find((c) => c.id === sale.customerId);
      if (cust) {
        const creditAmt = sale.paymentMethod === 'CREDIT'
          ? Math.max(0, sale.totalAmount - sale.paidAmount)
          : (sale.paymentDetails?.splitCredit || 0);

        cust.outstandingBalance = Math.max(0, (cust.outstandingBalance || 0) - creditAmt);

        db.customerLedgers = db.customerLedgers || [];
        db.customerLedgers.unshift({
          id: generateUUID(),
          customerId: cust.id,
          type: 'ADJUSTMENT',
          amount: -creditAmt,
          balanceAfter: cust.outstandingBalance,
          referenceNo: 'VOID-' + sale.invoiceNo,
          notes: `Credit Reversed - Voided Invoice #${sale.invoiceNo}`,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  // 3. Mark Sale as VOIDED with metadata
  sale.status = 'VOIDED';
  sale.voidedBy = reqUser?.userId;
  sale.voidedByName = voidedByName;
  sale.voidedAt = new Date().toISOString();
  sale.voidReason = voidReason;

  saveDB();

  logActivity(
    reqUser?.userId || 'system',
    voidedByName,
    'Void Sale Invoice',
    'POS',
    `Voided Sale Invoice #${sale.invoiceNo} (Reason: ${voidReason})`
  );

  return {
    success: true,
    status: 200,
    message: `Sale invoice #${sale.invoiceNo} successfully voided and stock restored.`,
    sale,
  };
}

// POST /api/sales/:id/void
router.post('/:id/void', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const result = await processVoidSaleInvoice(id, reason || 'Customer request / Clerical error', req.user);
  if (!result.success) {
    return res.status(result.status || 400).json({ error: result.error });
  }

  return res.json({ message: result.message, sale: result.sale });
});

// DELETE /api/sales/:id (Replaced with VOID/REVERSE for completed sales, delete allowed for HELD drafts)
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Invoice ID is required.' });
    }

    const db = loadDB();
    const saleIndex = db.sales.findIndex((s) => s.id === id || s.invoiceNo === id);

    if (saleIndex === -1) {
      return res.status(404).json({ error: `Sale invoice '${id}' not found.` });
    }

    const sale = db.sales[saleIndex];

    // If order is HELD (parked draft), allow physically deleting draft
    if (sale.status === 'HELD') {
      db.sales.splice(saleIndex, 1);
      saveDB();
      logActivity(req.user?.userId || 'system', req.user?.name || 'User', 'Delete Held Order', 'Sales', `Deleted held draft order #${sale.invoiceNo}`);
      return res.json({ success: true, message: `Held order #${sale.invoiceNo} deleted successfully.` });
    }

    // For COMPLETED financial invoices: Void & Reverse instead of deleting to preserve audit history
    const voidResult = await processVoidSaleInvoice(id, 'Requested invoice deletion / void', req.user);
    if (!voidResult.success) {
      return res.status(voidResult.status || 400).json({ error: voidResult.error });
    }

    return res.json({
      success: true,
      message: `Sale invoice #${sale.invoiceNo} was voided and stock restored to preserve accounting audit trail.`,
      sale: voidResult.sale,
    });
  } catch (err: any) {
    console.error('Unhandled error in DELETE sale:', err);
    return res.status(500).json({ error: err?.message || 'Server error occurred while voiding sale invoice.' });
  }
});

export default router;

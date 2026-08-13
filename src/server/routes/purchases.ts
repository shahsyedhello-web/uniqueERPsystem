import { Router } from 'express';
import { loadDB, saveDB, generateUUID, logActivity } from '../store';
import { Purchase, SupplierLedger } from '../../types/pos';
import { recordJournalEntry } from './finance';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'));

router.get('/', (req, res) => {
  const db = loadDB();
  res.json(db.purchases);
});

router.post('/', (req, res) => {
  const { supplierId, items, taxAmount, discount, paidAmount, paymentMethod, notes, createdByName } = req.body;

  if (!supplierId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Supplier and purchase items are required.' });
  }

  const db = loadDB();
  const supplier = db.suppliers.find((s) => s.id === supplierId);
  if (!supplier) {
    return res.status(404).json({ error: 'Supplier not found.' });
  }

  const purchaseNo = 'PO-' + Date.now();
  let subtotal = 0;

  const validatedItems = items.map((item: any) => {
    const itemTotal = Number(item.quantity) * Number(item.purchasePrice);
    subtotal += itemTotal;
    return {
      id: generateUUID(),
      productId: item.productId,
      productName: item.productName,
      quantity: Number(item.quantity),
      purchasePrice: Number(item.purchasePrice),
      total: itemTotal,
      expiryDate: item.expiryDate,
      batchNo: item.batchNo || 'BATCH-' + Date.now(),
    };
  });

  const tax = Number(taxAmount) || 0;
  const disc = Number(discount) || 0;
  const totalAmount = subtotal + tax - disc;
  const paid = Number(paidAmount) || 0;
  const due = Math.max(0, totalAmount - paid);

  let paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING' = 'PAID';
  if (paid === 0) paymentStatus = 'PENDING';
  else if (paid < totalAmount) paymentStatus = 'PARTIAL';

  // Update product stocks, purchase prices, batches, and ledger
  const mainWarehouse = (db.warehouses || []).find((w) => w.isMain) || (db.warehouses || [])[0];

  validatedItems.forEach((item) => {
    const prod = db.products.find((p) => p.id === item.productId);
    if (prod) {
      const prevStock = prod.currentStock;
      const prevCost = prod.costPrice || prod.purchasePrice || 0;
      const newStock = prevStock + item.quantity;

      // Calculate weighted average cost
      const newAvgCost = newStock > 0 ? (prevStock * prevCost + item.quantity * item.purchasePrice) / newStock : item.purchasePrice;

      prod.currentStock = newStock;
      prod.purchasePrice = item.purchasePrice;
      prod.costPrice = item.purchasePrice;
      prod.averageCost = Number(newAvgCost.toFixed(2));
      prod.updatedAt = new Date().toISOString();

      const wh = (db.warehouses || []).find((w) => w.id === prod.warehouseId) || mainWarehouse;

      // Create Stock Batch
      db.batches = db.batches || [];
      db.batches.unshift({
        id: generateUUID(),
        batchNo: item.batchNo,
        productId: prod.id,
        productName: prod.name,
        warehouseId: wh?.id,
        warehouseName: wh?.name,
        supplierId: supplier.id,
        supplierName: supplier.name,
        purchaseRef: purchaseNo,
        manufacturingDate: new Date().toISOString().split('T')[0],
        expiryDate: item.expiryDate || (prod.expiryDays ? new Date(Date.now() + prod.expiryDays * 86400000).toISOString().split('T')[0] : undefined),
        initialQuantity: item.quantity,
        currentQuantity: item.quantity,
        costPrice: item.purchasePrice,
        createdAt: new Date().toISOString(),
      });

      // Add Stock Ledger
      db.inventoryLogs = db.inventoryLogs || [];
      db.inventoryLogs.unshift({
        id: generateUUID(),
        productId: prod.id,
        productName: prod.name,
        warehouseId: wh?.id,
        warehouseName: wh?.name,
        type: 'PURCHASE',
        quantity: item.quantity,
        previousStock: prevStock,
        newStock: prod.currentStock,
        referenceNo: purchaseNo,
        reason: `Goods Receiving (GRN) from ${supplier.name}`,
        createdByName: createdByName || 'Admin',
        createdAt: new Date().toISOString(),
      });

      // Add Audit Log
      db.inventoryAudits = db.inventoryAudits || [];
      db.inventoryAudits.unshift({
        id: generateUUID(),
        referenceType: 'GRN',
        referenceNo: purchaseNo,
        action: 'Goods Received (PO)',
        productId: prod.id,
        productName: prod.name,
        warehouseId: wh?.id,
        oldValue: prevStock.toString(),
        newValue: prod.currentStock.toString(),
        userId: 'user-admin',
        userName: createdByName || 'Admin',
        createdAt: new Date().toISOString(),
      });
    }
  });

  // Update Supplier Outstanding & Ledger
  if (due > 0) {
    supplier.outstandingBalance = (supplier.outstandingBalance || 0) + due;
  }

  db.supplierLedgers = db.supplierLedgers || [];
  const suppLedger: SupplierLedger = {
    id: generateUUID(),
    supplierId: supplier.id,
    type: 'PURCHASE',
    amount: totalAmount,
    balanceAfter: supplier.outstandingBalance || 0,
    referenceNo: purchaseNo,
    notes: `Purchase Invoice #${purchaseNo} (Paid: Rs. ${paid}, Due: Rs. ${due})`,
    createdAt: new Date().toISOString(),
  };
  db.supplierLedgers.unshift(suppLedger);

  // Update Financial Accounts
  db.bankAccounts = db.bankAccounts || [];
  if (paid > 0) {
    const pmtMethod = (paymentMethod || 'CASH').toUpperCase();
    let account = db.bankAccounts.find((a) => (pmtMethod.includes('BANK') || pmtMethod.includes('CARD') ? a.accountType === 'BANK' : a.accountType === 'CASH'));
    if (!account) account = db.bankAccounts[0];
    if (account) {
      account.currentBalance -= paid;
    }
  }

  // Double Entry Journal Entry
  const journalItems = [
    { accountCode: '1050', accountName: 'Inventory Asset', debit: totalAmount, credit: 0 },
  ];
  if (paid > 0) {
    journalItems.push({ accountCode: '1010', accountName: 'Cash / Bank', debit: 0, credit: paid });
  }
  if (due > 0) {
    journalItems.push({ accountCode: '2010', accountName: 'Accounts Payable', debit: 0, credit: due });
  }

  recordJournalEntry(`Purchase Order / GRN #${purchaseNo} - ${supplier.name}`, journalItems, 'PURCHASE', purchaseNo, createdByName || 'Admin');

  const purchase: Purchase = {
    id: generateUUID(),
    purchaseNo,
    supplierId,
    supplierName: supplier.name,
    items: validatedItems,
    subtotal,
    taxAmount: tax,
    discount: disc,
    totalAmount,
    paidAmount: paid,
    dueAmount: due,
    paymentStatus,
    paymentMethod: paymentMethod || 'CASH',
    notes,
    createdByName: createdByName || 'Admin',
    createdAt: new Date().toISOString(),
  };

  db.purchases.unshift(purchase);
  saveDB();
  logActivity('system', createdByName || 'User', 'Create Purchase', 'Purchases', `Created Purchase ${purchaseNo} Total: ${totalAmount}`);

  res.status(201).json(purchase);
});

// Purchase Return (Return stock to supplier)
router.post('/:id/return', (req, res) => {
  const { id } = req.params;
  const { items, reason, returnedBy } = req.body;

  const db = loadDB();
  const purchase = db.purchases.find((p) => p.id === id || p.purchaseNo === id);
  if (!purchase) {
    return res.status(404).json({ error: 'Purchase Order not found.' });
  }

  const mainWarehouse = (db.warehouses || []).find((w) => w.isMain) || (db.warehouses || [])[0];
  const supplier = db.suppliers.find((s) => s.id === purchase.supplierId);

  const returnItems = items && Array.isArray(items) && items.length > 0 ? items : purchase.items;
  let totalReturnedVal = 0;

  returnItems.forEach((item: any) => {
    const prod = db.products.find((p) => p.id === item.productId);
    if (prod) {
      const returnQty = Math.abs(Number(item.quantity) || 0);
      const prevStock = prod.currentStock;
      prod.currentStock = Math.max(0, prod.currentStock - returnQty);
      prod.updatedAt = new Date().toISOString();

      const wh = (db.warehouses || []).find((w) => w.id === prod.warehouseId) || mainWarehouse;
      const itemCost = Number(item.purchasePrice) || prod.costPrice || prod.purchasePrice || 0;
      totalReturnedVal += returnQty * itemCost;

      // Reduce from active batch if exists
      if (db.batches) {
        const batch = db.batches.find((b) => b.productId === prod.id && b.purchaseRef === purchase.purchaseNo);
        if (batch) {
          batch.currentQuantity = Math.max(0, batch.currentQuantity - returnQty);
        }
      }

      // Record Stock Ledger Entry
      db.inventoryLogs = db.inventoryLogs || [];
      db.inventoryLogs.unshift({
        id: generateUUID(),
        productId: prod.id,
        productName: prod.name,
        warehouseId: wh?.id,
        warehouseName: wh?.name,
        type: 'PURCHASE_RETURN',
        quantity: -returnQty,
        previousStock: prevStock,
        newStock: prod.currentStock,
        referenceNo: 'RET-' + purchase.purchaseNo,
        reason: reason || `Purchase Return to ${supplier?.name || 'Supplier'}`,
        createdByName: returnedBy || 'Admin',
        createdAt: new Date().toISOString(),
      });

      // Record Audit Entry
      db.inventoryAudits = db.inventoryAudits || [];
      db.inventoryAudits.unshift({
        id: generateUUID(),
        referenceType: 'PURCHASE_RETURN',
        referenceNo: 'RET-' + purchase.purchaseNo,
        action: 'Purchase Return to Supplier',
        productId: prod.id,
        productName: prod.name,
        warehouseId: wh?.id,
        oldValue: prevStock.toString(),
        newValue: prod.currentStock.toString(),
        userId: 'user-admin',
        userName: returnedBy || 'Admin',
        createdAt: new Date().toISOString(),
      });
    }
  });

  // Adjust supplier outstanding balance
  if (supplier && supplier.outstandingBalance > 0) {
    supplier.outstandingBalance = Math.max(0, supplier.outstandingBalance - totalReturnedVal);
  }

  purchase.notes = (purchase.notes ? purchase.notes + ' | ' : '') + `Purchase Return Processed (${new Date().toISOString().split('T')[0]})`;
  saveDB();

  logActivity('system', returnedBy || 'User', 'Purchase Return', 'Purchases', `Returned items for Purchase #${purchase.purchaseNo}`);
  res.json({ message: 'Purchase Return processed successfully.', purchase, totalReturnedVal });
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const db = loadDB();
  const purchase = db.purchases.find((p) => p.id === id || p.purchaseNo === id);

  if (purchase) {
    const mainWarehouse = (db.warehouses || []).find((w) => w.isMain) || (db.warehouses || [])[0];

    // Deduct received stock if purchase created stock
    purchase.items.forEach((item) => {
      const prod = db.products.find((p) => p.id === item.productId);
      if (prod) {
        const prevStock = prod.currentStock;
        const deductQty = item.quantity;
        prod.currentStock = Math.max(0, prod.currentStock - deductQty);
        prod.updatedAt = new Date().toISOString();

        const wh = (db.warehouses || []).find((w) => w.id === prod.warehouseId) || mainWarehouse;

        // Reduce batches
        if (db.batches) {
          db.batches = db.batches.filter((b) => b.purchaseRef !== purchase.purchaseNo);
        }

        // Ledger entry
        db.inventoryLogs = db.inventoryLogs || [];
        db.inventoryLogs.unshift({
          id: generateUUID(),
          productId: prod.id,
          productName: prod.name,
          warehouseId: wh?.id,
          warehouseName: wh?.name,
          type: 'PURCHASE_RETURN',
          quantity: -deductQty,
          previousStock: prevStock,
          newStock: prod.currentStock,
          referenceNo: 'DEL-' + purchase.purchaseNo,
          reason: `Purchase Order ${purchase.purchaseNo} Deleted`,
          createdByName: 'Admin',
          createdAt: new Date().toISOString(),
        });
      }
    });

    // Adjust supplier balance
    const supplier = db.suppliers.find((s) => s.id === purchase.supplierId);
    if (supplier && purchase.dueAmount > 0) {
      supplier.outstandingBalance = Math.max(0, supplier.outstandingBalance - purchase.dueAmount);
    }

    db.purchases = db.purchases.filter((p) => p.id !== id && p.purchaseNo !== id);
    saveDB();
    logActivity('system', 'Admin', 'Delete Purchase', 'Purchases', `Deleted Purchase Order #${purchase.purchaseNo}`);
  }

  res.json({ message: 'Purchase record deleted and stock reversed.' });
});

export default router;

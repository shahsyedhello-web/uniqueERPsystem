import { Router } from 'express';
import { getPrisma, ensurePrismaInitialized, isDbConnected } from '../prismaService';
import { loadDB, saveDB, generateUUID } from '../store';
import { Sale, SaleItem, InventoryLedger } from '../../types/pos';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// GET /api/sales
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    await ensurePrismaInitialized();
    const prisma = getPrisma();
    if (prisma && isDbConnected()) {
      const whereClause: any = {};
      if (status) {
        whereClause.status = String(status);
      }

      const sales = await prisma.sale.findMany({
        where: whereClause,
        include: {
          items: {
            include: { product: true },
          },
          customer: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const formatted = sales.map((s: any) => ({
        id: s.id,
        invoiceNo: s.invoiceNo,
        customerId: s.customerId,
        customerName: s.customerName || (s.customer ? s.customer.name : 'Walk-in Customer'),
        subtotal: s.subtotal,
        taxAmount: s.taxAmount,
        discountAmount: s.discountAmount,
        totalAmount: s.totalAmount,
        paidAmount: s.paidAmount,
        changeAmount: s.changeAmount,
        paymentMethod: s.paymentMethod,
        paymentDetails: s.paymentDetails,
        status: s.status,
        cashierName: s.cashierName,
        kitchenStatus: s.kitchenStatus,
        createdAt: s.createdAt ? s.createdAt.toISOString() : new Date().toISOString(),
        items: (s.items || []).map((i: any) => ({
          id: i.id,
          productId: i.productId,
          productName: i.productName || (i.product ? i.product.name : 'Unknown Product'),
          unit: i.unit || 'pcs',
          price: i.price,
          quantity: i.quantity,
          discount: i.discount || 0,
          taxRate: i.taxRate || 0,
          subtotal: i.subtotal,
          isKitchenItem: i.isKitchenItem || false,
        })),
      }));

      return res.json(formatted);
    }

    // JSON Store fallback
    const db = loadDB();
    db.sales = db.sales || [];
    let list = db.sales;
    if (status) {
      list = list.filter((s) => s.status === String(status));
    }

    return res.json(list);
  } catch (err: any) {
    console.error('[Sales GET Error]:', err);
    try {
      const db = loadDB();
      return res.json(db.sales || []);
    } catch {
      return res.status(500).json({ error: 'Failed to fetch sales.' });
    }
  }
});

// POST /api/sales - Create Sale Invoice
router.post('/', async (req: AuthRequest, res) => {
  try {
    const {
      customerId,
      customerName,
      items,
      taxAmount,
      discountAmount,
      totalAmount,
      paidAmount,
      paymentMethod,
      paymentDetails,
      cashierName,
      status, // COMPLETED or HELD
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart items cannot be empty.' });
    }

    const prefix = 'USB-';
    const invoiceNo = prefix + Math.floor(100000 + Math.random() * 900000);
    const saleStatus = status || 'COMPLETED';

    let subtotal = 0;
    let hasKitchenItems = false;

    const saleItems = items.map((i: any) => {
      const itemSubtotal = Number(i.subtotal) || (Number(i.price) * Number(i.quantity));
      subtotal += itemSubtotal;
      if (i.isKitchenItem) hasKitchenItems = true;
      return {
        productId: String(i.productId).trim(),
        productName: i.productName || 'Item',
        unit: i.unit || 'pcs',
        price: Number(i.price) || 0,
        quantity: Number(i.quantity) || 1,
        discount: Number(i.discount) || 0,
        taxRate: Number(i.taxRate) || 0,
        subtotal: itemSubtotal,
        isKitchenItem: Boolean(i.isKitchenItem),
      };
    });

    const finalTax = Number(taxAmount) || 0;
    const finalDiscount = Number(discountAmount) || 0;
    const grandTotal = Number(totalAmount) !== undefined ? Number(totalAmount) : Math.max(0, subtotal + finalTax - finalDiscount);
    const method = (paymentMethod || 'CASH').toUpperCase();

    let paid = 0;
    let change = 0;
    let creditAmountToLedger = 0;

    await ensurePrismaInitialized();
    const prisma = getPrisma();

    if (prisma && isDbConnected()) {
      if (saleStatus === 'COMPLETED') {
        if (method === 'CASH' || method === 'CARD' || method === 'MOBILE') {
          const received = paidAmount !== undefined && paidAmount !== '' ? Number(paidAmount) : grandTotal;
          if (isNaN(received) || received < grandTotal - 0.01) {
            return res.status(400).json({ error: 'Insufficient payment received.' });
          }
          paid = received;
          change = Math.max(0, paid - grandTotal);
        } else if (method === 'CREDIT') {
          if (!customerId) {
            return res.status(400).json({ error: 'Customer selection is required for CREDIT sales.' });
          }
          paid = paidAmount !== undefined && paidAmount !== '' ? Number(paidAmount) : 0;
          creditAmountToLedger = Math.max(0, grandTotal - paid);
          change = 0;
        } else {
          paid = Number(paidAmount) || grandTotal;
          change = Math.max(0, paid - grandTotal);
        }

        // Verify product stock in PostgreSQL
        for (const item of saleItems) {
          const prod = await prisma.product.findUnique({ where: { id: item.productId } });
          if (!prod) {
            return res.status(400).json({ error: `Product '${item.productName}' was not found in database.` });
          }
          if (prod.currentStock < item.quantity) {
            return res.status(400).json({
              error: `Insufficient stock for ${prod.name}. Available: ${prod.currentStock}, Requested: ${item.quantity}.`,
            });
          }
        }
      }

      // Process Sale in Prisma Transaction
      const newSale = await prisma.$transaction(async (tx: any) => {
        const createdSale = await tx.sale.create({
          data: {
            invoiceNo,
            customerId: customerId ? String(customerId).trim() : null,
            customerName: customerName || 'Walk-in Customer',
            subtotal,
            taxAmount: finalTax,
            discountAmount: finalDiscount,
            totalAmount: grandTotal,
            paidAmount: paid,
            changeAmount: change,
            paymentMethod: method,
            paymentDetails: paymentDetails ? JSON.stringify(paymentDetails) : null,
            status: saleStatus,
            cashierName: cashierName || req.user?.name || 'Cashier',
            kitchenStatus: hasKitchenItems ? 'PENDING' : null,
            items: {
              create: saleItems.map((i: any) => ({
                productId: i.productId,
                productName: i.productName,
                unit: i.unit,
                price: i.price,
                quantity: i.quantity,
                discount: i.discount,
                taxRate: i.taxRate,
                subtotal: i.subtotal,
                isKitchenItem: i.isKitchenItem,
              })),
            },
          },
          include: { items: true },
        });

        if (saleStatus === 'COMPLETED') {
          for (const item of saleItems) {
            const prod = await tx.product.findUnique({ where: { id: item.productId } });
            if (prod) {
              const prevStock = prod.currentStock;
              const newStock = Math.max(0, prevStock - item.quantity);

              await tx.product.update({
                where: { id: prod.id },
                data: { currentStock: newStock },
              });

              await tx.inventoryLog.create({
                data: {
                  productId: prod.id,
                  type: 'SALE',
                  quantity: -item.quantity,
                  previousStock: prevStock,
                  newStock: newStock,
                  referenceNo: invoiceNo,
                  reason: `POS Sale Invoice #${invoiceNo}`,
                  createdByName: cashierName || req.user?.name || 'Cashier',
                },
              });
            }
          }

          if (creditAmountToLedger > 0 && customerId) {
            const cust = await tx.customer.findUnique({ where: { id: String(customerId).trim() } });
            if (cust) {
              const newBal = cust.outstandingBalance + creditAmountToLedger;
              await tx.customer.update({
                where: { id: cust.id },
                data: { outstandingBalance: newBal },
              });

              await tx.customerLedger.create({
                data: {
                  customerId: cust.id,
                  type: 'CREDIT_SALE',
                  amount: creditAmountToLedger,
                  balanceAfter: newBal,
                  referenceNo: invoiceNo,
                  notes: `Credit Sale Invoice #${invoiceNo}`,
                },
              });
            }
          }
        }

        return createdSale;
      });

      return res.status(201).json({
        id: newSale.id,
        invoiceNo: newSale.invoiceNo,
        customerId: newSale.customerId,
        customerName: newSale.customerName,
        subtotal: newSale.subtotal,
        taxAmount: newSale.taxAmount,
        discountAmount: newSale.discountAmount,
        totalAmount: newSale.totalAmount,
        paidAmount: newSale.paidAmount,
        changeAmount: newSale.changeAmount,
        paymentMethod: newSale.paymentMethod,
        status: newSale.status,
        cashierName: newSale.cashierName,
        kitchenStatus: newSale.kitchenStatus,
        createdAt: newSale.createdAt.toISOString(),
        items: saleItems,
      });
    }

    // JSON Store Fallback
    const db = loadDB();
    db.sales = db.sales || [];
    db.products = db.products || [];
    db.inventoryLogs = db.inventoryLogs || [];
    db.customers = db.customers || [];
    db.customerLedgers = db.customerLedgers || [];

    if (saleStatus === 'COMPLETED') {
      if (method === 'CASH' || method === 'CARD' || method === 'MOBILE') {
        const received = paidAmount !== undefined && paidAmount !== '' ? Number(paidAmount) : grandTotal;
        if (isNaN(received) || received < grandTotal - 0.01) {
          return res.status(400).json({ error: 'Insufficient payment received.' });
        }
        paid = received;
        change = Math.max(0, paid - grandTotal);
      } else if (method === 'CREDIT') {
        if (!customerId) {
          return res.status(400).json({ error: 'Customer selection is required for CREDIT sales.' });
        }
        paid = paidAmount !== undefined && paidAmount !== '' ? Number(paidAmount) : 0;
        creditAmountToLedger = Math.max(0, grandTotal - paid);
        change = 0;
      } else {
        paid = Number(paidAmount) || grandTotal;
        change = Math.max(0, paid - grandTotal);
      }

      for (const item of saleItems) {
        const prod = db.products.find((p) => p.id === item.productId);
        if (prod && prod.currentStock < item.quantity) {
          return res.status(400).json({
            error: `Insufficient stock for ${prod.name}. Available: ${prod.currentStock}, Requested: ${item.quantity}.`,
          });
        }
      }

      for (const item of saleItems) {
        const prod = db.products.find((p) => p.id === item.productId);
        if (prod) {
          const prevStock = prod.currentStock;
          const newStock = Math.max(0, prevStock - item.quantity);
          prod.currentStock = newStock;

          db.inventoryLogs.unshift({
            id: generateUUID(),
            productId: prod.id,
            productName: prod.name,
            type: 'SALE',
            quantity: -item.quantity,
            previousStock: prevStock,
            newStock: newStock,
            referenceNo: invoiceNo,
            reason: `POS Sale Invoice #${invoiceNo}`,
            createdByName: cashierName || req.user?.name || 'Cashier',
            createdAt: new Date().toISOString(),
          });
        }
      }

      if (creditAmountToLedger > 0 && customerId) {
        const cust = db.customers.find((c) => c.id === String(customerId).trim());
        if (cust) {
          const newBal = (cust.outstandingBalance || 0) + creditAmountToLedger;
          cust.outstandingBalance = newBal;
          db.customerLedgers.unshift({
            id: generateUUID(),
            customerId: cust.id,
            type: 'CREDIT_SALE',
            amount: creditAmountToLedger,
            balanceAfter: newBal,
            referenceNo: invoiceNo,
            notes: `Credit Sale Invoice #${invoiceNo}`,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    const saleRecord: Sale = {
      id: generateUUID(),
      invoiceNo,
      customerId: customerId ? String(customerId).trim() : undefined,
      customerName: customerName || 'Walk-in Customer',
      items: saleItems.map((si) => ({ ...si, id: generateUUID() })),
      subtotal,
      taxAmount: finalTax,
      discountAmount: finalDiscount,
      totalAmount: grandTotal,
      paidAmount: paid,
      changeAmount: change,
      paymentMethod: method,
      paymentDetails: paymentDetails ? JSON.stringify(paymentDetails) : undefined,
      status: saleStatus,
      cashierName: cashierName || req.user?.name || 'Cashier',
      kitchenStatus: hasKitchenItems ? 'PENDING' : undefined,
      createdAt: new Date().toISOString(),
    };

    db.sales.unshift(saleRecord);
    saveDB();

    return res.status(201).json(saleRecord);
  } catch (err: any) {
    console.error('[Sales POST Error]:', err);
    return res.status(500).json({ error: err?.message || 'Failed to create sale.' });
  }
});

// POST /api/sales/refund - Refund / Return Sale
router.post('/refund', async (req: AuthRequest, res) => {
  try {
    const { saleId, reason, refundedBy } = req.body;
    if (!saleId) {
      return res.status(400).json({ error: 'Sale ID is required.' });
    }

    await ensurePrismaInitialized();
    const prisma = getPrisma();
    if (prisma && isDbConnected()) {
      const sale = await prisma.sale.findUnique({
        where: { id: String(saleId).trim() },
        include: { items: true },
      });

      if (!sale) {
        return res.status(404).json({ error: 'Sale invoice not found.' });
      }

      if (sale.status === 'REFUNDED') {
        return res.status(400).json({ error: 'Sale is already refunded.' });
      }

      await prisma.$transaction(async (tx: any) => {
        for (const item of sale.items) {
          const prod = await tx.product.findUnique({ where: { id: item.productId } });
          if (prod) {
            const prevStock = prod.currentStock;
            const newStock = prevStock + item.quantity;

            await tx.product.update({
              where: { id: prod.id },
              data: { currentStock: newStock },
            });

            await tx.inventoryLog.create({
              data: {
                productId: prod.id,
                type: 'RETURN',
                quantity: item.quantity,
                previousStock: prevStock,
                newStock: newStock,
                referenceNo: 'REF-' + sale.invoiceNo,
                reason: reason || 'Sale Refund / Return',
                createdByName: refundedBy || req.user?.name || 'Manager',
              },
            });
          }
        }

        await tx.sale.update({
          where: { id: sale.id },
          data: { status: 'REFUNDED' },
        });
      });

      return res.json({ message: 'Refund processed successfully.' });
    }

    // JSON Store fallback
    const db = loadDB();
    db.sales = db.sales || [];
    db.products = db.products || [];
    db.inventoryLogs = db.inventoryLogs || [];

    const sale = db.sales.find((s) => s.id === String(saleId).trim());
    if (!sale) {
      return res.status(404).json({ error: 'Sale invoice not found.' });
    }

    if (sale.status === 'REFUNDED') {
      return res.status(400).json({ error: 'Sale is already refunded.' });
    }

    for (const item of sale.items) {
      const prod = db.products.find((p) => p.id === item.productId);
      if (prod) {
        const prevStock = prod.currentStock;
        const newStock = prevStock + item.quantity;
        prod.currentStock = newStock;

        db.inventoryLogs.unshift({
          id: generateUUID(),
          productId: prod.id,
          productName: prod.name,
          type: 'RETURN',
          quantity: item.quantity,
          previousStock: prevStock,
          newStock: newStock,
          referenceNo: 'REF-' + sale.invoiceNo,
          reason: reason || 'Sale Refund / Return',
          createdByName: refundedBy || req.user?.name || 'Manager',
          createdAt: new Date().toISOString(),
        });
      }
    }

    sale.status = 'REFUNDED';
    saveDB();

    return res.json({ message: 'Refund processed successfully.' });
  } catch (err: any) {
    console.error('[Sales Refund Error]:', err);
    return res.status(500).json({ error: err?.message || 'Failed to process refund.' });
  }
});

// DELETE /api/sales/:id
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const rawId = req.params.id;
    const id = String(rawId || '').trim();

    await ensurePrismaInitialized();
    const prisma = getPrisma();
    if (prisma && isDbConnected()) {
      const sale = await prisma.sale.findUnique({ where: { id } });
      if (!sale) {
        return res.status(404).json({ error: 'Sale invoice not found.' });
      }

      if (sale.status === 'HELD') {
        await prisma.saleItem.deleteMany({ where: { saleId: id } });
        await prisma.sale.delete({ where: { id } });
        return res.json({ success: true, message: `Held draft #${sale.invoiceNo} deleted.` });
      }

      await prisma.sale.update({
        where: { id },
        data: { status: 'VOIDED' },
      });

      return res.json({ success: true, message: `Sale invoice #${sale.invoiceNo} marked as VOIDED.` });
    }

    // JSON Store fallback
    const db = loadDB();
    db.sales = db.sales || [];

    const sale = db.sales.find((s) => s.id === id);
    if (!sale) {
      return res.status(404).json({ error: 'Sale invoice not found.' });
    }

    if (sale.status === 'HELD') {
      db.sales = db.sales.filter((s) => s.id !== id);
      saveDB();
      return res.json({ success: true, message: `Held draft #${sale.invoiceNo} deleted.` });
    }

    sale.status = 'VOIDED';
    saveDB();

    return res.json({ success: true, message: `Sale invoice #${sale.invoiceNo} marked as VOIDED.` });
  } catch (err: any) {
    console.error('[Sales DELETE Error]:', err);
    return res.status(500).json({ error: err?.message || 'Failed to void sale.' });
  }
});

export default router;

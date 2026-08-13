import { Router } from 'express';
import { loadDB, saveDB, generateUUID, logActivity } from '../store';
import { Supplier, SupplierLedger } from '../../types/pos';
import { recordJournalEntry } from './finance';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'));

router.get('/', (req, res) => {
  const db = loadDB();
  res.json(db.suppliers);
});

router.post('/', (req, res) => {
  const { name, companyName, phone, email, address, taxNumber } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'Supplier Name and Phone are required.' });
  }

  const db = loadDB();
  const newSupplier: Supplier = {
    id: generateUUID(),
    name,
    companyName,
    phone,
    email,
    address,
    taxNumber,
    outstandingBalance: 0,
    createdAt: new Date().toISOString(),
  };

  db.suppliers.unshift(newSupplier);
  saveDB();
  logActivity('system', 'User', 'Create Supplier', 'Suppliers', `Added supplier ${name}`);

  res.status(201).json(newSupplier);
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const db = loadDB();
  const index = db.suppliers.findIndex((s) => s.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Supplier not found.' });
  }

  db.suppliers[index] = {
    ...db.suppliers[index],
    ...req.body,
  };

  saveDB();
  res.json(db.suppliers[index]);
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const db = loadDB();
  const supplier = db.suppliers.find((s) => s.id === id);
  if (!supplier) {
    return res.status(404).json({ error: 'Supplier not found.' });
  }

  const hasPurchases = db.purchases?.some((p) => p.supplierId === id);
  if (hasPurchases) {
    return res.status(400).json({
      error: `Cannot delete supplier "${supplier.name}". They are referenced in recorded purchase order transactions. You can set their status to INACTIVE to archive them instead.`
    });
  }

  const hasProducts = db.products?.some((p) => p.supplierId === id);
  if (hasProducts) {
    return res.status(400).json({
      error: `Cannot delete supplier "${supplier.name}". They are linked to active products in your catalog. Please reassign the products first, or set supplier status to INACTIVE.`
    });
  }

  db.suppliers = db.suppliers.filter((s) => s.id !== id);
  saveDB();
  logActivity('system', 'User', 'Delete Supplier', 'Suppliers', `Deleted supplier ${supplier.name}`);
  res.json({ message: 'Supplier deleted successfully.' });
});

router.get('/ledger/:supplierId', (req, res) => {
  const { supplierId } = req.params;
  const db = loadDB();
  const ledger = (db.supplierLedgers || []).filter((l) => l.supplierId === supplierId);
  res.json(ledger);
});

router.post('/payment', (req, res) => {
  const { supplierId, amount, paymentMethod, referenceNo, notes } = req.body;
  if (!supplierId || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Supplier and valid payment amount are required.' });
  }

  const db = loadDB();
  const supplier = db.suppliers.find((s) => s.id === supplierId);
  if (!supplier) {
    return res.status(404).json({ error: 'Supplier not found.' });
  }

  const pmtVal = Number(amount);
  const newBalance = Math.max(0, (supplier.outstandingBalance || 0) - pmtVal);
  supplier.outstandingBalance = newBalance;

  const ref = referenceNo || 'SPAY-' + Date.now();
  const ledgerEntry: SupplierLedger = {
    id: generateUUID(),
    supplierId,
    type: 'PAYMENT',
    amount: pmtVal,
    balanceAfter: newBalance,
    referenceNo: ref,
    notes: notes || `Payment to Supplier via ${paymentMethod || 'Cash'}`,
    createdAt: new Date().toISOString(),
  };

  db.supplierLedgers = db.supplierLedgers || [];
  db.supplierLedgers.unshift(ledgerEntry);

  // Update target financial account balance
  const pmtMethod = (paymentMethod || 'CASH').toUpperCase();
  db.bankAccounts = db.bankAccounts || [];
  let account = db.bankAccounts.find((a) => (pmtMethod.includes('BANK') || pmtMethod.includes('CARD') ? a.accountType === 'BANK' : a.accountType === 'CASH')) || db.bankAccounts[0];
  if (account) {
    account.currentBalance -= pmtVal;
  }

  // Journal Entry: Debit Accounts Payable (2010), Credit Cash/Bank (1010)
  recordJournalEntry(
    `Supplier Payment to ${supplier.name}`,
    [
      { accountCode: '2010', accountName: 'Accounts Payable', debit: pmtVal, credit: 0 },
      { accountCode: '1010', accountName: account?.name || 'Cash / Bank', debit: 0, credit: pmtVal },
    ],
    'SUPPLIER_PAYMENT',
    ref,
    'Admin'
  );

  saveDB();
  res.json({ message: 'Supplier payment recorded successfully', supplier, ledgerEntry });
});

export default router;

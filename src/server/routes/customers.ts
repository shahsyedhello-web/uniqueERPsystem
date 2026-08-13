import { Router } from 'express';
import { loadDB, saveDB, generateUUID, logActivity } from '../store';
import { Customer, CustomerLedger } from '../../types/pos';
import { recordJournalEntry } from './finance';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', (req, res) => {
  const db = loadDB();
  res.json(db.customers);
});

router.post('/', (req, res) => {
  const { name, phone, email, address } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: 'Customer Name and Phone Number are required.' });
  }

  const db = loadDB();
  const existing = db.customers.find((c) => c.phone === phone);
  if (existing) {
    return res.status(400).json({ error: 'Customer phone already exists.' });
  }

  const newCustomer: Customer = {
    id: generateUUID(),
    name,
    phone,
    email,
    address,
    outstandingBalance: 0,
    loyaltyPoints: 0,
    createdAt: new Date().toISOString(),
  };

  db.customers.unshift(newCustomer);
  saveDB();
  logActivity('system', 'User', 'Create Customer', 'Customers', `Created customer ${name} (${phone})`);

  res.status(201).json(newCustomer);
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const db = loadDB();
  const index = db.customers.findIndex((c) => c.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Customer not found.' });
  }

  db.customers[index] = {
    ...db.customers[index],
    ...req.body,
  };

  saveDB();
  res.json(db.customers[index]);
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const db = loadDB();
  const customer = db.customers.find((c) => c.id === id);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found.' });
  }

  if (customer.outstandingBalance && customer.outstandingBalance > 0) {
    return res.status(400).json({
      error: `Cannot delete customer "${customer.name}". They have an active outstanding balance of Rs. ${customer.outstandingBalance.toLocaleString()}. Please receive payment to clear the balance first.`
    });
  }

  const hasSales = db.sales?.some((s) => s.customerId === id);
  const hasLedger = db.customerLedgers?.some((l) => l.customerId === id);

  if (hasSales || hasLedger) {
    return res.status(400).json({
      error: `Cannot delete customer "${customer.name}". They have recorded sales invoices or account ledger history. Customer records with transaction history are preserved for audit purposes.`
    });
  }

  db.customers = db.customers.filter((c) => c.id !== id);
  saveDB();
  logActivity('system', 'User', 'Delete Customer', 'Customers', `Deleted customer ${customer.name}`);
  res.json({ message: 'Customer deleted successfully.' });
});

router.get('/ledger/:customerId', (req, res) => {
  const { customerId } = req.params;
  const db = loadDB();
  const ledger = db.customerLedgers.filter((l) => l.customerId === customerId);
  res.json(ledger);
});

// Receive Payment from Credit Customer
router.post('/payment', (req, res) => {
  const { customerId, amount, paymentMethod, referenceNo, notes } = req.body;
  if (!customerId || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Customer and valid payment amount are required.' });
  }

  const db = loadDB();
  const customer = db.customers.find((c) => c.id === customerId);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found.' });
  }

  const pmtVal = Number(amount);
  const newBalance = Math.max(0, (customer.outstandingBalance || 0) - pmtVal);
  customer.outstandingBalance = newBalance;

  const ref = referenceNo || 'PAY-' + Date.now();
  const ledgerEntry: CustomerLedger = {
    id: generateUUID(),
    customerId,
    type: 'PAYMENT',
    amount: pmtVal,
    balanceAfter: newBalance,
    referenceNo: ref,
    notes: notes || `Credit Payment received via ${paymentMethod || 'Cash'}`,
    createdAt: new Date().toISOString(),
  };

  db.customerLedgers.unshift(ledgerEntry);

  // Update target financial account
  const pmtMethod = (paymentMethod || 'CASH').toUpperCase();
  db.bankAccounts = db.bankAccounts || [];
  let account = db.bankAccounts.find((a) => (pmtMethod.includes('BANK') || pmtMethod.includes('CARD') ? a.accountType === 'BANK' : a.accountType === 'CASH')) || db.bankAccounts[0];
  if (account) {
    account.currentBalance += pmtVal;
  }

  // Journal Entry: Debit Cash/Bank (1010), Credit Accounts Receivable (1040)
  recordJournalEntry(
    `Customer Payment Received from ${customer.name}`,
    [
      { accountCode: '1010', accountName: account?.name || 'Cash / Bank', debit: pmtVal, credit: 0 },
      { accountCode: '1040', accountName: 'Accounts Receivable', debit: 0, credit: pmtVal },
    ],
    'CUSTOMER_PAYMENT',
    ref,
    'Admin'
  );

  saveDB();

  res.json({ message: 'Payment recorded successfully', customer, ledgerEntry });
});

export default router;

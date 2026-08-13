import { Router } from 'express';
import { loadDB, saveDB, generateUUID, logActivity } from '../store';
import { Expense } from '../../types/pos';
import { recordJournalEntry } from './finance';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN'));

router.get('/', (req, res) => {
  const db = loadDB();
  res.json(db.expenses);
});

router.post('/', (req, res) => {
  const { category, title, amount, paymentMethod, accountId, referenceNo, notes, createdByName } = req.body;
  if (!category || !title || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Category, title, and valid amount required.' });
  }

  const db = loadDB();
  const expVal = Number(amount);
  const pmtMethod = (paymentMethod || 'CASH').toUpperCase();

  const newExpense: Expense = {
    id: generateUUID(),
    category,
    title,
    amount: expVal,
    paymentMethod: pmtMethod,
    referenceNo,
    notes,
    createdByName: createdByName || 'Admin',
    createdAt: new Date().toISOString(),
  };

  db.expenses.unshift(newExpense);

  // Update target financial account
  db.bankAccounts = db.bankAccounts || [];
  let account = db.bankAccounts.find((a) => a.id === accountId);
  if (!account) {
    account = db.bankAccounts.find((a) => (pmtMethod.includes('BANK') || pmtMethod.includes('CARD') ? a.accountType === 'BANK' : a.accountType === 'CASH')) || db.bankAccounts[0];
  }
  if (account) {
    account.currentBalance -= expVal;
  }

  // If paid in cash from current active register shift, record in active shift
  if (pmtMethod === 'CASH') {
    db.cashShifts = db.cashShifts || [];
    const activeShift = db.cashShifts.find((s) => s.status === 'OPEN');
    if (activeShift) {
      activeShift.paidOut = (activeShift.paidOut || 0) + expVal;

      db.cashDrawerTransactions = db.cashDrawerTransactions || [];
      db.cashDrawerTransactions.unshift({
        id: generateUUID(),
        shiftId: activeShift.id,
        registerId: activeShift.registerId || 'reg-001',
        type: 'CASH_EXPENSE',
        amount: expVal,
        reason: `Expense: ${title} (${category})`,
        referenceNo: referenceNo || newExpense.id,
        userId: activeShift.cashierId,
        userName: createdByName || activeShift.cashierName,
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Journal Entry
  // Map category to expense account code
  let expenseAccountCode = '6040'; // General
  if (category.toLowerCase().includes('rent')) expenseAccountCode = '6010';
  else if (category.toLowerCase().includes('salary') || category.toLowerCase().includes('payroll')) expenseAccountCode = '6020';
  else if (category.toLowerCase().includes('utility') || category.toLowerCase().includes('electricity')) expenseAccountCode = '6030';

  recordJournalEntry(
    `Expense: ${title} (${category})`,
    [
      { accountCode: expenseAccountCode, accountName: category || 'Operating Expense', debit: expVal, credit: 0 },
      { accountCode: '1010', accountName: account?.name || 'Cash / Bank', debit: 0, credit: expVal },
    ],
    'EXPENSE',
    referenceNo || newExpense.id,
    createdByName || 'Admin'
  );

  saveDB();
  logActivity('system', createdByName || 'User', 'Create Expense', 'Expenses', `Added expense ${title} (${amount} PKR)`);

  res.status(201).json(newExpense);
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const db = loadDB();
  const index = db.expenses.findIndex((e) => e.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Expense not found.' });
  }

  const existing = db.expenses[index];
  db.expenses[index] = {
    ...existing,
    ...req.body,
    amount: req.body.amount !== undefined ? Number(req.body.amount) : existing.amount,
  };

  saveDB();
  res.json(db.expenses[index]);
});

router.post('/:id/approve', (req, res) => {
  const { id } = req.params;
  const db = loadDB();
  const exp = db.expenses.find((e) => e.id === id);
  if (!exp) return res.status(404).json({ error: 'Expense not found.' });

  exp.notes = (exp.notes ? exp.notes + ' | ' : '') + 'Approved by Management';
  saveDB();
  res.json({ message: 'Expense approved successfully', expense: exp });
});

router.post('/:id/reverse', (req, res) => {
  const { id } = req.params;
  const { reason, reversedBy } = req.body;
  const db = loadDB();
  const exp = db.expenses.find((e) => e.id === id);

  if (!exp) return res.status(404).json({ error: 'Expense not found.' });

  const expVal = exp.amount;

  // Restore bank account balance
  db.bankAccounts = db.bankAccounts || [];
  const account = db.bankAccounts.find((a) => (exp.paymentMethod?.includes('BANK') || exp.paymentMethod?.includes('CARD') ? a.accountType === 'BANK' : a.accountType === 'CASH')) || db.bankAccounts[0];
  if (account) {
    account.currentBalance += expVal;
  }

  // Reversal Journal Entry: Debit Cash (1010), Credit Expense (6040)
  let expenseAccountCode = '6040';
  if (exp.category.toLowerCase().includes('rent')) expenseAccountCode = '6010';
  else if (exp.category.toLowerCase().includes('salary')) expenseAccountCode = '6020';
  else if (exp.category.toLowerCase().includes('utility')) expenseAccountCode = '6030';

  recordJournalEntry(
    `Expense Reversal: ${exp.title} (${reason || 'Manager Reversal'})`,
    [
      { accountCode: '1010', accountName: account?.name || 'Cash / Bank', debit: expVal, credit: 0 },
      { accountCode: expenseAccountCode, accountName: exp.category || 'Operating Expense', debit: 0, credit: expVal },
    ],
    'EXPENSE',
    'REV-' + exp.id,
    reversedBy || 'Admin'
  );

  exp.notes = (exp.notes ? exp.notes + ' | ' : '') + `REVERSED: ${reason || 'Cancelled'}`;
  saveDB();

  logActivity('system', reversedBy || 'User', 'Reverse Expense', 'Expenses', `Reversed expense ${exp.title} (${expVal} PKR)`);

  res.json({ message: 'Expense reversed successfully', expense: exp });
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const db = loadDB();
  db.expenses = db.expenses.filter((e) => e.id !== id);
  saveDB();
  res.json({ message: 'Expense deleted.' });
});

export default router;

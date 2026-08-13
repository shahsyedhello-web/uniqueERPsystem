import { Router } from 'express';
import { loadDB, saveDB, generateUUID, logActivity } from '../store';
import {
  CashRegister,
  CashShift,
  CashDrawerTransaction,
  BankAccount,
  ChartAccount,
  JournalEntry,
  AccountTransfer,
  BankReconciliation,
  CustomerLedger,
  SupplierLedger,
} from '../../types/pos';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

// Apply auth middleware to all finance endpoints
router.use(authenticate);

// Restrict all accounting, GL, accounts, and financial reports to SUPER_ADMIN and ADMIN
router.use((req: AuthRequest, res, next) => {
  const isShiftOrRegisterRoute =
    req.path.startsWith('/registers') ||
    req.path.startsWith('/shifts');

  if (isShiftOrRegisterRoute) {
    return next();
  }

  return requireRole('SUPER_ADMIN', 'ADMIN')(req, res, next);
});

// Helper to record double entry journal
export function recordJournalEntry(
  description: string,
  items: { accountCode: string; accountName: string; debit: number; credit: number; notes?: string }[],
  referenceType?: 'SALE' | 'PURCHASE' | 'EXPENSE' | 'TRANSFER' | 'CUSTOMER_PAYMENT' | 'SUPPLIER_PAYMENT' | 'MANUAL',
  referenceNo?: string,
  createdBy: string = 'System'
) {
  const db = loadDB();
  db.journalEntries = db.journalEntries || [];
  db.chartAccounts = db.chartAccounts || [];

  let totalDebit = 0;
  let totalCredit = 0;

  const entryItems = items.map((i) => {
    totalDebit += Number(i.debit) || 0;
    totalCredit += Number(i.credit) || 0;

    // Update balance in Chart of Accounts
    const chartAcc = db.chartAccounts!.find((a) => a.accountCode === i.accountCode);
    if (chartAcc) {
      if (chartAcc.category === 'ASSET' || chartAcc.category === 'EXPENSE' || chartAcc.category === 'COGS') {
        chartAcc.balance += (i.debit - i.credit);
      } else {
        chartAcc.balance += (i.credit - i.debit);
      }
    }

    return {
      id: generateUUID(),
      accountId: i.accountCode,
      accountName: i.accountName,
      debit: Number(i.debit) || 0,
      credit: Number(i.credit) || 0,
      notes: i.notes || '',
    };
  });

  const entryNo = 'JE-' + Math.floor(100000 + Math.random() * 900000);
  const entry: JournalEntry = {
    id: generateUUID(),
    entryNo,
    date: new Date().toISOString(),
    referenceType,
    referenceNo,
    description,
    items: entryItems,
    totalDebit,
    totalCredit,
    createdBy,
    createdAt: new Date().toISOString(),
  };

  db.journalEntries.unshift(entry);
  saveDB();
  return entry;
}

// ----------------------------------------------------
// REGISTERS & SHIFTS
// ----------------------------------------------------

router.get('/registers', (req, res) => {
  const db = loadDB();
  res.json(db.registers || []);
});

router.post('/registers', requireRole('SUPER_ADMIN', 'ADMIN'), (req: AuthRequest, res) => {
  const { name, registerNo, branchId, counterId } = req.body;
  if (!name) return res.status(400).json({ error: 'Register Name is required.' });

  const db = loadDB();
  db.registers = db.registers || [];

  const branch = (db.branches || []).find((b) => b.id === branchId) || (db.branches || [])[0];

  const newReg: CashRegister = {
    id: generateUUID(),
    registerNo: registerNo || 'REG-' + (db.registers.length + 1).toString().padStart(3, '0'),
    name: name.trim(),
    branchId: branch?.id || 'branch-head-office',
    branchName: branch?.branchName || 'Head Office',
    counterId: counterId || 'counter-01',
    status: 'CLOSED',
    createdAt: new Date().toISOString(),
  };

  db.registers.push(newReg);
  saveDB();
  logActivity(req.user?.userId || 'system', req.user?.name || 'User', 'Create Register', 'Finance', `Created cash register ${newReg.name} (${newReg.registerNo})`);
  res.status(201).json(newReg);
});

router.get('/shifts', (req: AuthRequest, res) => {
  const db = loadDB();
  res.json(db.cashShifts || []);
});

router.get('/shifts/active', (req: AuthRequest, res) => {
  const db = loadDB();
  const { cashierId, registerId } = req.query;

  const active = (db.cashShifts || []).find((s) => {
    if (s.status !== 'OPEN') return false;
    if (registerId && s.registerId !== registerId) return false;
    if (cashierId && s.cashierId !== cashierId) return false;
    return true;
  });

  res.json(active || null);
});

router.post('/shifts/open', (req: AuthRequest, res) => {
  const { registerId, cashierId, cashierName, openingCash, openingDenominations, counterId, branchId, notes } = req.body;

  if (openingCash === undefined || isNaN(Number(openingCash)) || Number(openingCash) < 0) {
    return res.status(400).json({ error: 'Valid Opening Cash float amount is required.' });
  }

  // Cashier register binding security check
  if (req.user?.role === 'CASHIER' && req.user?.registerId && registerId && req.user.registerId !== registerId) {
    return res.status(403).json({ error: `Access Denied: You are restricted to operating your assigned register (${req.user.registerId}).` });
  }

  const db = loadDB();
  db.cashShifts = db.cashShifts || [];
  db.registers = db.registers || [];

  const reg = db.registers.find((r) => r.id === registerId) || db.registers[0];

  // Check if register already open
  const existingOpen = db.cashShifts.find((s) => s.registerId === reg.id && s.status === 'OPEN');
  if (existingOpen) {
    return res.status(400).json({ error: `Register ${reg.name} is already OPEN in shift ${existingOpen.shiftNo || existingOpen.id}.` });
  }

  const shiftNo = 'SHIFT-' + Math.floor(100000 + Math.random() * 900000);
  const openFloat = Number(openingCash);

  const newShift: CashShift = {
    id: generateUUID(),
    shiftNo,
    registerId: reg.id,
    registerName: reg.name,
    branchId: branchId || reg.branchId,
    cashierId: cashierId || 'user-cashier',
    cashierName: cashierName || 'Cashier',
    counterId: counterId || reg.counterId || 'counter-01',
    startTime: new Date().toISOString(),
    openingCash: openFloat,
    openingDenominations: openingDenominations || {},
    cashSales: 0,
    cardSales: 0,
    mobileSales: 0,
    jazzCashSales: 0,
    easyPaisaSales: 0,
    bankSales: 0,
    creditSales: 0,
    totalSales: 0,
    paidIn: 0,
    paidOut: 0,
    cashRefunds: 0,
    status: 'OPEN',
    notes: notes || 'Shift opened',
    createdAt: new Date().toISOString(),
  };

  reg.status = 'OPEN';
  reg.activeShiftId = newShift.id;
  db.cashShifts.unshift(newShift);

  // Record Paid In for initial float
  db.cashDrawerTransactions = db.cashDrawerTransactions || [];
  db.cashDrawerTransactions.unshift({
    id: generateUUID(),
    shiftId: newShift.id,
    registerId: reg.id,
    type: 'PAID_IN',
    amount: openFloat,
    reason: 'Opening Cash Float',
    userId: newShift.cashierId,
    userName: newShift.cashierName,
    createdAt: new Date().toISOString(),
  });

  saveDB();
  logActivity(newShift.cashierId, newShift.cashierName, 'Open Register Shift', 'Finance', `Opened shift ${shiftNo} on ${reg.name} with float Rs. ${openFloat}`);

  res.status(201).json(newShift);
});

router.post('/shifts/close', (req, res) => {
  const { shiftId, actualCash, varianceReason, notes, closedBy } = req.body;

  if (actualCash === undefined || isNaN(Number(actualCash)) || Number(actualCash) < 0) {
    return res.status(400).json({ error: 'Actual Cash counted amount is required to close register.' });
  }

  const db = loadDB();
  db.cashShifts = db.cashShifts || [];
  db.registers = db.registers || [];

  const shiftIndex = db.cashShifts.findIndex((s) => s.id === shiftId);
  if (shiftIndex === -1) {
    return res.status(404).json({ error: 'Shift session not found.' });
  }

  const shift = db.cashShifts[shiftIndex];
  if (shift.status === 'CLOSED') {
    return res.status(400).json({ error: 'Shift session is already CLOSED.' });
  }

  const counted = Number(actualCash);

  // Expected Cash = Opening Float + Cash Sales + Paid In - Paid Out - Cash Refunds
  const expected = (shift.openingCash || 0) + (shift.cashSales || 0) + (shift.paidIn || 0) - (shift.paidOut || 0) - (shift.cashRefunds || 0);
  const variance = counted - expected;

  shift.closingCash = counted;
  shift.actualCash = counted;
  shift.expectedCash = expected;
  shift.variance = variance;
  shift.varianceReason = varianceReason || (variance !== 0 ? 'Cash count variance recorded' : 'Balanced');
  shift.endTime = new Date().toISOString();
  shift.status = 'CLOSED';
  shift.closedBy = closedBy || shift.cashierName;
  if (notes) shift.notes = (shift.notes ? shift.notes + ' | ' : '') + notes;

  // Close Register
  const reg = db.registers.find((r) => r.id === shift.registerId);
  if (reg) {
    reg.status = 'CLOSED';
    reg.activeShiftId = undefined;
  }

  saveDB();
  logActivity(shift.cashierId, shift.cashierName, 'Close Register Shift', 'Finance', `Closed shift ${shift.shiftNo || shift.id}. Expected: Rs. ${expected}, Actual: Rs. ${counted}, Variance: Rs. ${variance}`);

  res.json({
    message: 'Register shift closed successfully.',
    shift,
    zReport: {
      shiftNo: shift.shiftNo || shift.id,
      cashierName: shift.cashierName,
      registerName: shift.registerName || 'Main Register',
      startTime: shift.startTime,
      endTime: shift.endTime,
      openingCash: shift.openingCash,
      grossSales: shift.totalSales,
      cashSales: shift.cashSales,
      cardSales: shift.cardSales,
      jazzCashSales: shift.jazzCashSales || 0,
      easyPaisaSales: shift.easyPaisaSales || 0,
      bankSales: shift.bankSales || 0,
      creditSales: shift.creditSales,
      paidIn: shift.paidIn || 0,
      paidOut: shift.paidOut || 0,
      cashRefunds: shift.cashRefunds || 0,
      expectedCash: expected,
      actualCash: counted,
      variance,
      varianceReason: shift.varianceReason,
    },
  });
});

router.post('/shifts/drawer-transaction', (req, res) => {
  const { shiftId, type, amount, reason, referenceNo, userId, userName } = req.body;

  if (!shiftId) return res.status(400).json({ error: 'Active shift ID is required.' });
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Valid transaction amount (> 0) is required.' });
  }
  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'Reason for cash movement is required.' });
  }

  const db = loadDB();
  db.cashShifts = db.cashShifts || [];
  db.cashDrawerTransactions = db.cashDrawerTransactions || [];

  const shift = db.cashShifts.find((s) => s.id === shiftId);
  if (!shift || shift.status !== 'OPEN') {
    return res.status(400).json({ error: 'Register shift is not OPEN.' });
  }

  const txAmount = Number(amount);
  const txType = type as CashDrawerTransaction['type'];

  if (txType === 'PAID_IN') {
    shift.paidIn = (shift.paidIn || 0) + txAmount;
  } else if (txType === 'PAID_OUT' || txType === 'SAFE_DROP' || txType === 'CASH_PICKUP' || txType === 'CASH_EXPENSE') {
    shift.paidOut = (shift.paidOut || 0) + txAmount;
  }

  const drawerTx: CashDrawerTransaction = {
    id: generateUUID(),
    shiftId,
    registerId: shift.registerId || 'reg-001',
    type: txType,
    amount: txAmount,
    reason: reason.trim(),
    referenceNo,
    userId: userId || shift.cashierId,
    userName: userName || shift.cashierName,
    createdAt: new Date().toISOString(),
  };

  db.cashDrawerTransactions.unshift(drawerTx);
  saveDB();

  logActivity(drawerTx.userId, drawerTx.userName, `Cash Drawer Movement (${txType})`, 'Finance', `Recorded ${txType} of Rs. ${txAmount} in shift ${shift.shiftNo || shift.id}: ${reason}`);

  res.status(201).json({ message: 'Cash drawer transaction recorded.', transaction: drawerTx, updatedShift: shift });
});

// ----------------------------------------------------
// FINANCIAL ACCOUNTS & WALLETS (Restricted to SUPER_ADMIN and ADMIN)
// ----------------------------------------------------

router.use(
  ['/accounts', '/journal', '/chart-accounts', '/transfers', '/reconciliation', '/trial-balance', '/balance-sheet', '/profit-loss'],
  requireRole('SUPER_ADMIN', 'ADMIN')
);

router.get('/accounts', (req, res) => {
  const db = loadDB();
  res.json(db.bankAccounts || []);
});

router.post('/accounts', (req, res) => {
  const { id, accountType, name, accountNumber, accountTitle, bankName, branchName, iban, openingBalance, status, notes } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Account Name is required.' });
  }

  const db = loadDB();
  db.bankAccounts = db.bankAccounts || [];

  if (id) {
    const existing = db.bankAccounts.find((a) => a.id === id);
    if (!existing) return res.status(404).json({ error: 'Account not found.' });

    existing.name = name.trim();
    existing.accountType = accountType || existing.accountType;
    existing.accountNumber = accountNumber || '';
    existing.accountTitle = accountTitle || '';
    existing.bankName = bankName || '';
    existing.branchName = branchName || '';
    existing.iban = iban || '';
    existing.status = status || existing.status;
    existing.notes = notes || '';

    saveDB();
    return res.json(existing);
  }

  const openBal = Number(openingBalance) || 0;
  const newAcc: BankAccount = {
    id: generateUUID(),
    accountType: accountType || 'BANK',
    name: name.trim(),
    accountNumber: accountNumber || '',
    accountTitle: accountTitle || '',
    bankName: bankName || '',
    branchName: branchName || '',
    iban: iban || '',
    openingBalance: openBal,
    currentBalance: openBal,
    status: status || 'ACTIVE',
    notes: notes || '',
    createdAt: new Date().toISOString(),
  };

  db.bankAccounts.push(newAcc);
  saveDB();
  logActivity('system', 'User', 'Create Financial Account', 'Finance', `Created ${newAcc.accountType} account: ${newAcc.name}`);
  res.status(201).json(newAcc);
});

router.delete('/accounts/:id', (req, res) => {
  const { id } = req.params;
  const db = loadDB();
  db.bankAccounts = db.bankAccounts || [];

  const idx = db.bankAccounts.findIndex((a) => a.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Account not found.' });

  // Soft deactivate instead of hard delete to preserve financial history
  db.bankAccounts[idx].status = 'INACTIVE';
  saveDB();
  res.json({ message: 'Account set to INACTIVE status.' });
});

// ----------------------------------------------------
// CHART OF ACCOUNTS & JOURNALS
// ----------------------------------------------------

router.get('/chart-of-accounts', (req, res) => {
  const db = loadDB();
  res.json(db.chartAccounts || []);
});

router.post('/chart-of-accounts', (req, res) => {
  const { accountCode, accountName, category, subCategory } = req.body;

  if (!accountCode || !accountName || !category) {
    return res.status(400).json({ error: 'Account Code, Name, and Category are required.' });
  }

  const db = loadDB();
  db.chartAccounts = db.chartAccounts || [];

  const duplicate = db.chartAccounts.find((a) => a.accountCode === accountCode.trim());
  if (duplicate) {
    return res.status(400).json({ error: `Account code "${accountCode}" already exists.` });
  }

  const newAcc: ChartAccount = {
    id: generateUUID(),
    accountCode: accountCode.trim(),
    accountName: accountName.trim(),
    category,
    subCategory: subCategory || '',
    balance: 0,
    isSystem: false,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };

  db.chartAccounts.push(newAcc);
  saveDB();
  res.status(201).json(newAcc);
});

router.get('/journal-entries', (req, res) => {
  const db = loadDB();
  res.json(db.journalEntries || []);
});

router.post('/journal-entries', (req, res) => {
  const { description, items, referenceType, referenceNo, createdBy } = req.body;

  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'Journal description is required.' });
  }
  if (!items || !Array.isArray(items) || items.length < 2) {
    return res.status(400).json({ error: 'Journal entry must contain at least 2 line items.' });
  }

  let sumDebit = 0;
  let sumCredit = 0;

  for (const item of items) {
    sumDebit += Number(item.debit) || 0;
    sumCredit += Number(item.credit) || 0;
  }

  if (Math.abs(sumDebit - sumCredit) > 0.01) {
    return res.status(400).json({
      error: `Unbalanced journal entry! Total Debit (Rs. ${sumDebit}) must equal Total Credit (Rs. ${sumCredit}).`,
    });
  }

  const entry = recordJournalEntry(description, items, referenceType || 'MANUAL', referenceNo, createdBy || 'User');
  res.status(201).json(entry);
});

// ----------------------------------------------------
// MONEY TRANSFERS & RECONCILIATIONS
// ----------------------------------------------------

router.get('/transfers', (req, res) => {
  const db = loadDB();
  res.json(db.accountTransfers || []);
});

router.post('/transfers', (req, res) => {
  const { fromAccountId, toAccountId, amount, referenceNo, notes, createdBy } = req.body;

  if (!fromAccountId || !toAccountId) {
    return res.status(400).json({ error: 'Both From and To accounts must be selected.' });
  }
  if (fromAccountId === toAccountId) {
    return res.status(400).json({ error: 'Source and Destination accounts cannot be the same.' });
  }
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Valid transfer amount (> 0) is required.' });
  }

  const db = loadDB();
  db.bankAccounts = db.bankAccounts || [];
  db.accountTransfers = db.accountTransfers || [];

  const fromAcc = db.bankAccounts.find((a) => a.id === fromAccountId);
  const toAcc = db.bankAccounts.find((a) => a.id === toAccountId);

  if (!fromAcc || !toAcc) {
    return res.status(400).json({ error: 'Selected financial accounts not found.' });
  }

  const transferVal = Number(amount);

  // Instantly update balances
  fromAcc.currentBalance -= transferVal;
  toAcc.currentBalance += transferVal;

  const transferNo = 'TRF-' + Math.floor(100000 + Math.random() * 900000);
  const newTransfer: AccountTransfer = {
    id: generateUUID(),
    transferNo,
    fromAccountId: fromAcc.id,
    fromAccountName: fromAcc.name,
    toAccountId: toAcc.id,
    toAccountName: toAcc.name,
    amount: transferVal,
    date: new Date().toISOString(),
    referenceNo,
    notes: notes || '',
    createdBy: createdBy || 'User',
    createdAt: new Date().toISOString(),
  };

  db.accountTransfers.unshift(newTransfer);

  // Post Double Entry Journal
  recordJournalEntry(
    `Transfer from ${fromAcc.name} to ${toAcc.name}`,
    [
      { accountCode: '1020', accountName: toAcc.name, debit: transferVal, credit: 0 },
      { accountCode: '1020', accountName: fromAcc.name, debit: 0, credit: transferVal },
    ],
    'TRANSFER',
    transferNo,
    createdBy
  );

  saveDB();
  logActivity(createdBy || 'system', 'User', 'Account Transfer', 'Finance', `Transferred Rs. ${transferVal} from ${fromAcc.name} to ${toAcc.name}`);

  res.status(201).json({ message: 'Transfer completed successfully.', transfer: newTransfer });
});

router.post('/reconciliations', (req, res) => {
  const { accountId, statementBalance, notes, reconciledBy } = req.body;

  if (!accountId || statementBalance === undefined) {
    return res.status(400).json({ error: 'Account ID and Statement Balance are required.' });
  }

  const db = loadDB();
  db.bankAccounts = db.bankAccounts || [];
  db.reconciliations = db.reconciliations || [];

  const acc = db.bankAccounts.find((a) => a.id === accountId);
  if (!acc) return res.status(404).json({ error: 'Financial account not found.' });

  const stmtBal = Number(statementBalance);
  const bookBal = acc.currentBalance;
  const diff = stmtBal - bookBal;

  const recon: BankReconciliation = {
    id: generateUUID(),
    accountId: acc.id,
    accountName: acc.name,
    statementDate: new Date().toISOString(),
    statementBalance: stmtBal,
    bookBalance: bookBal,
    difference: diff,
    status: Math.abs(diff) < 0.01 ? 'MATCHED' : 'DISCREPANCY',
    reconciledBy: reconciledBy || 'User',
    notes: notes || (Math.abs(diff) < 0.01 ? 'Statement matches book balance' : `Variance of Rs. ${diff} detected`),
    createdAt: new Date().toISOString(),
  };

  db.reconciliations.unshift(recon);
  saveDB();

  res.status(201).json(recon);
});

// ----------------------------------------------------
// CUSTOMER & SUPPLIER PAYMENTS
// ----------------------------------------------------

router.post('/customer-payments', (req, res) => {
  const { customerId, amount, targetAccountId, referenceNo, notes, receivedBy } = req.body;

  if (!customerId || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Customer ID and valid payment amount (> 0) are required.' });
  }

  const db = loadDB();
  db.customers = db.customers || [];
  db.customerLedgers = db.customerLedgers || [];
  db.bankAccounts = db.bankAccounts || [];

  const cust = db.customers.find((c) => c.id === customerId);
  if (!cust) return res.status(404).json({ error: 'Customer not found.' });

  const pmtAmount = Number(amount);
  cust.outstandingBalance = Math.max(0, (cust.outstandingBalance || 0) - pmtAmount);

  // Update target financial account
  const account = db.bankAccounts.find((a) => a.id === targetAccountId) || db.bankAccounts[0];
  if (account) {
    account.currentBalance += pmtAmount;
  }

  const refNo = referenceNo || 'CPMT-' + Math.floor(100000 + Math.random() * 900000);
  const ledger: CustomerLedger = {
    id: generateUUID(),
    customerId: cust.id,
    type: 'PAYMENT',
    amount: pmtAmount,
    balanceAfter: cust.outstandingBalance,
    referenceNo: refNo,
    notes: notes || `Payment received via ${account?.name || 'Cash/Bank'}`,
    createdAt: new Date().toISOString(),
  };

  db.customerLedgers.unshift(ledger);

  // Journal Entry
  recordJournalEntry(
    `Payment received from Customer: ${cust.name}`,
    [
      { accountCode: '1010', accountName: account?.name || 'Cash/Bank', debit: pmtAmount, credit: 0 },
      { accountCode: '1040', accountName: 'Accounts Receivable', debit: 0, credit: pmtAmount },
    ],
    'CUSTOMER_PAYMENT',
    refNo,
    receivedBy || 'User'
  );

  saveDB();
  logActivity(receivedBy || 'system', 'User', 'Receive Customer Payment', 'Finance', `Received Rs. ${pmtAmount} from ${cust.name}`);

  res.status(201).json({ message: 'Customer payment processed successfully.', newBalance: cust.outstandingBalance, ledger });
});

router.post('/supplier-payments', (req, res) => {
  const { supplierId, amount, sourceAccountId, referenceNo, notes, paidBy } = req.body;

  if (!supplierId || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Supplier ID and valid payment amount (> 0) are required.' });
  }

  const db = loadDB();
  db.suppliers = db.suppliers || [];
  db.supplierLedgers = db.supplierLedgers || [];
  db.bankAccounts = db.bankAccounts || [];

  const supp = db.suppliers.find((s) => s.id === supplierId);
  if (!supp) return res.status(404).json({ error: 'Supplier not found.' });

  const pmtAmount = Number(amount);
  supp.outstandingBalance = Math.max(0, (supp.outstandingBalance || 0) - pmtAmount);

  // Deduct from source financial account
  const account = db.bankAccounts.find((a) => a.id === sourceAccountId) || db.bankAccounts[0];
  if (account) {
    account.currentBalance -= pmtAmount;
  }

  const refNo = referenceNo || 'SPMT-' + Math.floor(100000 + Math.random() * 900000);
  const ledger: SupplierLedger = {
    id: generateUUID(),
    supplierId: supp.id,
    type: 'PAYMENT',
    amount: pmtAmount,
    balanceAfter: supp.outstandingBalance,
    referenceNo: refNo,
    notes: notes || `Paid to supplier via ${account?.name || 'Cash/Bank'}`,
    createdAt: new Date().toISOString(),
  };

  db.supplierLedgers.unshift(ledger);

  // Journal Entry
  recordJournalEntry(
    `Payment to Supplier: ${supp.name}`,
    [
      { accountCode: '2010', accountName: 'Accounts Payable', debit: pmtAmount, credit: 0 },
      { accountCode: '1010', accountName: account?.name || 'Cash/Bank', debit: 0, credit: pmtAmount },
    ],
    'SUPPLIER_PAYMENT',
    refNo,
    paidBy || 'User'
  );

  saveDB();
  logActivity(paidBy || 'system', 'User', 'Pay Supplier', 'Finance', `Paid Rs. ${pmtAmount} to supplier ${supp.name}`);

  res.status(201).json({ message: 'Supplier payment recorded successfully.', newBalance: supp.outstandingBalance, ledger });
});

export default router;

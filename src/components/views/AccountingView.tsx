import React, { useState, useEffect } from 'react';
import {
  Landmark,
  Wallet,
  Building2,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  Plus,
  RefreshCw,
  Printer,
  FileText,
  Lock,
  Unlock,
  Scale,
  CreditCard,
  History,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertCircle,
  X,
  Search,
  BookOpen,
} from 'lucide-react';
import {
  BankAccount,
  ChartAccount,
  JournalEntry,
  CashShift,
  CashRegister,
  AccountTransfer,
  Customer,
  Supplier,
} from '../../types/pos';

export const AccountingView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'registers' | 'accounts' | 'chart' | 'journals' | 'transfers' | 'reports'>('registers');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Data states
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [shifts, setShifts] = useState<CashShift[]>([]);
  const [activeShift, setActiveShift] = useState<CashShift | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [chartAccounts, setChartAccounts] = useState<ChartAccount[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [transfers, setTransfers] = useState<AccountTransfer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Modals
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [showDrawerTxModal, setShowDrawerTxModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showChartModal, setShowChartModal] = useState(false);
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [showZReportModal, setShowZReportModal] = useState<CashShift | null>(null);

  // Form states
  const [openFloat, setOpenFloat] = useState('');
  const [shiftNotes, setShiftNotes] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [varianceReason, setVarianceReason] = useState('');
  
  const [drawerTxType, setDrawerTxType] = useState<'PAID_IN' | 'PAID_OUT' | 'SAFE_DROP'>('PAID_IN');
  const [drawerTxAmount, setDrawerTxAmount] = useState('');
  const [drawerTxReason, setDrawerTxReason] = useState('');

  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<'BANK' | 'MOBILE_WALLET' | 'CASH'>('BANK');
  const [accNumber, setAccNumber] = useState('');
  const [accTitle, setAccTitle] = useState('');
  const [bankName, setBankName] = useState('');
  const [openBalance, setOpenBalance] = useState('0');

  const [trfFrom, setTrfFrom] = useState('');
  const [trfTo, setTrfTo] = useState('');
  const [trfAmount, setTrfAmount] = useState('');
  const [trfNotes, setTrfNotes] = useState('');

  const [coaCode, setCoaCode] = useState('');
  const [coaName, setCoaName] = useState('');
  const [coaCategory, setCoaCategory] = useState<'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'>('ASSET');

  const [journalDesc, setJournalDesc] = useState('');
  const [journalRows, setJournalRows] = useState<{ accountCode: string; accountName: string; debit: string; credit: string }[]>([
    { accountCode: '1010', accountName: 'Cash in Hand', debit: '0', credit: '0' },
    { accountCode: '4010', accountName: 'Sales Revenue', debit: '0', credit: '0' },
  ]);

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [regRes, shiftRes, actShiftRes, accRes, coaRes, jeRes, trfRes, custRes, suppRes] = await Promise.all([
        fetch('/api/finance/registers'),
        fetch('/api/finance/shifts'),
        fetch('/api/finance/shifts/active'),
        fetch('/api/finance/accounts'),
        fetch('/api/finance/chart-of-accounts'),
        fetch('/api/finance/journal-entries'),
        fetch('/api/finance/transfers'),
        fetch('/api/customers'),
        fetch('/api/suppliers'),
      ]);

      if (regRes.ok) setRegisters(await regRes.json());
      if (shiftRes.ok) setShifts(await shiftRes.json());
      if (actShiftRes.ok) setActiveShift(await actShiftRes.json());
      if (accRes.ok) setAccounts(await accRes.json());
      if (coaRes.ok) setChartAccounts(await coaRes.json());
      if (jeRes.ok) setJournals(await jeRes.json());
      if (trfRes.ok) setTransfers(await trfRes.json());
      if (custRes.ok) setCustomers(await custRes.json());
      if (suppRes.ok) setSuppliers(await suppRes.json());
    } catch (err) {
      console.error('Failed to load financial records:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openFloat || isNaN(Number(openFloat)) || Number(openFloat) < 0) {
      setMessage({ type: 'error', text: 'Enter a valid opening cash float amount.' });
      return;
    }

    try {
      const res = await fetch('/api/finance/shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registerId: registers[0]?.id || 'reg-001',
          cashierName: 'Admin Cashier',
          openingCash: Number(openFloat),
          notes: shiftNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to open register.');

      setMessage({ type: 'success', text: `Register shift ${data.shiftNo} opened successfully.` });
      setShowOpenShiftModal(false);
      setOpenFloat('');
      setShiftNotes('');
      fetchAllData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;
    if (!actualCash || isNaN(Number(actualCash)) || Number(actualCash) < 0) {
      setMessage({ type: 'error', text: 'Enter the actual physical cash count.' });
      return;
    }

    try {
      const res = await fetch('/api/finance/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId: activeShift.id,
          actualCash: Number(actualCash),
          varianceReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to close register.');

      setMessage({ type: 'success', text: 'Register shift closed cleanly and Z-Report generated.' });
      setShowCloseShiftModal(false);
      setShowZReportModal(data.shift);
      setActualCash('');
      setVarianceReason('');
      fetchAllData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleDrawerTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) {
      setMessage({ type: 'error', text: 'No active open shift found for this register.' });
      return;
    }

    try {
      const res = await fetch('/api/finance/shifts/drawer-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId: activeShift.id,
          type: drawerTxType,
          amount: Number(drawerTxAmount),
          reason: drawerTxReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record cash drawer transaction.');

      setMessage({ type: 'success', text: `Recorded ${drawerTxType} of Rs. ${drawerTxAmount}` });
      setShowDrawerTxModal(false);
      setDrawerTxAmount('');
      setDrawerTxReason('');
      fetchAllData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) {
      setMessage({ type: 'error', text: 'Account Name is required.' });
      return;
    }

    try {
      const res = await fetch('/api/finance/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: accName,
          accountType: accType,
          accountNumber: accNumber,
          accountTitle: accTitle,
          bankName,
          openingBalance: Number(openBalance) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create financial account.');

      setMessage({ type: 'success', text: `Account ${data.name} added.` });
      setShowAccountModal(false);
      setAccName('');
      setAccNumber('');
      setAccTitle('');
      setBankName('');
      setOpenBalance('0');
      fetchAllData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trfFrom || !trfTo || trfFrom === trfTo) {
      setMessage({ type: 'error', text: 'Select distinct source and target accounts.' });
      return;
    }

    try {
      const res = await fetch('/api/finance/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAccountId: trfFrom,
          toAccountId: trfTo,
          amount: Number(trfAmount),
          notes: trfNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transfer failed.');

      setMessage({ type: 'success', text: 'Account transfer processed cleanly.' });
      setShowTransferModal(false);
      setTrfAmount('');
      setTrfNotes('');
      fetchAllData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleAddCOA = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/finance/chart-of-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountCode: coaCode,
          accountName: coaName,
          category: coaCategory,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add chart account.');

      setMessage({ type: 'success', text: `Added account ${data.accountCode} - ${data.accountName}` });
      setShowChartModal(false);
      setCoaCode('');
      setCoaName('');
      fetchAllData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleAddJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!journalDesc.trim()) {
      setMessage({ type: 'error', text: 'Journal description is required.' });
      return;
    }

    let totDebit = 0;
    let totCredit = 0;

    const parsedItems = journalRows.map((r) => {
      const d = Number(r.debit) || 0;
      const c = Number(r.credit) || 0;
      totDebit += d;
      totCredit += c;
      return {
        accountCode: r.accountCode,
        accountName: r.accountName,
        debit: d,
        credit: c,
      };
    });

    if (Math.abs(totDebit - totCredit) > 0.01) {
      setMessage({ type: 'error', text: `Unbalanced journal! Debit (Rs. ${totDebit}) must equal Credit (Rs. ${totCredit}).` });
      return;
    }

    try {
      const res = await fetch('/api/finance/journal-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: journalDesc,
          items: parsedItems,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to post journal entry.');

      setMessage({ type: 'success', text: `Journal Entry ${data.entryNo} posted.` });
      setShowJournalModal(false);
      setJournalDesc('');
      fetchAllData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  // Metrics Calculations
  const totalCashInHand = accounts.filter((a) => a.accountType === 'CASH').reduce((sum, a) => sum + a.currentBalance, 0);
  const totalBankBalances = accounts.filter((a) => a.accountType === 'BANK').reduce((sum, a) => sum + a.currentBalance, 0);
  const totalWallets = accounts.filter((a) => a.accountType === 'MOBILE_WALLET').reduce((sum, a) => sum + a.currentBalance, 0);
  const totalLiquidAssets = totalCashInHand + totalBankBalances + totalWallets;

  const totalReceivables = customers.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);
  const totalPayables = suppliers.reduce((sum, s) => sum + (s.outstandingBalance || 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-slate-800 dark:text-slate-100">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-600/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Financial & Cash Management Engine</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Multi-account ledger, register shifts, double-entry accounting & balance sheets
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchAllData}
            disabled={loading}
            className="flex items-center space-x-2 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-medium transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {activeShift ? (
            <button
              onClick={() => setShowCloseShiftModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold shadow-sm transition"
            >
              <Lock className="w-4 h-4" />
              <span>Close Register ({activeShift.shiftNo || 'Active'})</span>
            </button>
          ) : (
            <button
              onClick={() => setShowOpenShiftModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition"
            >
              <Unlock className="w-4 h-4" />
              <span>Open Register Shift</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {message && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
          }`}
        >
          <div className="flex items-center space-x-2 text-sm font-medium">
            {message.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Key Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Liquid Assets</span>
            <Wallet className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">Rs. {totalLiquidAssets.toLocaleString()}</div>
          <div className="text-xs text-slate-500 mt-1">Cash + Banks + Wallets</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Main Drawer Cash</span>
            <DollarSign className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">Rs. {totalCashInHand.toLocaleString()}</div>
          <div className="text-xs text-slate-500 mt-1">Cash in Register Drawer</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Bank Accounts (HBL/Meezan)</span>
            <Building2 className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white">Rs. {totalBankBalances.toLocaleString()}</div>
          <div className="text-xs text-slate-500 mt-1">Real Bank Reserves</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Accounts Receivable</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400">Rs. {totalReceivables.toLocaleString()}</div>
          <div className="text-xs text-slate-500 mt-1">Customer Credit Dues</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Accounts Payable</span>
            <TrendingDown className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400">Rs. {totalPayables.toLocaleString()}</div>
          <div className="text-xs text-slate-500 mt-1">Supplier Outstanding Dues</div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex items-center space-x-6">
        <button
          onClick={() => setActiveTab('registers')}
          className={`pb-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition ${
            activeTab === 'registers'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Registers & Shift History</span>
        </button>

        <button
          onClick={() => setActiveTab('accounts')}
          className={`pb-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition ${
            activeTab === 'accounts'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Landmark className="w-4 h-4" />
          <span>Bank Accounts & Wallets</span>
        </button>

        <button
          onClick={() => setActiveTab('chart')}
          className={`pb-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition ${
            activeTab === 'chart'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Chart of Accounts</span>
        </button>

        <button
          onClick={() => setActiveTab('journals')}
          className={`pb-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition ${
            activeTab === 'journals'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Double Entry Journals</span>
        </button>

        <button
          onClick={() => setActiveTab('transfers')}
          className={`pb-3 text-sm font-semibold flex items-center space-x-2 border-b-2 transition ${
            activeTab === 'transfers'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          <span>Account Transfers</span>
        </button>
      </div>

      {/* TAB 1: REGISTERS & SHIFTS */}
      {activeTab === 'registers' && (
        <div className="space-y-6">
          {/* Active Shift Dashboard */}
          {activeShift ? (
            <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white p-6 rounded-2xl shadow-md border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <div className="inline-flex items-center space-x-2 bg-emerald-500/20 text-emerald-400 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-500/30 mb-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>ACTIVE REGISTER SHIFT SESSION</span>
                  </div>
                  <h2 className="text-xl font-bold">Shift #{activeShift.shiftNo || activeShift.id} - {activeShift.registerName || 'Main Register'}</h2>
                  <p className="text-xs text-slate-400">
                    Opened at {new Date(activeShift.startTime).toLocaleString()} by {activeShift.cashierName}
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setShowDrawerTxModal(true)}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl border border-slate-700 transition"
                  >
                    Paid-In / Paid-Out Movement
                  </button>
                  <button
                    onClick={() => setShowCloseShiftModal(true)}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold rounded-xl shadow transition"
                  >
                    Close Register Shift
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-2 text-center">
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <div className="text-xs text-slate-400">Opening Float</div>
                  <div className="text-lg font-bold text-white">Rs. {(activeShift.openingCash || 0).toLocaleString()}</div>
                </div>
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <div className="text-xs text-slate-400">Cash Sales</div>
                  <div className="text-lg font-bold text-emerald-400">Rs. {(activeShift.cashSales || 0).toLocaleString()}</div>
                </div>
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <div className="text-xs text-slate-400">Card Sales</div>
                  <div className="text-lg font-bold text-blue-400">Rs. {(activeShift.cardSales || 0).toLocaleString()}</div>
                </div>
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <div className="text-xs text-slate-400">JazzCash / Mobile</div>
                  <div className="text-lg font-bold text-indigo-400">Rs. {(activeShift.mobileSales || 0).toLocaleString()}</div>
                </div>
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <div className="text-xs text-slate-400">Paid-In</div>
                  <div className="text-lg font-bold text-cyan-400">Rs. {(activeShift.paidIn || 0).toLocaleString()}</div>
                </div>
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <div className="text-xs text-slate-400">Paid-Out</div>
                  <div className="text-lg font-bold text-rose-400">Rs. {(activeShift.paidOut || 0).toLocaleString()}</div>
                </div>
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                  <div className="text-xs text-slate-400">Expected Cash in Drawer</div>
                  <div className="text-lg font-bold text-amber-400">
                    Rs. {(
                      (activeShift.openingCash || 0) +
                      (activeShift.cashSales || 0) +
                      (activeShift.paidIn || 0) -
                      (activeShift.paidOut || 0)
                    ).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 dark:bg-amber-950/30 p-6 rounded-2xl border border-amber-200 dark:border-amber-800/50 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-6 h-6 text-amber-600" />
                <div>
                  <h3 className="font-semibold text-amber-900 dark:text-amber-200">No Cash Register Shift Currently Open</h3>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Open a shift to track cashier opening cash floats, cash sales, paid-ins/outs, and automated variance audits.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowOpenShiftModal(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow transition"
              >
                Open Shift Now
              </button>
            </div>
          )}

          {/* Past Shift Logs */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white">Register Shift Audit Logs</h3>
              <span className="text-xs text-slate-500">{shifts.length} Total Shift Sessions</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3.5">Shift No</th>
                    <th className="p-3.5">Register</th>
                    <th className="p-3.5">Cashier</th>
                    <th className="p-3.5">Start / End Time</th>
                    <th className="p-3.5 text-right">Opening Float</th>
                    <th className="p-3.5 text-right">Total Sales</th>
                    <th className="p-3.5 text-right">Expected Cash</th>
                    <th className="p-3.5 text-right">Actual Count</th>
                    <th className="p-3.5 text-right">Variance</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {shifts.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3.5 font-mono text-xs font-semibold">{s.shiftNo || s.id}</td>
                      <td className="p-3.5">{s.registerName || 'Main Register'}</td>
                      <td className="p-3.5">{s.cashierName}</td>
                      <td className="p-3.5 text-xs text-slate-500">
                        <div>{new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        <div>{s.endTime ? new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'In Progress'}</div>
                      </td>
                      <td className="p-3.5 text-right font-medium">Rs. {(s.openingCash || 0).toLocaleString()}</td>
                      <td className="p-3.5 text-right font-semibold text-emerald-600">Rs. {(s.totalSales || 0).toLocaleString()}</td>
                      <td className="p-3.5 text-right text-slate-600 dark:text-slate-400">Rs. {(s.expectedCash || 0).toLocaleString()}</td>
                      <td className="p-3.5 text-right font-bold">Rs. {(s.actualCash || s.closingCash || 0).toLocaleString()}</td>
                      <td className="p-3.5 text-right font-bold">
                        {s.variance !== undefined ? (
                          <span className={s.variance === 0 ? 'text-emerald-600' : s.variance > 0 ? 'text-blue-600' : 'text-rose-600'}>
                            Rs. {s.variance.toLocaleString()}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            s.status === 'OPEN'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => setShowZReportModal(s)}
                          className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium inline-flex items-center space-x-1"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Z-Report</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {shifts.length === 0 && (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-500">
                        No shift session logs found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BANK ACCOUNTS & WALLETS */}
      {activeTab === 'accounts' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Financial Bank & Mobile Wallet Accounts</h2>
              <p className="text-xs text-slate-500">Track real-time liquid cash, bank reserves, JazzCash & Easypaisa merchant balances</p>
            </div>
            <button
              onClick={() => setShowAccountModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm flex items-center space-x-2 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Account / Wallet</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acc) => (
              <div key={acc.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`p-3 rounded-xl ${
                        acc.accountType === 'CASH'
                          ? 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                          : acc.accountType === 'BANK'
                          ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                          : 'bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400'
                      }`}
                    >
                      {acc.accountType === 'CASH' ? <DollarSign className="w-5 h-5" /> : acc.accountType === 'BANK' ? <Building2 className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">{acc.name}</h3>
                      <p className="text-xs text-slate-500">{acc.bankName || acc.accountType}</p>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      acc.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {acc.status}
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="text-xs text-slate-500">Current Balance</div>
                  <div className="text-2xl font-extrabold text-slate-900 dark:text-white">Rs. {acc.currentBalance.toLocaleString()}</div>
                </div>

                <div className="text-xs text-slate-500 space-y-1">
                  {acc.accountNumber && (
                    <div>
                      <span className="font-semibold">Acc #:</span> {acc.accountNumber}
                    </div>
                  )}
                  {acc.iban && (
                    <div>
                      <span className="font-semibold">IBAN:</span> {acc.iban}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: CHART OF ACCOUNTS */}
      {activeTab === 'chart' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Chart of Accounts (COA)</h2>
              <p className="text-xs text-slate-500">System ledger architecture categorized into Assets, Liabilities, Equity, Revenue, and Expenses</p>
            </div>
            <button
              onClick={() => setShowChartModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm flex items-center space-x-2 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Account Code</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <div className="relative max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter chart accounts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>

            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Account Code</th>
                  <th className="p-3.5">Account Name</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Sub-Category</th>
                  <th className="p-3.5 text-right">Ledger Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {chartAccounts
                  .filter(
                    (a) =>
                      a.accountCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      a.accountName.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3.5 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{a.accountCode}</td>
                      <td className="p-3.5 font-semibold">{a.accountName}</td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            a.category === 'ASSET'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : a.category === 'LIABILITY'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              : a.category === 'REVENUE'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : a.category === 'EXPENSE' || a.category === 'COGS'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                          }`}
                        >
                          {a.category}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-500">{a.subCategory || '-'}</td>
                      <td className="p-3.5 text-right font-bold">Rs. {a.balance.toLocaleString()}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: DOUBLE ENTRY JOURNALS */}
      {activeTab === 'journals' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Double-Entry Journal Entries</h2>
              <p className="text-xs text-slate-500">Immutable ledger log ensuring every debit strictly balances credit</p>
            </div>
            <button
              onClick={() => setShowJournalModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm flex items-center space-x-2 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Post Manual Journal</span>
            </button>
          </div>

          <div className="space-y-4">
            {journals.map((j) => (
              <div key={j.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 px-2 py-1 rounded-lg">
                      {j.entryNo}
                    </span>
                    <span className="font-semibold text-sm">{j.description}</span>
                  </div>
                  <div className="text-xs text-slate-500">{new Date(j.createdAt).toLocaleString()}</div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500">
                      <tr>
                        <th className="p-2">Account</th>
                        <th className="p-2 text-right">Debit</th>
                        <th className="p-2 text-right">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {j.items.map((i, idx) => (
                        <tr key={idx}>
                          <td className="p-2 font-medium">{i.accountName} ({i.accountId})</td>
                          <td className="p-2 text-right font-mono">{i.debit > 0 ? `Rs. ${i.debit.toLocaleString()}` : '-'}</td>
                          <td className="p-2 text-right font-mono">{i.credit > 0 ? `Rs. ${i.credit.toLocaleString()}` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: TRANSFERS */}
      {activeTab === 'transfers' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Inter-Account Transfers</h2>
              <p className="text-xs text-slate-500">Move funds between Cash Drawer, HBL, Meezan, JazzCash, or Easypaisa with instant double-entry updates</p>
            </div>
            <button
              onClick={() => setShowTransferModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm flex items-center space-x-2 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Transfer Funds</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3.5">Transfer No</th>
                  <th className="p-3.5">From Account</th>
                  <th className="p-3.5">To Account</th>
                  <th className="p-3.5 text-right">Amount</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Created By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {transfers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="p-3.5 font-mono text-xs font-bold text-blue-600">{t.transferNo}</td>
                    <td className="p-3.5 font-medium">{t.fromAccountName}</td>
                    <td className="p-3.5 font-medium">{t.toAccountName}</td>
                    <td className="p-3.5 text-right font-bold text-emerald-600">Rs. {t.amount.toLocaleString()}</td>
                    <td className="p-3.5 text-xs text-slate-500">{new Date(t.date).toLocaleString()}</td>
                    <td className="p-3.5 text-slate-500">{t.createdBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: OPEN SHIFT */}
      {showOpenShiftModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-lg">Open Register Shift</h3>
              <button onClick={() => setShowOpenShiftModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOpenShift} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Opening Cash Float (PKR)</label>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={openFloat}
                  onChange={(e) => setOpenFloat(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 font-semibold text-lg"
                  required
                />
                <p className="text-xs text-slate-500 mt-1">Specify initial physical cash in the drawer at start of shift.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Opening Notes / Shift Remarks</label>
                <textarea
                  placeholder="Optional shift notes..."
                  value={shiftNotes}
                  onChange={(e) => setShiftNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm"
                  rows={2}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOpenShiftModal(false)}
                  className="px-4 py-2 border text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow">
                  Open Register Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CLOSE SHIFT */}
      {showCloseShiftModal && activeShift && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-lg">Close Register Shift #{activeShift.shiftNo || activeShift.id}</h3>
              <button onClick={() => setShowCloseShiftModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Opening Float:</span>
                <span className="font-semibold">Rs. {(activeShift.openingCash || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Cash Sales:</span>
                <span className="font-semibold text-emerald-600">+ Rs. {(activeShift.cashSales || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Paid-In (Float Added):</span>
                <span className="font-semibold text-cyan-600">+ Rs. {(activeShift.paidIn || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Paid-Out / Expenses:</span>
                <span className="font-semibold text-rose-600">- Rs. {(activeShift.paidOut || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-2 border-t font-bold text-base">
                <span>System Expected Cash:</span>
                <span className="text-amber-600">
                  Rs. {(
                    (activeShift.openingCash || 0) +
                    (activeShift.cashSales || 0) +
                    (activeShift.paidIn || 0) -
                    (activeShift.paidOut || 0)
                  ).toLocaleString()}
                </span>
              </div>
            </div>

            <form onSubmit={handleCloseShift} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Actual Physical Cash Counted (PKR)</label>
                <input
                  type="number"
                  placeholder="Enter counted cash in drawer"
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 font-semibold text-xl"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Variance Reason (If Discrepancy)</label>
                <input
                  type="text"
                  placeholder="Reason for discrepancy..."
                  value={varianceReason}
                  onChange={(e) => setVarianceReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCloseShiftModal(false)}
                  className="px-4 py-2 border text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold shadow">
                  Close Shift & Print Z-Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DRAWER TX */}
      {showDrawerTxModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-lg">Cash Drawer Movement</h3>
              <button onClick={() => setShowDrawerTxModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDrawerTx} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Transaction Type</label>
                <select
                  value={drawerTxType}
                  onChange={(e) => setDrawerTxType(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm font-medium"
                >
                  <option value="PAID_IN">Paid In (Add Cash to Drawer)</option>
                  <option value="PAID_OUT">Paid Out (Remove Cash from Drawer)</option>
                  <option value="SAFE_DROP">Safe Drop (Transfer to Bank/Vault)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Amount (PKR)</label>
                <input
                  type="number"
                  placeholder="e.g. 1000"
                  value={drawerTxAmount}
                  onChange={(e) => setDrawerTxAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Reason / Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Petty cash for milk purchase"
                  value={drawerTxReason}
                  onChange={(e) => setDrawerTxReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDrawerTxModal(false)}
                  className="px-4 py-2 border text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow">
                  Record Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD ACCOUNT */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-lg">Add Bank Account or Wallet</h3>
              <button onClick={() => setShowAccountModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Account Type</label>
                <select
                  value={accType}
                  onChange={(e) => setAccType(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm font-medium"
                >
                  <option value="BANK">Bank Account (HBL, Meezan, etc.)</option>
                  <option value="MOBILE_WALLET">Mobile Wallet (JazzCash, Easypaisa)</option>
                  <option value="CASH">Cash Drawer Account</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Account Name / Label</label>
                <input
                  type="text"
                  placeholder="e.g. Meezan Islamic Operating Acc"
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Bank or Wallet Provider</label>
                <input
                  type="text"
                  placeholder="e.g. Meezan Bank / JazzCash"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Account / IBAN Number</label>
                <input
                  type="text"
                  placeholder="e.g. 020101029384"
                  value={accNumber}
                  onChange={(e) => setAccNumber(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Opening Balance (PKR)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={openBalance}
                  onChange={(e) => setOpenBalance(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm font-semibold"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAccountModal(false)}
                  className="px-4 py-2 border text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow">
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TRANSFER */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-lg">Transfer Money Between Accounts</h3>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">From Account (Source)</label>
                <select
                  value={trfFrom}
                  onChange={(e) => setTrfFrom(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm font-medium"
                  required
                >
                  <option value="">Select source account...</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} (Bal: Rs. {a.currentBalance.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">To Account (Destination)</label>
                <select
                  value={trfTo}
                  onChange={(e) => setTrfTo(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm font-medium"
                  required
                >
                  <option value="">Select destination account...</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} (Bal: Rs. {a.currentBalance.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Transfer Amount (PKR)</label>
                <input
                  type="number"
                  placeholder="e.g. 50000"
                  value={trfAmount}
                  onChange={(e) => setTrfAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Transfer Notes / Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Weekly cash deposit to bank"
                  value={trfNotes}
                  onChange={(e) => setTrfNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 border text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow">
                  Execute Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD CHART OF ACCOUNT */}
      {showChartModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-lg">Add Chart of Account Item</h3>
              <button onClick={() => setShowChartModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCOA} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Account Code</label>
                <input
                  type="text"
                  placeholder="e.g. 6050"
                  value={coaCode}
                  onChange={(e) => setCoaCode(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Account Name</label>
                <input
                  type="text"
                  placeholder="e.g. Marketing & Promotions"
                  value={coaName}
                  onChange={(e) => setCoaName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Category</label>
                <select
                  value={coaCategory}
                  onChange={(e) => setCoaCategory(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-800 dark:border-slate-700 text-sm font-medium"
                >
                  <option value="ASSET">ASSET</option>
                  <option value="LIABILITY">LIABILITY</option>
                  <option value="EQUITY">EQUITY</option>
                  <option value="REVENUE">REVENUE</option>
                  <option value="EXPENSE">EXPENSE</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChartModal(false)}
                  className="px-4 py-2 border text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium"
                >
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow">
                  Save Account Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Z-REPORT PRINT PREVIEW */}
      {showZReportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-lg">Z-Report Shift Summary #{showZReportModal.shiftNo || showZReportModal.id}</h3>
              <button onClick={() => setShowZReportModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-xl space-y-3 text-sm border font-mono">
              <div className="text-center font-bold text-base border-b pb-2">UNIQUE SWEETS & BAKERS</div>
              <div className="text-center text-xs text-slate-500">End of Shift Z-Report</div>

              <div className="space-y-1 text-xs">
                <div>Register: {showZReportModal.registerName || 'Main Counter'}</div>
                <div>Cashier: {showZReportModal.cashierName}</div>
                <div>Opened: {new Date(showZReportModal.startTime).toLocaleString()}</div>
                <div>Closed: {showZReportModal.endTime ? new Date(showZReportModal.endTime).toLocaleString() : 'Open'}</div>
              </div>

              <div className="border-t border-dashed my-2"></div>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span>Opening Float:</span> <span>Rs. {(showZReportModal.openingCash || 0).toLocaleString()}</span></div>
                <div className="flex justify-between font-semibold"><span>Cash Sales:</span> <span>Rs. {(showZReportModal.cashSales || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Card Sales:</span> <span>Rs. {(showZReportModal.cardSales || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>JazzCash/Wallet Sales:</span> <span>Rs. {(showZReportModal.mobileSales || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Credit Sales:</span> <span>Rs. {(showZReportModal.creditSales || 0).toLocaleString()}</span></div>
                <div className="flex justify-between font-bold text-sm text-emerald-600"><span>TOTAL GROSS SALES:</span> <span>Rs. {(showZReportModal.totalSales || 0).toLocaleString()}</span></div>
              </div>

              <div className="border-t border-dashed my-2"></div>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span>Paid In:</span> <span>Rs. {(showZReportModal.paidIn || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Paid Out / Expenses:</span> <span>Rs. {(showZReportModal.paidOut || 0).toLocaleString()}</span></div>
                <div className="flex justify-between font-bold"><span>Expected Cash in Drawer:</span> <span>Rs. {(showZReportModal.expectedCash || 0).toLocaleString()}</span></div>
                <div className="flex justify-between font-bold"><span>Actual Counted Cash:</span> <span>Rs. {(showZReportModal.actualCash || showZReportModal.closingCash || 0).toLocaleString()}</span></div>
                <div className="flex justify-between font-bold text-rose-600"><span>Variance:</span> <span>Rs. {(showZReportModal.variance || 0).toLocaleString()}</span></div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center space-x-2"
              >
                <Printer className="w-4 h-4" />
                <span>Print Z-Report Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

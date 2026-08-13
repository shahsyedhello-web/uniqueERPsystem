import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import {
  User,
  Category,
  Product,
  InventoryLedger,
  StockAdjustment,
  StockTransfer,
  Supplier,
  Purchase,
  Customer,
  CustomerLedger,
  Sale,
  KitchenOrder,
  Recipe,
  ProductionBatch,
  Expense,
  Employee,
  Department,
  Attendance,
  Payroll,
  CashShift,
  BusinessSettings,
  ActivityLog,
  Role,
  Branch,
  Warehouse,
  Unit,
  StockBatch,
  GoodsReceipt,
  StockAlert,
  InventoryAudit,
  CashRegister,
  CashDrawerTransaction,
  BankAccount,
  ChartAccount,
  JournalEntry,
  AccountTransfer,
  SupplierLedger,
  BankReconciliation,
  PrintJob,
} from '../types/pos';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'pos_database.json');
const TMP_DB_FILE = path.join('/tmp', 'pos_database.json');

export interface DBData {
  users: User[];
  userPasswords: Record<string, string>; // userId -> passwordHash
  roles: Role[];
  branches: Branch[];
  warehouses: Warehouse[];
  units: Unit[];
  categories: Category[];
  products: Product[];
  inventoryLogs: InventoryLedger[];
  adjustments: StockAdjustment[];
  transfers: StockTransfer[];
  batches: StockBatch[];
  goodsReceipts: GoodsReceipt[];
  alerts: StockAlert[];
  inventoryAudits: InventoryAudit[];
  suppliers: Supplier[];
  supplierLedgers?: SupplierLedger[];
  purchases: Purchase[];
  customers: Customer[];
  customerLedgers: CustomerLedger[];
  sales: Sale[];
  kitchenOrders: KitchenOrder[];
  recipes: Recipe[];
  productionBatches: ProductionBatch[];
  expenses: Expense[];
  employees: Employee[];
  departments: Department[];
  attendances: Attendance[];
  payrolls: Payroll[];
  registers?: CashRegister[];
  cashShifts: CashShift[];
  cashDrawerTransactions?: CashDrawerTransaction[];
  bankAccounts?: BankAccount[];
  chartAccounts?: ChartAccount[];
  journalEntries?: JournalEntry[];
  accountTransfers?: AccountTransfer[];
  reconciliations?: BankReconciliation[];
  printJobs?: PrintJob[];
  settings: BusinessSettings;
  activityLogs: ActivityLog[];
}

const defaultSettings: BusinessSettings = {
  name: 'Unique Sweets & Bakers',
  logoUrl: '',
  tagline: 'Freshly Baked & Authentic Sweets',
  address: 'Main Boulevard, Suite 100, Unique Tower',
  phone: '+92 300 1234567',
  email: 'info@uniquesweets.com',
  taxNumber: 'NTN-9988776-6',
  currency: 'PKR',
  currencySymbol: 'Rs.',
  decimalPlaces: 2,
  dateFormat: 'YYYY-MM-DD',
  timeFormat: '12h',
  timezone: 'Asia/Karachi',
  taxPercentage: 0,
  defaultCustomer: 'Walk-in Customer',
  defaultBranch: 'branch-main',
  defaultRegister: 'reg-001',
  invoicePrefix: 'USB-',
  receiptHeader: 'UNIQUE SWEETS & BAKERS\nAuthentic Bakery & Confectionery',
  receiptFooter: 'Thank you for choosing Unique Sweets & Bakers! Freshly baked daily.',
  returnPolicyText: 'Returns/Exchange allowed within 24 hours with original receipt.',
  thermalPrinterWidth: '80mm',
  autoPrintReceipt: true,
  printCopies: 1,
  showLogo: true,
  showBusinessAddress: true,
  showPhone: true,
  showTax: true,
  showCashierName: true,
  showCustomer: true,
  enableKitchenRouting: true,
  allowNegativeStock: false,
  allowSellingOutOfStock: false,
  allowStockAdjustment: true,
  requireReasonForAdjustment: true,
  lowStockThreshold: 10,
  batchTracking: true,
  expiryTracking: true,
  stockConsumptionMode: 'FIFO',
  autoDeductOnSale: true,
  autoRestoreOnVoid: true,
  requireManagerApprovalForNegativeStock: true,
  enableDiscounts: true,
  maxCashierDiscountPercent: 10,
  requireManagerApprovalDiscount: true,
  allowPriceOverride: false,
  requireManagerApprovalPriceOverride: true,
  allowHeldOrders: true,
  maxHeldOrders: 20,
  allowSalesReturns: true,
  returnRequiresManagerApproval: true,
  allowInvoiceVoid: true,
  voidRequiresReason: true,
  defaultPaymentMethod: 'CASH',
  autoFocusBarcodeScanner: true,
  enableRegisterSessions: true,
  requireOpeningCash: true,
  allowCashierOpenRegister: true,
  allowCashInCashOut: true,
  requireReasonCashInCashOut: true,
  requireClosingCashCount: true,
  allowClosingWithVariance: true,
  maxAllowedVariance: 500,
  requireManagerApprovalHighVariance: true,
  autoGenerateZReport: true,
  paymentMethods: [
    { id: 'CASH', name: 'Cash', enabled: true, requiresReference: false, accountMapping: 'Cash in Hand' },
    { id: 'CARD', name: 'Debit/Credit Card', enabled: true, requiresReference: true, accountMapping: 'POS Bank Account' },
    { id: 'JAZZCASH', name: 'JazzCash', enabled: true, requiresReference: true, accountMapping: 'JazzCash Merchant' },
    { id: 'EASYPAISA', name: 'Easypaisa', enabled: true, requiresReference: true, accountMapping: 'Easypaisa Merchant' },
    { id: 'BANK', name: 'Bank Transfer', enabled: true, requiresReference: true, accountMapping: 'Main Bank Account' },
    { id: 'CREDIT', name: 'Customer Credit', enabled: true, requiresReference: false, accountMapping: 'Accounts Receivable' },
    { id: 'OTHER', name: 'Other Voucher', enabled: false, requiresReference: true, accountMapping: 'Other Accounts' },
  ],
  defaultUnit: 'pcs',
  requireSKU: false,
  requireBarcode: false,
  allowDuplicateBarcode: false,
  showCostPriceToCashier: false,
  allowWalkInCustomer: true,
  requireCustomerForCreditSale: true,
  defaultCreditLimit: 50000,
  sessionTimeoutMinutes: 60,
  minPasswordLength: 6,
  maxFailedLogins: 5,
  enableAuditLogging: true,
  lowStockAlerts: true,
  expiryAlerts: true,
  registerVarianceAlerts: true,
  failedLoginAlerts: true,
  theme: 'dark',
  branchName: 'Main Bakery Branch',
  counterName: 'Counter 01',
  receiptPrinter: 'POS-80 Thermal Receipt Printer',
  labelPrinter: 'TSC TTP-244 Pro',
  kitchenPrinter: 'Kitchen Thermal Printer',
  defaultPrinter: 'TSC TTP-244 Pro',
  printerType: 'TSC_TSPL',
  labelWidthMm: 50,
  labelHeightMm: 30,
  labelGapMm: 2,
  printDensity: 8,
  printSpeed: 4,
  barcodeFormat: 'CODE128',
  autoCut: true,
  cashDrawerTrigger: true,
  printBridgeUrl: 'http://127.0.0.1:9100',
};

const defaultRoles: Role[] = [
  {
    id: 'role-admin',
    name: 'Admin',
    description: 'Full system access',
    permissions: [],
  },
  {
    id: 'role-manager',
    name: 'Manager',
    description: 'Branch management and reports',
    permissions: [],
  },
  {
    id: 'role-cashier',
    name: 'Cashier',
    description: 'POS billing and customer counter',
    permissions: [],
  },
  {
    id: 'role-kitchen',
    name: 'Kitchen Staff',
    description: 'KOT view and production updates',
    permissions: [],
  },
];

let dbInMemory: DBData | null = null;
let lastDbMtime = 0;

function ensureDataDirExists() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (e) {
    // Read-only filesystem in serverless environments
  }
}

export function loadDB(forceReload = false): DBData {
  ensureDataDirExists();

  let activeFile = DB_FILE;
  let fileExists = false;

  try {
    if (fs.existsSync(TMP_DB_FILE)) {
      activeFile = TMP_DB_FILE;
      fileExists = true;
    } else if (fs.existsSync(DB_FILE)) {
      activeFile = DB_FILE;
      fileExists = true;
    }
  } catch (e) {}

  let currentMtime = 0;
  if (fileExists) {
    try {
      currentMtime = fs.statSync(activeFile).mtimeMs;
    } catch (e) {}
  }

  if (dbInMemory && !forceReload && currentMtime === lastDbMtime && currentMtime > 0) {
    return dbInMemory;
  }

  lastDbMtime = currentMtime;

  if (fileExists) {
    try {
      const raw = fs.readFileSync(activeFile, 'utf-8');
      dbInMemory = JSON.parse(raw);
      // Ensure empty arrays for strictly requested empty initialization if missing
      dbInMemory!.warehouses = dbInMemory!.warehouses || [
        { id: 'wh-main', name: 'Main Warehouse', code: 'WH-MAIN', type: 'MAIN', isMain: true, location: 'Central Store', createdAt: new Date().toISOString() },
        { id: 'wh-raw', name: 'Raw Material Store', code: 'WH-RAW', type: 'RAW_MATERIAL', location: 'Section A', createdAt: new Date().toISOString() },
        { id: 'wh-fg', name: 'Finished Goods Store', code: 'WH-FG', type: 'FINISHED_GOODS', location: 'Section B', createdAt: new Date().toISOString() },
        { id: 'wh-cold', name: 'Cold Storage', code: 'WH-COLD', type: 'COLD_STORAGE', location: 'Unit Cold-1', createdAt: new Date().toISOString() },
        { id: 'wh-prod', name: 'Production Store', code: 'WH-PROD', type: 'PRODUCTION', location: 'Kitchen Floor', createdAt: new Date().toISOString() },
      ];
      dbInMemory!.units = dbInMemory!.units || [
        { id: 'unit-kg', name: 'Kilogram', code: 'KG', symbol: 'kg', description: 'Mass measurement in kilograms', createdAt: new Date().toISOString() },
        { id: 'unit-gram', name: 'Gram', code: 'GRAM', symbol: 'g', description: 'Mass measurement in grams', createdAt: new Date().toISOString() },
        { id: 'unit-pcs', name: 'Piece', code: 'PCS', symbol: 'pcs', description: 'Individual unit count', createdAt: new Date().toISOString() },
        { id: 'unit-ltr', name: 'Liter', code: 'LITER', symbol: 'L', description: 'Liquid volume in liters', createdAt: new Date().toISOString() },
        { id: 'unit-box', name: 'Box', code: 'BOX', symbol: 'box', description: 'Packaged box unit', createdAt: new Date().toISOString() },
        { id: 'unit-pkt', name: 'Packet', code: 'PKT', symbol: 'pkt', description: 'Pre-packed product packet', createdAt: new Date().toISOString() },
        { id: 'unit-tray', name: 'Tray', code: 'TRAY', symbol: 'tray', description: 'Bakery tray unit', createdAt: new Date().toISOString() },
      ];
      dbInMemory!.products = dbInMemory!.products || [];
      if (!dbInMemory!.categories || dbInMemory!.categories.length === 0) {
        dbInMemory!.categories = [
          { id: 'cat-1', name: 'Cakes', code: 'CAT-001', description: 'Fresh bakery cakes', status: 'ACTIVE', createdAt: new Date().toISOString() },
          { id: 'cat-2', name: 'Sweets', code: 'CAT-002', description: 'Traditional oriental sweets & mithai', status: 'ACTIVE', createdAt: new Date().toISOString() },
          { id: 'cat-3', name: 'Bakery', code: 'CAT-003', description: 'Breads, buns, and rusks', status: 'ACTIVE', createdAt: new Date().toISOString() },
          { id: 'cat-4', name: 'Beverages', code: 'CAT-004', description: 'Cold drinks, juices & tea', status: 'ACTIVE', createdAt: new Date().toISOString() },
          { id: 'cat-5', name: 'Savories', code: 'CAT-005', description: 'Patties, samosas, and snacks', status: 'ACTIVE', createdAt: new Date().toISOString() },
          { id: 'cat-6', name: 'Biscuits', code: 'CAT-006', description: 'Bakery cookies & biscuits', status: 'ACTIVE', createdAt: new Date().toISOString() },
        ];
      }
      dbInMemory!.inventoryLogs = dbInMemory!.inventoryLogs || [];
      dbInMemory!.adjustments = dbInMemory!.adjustments || [];
      dbInMemory!.transfers = dbInMemory!.transfers || [];
      dbInMemory!.batches = dbInMemory!.batches || [];
      dbInMemory!.goodsReceipts = dbInMemory!.goodsReceipts || [];
      dbInMemory!.alerts = dbInMemory!.alerts || [];
      dbInMemory!.inventoryAudits = dbInMemory!.inventoryAudits || [];
      dbInMemory!.suppliers = dbInMemory!.suppliers || [];
      dbInMemory!.purchases = dbInMemory!.purchases || [];
      dbInMemory!.customers = dbInMemory!.customers || [];
      dbInMemory!.customerLedgers = dbInMemory!.customerLedgers || [];
      dbInMemory!.sales = dbInMemory!.sales || [];
      dbInMemory!.kitchenOrders = dbInMemory!.kitchenOrders || [];
      dbInMemory!.recipes = dbInMemory!.recipes || [];
      dbInMemory!.productionBatches = dbInMemory!.productionBatches || [];
      dbInMemory!.expenses = dbInMemory!.expenses || [];
      dbInMemory!.employees = dbInMemory!.employees || [];
      dbInMemory!.departments = dbInMemory!.departments || [
        { id: 'dept-sales', name: 'Sales & Billing', code: 'SALES', createdAt: new Date().toISOString() },
        { id: 'dept-kitchen', name: 'Kitchen & Production', code: 'KITCHEN', createdAt: new Date().toISOString() },
        { id: 'dept-inventory', name: 'Inventory & Store', code: 'INV', createdAt: new Date().toISOString() },
        { id: 'dept-accounts', name: 'Accounts & Finance', code: 'ACCT', createdAt: new Date().toISOString() },
      ];
      dbInMemory!.attendances = dbInMemory!.attendances || [];
      dbInMemory!.payrolls = dbInMemory!.payrolls || [];
      dbInMemory!.cashShifts = dbInMemory!.cashShifts || [];
      dbInMemory!.registers = dbInMemory!.registers || [
        {
          id: 'reg-001',
          registerNo: 'REG-001',
          name: 'Main Counter Register #01',
          branchId: 'branch-head-office',
          branchName: 'Head Office',
          counterId: 'counter-01',
          status: 'CLOSED',
          createdAt: new Date().toISOString(),
        },
      ];
      dbInMemory!.cashDrawerTransactions = dbInMemory!.cashDrawerTransactions || [];
      dbInMemory!.supplierLedgers = dbInMemory!.supplierLedgers || [];
      dbInMemory!.bankAccounts = dbInMemory!.bankAccounts || [
        {
          id: 'acc-cash-hand',
          accountType: 'CASH',
          name: 'Main Drawer Cash',
          accountNumber: 'CASH-DRAWER-01',
          accountTitle: 'Cash in Hand',
          bankName: 'Cash Drawer',
          openingBalance: 0,
          currentBalance: 0,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'acc-hbl',
          accountType: 'BANK',
          name: 'HBL Main Business Account',
          accountNumber: '123479001122',
          accountTitle: 'Unique Sweets & Bakers',
          bankName: 'Habib Bank Limited (HBL)',
          branchName: 'Main Boulevard Branch',
          iban: 'PK36HABB0000123479001122',
          openingBalance: 0,
          currentBalance: 0,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'acc-meezan',
          accountType: 'BANK',
          name: 'Meezan Islamic Account',
          accountNumber: '020101029384',
          accountTitle: 'Unique Sweets & Bakers',
          bankName: 'Meezan Bank',
          branchName: 'Gulberg Branch',
          iban: 'PK92MEZN0000020101029384',
          openingBalance: 0,
          currentBalance: 0,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'acc-jazzcash',
          accountType: 'MOBILE_WALLET',
          name: 'JazzCash Merchant Account',
          accountNumber: '03001234567',
          accountTitle: 'Unique Sweets & Bakers',
          bankName: 'JazzCash',
          openingBalance: 0,
          currentBalance: 0,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'acc-easypaisa',
          accountType: 'MOBILE_WALLET',
          name: 'Easypaisa Store Wallet',
          accountNumber: '03119876543',
          accountTitle: 'Unique Sweets & Bakers',
          bankName: 'Easypaisa',
          openingBalance: 0,
          currentBalance: 0,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        },
      ];
      dbInMemory!.chartAccounts = dbInMemory!.chartAccounts || [
        { id: 'coa-1010', accountCode: '1010', accountName: 'Cash in Hand', category: 'ASSET', subCategory: 'Current Assets', balance: 0, isSystem: true, status: 'ACTIVE', createdAt: new Date().toISOString() },
        { id: 'coa-1020', accountCode: '1020', accountName: 'Bank Accounts', category: 'ASSET', subCategory: 'Current Assets', balance: 0, isSystem: true, status: 'ACTIVE', createdAt: new Date().toISOString() },
        { id: 'coa-1030', accountCode: '1030', accountName: 'Mobile Wallets (JazzCash/Easypaisa)', category: 'ASSET', subCategory: 'Current Assets', balance: 0, isSystem: true, status: 'ACTIVE', createdAt: new Date().toISOString() },
        { id: 'coa-1040', accountCode: '1040', accountName: 'Accounts Receivable', category: 'ASSET', subCategory: 'Current Assets', balance: 0, isSystem: true, status: 'ACTIVE', createdAt: new Date().toISOString() },
        { id: 'coa-1050', accountCode: '1050', accountName: 'Inventory Asset', category: 'ASSET', subCategory: 'Current Assets', balance: 0, isSystem: true, status: 'ACTIVE', createdAt: new Date().toISOString() },
        { id: 'coa-2010', accountCode: '2010', accountName: 'Accounts Payable', category: 'LIABILITY', subCategory: 'Current Liabilities', balance: 0, isSystem: true, status: 'ACTIVE', createdAt: new Date().toISOString() },
        { id: 'coa-3010', accountCode: '3010', accountName: "Owner's Equity", category: 'EQUITY', subCategory: 'Equity', balance: 0, isSystem: true, status: 'ACTIVE', createdAt: new Date().toISOString() },
        { id: 'coa-4010', accountCode: '4010', accountName: 'Sales Revenue', category: 'REVENUE', subCategory: 'Operating Revenue', balance: 0, isSystem: true, status: 'ACTIVE', createdAt: new Date().toISOString() },
        { id: 'coa-5010', accountCode: '5010', accountName: 'Cost of Goods Sold', category: 'COGS', subCategory: 'Direct Costs', balance: 0, isSystem: true, status: 'ACTIVE', createdAt: new Date().toISOString() },
        { id: 'coa-6010', accountCode: '6010', accountName: 'Rent Expense', category: 'EXPENSE', subCategory: 'Operating Expenses', balance: 0, isSystem: true, status: 'ACTIVE', createdAt: new Date().toISOString() },
        { id: 'coa-6020', accountCode: '6020', accountName: 'Salaries Expense', category: 'EXPENSE', subCategory: 'Operating Expenses', balance: 0, isSystem: true, status: 'ACTIVE', createdAt: new Date().toISOString() },
        { id: 'coa-6030', accountCode: '6030', accountName: 'Utilities & Electricity', category: 'EXPENSE', subCategory: 'Operating Expenses', balance: 0, isSystem: true, status: 'ACTIVE', createdAt: new Date().toISOString() },
        { id: 'coa-6040', accountCode: '6040', accountName: 'General Expenses', category: 'EXPENSE', subCategory: 'Operating Expenses', balance: 0, isSystem: true, status: 'ACTIVE', createdAt: new Date().toISOString() },
      ];
      dbInMemory!.journalEntries = dbInMemory!.journalEntries || [];
      dbInMemory!.accountTransfers = dbInMemory!.accountTransfers || [];
      dbInMemory!.reconciliations = dbInMemory!.reconciliations || [];
      dbInMemory!.activityLogs = dbInMemory!.activityLogs || [];
      dbInMemory!.settings = { ...defaultSettings, ...dbInMemory!.settings };
      if (!dbInMemory!.branches || dbInMemory!.branches.length === 0) {
        dbInMemory!.branches = [
          {
            id: 'branch-head-office',
            branchCode: 'BR-0001',
            branchName: 'Head Office',
            phone: '+92 300 1234567',
            email: 'headoffice@uniquesweets.com',
            address: 'Main Boulevard, Suite 100, Unique Tower',
            city: 'Lahore',
            manager: 'General Manager',
            status: 'ACTIVE',
            isHeadOffice: true,
            createdAt: new Date().toISOString(),
            name: 'Head Office',
            code: 'BR-0001',
            isMain: true,
          },
        ];
      } else {
        // Normalize existing branches
        dbInMemory!.branches = dbInMemory!.branches.map((b, idx) => {
          const bCode = b.branchCode || b.code || `BR-${(idx + 1).toString().padStart(4, '0')}`;
          const bName = (b.branchName || b.name || 'Head Office').replace(/Main Bakery Branch/g, 'Head Office');
          const isHO = b.isHeadOffice !== undefined ? b.isHeadOffice : (b.isMain !== undefined ? b.isMain : idx === 0);
          return {
            id: b.id,
            branchCode: bCode,
            branchName: bName,
            phone: b.phone || '',
            email: b.email || '',
            address: b.address || '',
            city: b.city || '',
            manager: b.manager || '',
            status: b.status || 'ACTIVE',
            isHeadOffice: isHO,
            createdAt: b.createdAt || new Date().toISOString(),
            updatedAt: b.updatedAt,
            name: bName,
            code: bCode,
            isMain: isHO,
          };
        });
      }
      seedBakeryDataIfEmpty(dbInMemory!);
      return dbInMemory!;
    } catch (e) {
      console.error('Failed to parse existing POS DB, initializing fresh:', e);
    }
  }

  // Initial fresh setup - Clean zero-user database requiring setup wizard
  const freshDB: DBData = {
    users: [],
    userPasswords: {},
    roles: defaultRoles,
    branches: [
      {
        id: 'branch-head-office',
        branchCode: 'BR-0001',
        branchName: 'Head Office',
        phone: '+92 300 1234567',
        email: 'headoffice@uniquesweets.com',
        address: 'Main Boulevard, Suite 100, Unique Tower',
        city: 'Lahore',
        manager: 'General Manager',
        status: 'ACTIVE',
        isHeadOffice: true,
        createdAt: new Date().toISOString(),
        name: 'Head Office',
        code: 'BR-0001',
        isMain: true,
      },
    ],
    warehouses: [
      { id: 'wh-main', name: 'Main Warehouse', code: 'WH-MAIN', type: 'MAIN', isMain: true, location: 'Central Store', createdAt: new Date().toISOString() },
      { id: 'wh-raw', name: 'Raw Material Store', code: 'WH-RAW', type: 'RAW_MATERIAL', location: 'Section A', createdAt: new Date().toISOString() },
      { id: 'wh-fg', name: 'Finished Goods Store', code: 'WH-FG', type: 'FINISHED_GOODS', location: 'Section B', createdAt: new Date().toISOString() },
      { id: 'wh-cold', name: 'Cold Storage', code: 'WH-COLD', type: 'COLD_STORAGE', location: 'Unit Cold-1', createdAt: new Date().toISOString() },
      { id: 'wh-prod', name: 'Production Store', code: 'WH-PROD', type: 'PRODUCTION', location: 'Kitchen Floor', createdAt: new Date().toISOString() },
    ],
    units: [
      { id: 'unit-kg', name: 'Kilogram', code: 'KG', symbol: 'kg', description: 'Mass measurement in kilograms', createdAt: new Date().toISOString() },
      { id: 'unit-gram', name: 'Gram', code: 'GRAM', symbol: 'g', description: 'Mass measurement in grams', createdAt: new Date().toISOString() },
      { id: 'unit-pcs', name: 'Piece', code: 'PCS', symbol: 'pcs', description: 'Individual unit count', createdAt: new Date().toISOString() },
      { id: 'unit-ltr', name: 'Liter', code: 'LITER', symbol: 'L', description: 'Liquid volume in liters', createdAt: new Date().toISOString() },
      { id: 'unit-box', name: 'Box', code: 'BOX', symbol: 'box', description: 'Packaged box unit', createdAt: new Date().toISOString() },
      { id: 'unit-pkt', name: 'Packet', code: 'PKT', symbol: 'pkt', description: 'Pre-packed product packet', createdAt: new Date().toISOString() },
      { id: 'unit-tray', name: 'Tray', code: 'TRAY', symbol: 'tray', description: 'Bakery tray unit', createdAt: new Date().toISOString() },
    ],
    categories: [],
    products: [],
    inventoryLogs: [],
    adjustments: [],
    transfers: [],
    batches: [],
    goodsReceipts: [],
    alerts: [],
    inventoryAudits: [],
    suppliers: [],
    purchases: [],
    customers: [],
    customerLedgers: [],
    sales: [],
    kitchenOrders: [],
    recipes: [],
    productionBatches: [],
    expenses: [],
    employees: [],
    departments: [
      { id: 'dept-sales', name: 'Sales & Billing', code: 'SALES', createdAt: new Date().toISOString() },
      { id: 'dept-kitchen', name: 'Kitchen & Production', code: 'KITCHEN', createdAt: new Date().toISOString() },
      { id: 'dept-inventory', name: 'Inventory & Store', code: 'INV', createdAt: new Date().toISOString() },
      { id: 'dept-accounts', name: 'Accounts & Finance', code: 'ACCT', createdAt: new Date().toISOString() },
    ],
    attendances: [],
    payrolls: [],
    cashShifts: [],
    settings: defaultSettings,
    activityLogs: [
      {
        id: 'act-' + Date.now(),
        userId: 'system',
        userName: 'System',
        action: 'Database Initialized',
        module: 'System',
        details: 'System database created cleanly awaiting First-Time Super Admin setup.',
        createdAt: new Date().toISOString(),
      },
    ],
  };

  dbInMemory = freshDB;
  seedBakeryDataIfEmpty(dbInMemory);
  saveDB();
  return dbInMemory;
}

export function seedBakeryDataIfEmpty(db: DBData) {
  // Fresh clean installation - zero pre-populated records.
  // Data will be created manually by administrators through the UI.
}

export function saveDB() {
  if (!dbInMemory) return;
  try {
    const serialized = JSON.stringify(dbInMemory, null, 2);

    // Try saving to project root data directory
    try {
      ensureDataDirExists();
      fs.writeFileSync(DB_FILE, serialized, 'utf-8');
      try {
        lastDbMtime = fs.statSync(DB_FILE).mtimeMs;
      } catch (e) {}
    } catch (err) {
      // Read-only filesystem in serverless deployment
    }

    // Always attempt saving to /tmp for serverless persistence fallback
    try {
      fs.writeFileSync(TMP_DB_FILE, serialized, 'utf-8');
    } catch (err) {
      // Ignored
    }
  } catch (err) {
    // Read-only filesystem in serverless deployment
  }
}

export function generateUUID(): string {
  return 'id-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36);
}

export function logActivity(userId: string, userName: string, action: string, module: string, details: string) {
  const db = loadDB();
  const log: ActivityLog = {
    id: generateUUID(),
    userId,
    userName,
    action,
    module,
    details,
    createdAt: new Date().toISOString(),
  };
  db.activityLogs.unshift(log);
  if (db.activityLogs.length > 500) {
    db.activityLogs = db.activityLogs.slice(0, 500);
  }
  saveDB();
}

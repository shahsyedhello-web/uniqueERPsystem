export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'CASHIER' | 'KITCHEN' | 'INVENTORY_MANAGER';

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  phone?: string;
  role: UserRole;
  branchId?: string;
  branchName?: string;
  registerId?: string;
  registerName?: string;
  counterId?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Permission {
  id: string;
  module: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
}

export interface Category {
  id: string;
  name: string;
  code: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  purchasePrice: number;
  salePrice: number;
  stock: number;
}

export interface RecipeIngredient {
  id: string;
  rawMaterialId: string;
  rawMaterialName: string;
  quantity: number;
  unit: string;
  cost: number;
}

export interface Recipe {
  id: string;
  productId: string;
  productName: string;
  yieldQuantity: number;
  unit: string;
  ingredients: RecipeIngredient[];
  totalCost: number;
  instructions?: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  type: 'MAIN' | 'RAW_MATERIAL' | 'FINISHED_GOODS' | 'COLD_STORAGE' | 'PRODUCTION' | 'BRANCH';
  location?: string;
  branchId?: string;
  branchName?: string;
  isMain?: boolean;
  createdAt: string;
}

export interface Unit {
  id: string;
  name: string;
  code: string;
  symbol: string;
  description?: string;
  createdAt: string;
}

export interface StockBatch {
  id: string;
  batchNo: string;
  productId: string;
  productName: string;
  warehouseId?: string;
  warehouseName?: string;
  supplierId?: string;
  supplierName?: string;
  purchaseRef?: string;
  manufacturingDate?: string;
  expiryDate?: string;
  initialQuantity: number;
  currentQuantity: number;
  costPrice: number;
  createdAt: string;
}

export interface GoodsReceiptItem {
  id: string;
  productId: string;
  productName: string;
  receivedQuantity: number;
  unit: string;
  purchasePrice: number;
  totalPrice: number;
  batchNo?: string;
  manufacturingDate?: string;
  expiryDate?: string;
}

export interface GoodsReceipt {
  id: string;
  grnNo: string;
  supplierId: string;
  supplierName: string;
  purchaseRef?: string;
  warehouseId: string;
  warehouseName: string;
  receiveDate: string;
  items: GoodsReceiptItem[];
  totalAmount: number;
  notes?: string;
  createdByName: string;
  createdAt: string;
}

export interface StockAlert {
  id: string;
  productId: string;
  productName: string;
  alertType: 'LOW_STOCK' | 'EXPIRED' | 'NEAR_EXPIRY' | 'OUT_OF_STOCK';
  currentStock: number;
  minStock: number;
  daysRemaining?: number;
  expiryDate?: string;
  batchNo?: string;
  createdAt: string;
}

export interface InventoryAudit {
  id: string;
  referenceType: 'PURCHASE' | 'GRN' | 'SALE' | 'SALE_RETURN' | 'PURCHASE_RETURN' | 'PRODUCTION' | 'ADJUSTMENT' | 'TRANSFER' | 'MANUAL';
  referenceNo: string;
  action: string;
  productId?: string;
  productName?: string;
  warehouseId?: string;
  oldValue?: string;
  newValue?: string;
  userId: string;
  userName: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  categoryId: string;
  categoryName?: string;
  unit: string; // e.g. kg, pcs, box, pack, gram
  unitId?: string;
  warehouseId?: string;
  warehouseName?: string;
  purchasePrice: number;
  salePrice: number;
  wholesalePrice?: number;
  costPrice: number;
  minStock: number;
  maxStock?: number;
  reorderLevel?: number;
  currentStock: number;
  reservedStock?: number;
  availableStock?: number;
  averageCost?: number;
  lastPurchaseCost?: number;
  description?: string;
  image?: string;
  expiryDays?: number;
  expiryTracking?: boolean;
  batchTracking?: boolean;
  brand?: string;
  shelf?: string;
  storageLocation?: string;
  openingStock?: number;
  costMethod?: 'FIFO' | 'LIFO' | 'AVCO';
  weight?: number;
  status: 'ACTIVE' | 'INACTIVE';
  supplierId?: string;
  supplierName?: string;
  taxRate: number; // percentage e.g. 5, 12, 18
  isKitchenItem?: boolean;
  variants?: ProductVariant[];
  hasRecipe?: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface InventoryLedger {
  id: string;
  productId: string;
  productName: string;
  warehouseId?: string;
  warehouseName?: string;
  batchNo?: string;
  type: 'STOCK_IN' | 'STOCK_OUT' | 'SALE' | 'SALE_RETURN' | 'PURCHASE' | 'PURCHASE_RETURN' | 'RETURN' | 'ADJUSTMENT' | 'PRODUCTION' | 'TRANSFER' | 'GRN' | 'MANUAL' | 'SALE_VOID';
  quantity: number;
  previousStock: number;
  newStock: number;
  referenceNo: string;
  reason?: string;
  createdByName: string;
  createdAt: string;
}

export interface StockAdjustment {
  id: string;
  productId: string;
  productName: string;
  warehouseId?: string;
  warehouseName?: string;
  batchNo?: string;
  type: 'ADD' | 'SUBTRACT' | 'EXPIRED' | 'DAMAGED' | 'CORRECTION' | 'LOST' | 'INCREASE' | 'DECREASE';
  quantity: number;
  reason: string;
  adjustedByName: string;
  createdAt: string;
}

export interface StockTransfer {
  id: string;
  transferNo: string;
  fromBranch: string;
  toBranch: string;
  fromWarehouseId?: string;
  fromWarehouseName?: string;
  toWarehouseId?: string;
  toWarehouseName?: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
  }[];
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  companyName?: string;
  email?: string;
  phone: string;
  address?: string;
  taxNumber?: string;
  outstandingBalance: number;
  createdAt: string;
}

export interface PurchaseItem {
  id?: string;
  productId: string;
  productName: string;
  quantity: number;
  purchasePrice: number;
  total: number;
  expiryDate?: string;
  batchNo?: string;
}

export interface Purchase {
  id: string;
  purchaseNo: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseItem[];
  subtotal: number;
  taxAmount: number;
  discount: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING';
  paymentMethod: 'CASH' | 'BANK' | 'CHEQUE' | 'CREDIT';
  notes?: string;
  createdByName: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  outstandingBalance: number;
  loyaltyPoints: number;
  createdAt: string;
}

export interface CustomerLedger {
  id: string;
  customerId: string;
  type: 'CREDIT_SALE' | 'PAYMENT' | 'REFUND' | 'LOYALTY_REDEEM' | 'ADJUSTMENT';
  amount: number;
  balanceAfter: number;
  referenceNo: string;
  notes?: string;
  createdAt: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  barcode?: string;
  unit: string;
  price: number;
  quantity: number;
  discount: number;
  taxRate: number;
  subtotal: number;
  isKitchenItem?: boolean;
}

export interface Sale {
  id: string;
  invoiceNo: string;
  customerId?: string;
  customerName?: string;
  items: SaleItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: 'CASH' | 'CARD' | 'MOBILE' | 'CREDIT' | 'SPLIT' | string;
  paymentDetails?: string | {
    cash?: number;
    card?: number;
    mobile?: number;
    splitCredit?: number;
  };
  status: 'COMPLETED' | 'HELD' | 'REFUNDED' | 'VOID' | 'VOIDED';
  branchId?: string;
  counterId?: string;
  cashierName: string;
  kitchenStatus?: 'PENDING' | 'PREPARING' | 'READY' | 'SERVED';
  voidedBy?: string;
  voidedByName?: string;
  voidedAt?: string;
  voidReason?: string;
  createdAt: string;
}

export interface KitchenOrder {
  id: string;
  orderNo: string;
  saleId: string;
  invoiceNo: string;
  tableOrToken?: string;
  items: {
    productName: string;
    quantity: number;
    notes?: string;
    status: 'PENDING' | 'PREPARING' | 'READY';
  }[];
  status: 'PENDING' | 'PREPARING' | 'READY' | 'SERVED';
  createdAt: string;
}

export interface ProductionBatch {
  id: string;
  batchNo: string;
  productId: string;
  productName: string;
  recipeId: string;
  plannedQuantity: number;
  actualQuantity: number;
  rawMaterialsUsed: {
    rawMaterialId: string;
    rawMaterialName: string;
    quantity: number;
    unit: string;
  }[];
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED';
  startDate: string;
  completedDate?: string;
  operatorName: string;
}

export interface Expense {
  id: string;
  category: string;
  title: string;
  amount: number;
  paymentMethod: string;
  referenceNo?: string;
  notes?: string;
  createdByName: string;
  createdAt: string;
}

export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  designation: string;
  phone: string;
  email?: string;
  department: string;
  departmentId?: string;
  salary: number;
  joiningDate: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  createdAt: string;
}

export interface Attendance {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'LEAVE';
  notes?: string;
}

export interface Payroll {
  id: string;
  employeeId: string;
  employeeName: string;
  monthYear: string; // YYYY-MM
  basicSalary: number;
  bonuses: number;
  deductions: number;
  netSalary: number;
  paymentStatus: 'PAID' | 'PENDING';
  paymentDate?: string;
}

export interface CashShift {
  id: string;
  shiftNo?: string;
  registerId?: string;
  registerName?: string;
  branchId?: string;
  branchName?: string;
  cashierId: string;
  cashierName: string;
  counterId: string;
  startTime: string;
  endTime?: string;
  openingCash: number;
  openingDenominations?: Record<string, number>;
  closingCash?: number;
  expectedCash?: number;
  actualCash?: number;
  variance?: number;
  varianceReason?: string;
  cashSales: number;
  cardSales: number;
  mobileSales: number;
  jazzCashSales?: number;
  easyPaisaSales?: number;
  bankSales?: number;
  creditSales: number;
  totalSales: number;
  paidIn?: number;
  paidOut?: number;
  cashRefunds?: number;
  discrepancy?: number;
  status: 'OPEN' | 'CLOSED';
  notes?: string;
  closedBy?: string;
  createdAt?: string;
}

export interface CashRegister {
  id: string;
  registerNo: string;
  name: string;
  branchId: string;
  branchName?: string;
  counterId?: string;
  status: 'OPEN' | 'CLOSED';
  activeShiftId?: string;
  createdAt: string;
}

export interface CashDrawerTransaction {
  id: string;
  shiftId: string;
  registerId: string;
  type: 'PAID_IN' | 'PAID_OUT' | 'SAFE_DROP' | 'CASH_PICKUP' | 'CASH_SALE' | 'CASH_REFUND' | 'CASH_EXPENSE' | 'ADJUSTMENT';
  amount: number;
  reason: string;
  referenceNo?: string;
  userId: string;
  userName: string;
  createdAt: string;
}

export interface BankAccount {
  id: string;
  accountType: 'BANK' | 'MOBILE_WALLET' | 'CASH';
  name: string;
  accountNumber?: string;
  accountTitle?: string;
  bankName?: string;
  branchName?: string;
  iban?: string;
  openingBalance: number;
  currentBalance: number;
  status: 'ACTIVE' | 'INACTIVE';
  notes?: string;
  createdAt: string;
}

export interface ChartAccount {
  id: string;
  accountCode: string;
  accountName: string;
  category: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' | 'COGS';
  subCategory?: string;
  balance: number;
  isSystem?: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface JournalEntryItem {
  id?: string;
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
  notes?: string;
}

export interface JournalEntry {
  id: string;
  entryNo: string;
  date: string;
  referenceType?: 'SALE' | 'PURCHASE' | 'EXPENSE' | 'TRANSFER' | 'CUSTOMER_PAYMENT' | 'SUPPLIER_PAYMENT' | 'MANUAL';
  referenceNo?: string;
  description: string;
  items: JournalEntryItem[];
  totalDebit: number;
  totalCredit: number;
  createdBy: string;
  createdAt: string;
}

export interface AccountTransfer {
  id: string;
  transferNo: string;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  amount: number;
  date: string;
  referenceNo?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface SupplierLedger {
  id: string;
  supplierId: string;
  type: 'PURCHASE' | 'PAYMENT' | 'RETURN' | 'ADJUSTMENT';
  amount: number;
  balanceAfter: number;
  referenceNo: string;
  notes?: string;
  createdAt: string;
}

export interface BankReconciliation {
  id: string;
  accountId: string;
  accountName: string;
  statementDate: string;
  statementBalance: number;
  bookBalance: number;
  difference: number;
  status: 'MATCHED' | 'DISCREPANCY';
  reconciledBy: string;
  notes?: string;
  createdAt: string;
}

export interface PaymentMethodConfig {
  id: string;
  name: string;
  enabled: boolean;
  requiresReference: boolean;
  accountMapping?: string;
}

export interface BusinessSettings {
  name: string;
  logoUrl?: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  taxNumber: string;
  currency: string;
  currencySymbol: string;
  decimalPlaces?: number;
  dateFormat?: string;
  timeFormat?: string;
  timezone?: string;
  taxPercentage: number;
  defaultCustomer?: string;
  defaultBranch?: string;
  defaultRegister?: string;
  invoicePrefix: string;
  receiptHeader?: string;
  receiptFooter: string;
  returnPolicyText?: string;
  thermalPrinterWidth: '80mm' | '58mm' | 'A4';
  autoPrintReceipt: boolean;
  printCopies?: number;
  showLogo?: boolean;
  showBusinessAddress?: boolean;
  showPhone?: boolean;
  showTax?: boolean;
  showCashierName?: boolean;
  showCustomer?: boolean;
  enableKitchenRouting: boolean;
  allowNegativeStock?: boolean;
  allowSellingOutOfStock?: boolean;
  allowStockAdjustment?: boolean;
  requireReasonForAdjustment?: boolean;
  lowStockThreshold?: number;
  batchTracking?: boolean;
  expiryTracking?: boolean;
  stockConsumptionMode?: 'FIFO' | 'FEFO' | 'LIFO';
  autoDeductOnSale?: boolean;
  autoRestoreOnVoid?: boolean;
  requireManagerApprovalForNegativeStock?: boolean;
  enableDiscounts?: boolean;
  maxCashierDiscountPercent?: number;
  requireManagerApprovalDiscount?: boolean;
  allowPriceOverride?: boolean;
  requireManagerApprovalPriceOverride?: boolean;
  allowHeldOrders?: boolean;
  maxHeldOrders?: number;
  allowSalesReturns?: boolean;
  returnRequiresManagerApproval?: boolean;
  allowInvoiceVoid?: boolean;
  voidRequiresReason?: boolean;
  defaultPaymentMethod?: string;
  autoFocusBarcodeScanner?: boolean;
  enableRegisterSessions?: boolean;
  requireOpeningCash?: boolean;
  allowCashierOpenRegister?: boolean;
  allowCashInCashOut?: boolean;
  requireReasonCashInCashOut?: boolean;
  requireClosingCashCount?: boolean;
  allowClosingWithVariance?: boolean;
  maxAllowedVariance?: number;
  requireManagerApprovalHighVariance?: boolean;
  autoGenerateZReport?: boolean;
  paymentMethods?: PaymentMethodConfig[];
  defaultUnit?: string;
  requireSKU?: boolean;
  requireBarcode?: boolean;
  allowDuplicateBarcode?: boolean;
  showCostPriceToCashier?: boolean;
  allowWalkInCustomer?: boolean;
  requireCustomerForCreditSale?: boolean;
  defaultCreditLimit?: number;
  sessionTimeoutMinutes?: number;
  minPasswordLength?: number;
  maxFailedLogins?: number;
  enableAuditLogging?: boolean;
  lowStockAlerts?: boolean;
  expiryAlerts?: boolean;
  registerVarianceAlerts?: boolean;
  failedLoginAlerts?: boolean;
  theme: 'dark' | 'light';
  branchName: string;
  counterName: string;

  // Printer & Hardware Configuration
  receiptPrinter?: string;
  labelPrinter?: string;
  kitchenPrinter?: string;
  defaultPrinter?: string;
  printerType?: 'TSC_TSPL' | 'ESC_POS' | 'WINDOWS_SPOOLER' | 'CUSTOM';
  labelWidthMm?: number;
  labelHeightMm?: number;
  labelGapMm?: number;
  printDensity?: number;
  printSpeed?: number;
  barcodeFormat?: string;
  autoCut?: boolean;
  cashDrawerTrigger?: boolean;
  printBridgeUrl?: string;
}

export interface PrintJob {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  branchId?: string;
  printerName: string;
  jobType: 'BARCODE_LABEL' | 'RECEIPT' | 'KITCHEN_ORDER' | 'TEST_PRINT';
  productName?: string;
  copies: number;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  errorMessage?: string;
}

export interface Branch {
  id: string;
  branchCode: string;
  branchName: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  manager?: string;
  status: 'ACTIVE' | 'INACTIVE';
  isHeadOffice: boolean;
  createdAt: string;
  updatedAt?: string;

  // Legacy compatibility fields
  name?: string;
  code?: string;
  isMain?: boolean;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  details: string;
  ipAddress?: string;
  createdAt: string;
}

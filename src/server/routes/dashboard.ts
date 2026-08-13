import { Router } from 'express';
import { loadDB } from '../store';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'));

router.get('/stats', (req, res) => {
  const db = loadDB();
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  // Sales filter
  const completedSales = db.sales.filter((s) => s.status === 'COMPLETED');

  let todaySales = 0;
  let todayCount = 0;
  let weeklySales = 0;
  let monthlySales = 0;
  let yearlySales = 0;
  let totalSalesRevenue = 0;
  let totalCOGS = 0;
  let cashSalesTotal = 0;
  let cardSalesTotal = 0;
  let mobileSalesTotal = 0;

  completedSales.forEach((sale) => {
    const saleDate = new Date(sale.createdAt);
    const saleDateStr = sale.createdAt.split('T')[0];

    totalSalesRevenue += sale.totalAmount;

    if (sale.paymentMethod === 'CASH') cashSalesTotal += sale.totalAmount;
    else if (sale.paymentMethod === 'CARD') cardSalesTotal += sale.totalAmount;
    else if (sale.paymentMethod === 'MOBILE') mobileSalesTotal += sale.totalAmount;

    // Calculate COGS
    sale.items.forEach((item) => {
      const prod = db.products.find((p) => p.id === item.productId);
      const cost = prod ? prod.costPrice || prod.purchasePrice || 0 : 0;
      totalCOGS += cost * item.quantity;
    });

    if (saleDateStr === todayStr) {
      todaySales += sale.totalAmount;
      todayCount++;
    }
    if (saleDate >= startOfWeek) {
      weeklySales += sale.totalAmount;
    }
    if (saleDate >= startOfMonth) {
      monthlySales += sale.totalAmount;
    }
    if (saleDate >= startOfYear) {
      yearlySales += sale.totalAmount;
    }
  });

  // Expenses
  let todayExpenses = 0;
  let totalExpenses = 0;
  let cashExpenses = 0;

  db.expenses.forEach((e) => {
    totalExpenses += e.amount;
    const expDateStr = e.createdAt.split('T')[0];
    if (expDateStr === todayStr) todayExpenses += e.amount;
    if (e.paymentMethod === 'CASH') cashExpenses += e.amount;
  });

  // Profit / Loss
  const grossProfit = totalSalesRevenue - totalCOGS;
  const netProfit = grossProfit - totalExpenses;

  // Receivables & Payables
  const pendingReceivables = db.customers.reduce((sum, c) => sum + (c.outstandingBalance || 0), 0);
  const pendingPayables = db.suppliers.reduce((sum, s) => sum + (s.outstandingBalance || 0), 0);

  // Cash in Hand & Bank Balance directly from Bank Accounts
  const bankAccounts = db.bankAccounts || [];
  const cashInHand = bankAccounts.find((a) => a.accountType === 'CASH')?.currentBalance || 0;
  const bankBalance = bankAccounts.filter((a) => a.accountType === 'BANK').reduce((sum, a) => sum + a.currentBalance, 0);
  const mobileWalletBalance = bankAccounts.filter((a) => a.accountType === 'MOBILE_WALLET').reduce((sum, a) => sum + a.currentBalance, 0);

  // Active Employees
  const activeEmployees = db.employees.filter((e) => e.status === 'ACTIVE').length;

  // Inventory value & Stock alerts & Expiring
  let inventoryValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let expiringProductsCount = 0;

  const lowStockList: Array<{ id: string; name: string; currentStock: number; minStock: number; unit: string }> = [];

  db.products.forEach((p) => {
    if (p.status === 'ACTIVE') {
      const cost = p.averageCost || p.costPrice || p.purchasePrice || 0;
      inventoryValue += p.currentStock * cost;
      if (p.currentStock <= 0) {
        outOfStockCount++;
        lowStockList.push({ id: p.id, name: p.name, currentStock: p.currentStock, minStock: p.minStock || 5, unit: p.unit });
      } else if (p.currentStock <= (p.minStock || 5)) {
        lowStockCount++;
        lowStockList.push({ id: p.id, name: p.name, currentStock: p.currentStock, minStock: p.minStock || 5, unit: p.unit });
      }
    }
  });

  // Check expiring items from purchases or product expiryDays
  db.purchases.forEach((pur) => {
    pur.items.forEach((item) => {
      if (item.expiryDate) {
        const expDate = new Date(item.expiryDate);
        const diffDays = (expDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
        if (diffDays <= 15) {
          expiringProductsCount++;
        }
      }
    });
  });

  // Product sales mapping for Top/Slow moving products
  const productSalesMap: Record<string, { id: string; name: string; qty: number; revenue: number; category: string }> = {};
  completedSales.forEach((s) => {
    s.items.forEach((item) => {
      const prod = db.products.find((p) => p.id === item.productId);
      const catName = prod ? prod.categoryName || 'General' : 'General';
      if (!productSalesMap[item.productId]) {
        productSalesMap[item.productId] = { id: item.productId, name: item.productName, qty: 0, revenue: 0, category: catName };
      }
      productSalesMap[item.productId].qty += item.quantity;
      productSalesMap[item.productId].revenue += item.subtotal;
    });
  });

  const bestSellingProducts = Object.values(productSalesMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const soldProductIds = new Set(Object.keys(productSalesMap));
  const slowMovingProducts = db.products
    .filter((p) => p.status === 'ACTIVE' && (!soldProductIds.has(p.id) || productSalesMap[p.id].qty <= 2))
    .map((p) => ({ id: p.id, name: p.name, stock: p.currentStock, categoryName: p.categoryName || 'General' }))
    .slice(0, 5);

  // Top Customers
  const customerSpentMap: Record<string, { id: string; name: string; phone: string; totalSpent: number; ordersCount: number }> = {};
  completedSales.forEach((s) => {
    if (s.customerId && s.customerName) {
      if (!customerSpentMap[s.customerId]) {
        const cust = db.customers.find((c) => c.id === s.customerId);
        customerSpentMap[s.customerId] = {
          id: s.customerId,
          name: s.customerName,
          phone: cust?.phone || '',
          totalSpent: 0,
          ordersCount: 0,
        };
      }
      customerSpentMap[s.customerId].totalSpent += s.totalAmount;
      customerSpentMap[s.customerId].ordersCount++;
    }
  });

  const topCustomers = Object.values(customerSpentMap)
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 5);

  // Sales Trend Chart (Last 7 days)
  const salesTrendChart: Array<{ day: string; sales: number; profit: number }> = [];
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayName = daysOfWeek[d.getDay()];

    const daySalesList = completedSales.filter((s) => s.createdAt.startsWith(dateStr));
    const daySales = daySalesList.reduce((sum, s) => sum + s.totalAmount, 0);
    let dayCOGS = 0;
    daySalesList.forEach((s) => {
      s.items.forEach((item) => {
        const prod = db.products.find((p) => p.id === item.productId);
        const cost = prod ? prod.costPrice || prod.purchasePrice || 0 : 0;
        dayCOGS += cost * item.quantity;
      });
    });
    const dayProfit = daySales - dayCOGS;
    salesTrendChart.push({ day: dayName, sales: daySales, profit: dayProfit });
  }

  // Product Category Chart
  const categoryMap: Record<string, number> = {};
  db.products.forEach((p) => {
    const cName = p.categoryName || 'General';
    categoryMap[cName] = (categoryMap[cName] || 0) + p.currentStock * p.salePrice;
  });

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4', '#F97316'];
  const categoryChart = Object.entries(categoryMap).map(([name, value], index) => ({
    name,
    value,
    color: COLORS[index % COLORS.length],
  }));

  // Kitchen Orders Status
  const kitchenOrdersStatus = {
    pending: db.kitchenOrders.filter((k) => k.status === 'PENDING').length,
    preparing: db.kitchenOrders.filter((k) => k.status === 'PREPARING').length,
    ready: db.kitchenOrders.filter((k) => k.status === 'READY').length,
    served: db.kitchenOrders.filter((k) => k.status === 'SERVED').length,
  };

  // Production Status
  const productionStatus = {
    planned: db.productionBatches.filter((b) => b.status === 'PLANNED').length,
    inProgress: db.productionBatches.filter((b) => b.status === 'IN_PROGRESS').length,
    completed: db.productionBatches.filter((b) => b.status === 'COMPLETED').length,
  };

  // Recent Sales & Purchases
  const recentSales = completedSales.slice(-5).reverse();
  const recentPurchases = db.purchases.slice(-5).reverse();

  // Notifications
  const notifications: Array<{ id: string; type: 'warning' | 'danger' | 'info'; title: string; message: string; timestamp: string }> = [];

  if (lowStockCount > 0 || outOfStockCount > 0) {
    notifications.push({
      id: 'notif-stock',
      type: 'warning',
      title: 'Stock Alert',
      message: `${lowStockCount} items low on stock, ${outOfStockCount} items out of stock.`,
      timestamp: 'Just now',
    });
  }

  if (expiringProductsCount > 0) {
    notifications.push({
      id: 'notif-expiring',
      type: 'danger',
      title: 'Expiry Notice',
      message: `${expiringProductsCount} product batches expiring within 15 days.`,
      timestamp: 'Today',
    });
  }

  if (kitchenOrdersStatus.preparing > 0) {
    notifications.push({
      id: 'notif-kitchen',
      type: 'info',
      title: 'Kitchen Alert',
      message: `${kitchenOrdersStatus.preparing} kitchen orders active in preparation.`,
      timestamp: 'Active',
    });
  }

  res.json({
    todaySales,
    todayCount,
    monthlySales,
    yearlySales,
    grossProfit,
    netProfit,
    cashInHand,
    bankBalance,
    mobileWalletBalance,
    todayExpenses,
    totalExpenses,
    pendingReceivables,
    pendingPayables,
    totalCustomers: db.customers.length,
    activeEmployees,
    inventoryValue,
    lowStockCount,
    outOfStockCount,
    lowStockList,
    expiringProductsCount,
    totalProducts: db.products.length,
    totalCategories: db.categories.length,
    totalSuppliers: db.suppliers.length,
    bestSellingProducts,
    slowMovingProducts,
    topCustomers,
    salesTrendChart,
    categoryChart,
    recentSales,
    recentPurchases,
    kitchenOrdersStatus,
    productionStatus,
    notifications,
  });
});

export default router;

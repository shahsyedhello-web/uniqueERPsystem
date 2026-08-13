import { Router } from 'express';
import { loadDB } from '../store';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'));

router.get('/summary', (req: AuthRequest, res) => {
  const { startDate, endDate } = req.query;
  const db = loadDB();

  let sales = db.sales.filter((s) => s.status === 'COMPLETED');
  let purchases = db.purchases;
  let expenses = db.expenses;

  if (startDate && endDate) {
    const start = new Date(startDate as string).getTime();
    const end = new Date(endDate as string).getTime();

    sales = sales.filter((s) => {
      const t = new Date(s.createdAt).getTime();
      return t >= start && t <= end;
    });

    purchases = purchases.filter((p) => {
      const t = new Date(p.createdAt).getTime();
      return t >= start && t <= end;
    });

    expenses = expenses.filter((e) => {
      const t = new Date(e.createdAt).getTime();
      return t >= start && t <= end;
    });
  }

  const totalSalesAmount = sales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalTaxCollected = sales.reduce((sum, s) => sum + s.taxAmount, 0);
  const totalDiscounts = sales.reduce((sum, s) => sum + s.discountAmount, 0);

  const totalPurchaseAmount = purchases.reduce((sum, p) => sum + p.totalAmount, 0);
  const totalExpenseAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

  // COGS calculation
  let totalCOGS = 0;
  sales.forEach((s) => {
    s.items.forEach((item) => {
      const prod = db.products.find((p) => p.id === item.productId);
      const cost = prod ? prod.costPrice || prod.purchasePrice || 0 : 0;
      totalCOGS += cost * item.quantity;
    });
  });

  const grossProfit = totalSalesAmount - totalCOGS;
  const netProfit = grossProfit - totalExpenseAmount;

  res.json({
    period: { startDate, endDate },
    salesCount: sales.length,
    totalSalesAmount,
    totalTaxCollected,
    totalDiscounts,
    purchasesCount: purchases.length,
    totalPurchaseAmount,
    totalExpenseAmount,
    totalCOGS,
    grossProfit,
    netProfit,
  });
});

router.get('/top-products', (req: AuthRequest, res) => {
  const db = loadDB();
  const productSalesMap: Record<string, { name: string; categoryName?: string; quantity: number; revenue: number }> = {};

  db.sales
    .filter((s) => s.status === 'COMPLETED')
    .forEach((s) => {
      s.items.forEach((i) => {
        if (!productSalesMap[i.productId]) {
          const prod = db.products.find((p) => p.id === i.productId);
          productSalesMap[i.productId] = {
            name: i.productName,
            categoryName: prod?.categoryName || 'General',
            quantity: 0,
            revenue: 0,
          };
        }
        productSalesMap[i.productId].quantity += i.quantity;
        productSalesMap[i.productId].revenue += (i as any).totalPrice || (i.subtotal || i.price * i.quantity);
      });
    });

  const topProducts = Object.values(productSalesMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  res.json(topProducts);
});

router.get('/payment-methods', (req: AuthRequest, res) => {
  const db = loadDB();
  const methodMap: Record<string, { count: number; total: number }> = {
    CASH: { count: 0, total: 0 },
    CARD: { count: 0, total: 0 },
    JAZZCASH: { count: 0, total: 0 },
    EASYPAISA: { count: 0, total: 0 },
    BANK_TRANSFER: { count: 0, total: 0 },
    CREDIT: { count: 0, total: 0 },
    SPLIT: { count: 0, total: 0 },
  };

  db.sales
    .filter((s) => s.status === 'COMPLETED')
    .forEach((s) => {
      const method = s.paymentMethod || 'CASH';
      if (!methodMap[method]) methodMap[method] = { count: 0, total: 0 };
      methodMap[method].count += 1;
      methodMap[method].total += s.totalAmount;
    });

  res.json(methodMap);
});

export default router;

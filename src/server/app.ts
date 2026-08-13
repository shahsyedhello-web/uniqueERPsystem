import express from 'express';
import cors from 'cors';
import path from 'path';

import authRoutes from './routes/auth';
import setupRoutes from './routes/setup';
import dashboardRoutes from './routes/dashboard';
import productRoutes from './routes/products';
import categoryRoutes from './routes/categories';
import inventoryRoutes from './routes/inventory';
import purchaseRoutes from './routes/purchases';
import supplierRoutes from './routes/suppliers';
import saleRoutes from './routes/sales';
import customerRoutes from './routes/customers';
import expenseRoutes from './routes/expenses';
import employeeRoutes from './routes/employees';
import kitchenRoutes from './routes/kitchen';
import productionRoutes from './routes/production';
import reportRoutes from './routes/reports';
import settingRoutes from './routes/settings';
import userRoutes from './routes/users';
import branchRoutes from './routes/branches';
import departmentRoutes from './routes/departments';
import financeRoutes from './routes/finance';
import hardwareRoutes from './routes/hardware';
import { loadDB } from './store';

export const app = express();

// Initialize in-memory database store safely
try {
  loadDB();
} catch (err) {
  console.warn('[App] Non-fatal loadDB initialization warning:', err);
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Uploads static directory
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check endpoint (lightweight, independent from Prisma)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Unique Sweets & Bakers POS',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Diagnostic database health check endpoint
app.get('/api/health/db', async (req, res) => {
  try {
    const { ensurePrismaInitialized, getPrisma } = await import('./prismaService');
    await ensurePrismaInitialized();
    const p = getPrisma();
    if (p) {
      await p.$queryRaw`SELECT 1`;
      return res.json({ status: 'ok', database: 'PostgreSQL (Prisma)' });
    } else {
      return res.json({ status: 'ok', database: 'Fallback Store (JSON)' });
    }
  } catch (err: any) {
    console.warn('[DB Health Check Exception]:', err?.message || err);
    return res.status(200).json({
      status: 'error',
      message: 'Database connection failed',
    });
  }
});

// API Routes
app.use('/api/setup', setupRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/kitchen', kitchenRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/hardware', hardwareRoutes);

// Catch-all for unmatched /api routes
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route ${req.method} ${req.path} not found` });
});

// Global Express API Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Unhandled Express Server Error]:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

export default app;

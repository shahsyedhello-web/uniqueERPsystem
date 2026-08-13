import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();

export async function migrateJsonToPostgres() {
  const dbUrl = (process.env.DATABASE_URL || '').trim();
  if (!dbUrl || dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')) {
    console.log('[Migration] Skipping JSON migration: DATABASE_URL not configured for remote PostgreSQL.');
    return;
  }

  const pool = new pg.Pool({ connectionString: dbUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  let jsonPath = path.join(process.cwd(), 'data', 'pos_database.json');
  if (!fs.existsSync(jsonPath)) {
    jsonPath = path.join('/tmp', 'pos_database.json');
  }

  if (!fs.existsSync(jsonPath)) {
    console.log('[Migration] No pos_database.json file found to migrate.');
    await prisma.$disconnect();
    await pool.end();
    return;
  }

  console.log(`[Migration] Starting JSON database migration from ${jsonPath}...`);

  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const db = JSON.parse(raw);

  const stats = {
    users: 0,
    categories: 0,
    suppliers: 0,
    products: 0,
    customers: 0,
    sales: 0,
    inventoryLogs: 0,
    expenses: 0,
    employees: 0,
    settings: 0,
  };

  try {
    // 1. Migrate Users
    if (Array.isArray(db.users)) {
      for (const u of db.users) {
        if (!u.email) continue;
        const existing = await prisma.user.findFirst({
          where: { OR: [{ id: u.id }, { email: u.email.trim().toLowerCase() }] },
        });

        if (!existing) {
          const passHash = (db.userPasswords && db.userPasswords[u.id]) || '$2a$10$wT8K...dummy';
          let role: any = 'ADMIN';
          if (u.role === 'CASHIER') role = 'CASHIER';
          else if (u.role === 'MANAGER') role = 'MANAGER';
          else if (u.role === 'KITCHEN') role = 'KITCHEN';
          else if (u.role === 'INVENTORY_MANAGER') role = 'INVENTORY_MANAGER';

          await prisma.user.create({
            data: {
              id: u.id || undefined,
              name: u.name || 'User',
              email: u.email.trim().toLowerCase(),
              passwordHash: passHash,
              role,
              isActive: u.isActive !== false,
              createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
            },
          });
          stats.users++;
        }
      }
    }

    // 2. Migrate Categories
    if (Array.isArray(db.categories)) {
      for (const c of db.categories) {
        if (!c.name) continue;
        const code = c.code || `CAT-${c.id.slice(0, 6)}`;
        const existing = await prisma.category.findFirst({
          where: { OR: [{ id: c.id }, { code }] },
        });

        if (!existing) {
          await prisma.category.create({
            data: {
              id: c.id || undefined,
              name: c.name,
              code,
              description: c.description || null,
              status: c.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
              createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
            },
          });
          stats.categories++;
        }
      }
    }

    // Ensure at least one Category exists
    let defaultCat = await prisma.category.findFirst();
    if (!defaultCat) {
      defaultCat = await prisma.category.create({
        data: {
          name: 'General',
          code: 'CAT-GEN-001',
          description: 'Default general category',
          status: 'ACTIVE',
        },
      });
      stats.categories++;
    }

    // 3. Migrate Suppliers
    if (Array.isArray(db.suppliers)) {
      for (const s of db.suppliers) {
        if (!s.name) continue;
        const existing = await prisma.supplier.findFirst({
          where: { OR: [{ id: s.id }, { name: s.name }] },
        });

        if (!existing) {
          await prisma.supplier.create({
            data: {
              id: s.id || undefined,
              name: s.name,
              companyName: s.companyName || null,
              phone: s.phone || 'N/A',
              email: s.email || null,
              address: s.address || null,
              outstandingBalance: Number(s.outstandingBalance) || 0,
              createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
            },
          });
          stats.suppliers++;
        }
      }
    }

    // 4. Migrate Products
    if (Array.isArray(db.products)) {
      for (const p of db.products) {
        if (!p.name) continue;

        // Ensure unique SKU & Barcode
        const sku = p.sku || `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const barcode = p.barcode || `BAR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const existing = await prisma.product.findFirst({
          where: { OR: [{ id: p.id }, { sku }, { barcode }] },
        });

        if (!existing) {
          let catId = p.categoryId;
          const validCat = await prisma.category.findUnique({ where: { id: catId } });
          if (!validCat) {
            catId = defaultCat.id;
          }

          let suppId: string | null = null;
          if (p.supplierId) {
            const validSupp = await prisma.supplier.findUnique({ where: { id: p.supplierId } });
            if (validSupp) suppId = validSupp.id;
          }

          await prisma.product.create({
            data: {
              id: p.id || undefined,
              name: p.name,
              sku,
              barcode,
              categoryId: catId,
              unit: p.unit || 'pcs',
              purchasePrice: Number(p.purchasePrice) || 0,
              salePrice: Number(p.salePrice) || 0,
              costPrice: Number(p.costPrice) || 0,
              minStock: Number(p.minStock) || 5,
              currentStock: Number(p.currentStock) || 0,
              description: p.description || null,
              image: p.image || null,
              status: p.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
              supplierId: suppId,
              taxRate: Number(p.taxRate) || 0,
              isKitchenItem: Boolean(p.isKitchenItem),
              createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
            },
          });
          stats.products++;
        }
      }
    }

    // 5. Migrate Customers
    if (Array.isArray(db.customers)) {
      for (const cust of db.customers) {
        if (!cust.name) continue;
        const phone = cust.phone || `P-${cust.id || Date.now()}`;
        const existing = await prisma.customer.findFirst({
          where: { OR: [{ id: cust.id }, { phone }] },
        });

        if (!existing) {
          await prisma.customer.create({
            data: {
              id: cust.id || undefined,
              name: cust.name,
              phone,
              email: cust.email || null,
              address: cust.address || null,
              outstandingBalance: Number(cust.outstandingBalance) || 0,
              loyaltyPoints: Number(cust.loyaltyPoints) || 0,
              createdAt: cust.createdAt ? new Date(cust.createdAt) : new Date(),
            },
          });
          stats.customers++;
        }
      }
    }

    // 6. Migrate Sales
    if (Array.isArray(db.sales)) {
      for (const sale of db.sales) {
        if (!sale.invoiceNo) continue;
        const existing = await prisma.sale.findFirst({
          where: { OR: [{ id: sale.id }, { invoiceNo: sale.invoiceNo }] },
        });

        if (!existing) {
          let pm: any = 'CASH';
          if (sale.paymentMethod === 'CARD') pm = 'CARD';
          else if (sale.paymentMethod === 'MOBILE') pm = 'MOBILE';
          else if (sale.paymentMethod === 'CREDIT') pm = 'CREDIT';

          const createdSale = await prisma.sale.create({
            data: {
              id: sale.id || undefined,
              invoiceNo: sale.invoiceNo,
              subtotal: Number(sale.subtotal) || 0,
              taxAmount: Number(sale.taxAmount) || 0,
              discountAmount: Number(sale.discountAmount) || 0,
              totalAmount: Number(sale.totalAmount) || 0,
              paidAmount: Number(sale.paidAmount) || 0,
              changeAmount: Number(sale.changeAmount) || 0,
              paymentMethod: pm,
              status: sale.status === 'REFUNDED' ? 'REFUNDED' : 'COMPLETED',
              cashierName: sale.cashierName || 'Cashier',
              createdAt: sale.createdAt ? new Date(sale.createdAt) : new Date(),
            },
          });

          if (Array.isArray(sale.items)) {
            for (const item of sale.items) {
              const validProd = await prisma.product.findUnique({ where: { id: item.productId } });
              if (validProd) {
                await prisma.saleItem.create({
                  data: {
                    saleId: createdSale.id,
                    productId: validProd.id,
                    unit: item.unit || validProd.unit,
                    price: Number(item.price) || 0,
                    quantity: Number(item.quantity) || 1,
                    discount: Number(item.discount) || 0,
                    taxRate: Number(item.taxRate) || 0,
                    subtotal: Number(item.subtotal) || 0,
                    isKitchenItem: Boolean(item.isKitchenItem),
                  },
                });
              }
            }
          }
          stats.sales++;
        }
      }
    }

    // 7. Migrate Inventory Logs
    if (Array.isArray(db.inventoryLogs)) {
      for (const log of db.inventoryLogs) {
        if (!log.productId) continue;
        const existing = await prisma.inventoryLog.findUnique({ where: { id: log.id } });
        if (!existing) {
          const validProd = await prisma.product.findUnique({ where: { id: log.productId } });
          if (validProd) {
            let stockType: any = 'STOCK_IN';
            if (log.type === 'SALE') stockType = 'SALE';
            else if (log.type === 'PURCHASE') stockType = 'PURCHASE';
            else if (log.type === 'ADJUSTMENT') stockType = 'ADJUSTMENT';
            else if (log.type === 'RETURN') stockType = 'RETURN';
            else if (log.type === 'STOCK_OUT') stockType = 'STOCK_OUT';
            else if (log.type === 'PRODUCTION') stockType = 'PRODUCTION';
            else if (log.type === 'TRANSFER') stockType = 'TRANSFER';

            await prisma.inventoryLog.create({
              data: {
                id: log.id || undefined,
                productId: validProd.id,
                type: stockType,
                quantity: Number(log.quantity) || 0,
                previousStock: Number(log.previousStock) || 0,
                newStock: Number(log.newStock) || 0,
                referenceNo: log.referenceNo || `REF-${Date.now()}`,
                reason: log.reason || null,
                createdByName: log.createdByName || 'System',
                createdAt: log.createdAt ? new Date(log.createdAt) : new Date(),
              },
            });
            stats.inventoryLogs++;
          }
        }
      }
    }

    // 8. Migrate Expenses
    if (Array.isArray(db.expenses)) {
      for (const exp of db.expenses) {
        if (!exp.title) continue;
        const existing = await prisma.expense.findUnique({ where: { id: exp.id } });
        if (!existing) {
          await prisma.expense.create({
            data: {
              id: exp.id || undefined,
              category: exp.category || 'General',
              title: exp.title,
              amount: Number(exp.amount) || 0,
              paymentMethod: exp.paymentMethod || 'CASH',
              referenceNo: exp.referenceNo || null,
              notes: exp.notes || null,
              createdByName: exp.createdByName || 'Admin',
              createdAt: exp.createdAt ? new Date(exp.createdAt) : new Date(),
            },
          });
          stats.expenses++;
        }
      }
    }

    // 9. Migrate Employees
    if (Array.isArray(db.employees)) {
      for (const emp of db.employees) {
        if (!emp.name) continue;
        const empCode = emp.employeeCode || `EMP-${Date.now()}-${Math.floor(Math.random() * 100)}`;
        const existing = await prisma.employee.findFirst({
          where: { OR: [{ id: emp.id }, { employeeCode: empCode }] },
        });

        if (!existing) {
          await prisma.employee.create({
            data: {
              id: emp.id || undefined,
              employeeCode: empCode,
              name: emp.name,
              designation: emp.designation || 'Staff',
              department: emp.department || 'General',
              phone: emp.phone || 'N/A',
              email: emp.email || null,
              salary: Number(emp.salary) || 0,
              joiningDate: emp.joiningDate ? new Date(emp.joiningDate) : new Date(),
              status: emp.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
              createdAt: emp.createdAt ? new Date(emp.createdAt) : new Date(),
            },
          });
          stats.employees++;
        }
      }
    }

    // 10. Migrate Settings
    if (db.settings && typeof db.settings === 'object') {
      for (const [k, v] of Object.entries(db.settings)) {
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
          await prisma.setting.upsert({
            where: { key: k },
            update: { value: String(v) },
            create: { key: k, value: String(v) },
          });
          stats.settings++;
        }
      }
    }

    console.log('[Migration] Migration from JSON to PostgreSQL completed successfully!');
    console.log('Migration Summary:', stats);
  } catch (err: any) {
    console.error('[Migration] Error during JSON to PostgreSQL migration:', err?.message || err);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

// Allow running via node/tsx directly
if (process.argv[1] && process.argv[1].endsWith('migrate-json-to-postgres.ts')) {
  migrateJsonToPostgres().catch(console.error);
}

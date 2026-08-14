import { Router } from 'express';
import { getPrisma, ensurePrismaInitialized, isDbConnected } from '../prismaService';
import { loadDB, saveDB, generateUUID } from '../store';
import { Category } from '../../types/pos';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

function handleCategoryError(res: any, err: any, defaultMessage: string) {
  const msg = err?.message || String(err || '');
  console.error(`[Categories Error]:`, err);

  if (msg.includes('DATABASE_UNAVAILABLE') || msg.includes("Can't reach database server")) {
    return res.status(503).json({ error: 'DATABASE_UNAVAILABLE', message: 'Production database is unavailable.' });
  }
  return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: msg || defaultMessage });
}

router.get('/', async (req, res) => {
  try {
    await ensurePrismaInitialized();
    const prisma = getPrisma();
    const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

    if (prisma && isDbConnected()) {
      const categories = await prisma.category.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      return res.json(categories);
    }

    if (isProd) {
      return res.status(503).json({ error: 'DATABASE_UNAVAILABLE', message: 'Production database is unavailable.' });
    }

    const db = loadDB();
    db.categories = db.categories || [];
    const categories = db.categories
      .filter((c: any) => !c.deletedAt)
      .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    return res.json(categories);
  } catch (err: any) {
    return handleCategoryError(res, err, 'Failed to fetch categories.');
  }
});

router.post('/', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  try {
    const { name, code, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Category Name is required.' });
    }

    const trimmedName = name.trim();

    await ensurePrismaInitialized();
    const prisma = getPrisma();
    const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

    if (!(prisma && isDbConnected()) && isProd) {
      return res.status(503).json({ error: 'DATABASE_UNAVAILABLE', message: 'Production database is unavailable.' });
    }

    if (prisma && isDbConnected()) {
      // Check duplicate category name
      const existingName = await prisma.category.findFirst({
        where: { name: { equals: trimmedName, mode: 'insensitive' }, deletedAt: null },
      });
      if (existingName) {
        return res.status(400).json({ error: 'CATEGORY_NAME_EXISTS', message: `A category with name "${trimmedName}" already exists.` });
      }

      // Auto-generate code if missing
      let catCode = code ? code.trim().toUpperCase() : '';
      if (!catCode) {
        const count = await prisma.category.count();
        catCode = 'CAT-' + (count + 1).toString().padStart(3, '0');
      }

      const existingCode = await prisma.category.findFirst({
        where: { code: { equals: catCode, mode: 'insensitive' } },
      });
      if (existingCode) {
        return res.status(400).json({ error: 'CATEGORY_CODE_EXISTS', message: `A category with code "${catCode}" already exists.` });
      }

      const newCategory = await prisma.category.create({
        data: {
          name: trimmedName,
          code: catCode,
          description: description ? description.trim() : null,
          status: 'ACTIVE',
        },
      });

      return res.status(201).json(newCategory);
    }

    // JSON Store fallback (dev only)
    const db = loadDB();
    db.categories = db.categories || [];

    const existingName = db.categories.find(
      (c) => !c.deletedAt && c.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (existingName) {
      return res.status(400).json({ error: 'CATEGORY_NAME_EXISTS', message: `A category with name "${trimmedName}" already exists.` });
    }

    let catCode = code ? code.trim().toUpperCase() : '';
    if (!catCode) {
      catCode = 'CAT-' + (db.categories.length + 1).toString().padStart(3, '0');
    }

    const existingCode = db.categories.find((c) => c.code.toLowerCase() === catCode.toLowerCase());
    if (existingCode) {
      return res.status(400).json({ error: 'CATEGORY_CODE_EXISTS', message: `A category with code "${catCode}" already exists.` });
    }

    const newCategory: Category = {
      id: generateUUID(),
      name: trimmedName,
      code: catCode,
      description: description ? description.trim() : undefined,
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.categories.unshift(newCategory);
    saveDB();

    return res.status(201).json(newCategory);
  } catch (err: any) {
    return handleCategoryError(res, err, 'Failed to create category.');
  }
});

router.put('/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  try {
    const rawId = req.params.id;
    const id = String(rawId || '').trim();
    const { name, code, description, status } = req.body;

    await ensurePrismaInitialized();
    const prisma = getPrisma();
    const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

    if (!(prisma && isDbConnected()) && isProd) {
      return res.status(503).json({ error: 'DATABASE_UNAVAILABLE', message: 'Production database is unavailable.' });
    }

    if (prisma && isDbConnected()) {
      const existing = await prisma.category.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'CATEGORY_NOT_FOUND', message: 'Category does not exist.' });
      }

      if (name && name.trim()) {
        const trimmedName = name.trim();
        const duplicate = await prisma.category.findFirst({
          where: {
            id: { not: id },
            name: { equals: trimmedName, mode: 'insensitive' },
            deletedAt: null,
          },
        });
        if (duplicate) {
          return res.status(400).json({ error: 'CATEGORY_NAME_EXISTS', message: `A category with name "${trimmedName}" already exists.` });
        }
      }

      if (code && code.trim()) {
        const trimmedCode = code.trim().toUpperCase();
        const duplicateCode = await prisma.category.findFirst({
          where: {
            id: { not: id },
            code: { equals: trimmedCode, mode: 'insensitive' },
          },
        });
        if (duplicateCode) {
          return res.status(400).json({ error: 'CATEGORY_CODE_EXISTS', message: `A category with code "${trimmedCode}" already exists.` });
        }
      }

      const updated = await prisma.category.update({
        where: { id },
        data: {
          name: name && name.trim() ? name.trim() : existing.name,
          code: code && code.trim() ? code.trim().toUpperCase() : existing.code,
          description: description !== undefined ? (description ? description.trim() : null) : existing.description,
          status: status || existing.status,
        },
      });

      return res.json(updated);
    }

    // JSON Store fallback (dev only)
    const db = loadDB();
    db.categories = db.categories || [];
    const index = db.categories.findIndex((c) => c.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'CATEGORY_NOT_FOUND', message: 'Category does not exist.' });
    }

    const existing = db.categories[index];

    if (name && name.trim()) {
      const trimmedName = name.trim();
      const duplicate = db.categories.find(
        (c) => c.id !== id && !c.deletedAt && c.name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicate) {
        return res.status(400).json({ error: 'CATEGORY_NAME_EXISTS', message: `A category with name "${trimmedName}" already exists.` });
      }
    }

    if (code && code.trim()) {
      const trimmedCode = code.trim().toUpperCase();
      const duplicateCode = db.categories.find(
        (c) => c.id !== id && c.code.toLowerCase() === trimmedCode.toLowerCase()
      );
      if (duplicateCode) {
        return res.status(400).json({ error: 'CATEGORY_CODE_EXISTS', message: `A category with code "${trimmedCode}" already exists.` });
      }
    }

    const updatedCategory: Category = {
      ...existing,
      name: name && name.trim() ? name.trim() : existing.name,
      code: code && code.trim() ? code.trim().toUpperCase() : existing.code,
      description: description !== undefined ? (description ? description.trim() : undefined) : existing.description,
      status: status || existing.status,
      updatedAt: new Date().toISOString(),
    };

    db.categories[index] = updatedCategory;
    saveDB();

    return res.json(updatedCategory);
  } catch (err: any) {
    return handleCategoryError(res, err, 'Failed to update category.');
  }
});

router.delete('/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  try {
    const rawId = req.params.id;
    const id = String(rawId || '').trim();
    const { reassignToCategoryId } = req.body || {};

    await ensurePrismaInitialized();
    const prisma = getPrisma();
    const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

    if (!(prisma && isDbConnected()) && isProd) {
      return res.status(503).json({ error: 'DATABASE_UNAVAILABLE', message: 'Production database is unavailable.' });
    }

    if (prisma && isDbConnected()) {
      const category = await prisma.category.findUnique({ where: { id } });
      if (!category) {
        return res.status(404).json({
          error: 'CATEGORY_NOT_FOUND',
          message: 'Category does not exist.',
        });
      }

      const assignedProductsCount = await prisma.product.count({
        where: { categoryId: id, deletedAt: null },
      });

      if (assignedProductsCount > 0) {
        if (reassignToCategoryId) {
          const targetCategory = await prisma.category.findUnique({ where: { id: reassignToCategoryId } });
          if (!targetCategory || targetCategory.id === id) {
            return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Selected replacement category was not found.' });
          }

          await prisma.product.updateMany({
            where: { categoryId: id },
            data: { categoryId: targetCategory.id },
          });
        } else {
          return res.status(400).json({
            error: 'CATEGORY_HAS_PRODUCTS',
            hasLinkedProducts: true,
            productCount: assignedProductsCount,
            categoryName: category.name,
            message: `Category "${category.name}" contains ${assignedProductsCount} active product(s). Please select another category to move these products to, or cancel.`,
          });
        }
      }

      await prisma.category.delete({ where: { id } });

      return res.json({ message: `Category "${category.name}" deleted successfully.` });
    }

    // JSON Store fallback (dev only)
    const db = loadDB();
    db.categories = db.categories || [];
    db.products = db.products || [];

    const category = db.categories.find((c) => c.id === id);
    if (!category) {
      return res.status(404).json({ error: 'CATEGORY_NOT_FOUND', message: 'Category does not exist.' });
    }

    const assignedProducts = db.products.filter((p) => p.categoryId === id && !p.deletedAt);

    if (assignedProducts.length > 0) {
      if (reassignToCategoryId) {
        const targetCat = db.categories.find((c) => c.id === reassignToCategoryId);
        if (!targetCat || targetCat.id === id) {
          return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Selected replacement category was not found.' });
        }
        db.products.forEach((p) => {
          if (p.categoryId === id) {
            p.categoryId = targetCat.id;
            p.categoryName = targetCat.name;
          }
        });
      } else {
        return res.status(400).json({
          error: 'CATEGORY_HAS_PRODUCTS',
          hasLinkedProducts: true,
          productCount: assignedProducts.length,
          categoryName: category.name,
          message: `Category "${category.name}" contains ${assignedProducts.length} active product(s). Please select another category to move these products to, or cancel.`,
        });
      }
    }

    db.categories = db.categories.filter((c) => c.id !== id);
    saveDB();

    return res.json({ message: `Category "${category.name}" deleted successfully.` });
  } catch (err: any) {
    return handleCategoryError(res, err, 'Failed to delete category.');
  }
});

export default router;

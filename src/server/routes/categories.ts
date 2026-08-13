import { Router } from 'express';
import { loadDB, saveDB, generateUUID, logActivity } from '../store';
import { Category } from '../../types/pos';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

function generateCategoryCode(existingCategories: Category[], requestedCode?: string): string {
  if (requestedCode && requestedCode.trim()) {
    return requestedCode.trim().toUpperCase();
  }
  let count = existingCategories.length + 1;
  let candidate = 'CAT-' + count.toString().padStart(3, '0');
  while (existingCategories.some((c) => c.code.toUpperCase() === candidate)) {
    count++;
    candidate = 'CAT-' + count.toString().padStart(3, '0');
  }
  return candidate;
}

router.get('/', (req, res) => {
  const db = loadDB();
  res.json(db.categories);
});

router.post('/', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), (req: AuthRequest, res) => {
  const { name, code, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Category Name is required.' });
  }

  const trimmedName = name.trim();
  const db = loadDB();

  // Validate duplicate category name (case-insensitive)
  const duplicateName = db.categories.find(
    (c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase()
  );
  if (duplicateName) {
    return res.status(400).json({ error: `Category name "${trimmedName}" already exists.` });
  }

  const catCode = generateCategoryCode(db.categories, code);

  // Check duplicate code
  const existingCode = db.categories.find((c) => c.code.toLowerCase() === catCode.toLowerCase());
  if (existingCode) {
    return res.status(400).json({ error: `Category code "${catCode}" already exists.` });
  }

  const newCategory: Category = {
    id: generateUUID(),
    name: trimmedName,
    code: catCode,
    description: description ? description.trim() : '',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
  };

  db.categories.unshift(newCategory);
  saveDB();
  logActivity('system', 'User', 'Create Category', 'Categories', `Created category ${trimmedName} (${catCode})`);

  res.status(201).json(newCategory);
});

router.put('/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, code, description, status } = req.body;

  const db = loadDB();
  const index = db.categories.findIndex((c) => c.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Category not found.' });
  }

  const existingCategory = db.categories[index];

  if (name && name.trim()) {
    const trimmedName = name.trim();
    const duplicate = db.categories.find(
      (c) => c.id !== id && c.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      return res.status(400).json({ error: `Category name "${trimmedName}" already exists on another category.` });
    }
  }

  if (code && code.trim()) {
    const trimmedCode = code.trim().toUpperCase();
    const duplicateCode = db.categories.find(
      (c) => c.id !== id && c.code.toUpperCase() === trimmedCode
    );
    if (duplicateCode) {
      return res.status(400).json({ error: `Category code "${trimmedCode}" already exists on another category.` });
    }
  }

  const updatedName = name && name.trim() ? name.trim() : existingCategory.name;
  const updatedCode = code && code.trim() ? code.trim().toUpperCase() : existingCategory.code;

  db.categories[index] = {
    ...existingCategory,
    name: updatedName,
    code: updatedCode,
    description: description !== undefined ? description.trim() : existingCategory.description,
    status: status || existingCategory.status,
  };

  // Sync categoryName across products if name changed
  if (updatedName !== existingCategory.name) {
    db.products.forEach((p) => {
      if (p.categoryId === id) {
        p.categoryName = updatedName;
      }
    });
  }

  saveDB();
  res.json(db.categories[index]);
});

router.delete('/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), (req: AuthRequest, res) => {
  const { id } = req.params;
  const { reassignToCategoryId } = req.body || {};
  const db = loadDB();

  const category = db.categories.find((c) => c.id === id);
  if (!category) {
    return res.status(404).json({ error: 'Category not found.' });
  }

  const assignedProducts = db.products.filter((p) => p.categoryId === id);

  if (assignedProducts.length > 0) {
    if (reassignToCategoryId) {
      const targetCategory = db.categories.find((c) => c.id === reassignToCategoryId && c.id !== id);
      if (!targetCategory) {
        return res.status(400).json({ error: 'Selected replacement category was not found.' });
      }

      // Reassign all products
      db.products = db.products.map((p) => {
        if (p.categoryId === id) {
          return { ...p, categoryId: targetCategory.id };
        }
        return p;
      });

      logActivity(
        'system',
        'User',
        'Reassign Category Products',
        'Categories',
        `Moved ${assignedProducts.length} product(s) from "${category.name}" to "${targetCategory.name}"`
      );
    } else {
      return res.status(400).json({
        hasLinkedProducts: true,
        productCount: assignedProducts.length,
        categoryName: category.name,
        error: `Category "${category.name}" contains ${assignedProducts.length} active product(s). Please select another category to move these products to, or cancel.`
      });
    }
  }

  db.categories = db.categories.filter((c) => c.id !== id);
  saveDB();
  logActivity('system', 'User', 'Delete Category', 'Categories', `Deleted category ${category.name} (${category.code})`);

  res.json({ message: `Category "${category.name}" deleted successfully.` });
});

export default router;

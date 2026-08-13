import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { put } from '@vercel/blob';
import { loadDB, saveDB, generateUUID, logActivity } from '../store';
import { getPrisma } from '../prismaService';
import { Product } from '../../types/pos';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Product Image Upload Route with Vercel Blob + Local Disk + Data URL Fallbacks
router.post('/upload-image', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  try {
    const { imageBase64, filename } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'Valid imageBase64 string is required.' });
    }

    const matches = imageBase64.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: 'Invalid base64 image format. Supported formats: PNG, JPG, JPEG, WEBP.' });
    }

    const rawExt = matches[1].toLowerCase();
    const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
    const allowedExts = ['png', 'jpg', 'jpeg', 'webp'];
    if (!allowedExts.includes(ext)) {
      return res.status(400).json({ error: `Unsupported image format (${ext}). Allowed: PNG, JPG, JPEG, WEBP.` });
    }

    const buffer = Buffer.from(matches[2], 'base64');
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image size exceeds maximum limit of 5MB.' });
    }

    const safeFilename = `prod_${Date.now()}_${generateUUID().slice(0, 8)}.${ext}`;

    // 1. Try Vercel Blob if token is available
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const blob = await put(`products/${safeFilename}`, buffer, {
          access: 'public',
          contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
        return res.json({ success: true, imageUrl: blob.url, message: 'Image uploaded successfully to Vercel Blob.' });
      } catch (blobErr: any) {
        console.warn('[Upload] Vercel Blob upload warning:', blobErr?.message || blobErr);
      }
    }

    // 2. Try writing to local disk if running locally outside Vercel
    if (process.env.VERCEL !== '1') {
      try {
        const uploadDir = path.join(process.cwd(), 'uploads', 'products');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        const filePath = path.join(uploadDir, safeFilename);
        fs.writeFileSync(filePath, buffer);
        const imageUrl = `/uploads/products/${safeFilename}`;
        return res.json({ success: true, imageUrl, message: 'Image uploaded successfully.' });
      } catch (fsErr: any) {
        console.warn('[Upload] Local filesystem write warning:', fsErr?.message || fsErr);
      }
    }

    // 3. Fallback to Data URL so upload never throws ENOENT on Vercel
    return res.json({
      success: true,
      imageUrl: imageBase64,
      message: 'Image stored as persistent base64 Data URL.',
    });
  } catch (err: any) {
    console.error('Product image upload error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to upload product image.' });
  }
});

router.get('/', async (req, res) => {
  const db = loadDB();
  const productsWithCat = db.products.map((p) => {
    const cat = db.categories.find((c) => c.id === p.categoryId);
    return {
      ...p,
      categoryName: cat ? cat.name : p.categoryName || 'Uncategorized',
    };
  });
  res.json(productsWithCat);
});

router.post('/', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  const {
    name,
    sku,
    barcode,
    categoryId,
    unit,
    purchasePrice,
    salePrice,
    wholesalePrice,
    costPrice,
    minStock,
    currentStock,
    description,
    image,
    expiryDays,
    status,
    supplierId,
    taxRate,
    isKitchenItem,
    variants,
  } = req.body;

  if (!name || !name.trim() || !categoryId || salePrice === undefined) {
    return res.status(400).json({ error: 'Name, Category, and Sale Price are required.' });
  }

  const cleanCategoryId = String(categoryId).trim();
  const db = loadDB();

  // Strict Category Validation: Look up category strictly by exact database ID
  const category = db.categories.find((c) => c.id === cleanCategoryId);

  if (!category) {
    return res.status(400).json({
      error: 'Selected category does not exist. Please select a valid category from the dropdown.',
    });
  }

  function createEan13(): string {
    const base12 = '200' + Math.floor(100000000 + Math.random() * 900000000).toString();
    let oddSum = 0, evenSum = 0;
    for (let i = 0; i < 12; i++) {
      const d = parseInt(base12[i], 10);
      if (i % 2 === 0) oddSum += d;
      else evenSum += d;
    }
    const checkDigit = (10 - ((oddSum + evenSum * 3) % 10)) % 10;
    return `${base12}${checkDigit}`;
  }

  const generatedSku = (sku && sku.trim()) || 'USB-' + Math.floor(100000 + Math.random() * 900000);
  const generatedBarcode = (barcode && barcode.trim()) || createEan13();

  // Check unique SKU or Barcode
  if (db.products.some((p) => p.sku.toLowerCase() === generatedSku.toLowerCase())) {
    return res.status(400).json({ error: `SKU "${generatedSku}" already exists.` });
  }

  if (barcode && db.products.some((p) => p.barcode === barcode.trim())) {
    return res.status(400).json({ error: `Barcode "${barcode}" already exists.` });
  }

  const newProduct: Product = {
    id: generateUUID(),
    name: name.trim(),
    sku: generatedSku,
    barcode: generatedBarcode,
    categoryId: category.id,
    unit: unit || 'pcs',
    purchasePrice: Number(purchasePrice) || 0,
    salePrice: Number(salePrice) || 0,
    wholesalePrice: wholesalePrice ? Number(wholesalePrice) : undefined,
    costPrice: Number(costPrice) || Number(purchasePrice) || 0,
    minStock: Number(minStock) || 5,
    currentStock: Number(currentStock) || 0,
    description,
    image,
    expiryDays: expiryDays ? Number(expiryDays) : undefined,
    status: status || 'ACTIVE',
    supplierId,
    taxRate: Number(taxRate) || 0,
    isKitchenItem: Boolean(isKitchenItem),
    categoryName: category.name,
    variants: variants || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.products.unshift(newProduct);

  // Initial stock ledger if initial stock > 0
  if (newProduct.currentStock > 0) {
    db.inventoryLogs.unshift({
      id: generateUUID(),
      productId: newProduct.id,
      productName: newProduct.name,
      type: 'STOCK_IN',
      quantity: newProduct.currentStock,
      previousStock: 0,
      newStock: newProduct.currentStock,
      referenceNo: 'INIT-' + Date.now(),
      reason: 'Initial stock setup',
      createdByName: req.user?.name || 'Admin',
      createdAt: new Date().toISOString(),
    });
  }

  saveDB();
  logActivity('system', req.user?.name || 'User', 'Create Product', 'Products', `Created product ${name} (${generatedSku})`);

  res.status(201).json(newProduct);
});

router.put('/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  const rawId = req.params.id;
  const cleanId = String(rawId || '').trim();

  console.log('EDIT PRODUCT REQUEST');
  console.log('product ID received:', rawId);
  console.log('product ID type:', typeof rawId);
  console.log('product ID length:', rawId ? String(rawId).length : 0);

  const db = loadDB();
  let index = db.products.findIndex(
    (p) => p.id === cleanId || String(p.id || '').trim().toLowerCase() === cleanId.toLowerCase()
  );

  console.log('database lookup result:', index !== -1 ? 'FOUND' : 'NOT FOUND');

  if (index === -1) {
    return res.status(404).json({ error: 'Product not found.' });
  }

  const existing = db.products[index];

  if (req.body.sku && req.body.sku.trim().toLowerCase() !== existing.sku.toLowerCase()) {
    const duplicateSku = db.products.some(
      (p) =>
        p.id !== existing.id &&
        String(p.id).trim().toLowerCase() !== cleanId.toLowerCase() &&
        p.sku.trim().toLowerCase() === req.body.sku.trim().toLowerCase()
    );
    if (duplicateSku) {
      return res.status(400).json({ error: `SKU "${req.body.sku}" already exists on another product.` });
    }
  }

  if (req.body.barcode && req.body.barcode.trim() !== (existing.barcode || '')) {
    const duplicateBarcode = db.products.some(
      (p) =>
        p.id !== existing.id &&
        String(p.id).trim().toLowerCase() !== cleanId.toLowerCase() &&
        p.barcode &&
        p.barcode.trim() === req.body.barcode.trim()
    );
    if (duplicateBarcode) {
      return res.status(400).json({ error: `Barcode "${req.body.barcode}" already exists on another product.` });
    }
  }

  const targetCatId = req.body.categoryId ? String(req.body.categoryId).trim() : existing.categoryId;
  const targetCategory = db.categories.find(
    (c) => c.id === targetCatId || String(c.id).trim().toLowerCase() === targetCatId.toLowerCase()
  );

  if (!targetCategory) {
    return res.status(400).json({
      error: 'Selected category does not exist. Please select a valid category from the dropdown.',
    });
  }

  // Preserve image if not explicitly set/cleared in req.body
  const finalImage = req.body.image !== undefined ? req.body.image : (req.body.imageUrl !== undefined ? req.body.imageUrl : existing.image);

  const updated: Product = {
    ...existing,
    ...req.body,
    id: existing.id, // Ensure primary key is preserved
    image: finalImage,
    categoryId: targetCategory.id,
    categoryName: targetCategory.name,
    purchasePrice: Number(req.body.purchasePrice ?? existing.purchasePrice),
    salePrice: Number(req.body.salePrice ?? existing.salePrice),
    costPrice: Number(req.body.costPrice ?? existing.costPrice),
    minStock: Number(req.body.minStock ?? existing.minStock),
    currentStock: Number(req.body.currentStock ?? existing.currentStock),
    taxRate: Number(req.body.taxRate ?? existing.taxRate),
    updatedAt: new Date().toISOString(),
  };

  db.products[index] = updated;
  saveDB();
  logActivity('system', req.user?.name || 'User', 'Update Product', 'Products', `Updated product ${updated.name} (${updated.sku})`);
  res.json(updated);
});

router.delete('/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), (req: AuthRequest, res) => {
  const rawId = req.params.id;
  const cleanId = String(rawId || '').trim();
  const db = loadDB();

  const product = db.products.find(
    (p) => p.id === cleanId || String(p.id || '').trim().toLowerCase() === cleanId.toLowerCase()
  );
  if (!product) {
    return res.status(404).json({ error: 'Product not found.' });
  }

  // Business Rule: Cannot delete product with active stock
  if (product.currentStock > 0) {
    return res.status(400).json({
      error: `Cannot delete product "${product.name}". It currently has ${product.currentStock} ${product.unit} in stock. Please adjust or clear stock to 0 before deleting.`
    });
  }

  const targetId = product.id;

  // Check references in Sales
  const hasSales = db.sales?.some((s) => s.items?.some((item: any) => item.productId === targetId));
  if (hasSales) {
    return res.status(400).json({
      error: `Cannot delete product "${product.name}". It is referenced in existing sales transaction history. You can edit its status to "INACTIVE" to archive it instead.`
    });
  }

  // Check references in Purchases
  const hasPurchases = db.purchases?.some((p) => p.items?.some((item: any) => item.productId === targetId));
  if (hasPurchases) {
    return res.status(400).json({
      error: `Cannot delete product "${product.name}". It is referenced in supplier purchase orders. You can edit its status to "INACTIVE" to archive it instead.`
    });
  }

  // Check references in Recipes
  const hasRecipes = db.recipes?.some((r) => r.productId === targetId || r.ingredients?.some((ing: any) => ing.productId === targetId));
  if (hasRecipes) {
    return res.status(400).json({
      error: `Cannot delete product "${product.name}". It is linked to production recipes. Remove it from recipes or set status to "INACTIVE" to archive it instead.`
    });
  }

  // Check references in Inventory Transfers / Logs
  const hasInventoryLogs = db.inventoryLogs?.some((log) => log.productId === targetId && log.type !== 'STOCK_IN');
  const hasTransfers = db.transfers?.some((t) => t.items?.some((item: any) => item.productId === targetId));
  if (hasInventoryLogs || hasTransfers) {
    return res.status(400).json({
      error: `Cannot delete product "${product.name}". It has recorded inventory movements or branch transfers. Set its status to "INACTIVE" to archive it instead.`
    });
  }

  // Also clean initial inventory log if only initial setup log exists
  if (db.inventoryLogs) {
    db.inventoryLogs = db.inventoryLogs.filter((log) => log.productId !== targetId);
  }

  db.products = db.products.filter((p) => p.id !== targetId);
  saveDB();
  logActivity('system', 'User', 'Delete Product', 'Products', `Deleted product ${product.name} (${product.sku})`);

  res.json({ message: `Product "${product.name}" deleted successfully.` });
});

export default router;

import { Router } from 'express';
import { getPrisma, ensurePrismaInitialized, isDbConnected } from '../prismaService';
import { uploadProductImage, deleteProductImage } from '../storageService';
import { loadDB, saveDB, generateUUID } from '../store';
import { Product, InventoryLedger } from '../../types/pos';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

function handleProductError(res: any, err: any, defaultMessage: string) {
  const msg = err?.message || String(err || '');
  console.error(`[Products Error]:`, err);

  if (msg.includes('IMAGE_STORAGE_NOT_CONFIGURED')) {
    return res.status(503).json({ error: 'IMAGE_STORAGE_NOT_CONFIGURED', message: msg });
  }
  if (msg.includes('IMAGE_UPLOAD_FAILED')) {
    return res.status(502).json({ error: 'IMAGE_UPLOAD_FAILED', message: msg });
  }
  if (msg.includes('IMAGE_INVALID_TYPE')) {
    return res.status(400).json({ error: 'IMAGE_INVALID_TYPE', message: msg });
  }
  if (msg.includes('IMAGE_TOO_LARGE')) {
    return res.status(413).json({ error: 'IMAGE_TOO_LARGE', message: msg });
  }
  if (msg.includes('DATABASE_UNAVAILABLE') || msg.includes("Can't reach database server")) {
    return res.status(503).json({ error: 'DATABASE_UNAVAILABLE', message: 'Production database is unavailable.' });
  }
  return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: msg || defaultMessage });
}

// Helper function to generate EAN-13 barcode
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

// Product Image Upload Route
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

    const ext = matches[1].toLowerCase() === 'jpeg' ? 'jpg' : matches[1].toLowerCase();
    const safeFilename = filename || `prod_${Date.now()}.${ext}`;

    const imageUrl = await uploadProductImage(imageBase64, safeFilename, `image/${ext}`);
    return res.json({ success: true, imageUrl, message: 'Image uploaded successfully.' });
  } catch (err: any) {
    return handleProductError(res, err, 'Failed to upload product image.');
  }
});

// GET all products
router.get('/', async (req, res) => {
  try {
    await ensurePrismaInitialized();
    const prisma = getPrisma();

    if (prisma && isDbConnected()) {
      const products = await prisma.product.findMany({
        where: { deletedAt: null },
        include: { category: true, supplier: true, variants: true },
        orderBy: { createdAt: 'desc' },
      });

      const formattedProducts = products.map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        categoryId: p.categoryId,
        categoryName: p.category ? p.category.name : 'Uncategorized',
        unit: p.unit,
        purchasePrice: p.purchasePrice,
        salePrice: p.salePrice,
        wholesalePrice: p.wholesalePrice,
        costPrice: p.costPrice,
        minStock: p.minStock,
        currentStock: p.currentStock,
        description: p.description,
        image: p.image,
        expiryDays: p.expiryDays,
        status: p.status,
        supplierId: p.supplierId,
        supplierName: p.supplier ? p.supplier.name : null,
        taxRate: p.taxRate,
        isKitchenItem: p.isKitchenItem,
        variants: p.variants || [],
        createdAt: p.createdAt ? p.createdAt.toISOString() : new Date().toISOString(),
        updatedAt: p.updatedAt ? p.updatedAt.toISOString() : new Date().toISOString(),
      }));

      return res.json(formattedProducts);
    }

    // JSON Store fallback (dev only)
    const db = loadDB();
    db.products = db.products || [];
    db.categories = db.categories || [];
    db.suppliers = db.suppliers || [];

    const formatted = db.products
      .filter((p) => !p.deletedAt)
      .map((p) => {
        const cat = db.categories.find((c) => c.id === p.categoryId);
        const supp = db.suppliers.find((s) => s.id === p.supplierId);
        return {
          ...p,
          categoryName: p.categoryName || (cat ? cat.name : 'Uncategorized'),
          supplierName: p.supplierName || (supp ? supp.name : null),
        };
      });

    return res.json(formatted);
  } catch (err: any) {
    return handleProductError(res, err, 'Failed to fetch products.');
  }
});

// CREATE Product
router.post('/', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  try {
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
    } = req.body;

    if (!name || !name.trim() || !categoryId || salePrice === undefined) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Name, Category, and Sale Price are required.' });
    }

    const cleanCatId = String(categoryId).trim();

    await ensurePrismaInitialized();
    const prisma = getPrisma();

    if (prisma && isDbConnected()) {
      // 1. Confirm Category exists in PostgreSQL
      const category = await prisma.category.findUnique({
        where: { id: cleanCatId },
      });

      if (!category) {
        return res.status(400).json({
          error: 'CATEGORY_NOT_FOUND',
          message: 'Selected category does not exist. Please select a valid category from the dropdown.',
        });
      }

      // 2. Validate Supplier if supplied
      let cleanSuppId: string | null = null;
      if (supplierId && String(supplierId).trim()) {
        const supp = await prisma.supplier.findUnique({ where: { id: String(supplierId).trim() } });
        if (supp) cleanSuppId = supp.id;
      }

      // 3. Generate SKU / Barcode if missing
      const generatedSku = (sku && sku.trim()) || 'USB-' + Math.floor(100000 + Math.random() * 900000);
      const generatedBarcode = (barcode && barcode.trim()) || createEan13();

      // 4. Validate SKU & Barcode Uniqueness
      const duplicateSku = await prisma.product.findFirst({
        where: { sku: { equals: generatedSku, mode: 'insensitive' } },
      });
      if (duplicateSku) {
        return res.status(400).json({ error: 'SKU_EXISTS', message: `SKU "${generatedSku}" already exists.` });
      }

      const duplicateBarcode = await prisma.product.findFirst({
        where: { barcode: { equals: generatedBarcode, mode: 'insensitive' } },
      });
      if (duplicateBarcode) {
        return res.status(400).json({ error: 'BARCODE_EXISTS', message: `Barcode "${generatedBarcode}" already exists.` });
      }

      // 5. Upload image if base64 provided
      let finalImageUrl: string | null = null;
      if (image && typeof image === 'string') {
        if (image.startsWith('data:image/')) {
          finalImageUrl = await uploadProductImage(image, `prod_${Date.now()}.png`);
        } else {
          finalImageUrl = image;
        }
      }

      const initialStockNum = Number(currentStock) || 0;

      // 6. Prisma Transaction: Create Product + Initial Inventory Ledger
      const result = await prisma.$transaction(async (tx: any) => {
        const newProd = await tx.product.create({
          data: {
            name: name.trim(),
            sku: generatedSku,
            barcode: generatedBarcode,
            categoryId: category.id,
            unit: unit || 'pcs',
            purchasePrice: Number(purchasePrice) || 0,
            salePrice: Number(salePrice) || 0,
            wholesalePrice: wholesalePrice ? Number(wholesalePrice) : null,
            costPrice: Number(costPrice) || Number(purchasePrice) || 0,
            minStock: Number(minStock) || 5,
            currentStock: initialStockNum,
            description: description ? description.trim() : null,
            image: finalImageUrl,
            expiryDays: expiryDays ? Number(expiryDays) : null,
            status: status || 'ACTIVE',
            supplierId: cleanSuppId,
            taxRate: Number(taxRate) || 0,
            isKitchenItem: Boolean(isKitchenItem),
          },
          include: { category: true, supplier: true },
        });

        if (initialStockNum > 0) {
          await tx.inventoryLog.create({
            data: {
              productId: newProd.id,
              type: 'STOCK_IN',
              quantity: initialStockNum,
              previousStock: 0,
              newStock: initialStockNum,
              referenceNo: 'INIT-' + Date.now(),
              reason: 'Initial stock setup',
              createdByName: req.user?.name || 'Admin',
            },
          });
        }

        return newProd;
      });

      return res.status(201).json({
        id: result.id,
        name: result.name,
        sku: result.sku,
        barcode: result.barcode,
        categoryId: result.categoryId,
        categoryName: category.name,
        unit: result.unit,
        purchasePrice: result.purchasePrice,
        salePrice: result.salePrice,
        wholesalePrice: result.wholesalePrice,
        costPrice: result.costPrice,
        minStock: result.minStock,
        currentStock: result.currentStock,
        description: result.description,
        image: result.image,
        expiryDays: result.expiryDays,
        status: result.status,
        supplierId: result.supplierId,
        taxRate: result.taxRate,
        isKitchenItem: result.isKitchenItem,
        variants: [],
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
      });
    }

    // JSON Store fallback
    const db = loadDB();
    db.products = db.products || [];
    db.categories = db.categories || [];
    db.suppliers = db.suppliers || [];
    db.inventoryLogs = db.inventoryLogs || [];

    const category = db.categories.find((c) => c.id === cleanCatId);
    if (!category) {
      return res.status(400).json({ error: 'Selected category does not exist.' });
    }

    let cleanSuppId: string | undefined = undefined;
    let suppName: string | undefined = undefined;
    if (supplierId && String(supplierId).trim()) {
      const supp = db.suppliers.find((s) => s.id === String(supplierId).trim());
      if (supp) {
        cleanSuppId = supp.id;
        suppName = supp.name;
      }
    }

    const generatedSku = (sku && sku.trim()) || 'USB-' + Math.floor(100000 + Math.random() * 900000);
    const generatedBarcode = (barcode && barcode.trim()) || createEan13();

    const dupSku = db.products.find((p) => !p.deletedAt && p.sku.toLowerCase() === generatedSku.toLowerCase());
    if (dupSku) {
      return res.status(400).json({ error: `SKU "${generatedSku}" already exists.` });
    }

    const dupBarcode = db.products.find((p) => !p.deletedAt && p.barcode.toLowerCase() === generatedBarcode.toLowerCase());
    if (dupBarcode) {
      return res.status(400).json({ error: `Barcode "${generatedBarcode}" already exists.` });
    }

    let finalImageUrl: string | undefined = undefined;
    if (image && typeof image === 'string') {
      if (image.startsWith('data:image/')) {
        finalImageUrl = await uploadProductImage(image, `prod_${Date.now()}.png`);
      } else {
        finalImageUrl = image;
      }
    }

    const initialStockNum = Number(currentStock) || 0;
    const newProd: Product = {
      id: generateUUID(),
      name: name.trim(),
      sku: generatedSku,
      barcode: generatedBarcode,
      categoryId: category.id,
      categoryName: category.name,
      unit: unit || 'pcs',
      purchasePrice: Number(purchasePrice) || 0,
      salePrice: Number(salePrice) || 0,
      wholesalePrice: wholesalePrice ? Number(wholesalePrice) : undefined,
      costPrice: Number(costPrice) || Number(purchasePrice) || 0,
      minStock: Number(minStock) || 5,
      currentStock: initialStockNum,
      description: description ? description.trim() : undefined,
      image: finalImageUrl,
      expiryDays: expiryDays ? Number(expiryDays) : undefined,
      status: status || 'ACTIVE',
      supplierId: cleanSuppId,
      supplierName: suppName,
      taxRate: Number(taxRate) || 0,
      isKitchenItem: Boolean(isKitchenItem),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.products.unshift(newProd);

    if (initialStockNum > 0) {
      const log: InventoryLedger = {
        id: generateUUID(),
        productId: newProd.id,
        productName: newProd.name,
        type: 'STOCK_IN',
        quantity: initialStockNum,
        previousStock: 0,
        newStock: initialStockNum,
        referenceNo: 'INIT-' + Date.now(),
        reason: 'Initial stock setup',
        createdByName: req.user?.name || 'Admin',
        createdAt: new Date().toISOString(),
      };
      db.inventoryLogs.unshift(log);
    }

    saveDB();

    return res.status(201).json(newProd);
  } catch (err: any) {
    return handleProductError(res, err, 'Failed to create product.');
  }
});

// EDIT Product
router.put('/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  try {
    const rawId = req.params.id;
    const id = String(rawId || '').trim();

    await ensurePrismaInitialized();
    const prisma = getPrisma();

    if (prisma && isDbConnected()) {
      const existing = await prisma.product.findUnique({
        where: { id },
        include: { category: true },
      });

      if (!existing) {
        return res.status(404).json({ error: 'PRODUCT_NOT_FOUND', message: 'Product does not exist.' });
      }

      // Check SKU duplicate if changed
      if (req.body.sku && req.body.sku.trim().toLowerCase() !== existing.sku.toLowerCase()) {
        const duplicateSku = await prisma.product.findFirst({
          where: {
            id: { not: id },
            sku: { equals: req.body.sku.trim(), mode: 'insensitive' },
          },
        });
        if (duplicateSku) {
          return res.status(400).json({ error: 'SKU_EXISTS', message: `SKU "${req.body.sku}" already exists on another product.` });
        }
      }

      // Check Barcode duplicate if changed
      if (req.body.barcode && req.body.barcode.trim().toLowerCase() !== (existing.barcode || '').toLowerCase()) {
        const duplicateBarcode = await prisma.product.findFirst({
          where: {
            id: { not: id },
            barcode: { equals: req.body.barcode.trim(), mode: 'insensitive' },
          },
        });
        if (duplicateBarcode) {
          return res.status(400).json({ error: 'BARCODE_EXISTS', message: `Barcode "${req.body.barcode}" already exists on another product.` });
        }
      }

      // Category validation if provided
      let targetCatId = existing.categoryId;
      if (req.body.categoryId && String(req.body.categoryId).trim() !== existing.categoryId) {
        const catCheck = await prisma.category.findUnique({
          where: { id: String(req.body.categoryId).trim() },
        });
        if (!catCheck) {
          return res.status(400).json({
            error: 'CATEGORY_NOT_FOUND',
            message: 'Selected category does not exist. Please select a valid category from the dropdown.',
          });
        }
        targetCatId = catCheck.id;
      }

      // Image handling rules
      let finalImageUrl = existing.image;
      if (req.body.image !== undefined) {
        if (req.body.image === null || req.body.image === '') {
          if (existing.image) {
            await deleteProductImage(existing.image);
          }
          finalImageUrl = null;
        } else if (typeof req.body.image === 'string' && req.body.image.startsWith('data:image/')) {
          finalImageUrl = await uploadProductImage(req.body.image, `prod_${Date.now()}.png`);
        } else if (typeof req.body.image === 'string') {
          finalImageUrl = req.body.image;
        }
      }

      const updated = await prisma.product.update({
        where: { id },
        data: {
          name: req.body.name !== undefined ? req.body.name.trim() : existing.name,
          sku: req.body.sku !== undefined ? req.body.sku.trim() : existing.sku,
          barcode: req.body.barcode !== undefined ? req.body.barcode.trim() : existing.barcode,
          categoryId: targetCatId,
          unit: req.body.unit !== undefined ? req.body.unit : existing.unit,
          purchasePrice: req.body.purchasePrice !== undefined ? Number(req.body.purchasePrice) : existing.purchasePrice,
          salePrice: req.body.salePrice !== undefined ? Number(req.body.salePrice) : existing.salePrice,
          wholesalePrice: req.body.wholesalePrice !== undefined ? (req.body.wholesalePrice ? Number(req.body.wholesalePrice) : null) : existing.wholesalePrice,
          costPrice: req.body.costPrice !== undefined ? Number(req.body.costPrice) : existing.costPrice,
          minStock: req.body.minStock !== undefined ? Number(req.body.minStock) : existing.minStock,
          currentStock: req.body.currentStock !== undefined ? Number(req.body.currentStock) : existing.currentStock,
          description: req.body.description !== undefined ? (req.body.description ? req.body.description.trim() : null) : existing.description,
          image: finalImageUrl,
          expiryDays: req.body.expiryDays !== undefined ? (req.body.expiryDays ? Number(req.body.expiryDays) : null) : existing.expiryDays,
          status: req.body.status !== undefined ? req.body.status : existing.status,
          supplierId: req.body.supplierId !== undefined ? (req.body.supplierId ? String(req.body.supplierId).trim() : null) : existing.supplierId,
          taxRate: req.body.taxRate !== undefined ? Number(req.body.taxRate) : existing.taxRate,
          isKitchenItem: req.body.isKitchenItem !== undefined ? Boolean(req.body.isKitchenItem) : existing.isKitchenItem,
        },
        include: { category: true, supplier: true, variants: true },
      });

      return res.json({
        id: updated.id,
        name: updated.name,
        sku: updated.sku,
        barcode: updated.barcode,
        categoryId: updated.categoryId,
        categoryName: updated.category ? updated.category.name : 'Uncategorized',
        unit: updated.unit,
        purchasePrice: updated.purchasePrice,
        salePrice: updated.salePrice,
        wholesalePrice: updated.wholesalePrice,
        costPrice: updated.costPrice,
        minStock: updated.minStock,
        currentStock: updated.currentStock,
        description: updated.description,
        image: updated.image,
        expiryDays: updated.expiryDays,
        status: updated.status,
        supplierId: updated.supplierId,
        taxRate: updated.taxRate,
        isKitchenItem: updated.isKitchenItem,
        variants: updated.variants || [],
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      });
    }

    // JSON Store fallback
    const db = loadDB();
    db.products = db.products || [];
    db.categories = db.categories || [];
    db.suppliers = db.suppliers || [];

    const index = db.products.findIndex((p) => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const existing = db.products[index];

    if (req.body.sku && req.body.sku.trim().toLowerCase() !== existing.sku.toLowerCase()) {
      const dupSku = db.products.find((p) => p.id !== id && !p.deletedAt && p.sku.toLowerCase() === req.body.sku.trim().toLowerCase());
      if (dupSku) {
        return res.status(400).json({ error: `SKU "${req.body.sku}" already exists on another product.` });
      }
    }

    if (req.body.barcode && req.body.barcode.trim().toLowerCase() !== (existing.barcode || '').toLowerCase()) {
      const dupBarcode = db.products.find((p) => p.id !== id && !p.deletedAt && p.barcode.toLowerCase() === req.body.barcode.trim().toLowerCase());
      if (dupBarcode) {
        return res.status(400).json({ error: `Barcode "${req.body.barcode}" already exists on another product.` });
      }
    }

    let targetCatId = existing.categoryId;
    let targetCatName = existing.categoryName;
    if (req.body.categoryId && String(req.body.categoryId).trim() !== existing.categoryId) {
      const catCheck = db.categories.find((c) => c.id === String(req.body.categoryId).trim());
      if (!catCheck) {
        return res.status(400).json({ error: 'Selected category does not exist.' });
      }
      targetCatId = catCheck.id;
      targetCatName = catCheck.name;
    }

    let finalImageUrl = existing.image;
    if (req.body.image !== undefined) {
      if (req.body.image === null || req.body.image === '') {
        if (existing.image) {
          await deleteProductImage(existing.image);
        }
        finalImageUrl = undefined;
      } else if (typeof req.body.image === 'string' && req.body.image.startsWith('data:image/')) {
        finalImageUrl = await uploadProductImage(req.body.image, `prod_${Date.now()}.png`);
      } else if (typeof req.body.image === 'string') {
        finalImageUrl = req.body.image;
      }
    }

    const updatedProd: Product = {
      ...existing,
      name: req.body.name !== undefined ? req.body.name.trim() : existing.name,
      sku: req.body.sku !== undefined ? req.body.sku.trim() : existing.sku,
      barcode: req.body.barcode !== undefined ? req.body.barcode.trim() : existing.barcode,
      categoryId: targetCatId,
      categoryName: targetCatName,
      unit: req.body.unit !== undefined ? req.body.unit : existing.unit,
      purchasePrice: req.body.purchasePrice !== undefined ? Number(req.body.purchasePrice) : existing.purchasePrice,
      salePrice: req.body.salePrice !== undefined ? Number(req.body.salePrice) : existing.salePrice,
      wholesalePrice: req.body.wholesalePrice !== undefined ? (req.body.wholesalePrice ? Number(req.body.wholesalePrice) : undefined) : existing.wholesalePrice,
      costPrice: req.body.costPrice !== undefined ? Number(req.body.costPrice) : existing.costPrice,
      minStock: req.body.minStock !== undefined ? Number(req.body.minStock) : existing.minStock,
      currentStock: req.body.currentStock !== undefined ? Number(req.body.currentStock) : existing.currentStock,
      description: req.body.description !== undefined ? (req.body.description ? req.body.description.trim() : undefined) : existing.description,
      image: finalImageUrl,
      expiryDays: req.body.expiryDays !== undefined ? (req.body.expiryDays ? Number(req.body.expiryDays) : undefined) : existing.expiryDays,
      status: req.body.status !== undefined ? req.body.status : existing.status,
      supplierId: req.body.supplierId !== undefined ? (req.body.supplierId ? String(req.body.supplierId).trim() : undefined) : existing.supplierId,
      taxRate: req.body.taxRate !== undefined ? Number(req.body.taxRate) : existing.taxRate,
      isKitchenItem: req.body.isKitchenItem !== undefined ? Boolean(req.body.isKitchenItem) : existing.isKitchenItem,
      updatedAt: new Date().toISOString(),
    };

    db.products[index] = updatedProd;
    saveDB();

    return res.json(updatedProd);
  } catch (err: any) {
    return handleProductError(res, err, 'Failed to update product.');
  }
});

// DELETE Product
router.delete('/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  try {
    const rawId = req.params.id;
    const id = String(rawId || '').trim();

    await ensurePrismaInitialized();
    const prisma = getPrisma();

    if (prisma && isDbConnected()) {
      const product = await prisma.product.findUnique({ where: { id } });
      if (!product) {
        return res.status(404).json({ error: 'PRODUCT_NOT_FOUND', message: 'Product does not exist.' });
      }

      if (product.currentStock > 0) {
        return res.status(400).json({
          error: `Cannot delete product "${product.name}". It currently has ${product.currentStock} ${product.unit} in stock. Please adjust or clear stock to 0 before deleting.`,
        });
      }

      // Check references in Sales
      const hasSales = await prisma.saleItem.findFirst({ where: { productId: id } });
      if (hasSales) {
        return res.status(400).json({
          error: `Cannot delete product "${product.name}". It is referenced in existing sales transaction history. You can edit its status to "INACTIVE" to archive it instead.`,
        });
      }

      // Check references in Purchases
      const hasPurchases = await prisma.purchaseItem.findFirst({ where: { productId: id } });
      if (hasPurchases) {
        return res.status(400).json({
          error: `Cannot delete product "${product.name}". It is referenced in supplier purchase orders. You can edit its status to "INACTIVE" to archive it instead.`,
        });
      }

      // Check references in Recipes
      const hasRecipeProd = await prisma.recipe.findFirst({ where: { productId: id } });
      const hasRecipeIng = await prisma.recipeIngredient.findFirst({ where: { rawMaterialId: id } });
      if (hasRecipeProd || hasRecipeIng) {
        return res.status(400).json({
          error: `Cannot delete product "${product.name}". It is linked to production recipes. Set status to "INACTIVE" to archive it instead.`,
        });
      }

      // Check inventory logs
      const hasLogs = await prisma.inventoryLog.findFirst({
        where: { productId: id, type: { not: 'STOCK_IN' } },
      });
      if (hasLogs) {
        return res.status(400).json({
          error: `Cannot delete product "${product.name}". It has recorded inventory movements. Set its status to "INACTIVE" to archive it instead.`,
        });
      }

      // Clean up initial inventory log and delete product
      await prisma.inventoryLog.deleteMany({ where: { productId: id } });
      if (product.image) {
        await deleteProductImage(product.image);
      }
      await prisma.product.delete({ where: { id } });

      return res.json({ message: `Product "${product.name}" deleted successfully.` });
    }

    // JSON Store fallback
    const db = loadDB();
    db.products = db.products || [];

    const product = db.products.find((p) => p.id === id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    if (product.currentStock > 0) {
      return res.status(400).json({
        error: `Cannot delete product "${product.name}". It currently has ${product.currentStock} ${product.unit} in stock. Please adjust or clear stock to 0 before deleting.`,
      });
    }

    if (product.image) {
      await deleteProductImage(product.image);
    }

    db.products = db.products.filter((p) => p.id !== id);
    saveDB();

    return res.json({ message: `Product "${product.name}" deleted successfully.` });
  } catch (err: any) {
    console.error('[Products DELETE Error]:', err);
    return res.status(500).json({ error: err?.message || 'Failed to delete product.' });
  }
});

export default router;

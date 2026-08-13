import { Router } from 'express';
import { loadDB, saveDB, generateUUID, logActivity } from '../store';
import { Recipe, ProductionBatch } from '../../types/pos';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'KITCHEN'));

// RECIPE MANAGEMENT
router.get('/recipes', (req, res) => {
  const db = loadDB();
  res.json(db.recipes);
});

router.post('/recipes', (req, res) => {
  const { productId, yieldQuantity, unit, ingredients, instructions } = req.body;
  if (!productId || !yieldQuantity || !ingredients || !Array.isArray(ingredients)) {
    return res.status(400).json({ error: 'Product, yield quantity, and ingredients required.' });
  }

  const db = loadDB();
  const product = db.products.find((p) => p.id === productId);
  if (!product) {
    return res.status(404).json({ error: 'Bakery finished product not found.' });
  }

  let totalCost = 0;
  const validatedIngredients = ingredients.map((i: any) => {
    const rawMat = db.products.find((p) => p.id === i.rawMaterialId);
    const itemCost = rawMat ? (rawMat.costPrice || rawMat.purchasePrice) * Number(i.quantity) : Number(i.cost) || 0;
    totalCost += itemCost;
    return {
      id: generateUUID(),
      rawMaterialId: i.rawMaterialId,
      rawMaterialName: rawMat ? rawMat.name : i.rawMaterialName,
      quantity: Number(i.quantity),
      unit: i.unit || 'kg',
      cost: itemCost,
    };
  });

  const recipe: Recipe = {
    id: generateUUID(),
    productId,
    productName: product.name,
    yieldQuantity: Number(yieldQuantity),
    unit: unit || 'pcs',
    ingredients: validatedIngredients,
    totalCost,
    instructions,
  };

  product.hasRecipe = true;
  product.costPrice = totalCost / Number(yieldQuantity);

  db.recipes.unshift(recipe);
  saveDB();
  logActivity('system', 'Baker', 'Create Recipe', 'Production', `Created recipe for ${product.name}`);

  res.status(201).json(recipe);
});

router.put('/recipes/:id', (req, res) => {
  const { id } = req.params;
  const { productId, yieldQuantity, unit, ingredients, instructions } = req.body;

  const db = loadDB();
  const recipeIndex = db.recipes.findIndex((r) => r.id === id);
  if (recipeIndex === -1) {
    return res.status(404).json({ error: 'Recipe not found.' });
  }

  const existing = db.recipes[recipeIndex];
  const targetProductId = productId || existing.productId;
  const product = db.products.find((p) => p.id === targetProductId);

  let totalCost = 0;
  const validatedIngredients = (ingredients || existing.ingredients).map((i: any) => {
    const rawMat = db.products.find((p) => p.id === i.rawMaterialId);
    const itemCost = rawMat ? (rawMat.costPrice || rawMat.purchasePrice) * Number(i.quantity) : Number(i.cost) || 0;
    totalCost += itemCost;
    return {
      id: i.id || generateUUID(),
      rawMaterialId: i.rawMaterialId,
      rawMaterialName: rawMat ? rawMat.name : i.rawMaterialName,
      quantity: Number(i.quantity),
      unit: i.unit || 'kg',
      cost: itemCost,
    };
  });

  const updatedRecipe: Recipe = {
    ...existing,
    productId: targetProductId,
    productName: product ? product.name : existing.productName,
    yieldQuantity: Number(yieldQuantity ?? existing.yieldQuantity),
    unit: unit || existing.unit,
    ingredients: validatedIngredients,
    totalCost,
    instructions: instructions ?? existing.instructions,
  };

  if (product) {
    product.hasRecipe = true;
    product.costPrice = totalCost / updatedRecipe.yieldQuantity;
  }

  db.recipes[recipeIndex] = updatedRecipe;
  saveDB();
  logActivity('system', 'Baker', 'Update Recipe', 'Production', `Updated recipe for ${updatedRecipe.productName}`);

  res.json(updatedRecipe);
});

router.delete('/recipes/:id', (req, res) => {
  const { id } = req.params;
  const db = loadDB();
  const rec = db.recipes.find((r) => r.id === id);
  if (rec) {
    const prod = db.products.find((p) => p.id === rec.productId);
    if (prod) prod.hasRecipe = false;
  }
  db.recipes = db.recipes.filter((r) => r.id !== id);
  saveDB();
  res.json({ message: 'Recipe deleted.' });
});

// PRODUCTION BATCHES (Bakery Kitchen Production)
router.get('/batches', (req, res) => {
  const db = loadDB();
  res.json(db.productionBatches);
});

router.post('/batches', (req, res) => {
  const { productId, recipeId, plannedQuantity, operatorName } = req.body;
  if (!productId || !recipeId || !plannedQuantity) {
    return res.status(400).json({ error: 'Finished product, recipe, and quantity required.' });
  }

  const db = loadDB();
  const product = db.products.find((p) => p.id === productId);
  const recipe = db.recipes.find((r) => r.id === recipeId);

  if (!product || !recipe) {
    return res.status(404).json({ error: 'Product or Recipe not found.' });
  }

  const batchNo = 'BAT-' + Date.now();
  const multiplier = Number(plannedQuantity) / recipe.yieldQuantity;

  const mainWarehouse = (db.warehouses || []).find((w) => w.isMain) || (db.warehouses || [])[0];

  // Deduct raw materials from stock
  const rawMaterialsUsed: any[] = [];
  recipe.ingredients.forEach((ing) => {
    const neededQty = ing.quantity * multiplier;
    const rawMat = db.products.find((p) => p.id === ing.rawMaterialId);
    if (rawMat) {
      const prev = rawMat.currentStock;
      rawMat.currentStock = Math.max(0, rawMat.currentStock - neededQty);

      const rawWh = (db.warehouses || []).find((w) => w.id === rawMat.warehouseId) || mainWarehouse;

      db.inventoryLogs = db.inventoryLogs || [];
      db.inventoryLogs.unshift({
        id: generateUUID(),
        productId: rawMat.id,
        productName: rawMat.name,
        warehouseId: rawWh?.id,
        warehouseName: rawWh?.name,
        type: 'PRODUCTION',
        quantity: -neededQty, // Negative for consumption
        previousStock: prev,
        newStock: rawMat.currentStock,
        referenceNo: batchNo,
        reason: `Raw material consumed for Batch #${batchNo} (${product.name})`,
        createdByName: operatorName || 'Master Baker',
        createdAt: new Date().toISOString(),
      });

      db.inventoryAudits = db.inventoryAudits || [];
      db.inventoryAudits.unshift({
        id: generateUUID(),
        referenceType: 'PRODUCTION',
        referenceNo: batchNo,
        action: 'Raw Material Consumption',
        productId: rawMat.id,
        productName: rawMat.name,
        warehouseId: rawWh?.id,
        oldValue: prev.toString(),
        newValue: rawMat.currentStock.toString(),
        userId: 'user-baker',
        userName: operatorName || 'Master Baker',
        createdAt: new Date().toISOString(),
      });

      rawMaterialsUsed.push({
        rawMaterialId: rawMat.id,
        rawMaterialName: rawMat.name,
        quantity: neededQty,
        unit: ing.unit,
      });
    }
  });

  // Add produced finished goods stock
  const prevProdStock = product.currentStock;
  product.currentStock += Number(plannedQuantity);
  const prodWh = (db.warehouses || []).find((w) => w.id === product.warehouseId) || mainWarehouse;

  db.inventoryLogs = db.inventoryLogs || [];
  db.inventoryLogs.unshift({
    id: generateUUID(),
    productId: product.id,
    productName: product.name,
    warehouseId: prodWh?.id,
    warehouseName: prodWh?.name,
    type: 'PRODUCTION',
    quantity: Number(plannedQuantity),
    previousStock: prevProdStock,
    newStock: product.currentStock,
    referenceNo: batchNo,
    reason: `Bakery Production Batch #${batchNo} (Yield)`,
    createdByName: operatorName || 'Master Baker',
    createdAt: new Date().toISOString(),
  });

  db.inventoryAudits = db.inventoryAudits || [];
  db.inventoryAudits.unshift({
    id: generateUUID(),
    referenceType: 'PRODUCTION',
    referenceNo: batchNo,
    action: 'Finished Goods Yield',
    productId: product.id,
    productName: product.name,
    warehouseId: prodWh?.id,
    oldValue: prevProdStock.toString(),
    newValue: product.currentStock.toString(),
    userId: 'user-baker',
    userName: operatorName || 'Master Baker',
    createdAt: new Date().toISOString(),
  });

  // Create Batch for Finished Bakery Product
  db.batches = db.batches || [];
  db.batches.unshift({
    id: generateUUID(),
    batchNo,
    productId: product.id,
    productName: product.name,
    warehouseId: prodWh?.id,
    warehouseName: prodWh?.name,
    manufacturingDate: new Date().toISOString().split('T')[0],
    expiryDate: product.expiryDays
      ? new Date(Date.now() + product.expiryDays * 86400000).toISOString().split('T')[0]
      : new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    initialQuantity: Number(plannedQuantity),
    currentQuantity: Number(plannedQuantity),
    costPrice: product.costPrice || (recipe.totalCost / recipe.yieldQuantity) || 0,
    createdAt: new Date().toISOString(),
  });

  const batch: ProductionBatch = {
    id: generateUUID(),
    batchNo,
    productId,
    productName: product.name,
    recipeId,
    plannedQuantity: Number(plannedQuantity),
    actualQuantity: Number(plannedQuantity),
    rawMaterialsUsed,
    status: 'COMPLETED',
    startDate: new Date().toISOString(),
    completedDate: new Date().toISOString(),
    operatorName: operatorName || 'Master Baker',
  };

  db.productionBatches.unshift(batch);
  saveDB();
  logActivity('system', operatorName || 'Baker', 'Production Batch', 'Production', `Produced ${plannedQuantity} ${product.unit} of ${product.name}`);

  res.status(201).json(batch);
});

router.delete('/batches/:id', (req, res) => {
  const { id } = req.params;
  const db = loadDB();
  db.productionBatches = db.productionBatches.filter((b) => b.id !== id);
  saveDB();
  res.json({ message: 'Production batch record deleted.' });
});

export default router;

import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { Recipe, ProductionBatch, Product } from '../../types/pos';
import { ChefHat, Plus, Play, Trash2, X, Edit2 } from 'lucide-react';

export const ProductionView: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);

  // Recipe Form
  const [selectedProduct, setSelectedProduct] = useState('');
  const [yieldQty, setYieldQty] = useState('');
  const [yieldUnit, setYieldUnit] = useState('pcs');
  const [ingredients, setIngredients] = useState<{ rawMaterialId: string; quantity: number; unit: string }[]>([]);

  // Batch Form
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [plannedQty, setPlannedQty] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [recs, bats, prods] = await Promise.all([
        apiFetch<Recipe[]>('/production/recipes'),
        apiFetch<ProductionBatch[]>('/production/batches'),
        apiFetch<Product[]>('/products'),
      ]);
      setRecipes(recs);
      setBatches(bats);
      setProducts(prods);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddIngredientRow = () => {
    if (products.length === 0) return;
    setIngredients((prev) => [...prev, { rawMaterialId: products[0].id, quantity: 1, unit: 'kg' }]);
  };

  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);

  const handleEditRecipeClick = (r: Recipe) => {
    setEditingRecipeId(r.id);
    setSelectedProduct(r.productId);
    setYieldQty(r.yieldQuantity.toString());
    setYieldUnit(r.unit || 'pcs');
    setIngredients(
      r.ingredients.map((i) => ({
        rawMaterialId: i.rawMaterialId,
        quantity: i.quantity,
        unit: i.unit,
      }))
    );
    setShowRecipeModal(true);
  };

  const handleCreateRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRecipeId) {
        await apiFetch(`/production/recipes/${editingRecipeId}`, {
          method: 'PUT',
          body: JSON.stringify({
            productId: selectedProduct,
            yieldQuantity: Number(yieldQty),
            unit: yieldUnit,
            ingredients,
          }),
        });
      } else {
        await apiFetch('/production/recipes', {
          method: 'POST',
          body: JSON.stringify({
            productId: selectedProduct,
            yieldQuantity: Number(yieldQty),
            unit: yieldUnit,
            ingredients,
          }),
        });
      }
      setShowRecipeModal(false);
      setEditingRecipeId(null);
      setIngredients([]);
      setSelectedProduct('');
      setYieldQty('');
      loadData();
    } catch (e: any) {
      alert(e.message || 'Failed to save recipe');
    }
  };

  const handleRunBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const recipe = recipes.find((r) => r.id === selectedRecipeId);
    if (!recipe) return;

    try {
      await apiFetch('/production/batches', {
        method: 'POST',
        body: JSON.stringify({
          productId: recipe.productId,
          recipeId: recipe.id,
          plannedQuantity: Number(plannedQty),
        }),
      });
      setShowBatchModal(false);
      setSelectedRecipeId('');
      setPlannedQty('');
      loadData();
    } catch (e: any) {
      alert(e.message || 'Production batch failed');
    }
  };

  const handleDeleteRecipe = async (id: string, productName: string) => {
    if (!confirm(`Are you sure you want to delete the recipe for "${productName}"?`)) return;
    try {
      await apiFetch(`/production/recipes/${id}`, { method: 'DELETE' });
      loadData();
    } catch (e: any) {
      alert(e.message || 'Failed to delete recipe');
    }
  };

  const handleDeleteBatch = async (id: string, batchNo: string) => {
    if (!confirm(`Are you sure you want to delete production batch #${batchNo}?`)) return;
    try {
      await apiFetch(`/production/batches/${id}`, { method: 'DELETE' });
      loadData();
    } catch (e: any) {
      alert(e.message || 'Failed to delete production batch');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-amber-400" />
            <span>Bakery Recipe & Raw Material Production</span>
          </h1>
          <p className="text-xs text-slate-400">Formulate bakery recipes, consume raw ingredients, and track finished batch outputs</p>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={() => setShowRecipeModal(true)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4 text-blue-400" />
            <span>Create Recipe</span>
          </button>
          <button
            onClick={() => setShowBatchModal(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-lg shadow-amber-600/20"
          >
            <Play className="w-4 h-4" />
            <span>Run Production Batch</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RECIPES */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2">
            Bakery Formulas & Recipes
          </h2>

          <div className="space-y-3">
            {recipes.map((r) => (
              <div key={r.id} className="p-3 bg-slate-800/60 rounded-xl space-y-2 border border-slate-800">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-100 text-xs">{r.productName}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-mono font-bold">
                      Yield: {r.yieldQuantity} {r.unit}
                    </span>
                    <button
                      onClick={() => handleEditRecipeClick(r)}
                      className="p-1 text-slate-400 hover:text-blue-400 rounded transition-colors"
                      title="Edit Recipe"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteRecipe(r.id, r.productName)}
                      className="p-1 text-slate-400 hover:text-red-400 rounded transition-colors"
                      title="Delete Recipe"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 space-y-1">
                  {r.ingredients.map((ing, i) => (
                    <div key={i} className="flex justify-between">
                      <span>&bull; {ing.rawMaterialName}</span>
                      <span className="font-mono text-slate-300">{ing.quantity} {ing.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {recipes.length === 0 && (
              <div className="text-center py-12 text-slate-500 text-xs">
                No recipes formulated yet. Click "Create Recipe" to link raw materials to finished bakery goods.
              </div>
            )}
          </div>
        </div>

        {/* BATCHES HISTORY */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2">
            Recent Production Batch Runs
          </h2>

          <div className="space-y-2">
            {batches.map((b) => (
              <div key={b.id} className="p-3 bg-slate-800/60 rounded-xl flex justify-between items-center text-xs">
                <div>
                  <div className="font-bold text-slate-200">{b.productName} (#{b.batchNo})</div>
                  <div className="text-[10px] text-slate-400">{new Date(b.startDate).toLocaleString()}</div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-right font-mono">
                    <div className="font-bold text-emerald-400">+{b.actualQuantity} Produced</div>
                    <div className="text-[10px] text-slate-500">Stock Updated</div>
                  </div>
                  <button
                    onClick={() => handleDeleteBatch(b.id, b.batchNo)}
                    className="p-1 text-slate-400 hover:text-red-400 rounded transition-colors"
                    title="Delete Batch Record"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {batches.length === 0 && (
              <div className="text-center py-12 text-slate-500 text-xs">No production batches executed yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* CREATE RECIPE MODAL */}
      {showRecipeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100">Formulate Bakery Recipe</h2>
              <button onClick={() => setShowRecipeModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRecipe} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Finished Bakery Product *</label>
                <select
                  required
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                >
                  <option value="">Choose Finished Good...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Standard Batch Yield Quantity *</label>
                <input
                  type="number"
                  required
                  value={yieldQty}
                  onChange={(e) => setYieldQty(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-bold"
                />
              </div>

              <div className="space-y-2 border-t border-slate-800 pt-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-300">Raw Material Ingredients</span>
                  <button
                    type="button"
                    onClick={handleAddIngredientRow}
                    className="text-blue-400 font-semibold"
                  >
                    + Add Ingredient
                  </button>
                </div>

                {ingredients.map((ing, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      value={ing.rawMaterialId}
                      onChange={(e) => {
                        const updated = [...ingredients];
                        updated[idx].rawMaterialId = e.target.value;
                        setIngredients(updated);
                      }}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      value={ing.quantity}
                      onChange={(e) => {
                        const updated = [...ingredients];
                        updated[idx].quantity = Number(e.target.value);
                        setIngredients(updated);
                      }}
                      className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 font-bold"
                    />
                  </div>
                ))}
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowRecipeModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl"
                >
                  Save Recipe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RUN BATCH MODAL */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100">Run Production Batch</h2>
              <button onClick={() => setShowBatchModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRunBatch} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Select Recipe *</label>
                <select
                  required
                  value={selectedRecipeId}
                  onChange={(e) => setSelectedRecipeId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                >
                  <option value="">Choose Recipe...</option>
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.productName} (Standard Yield: {r.yieldQuantity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Quantity To Produce *</label>
                <input
                  type="number"
                  required
                  value={plannedQty}
                  onChange={(e) => setPlannedQty(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-emerald-400 font-bold"
                  placeholder="e.g. 100"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl"
                >
                  Consume Ingredients & Produce
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

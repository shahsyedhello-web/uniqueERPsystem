import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { Category, Product } from '../../types/pos';
import { Plus, FolderTree, Edit2, Trash2, X, AlertTriangle, AlertCircle, CheckCircle, Package } from 'lucide-react';

export const CategoriesView: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Deletion state
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [targetCategoryId, setTargetCategoryId] = useState<string>('');
  const [deletingError, setDeletingError] = useState<string | null>(null);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoadError(null);
    try {
      const catData = await apiFetch<Category[]>('/categories');
      const prodData = await apiFetch<Product[]>('/products').catch(() => []);
      setCategories(Array.isArray(catData) ? catData : []);
      setProducts(Array.isArray(prodData) ? prodData : []);
    } catch (err: any) {
      console.error(err);
      setLoadError(err.message || 'Failed to load categories from PostgreSQL database.');
      setCategories([]);
      setProducts([]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await apiFetch(`/categories/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
      } else {
        await apiFetch('/categories', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
      }
      setShowModal(false);
      setFormData({ name: '', code: '', description: '' });
      setEditingId(null);
      loadCategories();
    } catch (err: any) {
      alert(err.message || 'Failed to save category');
    }
  };

  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeProducts = Array.isArray(products) ? products : [];

  const handleDeleteClick = (c: Category) => {
    setDeletingCategory(c);
    setDeletingError(null);
    // Default target category to first available other category
    const other = safeCategories.find((cat) => cat.id !== c.id);
    setTargetCategoryId(other ? other.id : '');
  };

  const confirmDeleteCategory = async () => {
    if (!deletingCategory) return;
    const linkedCount = safeProducts.filter((p) => p.categoryId === deletingCategory.id).length;

    if (linkedCount > 0 && !targetCategoryId) {
      setDeletingError('Please select a destination category to move the linked products to.');
      return;
    }

    try {
      const res = await apiFetch<{ message: string }>(`/categories/${deletingCategory.id}`, {
        method: 'DELETE',
        body: linkedCount > 0 ? JSON.stringify({ reassignToCategoryId: targetCategoryId }) : undefined,
      });
      setDeleteSuccessMessage(res.message || `Category "${deletingCategory.name}" deleted successfully.`);
      setTimeout(() => setDeleteSuccessMessage(null), 4000);
      setDeletingCategory(null);
      setDeletingError(null);
      await loadCategories();
    } catch (err: any) {
      setDeletingError(err.message || 'Failed to delete category.');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-blue-400" />
            <span>Product Categories</span>
          </h1>
          <p className="text-xs text-slate-400">Organize bakery products into categories</p>
        </div>

        <button
          onClick={() => {
            setEditingId(null);
            setFormData({ name: '', code: '', description: '' });
            setShowModal(true);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-lg shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Add Category</span>
        </button>
      </div>

      {loadError && (
        <div className="flex items-center justify-between text-xs text-red-400 bg-red-950/60 border border-red-800/80 p-3.5 rounded-xl font-bold shadow-sm">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{loadError}</span>
          </div>
          <button onClick={loadCategories} className="px-3 py-1 bg-red-900/50 hover:bg-red-900 text-red-200 rounded-lg text-[11px]">
            Retry
          </button>
        </div>
      )}

      {deleteSuccessMessage && (
        <div className="flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 p-3 rounded-xl font-bold shadow-sm animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{deleteSuccessMessage}</span>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-3.5">Category Name</th>
              <th className="p-3.5">Category Code</th>
              <th className="p-3.5">Linked Products</th>
              <th className="p-3.5">Description</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {safeCategories.map((c) => {
              const productCount = safeProducts.filter((p) => p.categoryId === c.id).length;
              return (
                <tr key={c.id} className="hover:bg-slate-800/40">
                  <td className="p-3.5 font-bold text-slate-100">{c.name}</td>
                  <td className="p-3.5 font-mono text-blue-400">{c.code}</td>
                  <td className="p-3.5">
                    <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                      <Package className="w-3 h-3 text-slate-400" />
                      <span>{productCount} item{productCount === 1 ? '' : 's'}</span>
                    </span>
                  </td>
                  <td className="p-3.5 text-slate-400">{c.description || '-'}</td>
                  <td className="p-3.5 text-right space-x-2">
                    <button
                      onClick={() => {
                        setEditingId(c.id);
                        setFormData({ name: c.name, code: c.code, description: c.description || '' });
                        setShowModal(true);
                      }}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg transition-colors"
                      title="Edit Category"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(c)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-red-400 rounded-lg transition-colors"
                      title="Delete Category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {categories.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-slate-500">
                  No categories created yet. Click "Add Category" to start.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100">
                {editingId ? 'Edit Category' : 'Create Category'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Sweets, Bakery, Cakes, Pastries"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Category Code (Optional)</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono uppercase focus:outline-none"
                  placeholder="Auto-generated if left blank (e.g. CAT-001)"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                  rows={2}
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* DELETE CATEGORY CONFIRMATION MODAL */}
      {deletingCategory && (() => {
        const linkedProducts = safeProducts.filter((p) => p.categoryId === deletingCategory.id);
        const otherCategories = safeCategories.filter((c) => c.id !== deletingCategory.id);

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
              <div className="flex items-center space-x-3 text-red-600 border-b border-slate-100 pb-3">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Confirm Category Delete</h2>
                  <p className="text-[11px] text-slate-500 font-medium">Category Database Management</p>
                </div>
              </div>

              {deletingError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{deletingError}</p>
                </div>
              )}

              {linkedProducts.length > 0 ? (
                <div className="space-y-3 text-xs text-slate-600">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <Package className="w-4 h-4 text-amber-700" />
                      <span>This category contains {linkedProducts.length} product(s).</span>
                    </p>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Before deleting <strong>"{deletingCategory.name}"</strong>, choose another category to move all existing products to:
                    </p>
                  </div>

                  {otherCategories.length > 0 ? (
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Move products to:</label>
                      <select
                        value={targetCategoryId}
                        onChange={(e) => setTargetCategoryId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 font-medium text-xs focus:ring-2 focus:ring-blue-500"
                      >
                        {otherCategories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name} ({cat.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <p className="text-red-600 font-medium text-xs">
                      No other categories available. Please create another category first or reassign the products manually.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
                  <p>
                    Are you sure you want to delete category{' '}
                    <strong className="text-slate-900 font-bold">"{deletingCategory.name}"</strong> (Code:{' '}
                    <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-blue-600 font-bold">
                      {deletingCategory.code}
                    </code>
                    )?
                  </p>
                  <p className="text-slate-500 text-[11px]">
                    This category has no linked products and will be permanently removed from the database.
                  </p>
                </div>
              )}

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeletingCategory(null);
                    setDeletingError(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                {(linkedProducts.length === 0 || otherCategories.length > 0) && (
                  <button
                    type="button"
                    onClick={confirmDeleteCategory}
                    className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-600/30 text-xs transition-all active:scale-95"
                  >
                    {linkedProducts.length > 0 ? 'Move Products & Delete Category' : 'Confirm Delete'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

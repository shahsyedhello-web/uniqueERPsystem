import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { Product, Category, Supplier } from '../../types/pos';
import { Plus, Search, Edit2, Trash2, Barcode, Printer, X, AlertCircle, Camera, RefreshCw, AlertTriangle, CheckCircle, Upload, Image as ImageIcon } from 'lucide-react';
import { BarcodeImage } from '../common/BarcodeImage';
import { BarcodePrintModal } from '../common/BarcodePrintModal';
import { CameraBarcodeScannerModal } from '../common/CameraBarcodeScannerModal';
import { generateEAN13Barcode, generateSKU } from '../../utils/barcode';

export const ProductsView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showBarcodePrintModal, setShowBarcodePrintModal] = useState(false);
  const [selectedForBarcode, setSelectedForBarcode] = useState<Product | null>(null);
  const [showCameraScanner, setShowCameraScanner] = useState(false);

  // Deletion State
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deletingError, setDeletingError] = useState<string | null>(null);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);

  // Form State
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    sku: '',
    barcode: '',
    categoryId: '',
    unit: 'pcs',
    purchasePrice: 0,
    salePrice: 0,
    wholesalePrice: 0,
    costPrice: 0,
    minStock: 5,
    currentStock: 0,
    description: '',
    image: '',
    expiryDays: 0,
    supplierId: '',
    taxRate: 0,
    isKitchenItem: false,
    status: 'ACTIVE',
  });

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      setImageUploadError('Please select a PNG, JPG, JPEG, or WEBP image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setImageUploadError('Selected image exceeds maximum 5MB size limit.');
      return;
    }

    setImageUploadError(null);
    setIsUploadingImage(true);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Str = reader.result as string;
        try {
          const res = await apiFetch<{ imageUrl: string }>('/products/upload-image', {
            method: 'POST',
            body: JSON.stringify({ imageBase64: base64Str, filename: file.name }),
          });
          setFormData((prev) => ({ ...prev, image: res.imageUrl }));
        } catch (err: any) {
          console.error('Image upload failed:', err);
          setImageUploadError(err.message || 'Failed to upload image.');
        } finally {
          setIsUploadingImage(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setIsUploadingImage(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [prods, cats, supps] = await Promise.all([
        apiFetch<Product[]>('/products'),
        apiFetch<Category[]>('/categories'),
        apiFetch<Supplier[]>('/suppliers'),
      ]);
      setProducts(prods);
      setCategories(cats);
      setSuppliers(supps);
      if (cats.length > 0 && !formData.categoryId) {
        setFormData((prev) => ({ ...prev, categoryId: cats[0].id }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await apiFetch(`/products/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
      } else {
        await apiFetch('/products', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
      }
      setShowModal(false);
      resetForm();
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save product');
    }
  };

  const handleDeleteClick = (p: Product) => {
    setDeletingProduct(p);
    setDeletingError(null);
  };

  const confirmDeleteProduct = async () => {
    if (!deletingProduct) return;
    try {
      const res = await apiFetch<{ message: string }>(`/products/${deletingProduct.id}`, { method: 'DELETE' });
      setDeleteSuccessMessage(res.message || `Product "${deletingProduct.name}" deleted successfully.`);
      setTimeout(() => setDeleteSuccessMessage(null), 4000);
      setDeletingProduct(null);
      setDeletingError(null);
      await loadData();
    } catch (err: any) {
      setDeletingError(err.message || 'Failed to delete product.');
    }
  };

  const handleArchiveProduct = async () => {
    if (!deletingProduct) return;
    try {
      await apiFetch(`/products/${deletingProduct.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...deletingProduct, status: 'INACTIVE' }),
      });
      setDeleteSuccessMessage(`Product "${deletingProduct.name}" has been set to INACTIVE / archived.`);
      setTimeout(() => setDeleteSuccessMessage(null), 4000);
      setDeletingProduct(null);
      setDeletingError(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to archive product.');
    }
  };

  const handleEdit = (p: Product) => {
    setEditingId(p.id);
    setFormData(p);
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: '',
      sku: '',
      barcode: '',
      categoryId: categories[0]?.id || '',
      unit: 'pcs',
      purchasePrice: 0,
      salePrice: 0,
      wholesalePrice: 0,
      costPrice: 0,
      minStock: 5,
      currentStock: 0,
      description: '',
      expiryDays: 0,
      supplierId: '',
      taxRate: 0,
      isKitchenItem: false,
      status: 'ACTIVE',
    });
  };

  const filtered = products.filter((p) => {
    const matchesCat = selectedCategory === 'ALL' || p.categoryId === selectedCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Products Catalog Management</h1>
          <p className="text-xs text-slate-500 font-medium">
            Manage product items, prices, barcode SKUs, units, and inventory thresholds
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-lg shadow-blue-600/30 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {deleteSuccessMessage && (
        <div className="flex items-center space-x-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-3 rounded-xl font-bold shadow-sm animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{deleteSuccessMessage}</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 flex space-x-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Product Name, SKU, or Barcode..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3 py-2.5 text-xs text-slate-800 font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setShowCameraScanner(true)}
            className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all"
            title="Scan barcode with camera to filter"
          >
            <Camera className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline">Camera Scan</span>
          </button>
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-white border border-slate-200 text-xs font-semibold text-slate-700 rounded-xl px-3 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="ALL">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Products Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Product Name / SKU</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Barcode Image & Code</th>
                <th className="p-3.5">Sale Price</th>
                <th className="p-3.5">Purchase Cost</th>
                <th className="p-3.5">Stock Qty</th>
                <th className="p-3.5">Kitchen</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3.5">
                    <div className="flex items-center space-x-3">
                      {p.image ? (
                        <img
                          src={p.image}
                          alt={p.name}
                          className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0 bg-slate-50"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center shrink-0 text-slate-400">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-slate-800">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{p.sku} &bull; {p.unit}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-semibold border border-slate-200">
                      {p.categoryName || 'Uncategorized'}
                    </span>
                  </td>
                  <td className="p-3.5">
                    <div className="flex flex-col items-start space-y-1">
                      <BarcodeImage value={p.barcode} width={1.2} height={22} fontSize={8} />
                      <span className="font-mono text-[10px] text-slate-500 font-semibold">{p.barcode}</span>
                    </div>
                  </td>
                  <td className="p-3.5 font-bold text-slate-900">Rs. {p.salePrice.toLocaleString()}</td>
                  <td className="p-3.5 text-slate-500">Rs. {p.purchasePrice.toLocaleString()}</td>
                  <td className="p-3.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.currentStock <= p.minStock
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {p.currentStock} {p.unit}
                    </span>
                  </td>
                  <td className="p-3.5">
                    {p.isKitchenItem ? (
                      <span className="text-[10px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded font-semibold border border-amber-200">
                        Bakery KOT
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">-</span>
                    )}
                  </td>
                  <td className="p-3.5 text-right space-x-2">
                    <button
                      onClick={() => {
                        setSelectedForBarcode(p);
                        setShowBarcodePrintModal(true);
                      }}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                      title="Print Barcode Label"
                    >
                      <Barcode className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleEdit(p)}
                      className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                      title="Edit Product"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(p)}
                      className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                      title="Delete Product"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    No products added yet. Click "Add New Product" to start building your bakery catalog.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT PRODUCT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-2xl rounded-2xl p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-800">
                {editingId ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Product Image Upload Section */}
                <div className="sm:col-span-2 bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                  <label className="block text-slate-800 font-bold text-xs uppercase tracking-wider">
                    Product Image / Photo
                  </label>
                  {imageUploadError && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-semibold flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                      <span>{imageUploadError}</span>
                    </div>
                  )}

                  <div className="flex items-center space-x-4">
                    {formData.image ? (
                      <div className="relative group shrink-0">
                        <img
                          src={formData.image}
                          alt="Product preview"
                          className="w-16 h-16 object-cover rounded-xl border border-slate-300 shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, image: '' }))}
                          className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full shadow-md transition-transform active:scale-95"
                          title="Remove image"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center shrink-0 text-slate-400">
                        <ImageIcon className="w-6 h-6 stroke-1" />
                        <span className="text-[9px] font-semibold mt-0.5">No Image</span>
                      </div>
                    )}

                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <label className="cursor-pointer px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-600/20 inline-flex items-center space-x-1.5 transition-all active:scale-95">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{isUploadingImage ? 'Uploading...' : formData.image ? 'Replace Image' : 'Upload Image'}</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            onChange={handleImageSelect}
                            disabled={isUploadingImage}
                            className="hidden"
                          />
                        </label>
                        {formData.image && (
                          <button
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, image: '' }))}
                            className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500">
                        PNG, JPG, WEBP up to 5MB. Image will be displayed on POS cards.
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    placeholder="e.g. Chocolate Fudge Cake 1kg"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Category *</label>
                  <select
                    required
                    value={formData.categoryId || ''}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">SKU Code</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.sku || ''}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3 pr-8 py-2 text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      placeholder="Auto-generated if empty"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, sku: generateSKU('USB') }))}
                      title="Generate SKU"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Barcode (EAN-13)</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.barcode || ''}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3 pr-8 py-2 text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                      placeholder="Auto-generated EAN-13 if empty"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, barcode: generateEAN13Barcode() }))}
                      title="Generate EAN-13 Barcode"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Unit</label>
                  <select
                    value={formData.unit || 'pcs'}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  >
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="kg">Kilograms (kg)</option>
                    <option value="gram">Grams (g)</option>
                    <option value="box">Box</option>
                    <option value="pack">Pack</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Sale Price (PKR) *</label>
                  <input
                    type="number"
                    required
                    value={formData.salePrice || ''}
                    onChange={(e) => setFormData({ ...formData, salePrice: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Purchase Cost (PKR)</label>
                  <input
                    type="number"
                    value={formData.purchasePrice || ''}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Initial Stock Qty</label>
                  <input
                    type="number"
                    value={formData.currentStock || ''}
                    onChange={(e) => setFormData({ ...formData, currentStock: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Minimum Alert Stock Level</label>
                  <input
                    type="number"
                    value={formData.minStock || 5}
                    onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
                  />
                </div>

                <div className="flex items-center space-x-2 pt-5">
                  <input
                    type="checkbox"
                    id="isKitchenItem"
                    checked={formData.isKitchenItem || false}
                    onChange={(e) => setFormData({ ...formData, isKitchenItem: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-0 border-slate-300"
                  />
                  <label htmlFor="isKitchenItem" className="text-slate-700 font-semibold cursor-pointer">
                    Route Order to Bakery Kitchen KOT
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all active:scale-95"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BARCODE LABEL PRINT MODAL */}
      <BarcodePrintModal
        isOpen={showBarcodePrintModal}
        product={selectedForBarcode}
        onClose={() => {
          setShowBarcodePrintModal(false);
          setSelectedForBarcode(null);
        }}
      />

      {/* CAMERA BARCODE SCANNER MODAL FOR FILTERING */}
      <CameraBarcodeScannerModal
        isOpen={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScanSuccess={(scannedCode) => {
          setSearch(scannedCode);
        }}
        title="Filter Product List by Camera Scan"
      />

      {/* DELETE PRODUCT CONFIRMATION MODAL */}
      {deletingProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-red-600 border-b border-slate-100 pb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div>
                <h2 className="text-sm font-bold text-slate-800">Confirm Permanent Delete</h2>
                <p className="text-[11px] text-slate-500 font-medium">Product Catalog Database Operation</p>
              </div>
            </div>

            {deletingError ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs space-y-2">
                <div className="font-bold flex items-center space-x-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>Cannot Delete Product</span>
                </div>
                <p className="leading-relaxed">{deletingError}</p>
              </div>
            ) : (
              <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
                <p>
                  Are you sure you want to permanently delete product{' '}
                  <strong className="text-slate-900 font-bold">"{deletingProduct.name}"</strong> (SKU:{' '}
                  <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-blue-600 font-bold">
                    {deletingProduct.sku}
                  </code>
                  )?
                </p>
                <p className="text-slate-500 text-[11px]">
                  This action will permanently purge the item record from the database.
                </p>
              </div>
            )}

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setDeletingProduct(null);
                  setDeletingError(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
              >
                {deletingError ? 'Close' : 'Cancel'}
              </button>
              {deletingError ? (
                <button
                  type="button"
                  onClick={handleArchiveProduct}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-lg shadow-amber-600/30 text-xs transition-all active:scale-95"
                >
                  Archive Product (Set INACTIVE)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={confirmDeleteProduct}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-600/30 text-xs transition-all active:scale-95"
                >
                  Confirm Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

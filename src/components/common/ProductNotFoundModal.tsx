import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { Category, Product } from '../../types/pos';
import { Barcode, Plus, X, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { generateEAN13Barcode, generateSKU } from '../../utils/barcode';

interface ProductNotFoundModalProps {
  isOpen: boolean;
  scannedBarcode: string;
  onClose: () => void;
  onProductCreated?: (product: Product) => void;
}

export const ProductNotFoundModal: React.FC<ProductNotFoundModalProps> = ({
  isOpen,
  scannedBarcode,
  onClose,
  onProductCreated,
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [showQuickForm, setShowQuickForm] = useState(false);

  // Quick Form fields
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [sku, setSku] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [currentStock, setCurrentStock] = useState('10');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setBarcode(scannedBarcode || generateEAN13Barcode());
      setSku(generateSKU('USB'));
      loadCategories();
      setShowQuickForm(false);
      setName('');
      setSalePrice('');
      setPurchasePrice('');
      setError(null);
    }
  }, [isOpen, scannedBarcode]);

  const loadCategories = async () => {
    try {
      const cats = await apiFetch<Category[]>('/categories');
      setCategories(cats);
      if (cats.length > 0) {
        setCategoryId(cats[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateEan13 = () => {
    setBarcode(generateEAN13Barcode());
  };

  const handleGenerateSku = () => {
    setSku(generateSKU('USB'));
  };

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Product Name is required.');
      return;
    }

    if (!salePrice || Number(salePrice) <= 0) {
      setError('Sale Price must be greater than zero.');
      return;
    }

    if (!categoryId) {
      setError('Please select or create a Category first.');
      return;
    }

    setIsSubmitting(true);

    try {
      const finalBarcode = barcode.trim() || generateEAN13Barcode();
      const finalSku = sku.trim() || generateSKU('USB');

      const newProduct = await apiFetch<Product>('/products', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          barcode: finalBarcode,
          sku: finalSku,
          categoryId,
          salePrice: Number(salePrice),
          purchasePrice: Number(purchasePrice) || Number(salePrice) * 0.7,
          unit,
          currentStock: Number(currentStock) || 10,
          minStock: 5,
          taxRate: 0,
          status: 'ACTIVE',
        }),
      });

      if (onProductCreated) {
        onProductCreated(newProduct);
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-red-950/80 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-red-500/20 text-red-400 border border-red-500/30 rounded-2xl flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Product Not Found</h2>
              <p className="text-[11px] font-mono text-red-300">
                Scanned Barcode: <strong className="text-white bg-red-950 px-2 py-0.5 rounded border border-red-800">{scannedBarcode}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          {!showQuickForm ? (
            <div className="text-center space-y-4 py-3">
              <p className="text-slate-300 leading-relaxed font-medium">
                No product registered with barcode <span className="font-mono text-amber-400 font-bold">{scannedBarcode}</span> in your database catalog.
              </p>

              <div className="pt-2 flex flex-col space-y-2.5">
                <button
                  onClick={() => setShowQuickForm(true)}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center space-x-2 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Quick Create Product with Barcode ({scannedBarcode})</span>
                </button>

                <button
                  onClick={onClose}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl"
                >
                  Dismiss & Return to POS
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleQuickSubmit} className="space-y-3">
              {error && (
                <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-red-300 text-[11px] font-medium flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Product Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Special Gulab Jamun 1Kg"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Barcode (EAN-13)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-3 pr-8 py-2 text-slate-100 font-mono font-bold text-[11px]"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateEan13}
                      title="Auto-generate EAN-13"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-400"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">SKU Code</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-3 pr-8 py-2 text-slate-100 font-mono font-bold text-[11px]"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateSku}
                      title="Auto-generate SKU"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-400"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Sale Price (Rs.) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-bold font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Category <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-bold"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Unit</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
                  >
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="kg">Kilogram (kg)</option>
                    <option value="box">Box</option>
                    <option value="pack">Pack</option>
                    <option value="gram">Gram (g)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Initial Stock</label>
                  <input
                    type="number"
                    value={currentStock}
                    onChange={(e) => setCurrentStock(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowQuickForm(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 flex items-center space-x-1.5 active:scale-95 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{isSubmitting ? 'Saving...' : 'Save & Add to Cart'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

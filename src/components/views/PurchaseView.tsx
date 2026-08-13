import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { Purchase, Supplier, Product } from '../../types/pos';
import { Truck, Plus, Trash2, X, FileText } from 'lucide-react';

export const PurchaseView: React.FC = () => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showModal, setShowModal] = useState(false);

  // Form
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<
    { productId: string; productName: string; quantity: number; purchasePrice: number }[]
  >([]);

  const [taxAmount, setTaxAmount] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK' | 'CHEQUE'>('CASH');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [pur, supp, prod] = await Promise.all([
        apiFetch<Purchase[]>('/purchases'),
        apiFetch<Supplier[]>('/suppliers'),
        apiFetch<Product[]>('/products'),
      ]);
      setPurchases(pur);
      setSuppliers(supp);
      setProducts(prod);
    } catch (e) {
      console.error(e);
    }
  };

  const addItemRow = () => {
    if (products.length === 0) return;
    const first = products[0];
    setPurchaseItems((prev) => [
      ...prev,
      { productId: first.id, productName: first.name, quantity: 1, purchasePrice: first.purchasePrice || 0 },
    ]);
  };

  const removeItemRow = (idx: number) => {
    setPurchaseItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const subtotal = purchaseItems.reduce((sum, item) => sum + item.quantity * item.purchasePrice, 0);
  const totalAmount = Math.max(0, subtotal + taxAmount - discount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId || purchaseItems.length === 0) {
      alert('Please select supplier and add at least one item');
      return;
    }

    try {
      await apiFetch('/purchases', {
        method: 'POST',
        body: JSON.stringify({
          supplierId: selectedSupplierId,
          items: purchaseItems,
          taxAmount,
          discount,
          paidAmount,
          paymentMethod,
        }),
      });

      setShowModal(false);
      setPurchaseItems([]);
      setSelectedSupplierId('');
      setTaxAmount(0);
      setDiscount(0);
      setPaidAmount(0);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create purchase');
    }
  };

  const handleDeletePurchase = async (id: string, refNo: string) => {
    if (!confirm(`Are you sure you want to delete purchase record ${refNo}?`)) return;
    try {
      await apiFetch(`/purchases/${id}`, { method: 'DELETE' });
      loadData();
    } catch (e: any) {
      alert(e.message || 'Failed to delete purchase record.');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-400" />
            <span>Supplier Purchase Invoices</span>
          </h1>
          <p className="text-xs text-slate-400">Record inventory purchases, raw materials stock inward, and supplier dues</p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-lg shadow-emerald-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>New Supplier Purchase</span>
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-3.5">Purchase Invoice #</th>
              <th className="p-3.5">Supplier</th>
              <th className="p-3.5">Date</th>
              <th className="p-3.5">Total Amount</th>
              <th className="p-3.5">Paid</th>
              <th className="p-3.5">Due</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {purchases.map((p) => (
              <tr key={p.id} className="hover:bg-slate-800/40">
                <td className="p-3.5 font-bold text-slate-100 font-mono">{p.purchaseNo}</td>
                <td className="p-3.5 font-semibold text-slate-200">{p.supplierName}</td>
                <td className="p-3.5 text-slate-400">{new Date(p.createdAt).toLocaleDateString()}</td>
                <td className="p-3.5 font-bold text-slate-100 font-mono">Rs. {p.totalAmount.toLocaleString()}</td>
                <td className="p-3.5 font-mono text-emerald-400">Rs. {p.paidAmount.toLocaleString()}</td>
                <td className="p-3.5 font-mono text-amber-400">Rs. {p.dueAmount.toLocaleString()}</td>
                <td className="p-3.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      p.paymentStatus === 'PAID'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {p.paymentStatus}
                  </span>
                </td>
                <td className="p-3.5 text-right">
                  <button
                    onClick={() => handleDeletePurchase(p.id, p.purchaseNo)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-red-400 rounded-lg transition-colors"
                    title="Delete Purchase Invoice"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}

            {purchases.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-slate-500">
                  No purchases recorded yet. Click "New Supplier Purchase" to enter a bill.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* NEW PURCHASE MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-100">Record New Purchase Invoice</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Select Supplier *</label>
                <select
                  required
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                >
                  <option value="">Choose Supplier...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 border-t border-slate-800 pt-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-200">Purchased Items & Raw Materials</span>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-[11px]"
                  >
                    + Add Item
                  </button>
                </div>

                {purchaseItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center bg-slate-800/50 p-2 rounded-lg">
                    <select
                      value={item.productId}
                      onChange={(e) => {
                        const prod = products.find((p) => p.id === e.target.value);
                        const updated = [...purchaseItems];
                        if (prod) {
                          updated[idx] = {
                            ...updated[idx],
                            productId: prod.id,
                            productName: prod.name,
                            purchasePrice: prod.purchasePrice || 0,
                          };
                          setPurchaseItems(updated);
                        }
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
                      min="1"
                      value={item.quantity}
                      onChange={(e) => {
                        const updated = [...purchaseItems];
                        updated[idx].quantity = Number(e.target.value);
                        setPurchaseItems(updated);
                      }}
                      placeholder="Qty"
                      className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 font-bold"
                    />

                    <input
                      type="number"
                      value={item.purchasePrice}
                      onChange={(e) => {
                        const updated = [...purchaseItems];
                        updated[idx].purchasePrice = Number(e.target.value);
                        setPurchaseItems(updated);
                      }}
                      placeholder="Unit Price"
                      className="w-24 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 font-bold"
                    />

                    <button
                      type="button"
                      onClick={() => removeItemRow(idx)}
                      className="p-1 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-slate-800 pt-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Paid Amount (PKR)</label>
                  <input
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-emerald-400 font-bold"
                  />
                </div>

                <div className="text-right space-y-1 font-bold pt-2">
                  <div className="text-slate-400">Total Purchase: Rs. {totalAmount.toLocaleString()}</div>
                  <div className="text-amber-400">
                    Remaining Due: Rs. {Math.max(0, totalAmount - paidAmount).toLocaleString()}
                  </div>
                </div>
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
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl"
                >
                  Confirm Purchase & Update Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

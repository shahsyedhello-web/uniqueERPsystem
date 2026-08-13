import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { Sale } from '../../types/pos';
import { Receipt, Search, RotateCcw, Printer, Eye, Trash2, X, CheckCircle, AlertCircle } from 'lucide-react';

export const SalesView: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    loadSales();
  }, []);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadSales = async () => {
    try {
      const data = await apiFetch<Sale[]>('/sales');
      setSales(data);
    } catch (e: any) {
      console.error('Failed to load sales history:', e);
      showToast(e.message || 'Failed to load sales history.', 'error');
    }
  };

  const handleRefund = async (saleId: string) => {
    if (!confirm('Refund this invoice and restore product inventory?')) return;
    try {
      const res = await apiFetch<{ message?: string }>('/sales/refund', {
        method: 'POST',
        body: JSON.stringify({ saleId, reason: 'Customer requested refund' }),
      });
      await loadSales();
      setSelectedSale(null);
      showToast(res.message || 'Refund processed and stock restored.', 'success');
    } catch (e: any) {
      showToast(e.message || 'Refund failed.', 'error');
    }
  };

  const handleDelete = async (saleId: string, invoiceNo: string) => {
    if (!confirm(`Are you sure you want to VOID sale invoice #${invoiceNo}? This will restore stock to inventory and reverse accounting transactions.`)) return;
    try {
      const res = await apiFetch<{ message?: string }>(`/sales/${saleId}`, { method: 'DELETE' });
      await loadSales();
      if (selectedSale?.id === saleId) setSelectedSale(null);
      showToast(res.message || `Sale invoice #${invoiceNo} voided successfully.`, 'success');
    } catch (e: any) {
      console.error('Void/Delete failed:', e);
      showToast(e.message || 'Failed to void sale invoice.', 'error');
    }
  };

  const filtered = sales.filter(
    (s) =>
      s.invoiceNo.toLowerCase().includes(search.toLowerCase()) ||
      s.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      s.cashierName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-blue-400" />
            <span>Sales Invoices History</span>
          </h1>
          <p className="text-xs text-slate-400">View billing audit history, process returns, and print invoices</p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Invoice # or Customer..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none"
          />
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-3.5">Invoice #</th>
              <th className="p-3.5">Customer</th>
              <th className="p-3.5">Date & Time</th>
              <th className="p-3.5">Payment Method</th>
              <th className="p-3.5">Total Amount</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {filtered.map((s) => (
              <tr key={s.id} className="hover:bg-slate-800/40">
                <td className="p-3.5 font-bold text-slate-100 font-mono">{s.invoiceNo}</td>
                <td className="p-3.5 font-semibold text-slate-200">{s.customerName}</td>
                <td className="p-3.5 text-slate-400">{new Date(s.createdAt).toLocaleString()}</td>
                <td className="p-3.5">
                  <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-bold">
                    {s.paymentMethod}
                  </span>
                </td>
                <td className="p-3.5 font-bold text-emerald-400 font-mono">Rs. {s.totalAmount.toLocaleString()}</td>
                <td className="p-3.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      s.status === 'COMPLETED'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : s.status === 'REFUNDED'
                        ? 'bg-amber-500/20 text-amber-400'
                        : s.status === 'VOIDED'
                        ? 'bg-red-500/20 text-red-400 line-through'
                        : 'bg-slate-500/20 text-slate-400'
                    }`}
                  >
                    {s.status}
                  </span>
                </td>
                <td className="p-3.5 text-right space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSale(s);
                    }}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg"
                    title="View Receipt"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  {s.status === 'COMPLETED' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRefund(s.id);
                      }}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg"
                      title="Refund Sale"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(s.id, s.invoiceNo);
                    }}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-red-400 rounded-lg"
                    title="Delete Invoice"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-500">
                  No sales invoices found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* VIEW RECEIPT MODAL */}
      {selectedSale && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-300">Invoice Details</span>
              <button onClick={() => setSelectedSale(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-white text-black p-4 font-mono text-[11px] rounded shadow-inner space-y-3 leading-tight select-text">
              <div className="text-center space-y-1 border-b border-black/20 pb-2">
                <h2 className="font-extrabold text-sm uppercase tracking-wider">Unique Sweets & Bakers</h2>
                <p className="text-[9px]">INVOICE #{selectedSale.invoiceNo}</p>
                <p className="text-[9px]">{new Date(selectedSale.createdAt).toLocaleString()}</p>
              </div>

              <div className="border-t border-b border-black/20 py-1 space-y-1">
                {selectedSale.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{item.productName} (x{item.quantity})</span>
                    <span>Rs. {item.subtotal}</span>
                  </div>
                ))}
              </div>

              <div className="text-right font-bold pt-1">
                <div>TOTAL: Rs. {selectedSale.totalAmount}</div>
                <div className="text-[10px] font-normal">Paid via: {selectedSale.paymentMethod}</div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Invoice</span>
              </button>

              <button
                onClick={() => handleDelete(selectedSale.id, selectedSale.invoiceNo)}
                className="py-2.5 px-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 font-bold rounded-xl text-xs flex items-center justify-center space-x-1 border border-red-500/30"
                title="Delete Invoice"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl shadow-2xl z-50 flex items-center space-x-2 text-xs font-semibold border transition-all animate-bounce ${
            toastType === 'success'
              ? 'bg-slate-900 text-emerald-300 border-emerald-500/40'
              : 'bg-red-950 text-red-200 border-red-500/40'
          }`}
        >
          {toastType === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-400" />
          )}
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

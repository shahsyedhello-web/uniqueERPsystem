import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { Supplier } from '../../types/pos';
import { Layers, Plus, Edit2, Trash2, X, AlertCircle, CheckCircle } from 'lucide-react';

export const SuppliersView: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Supplier deletion state
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);
  const [deletingError, setDeletingError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    companyName: '',
    phone: '',
    email: '',
    address: '',
    taxNumber: '',
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      const data = await apiFetch<Supplier[]>('/suppliers');
      setSuppliers(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await apiFetch(`/suppliers/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
      } else {
        await apiFetch('/suppliers', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
      }
      setShowModal(false);
      setEditingId(null);
      setFormData({ name: '', companyName: '', phone: '', email: '', address: '', taxNumber: '' });
      loadSuppliers();
    } catch (err: any) {
      alert(err.message || 'Failed to save supplier');
    }
  };

  const handleDeleteClick = (s: Supplier) => {
    setDeletingSupplier(s);
    setDeletingError(null);
  };

  const confirmDeleteSupplier = async () => {
    if (!deletingSupplier) return;
    try {
      const res = await apiFetch<{ message: string }>(`/suppliers/${deletingSupplier.id}`, { method: 'DELETE' });
      setSuccessMsg(res.message || `Supplier "${deletingSupplier.name}" deleted successfully.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      setDeletingSupplier(null);
      setDeletingError(null);
      loadSuppliers();
    } catch (err: any) {
      setDeletingError(err.message || 'Failed to delete supplier.');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-400" />
            <span>Suppliers Directory & Ledgers</span>
          </h1>
          <p className="text-xs text-slate-400">Manage vendor details and outstanding payables</p>
        </div>

        <button
          onClick={() => {
            setEditingId(null);
            setFormData({ name: '', companyName: '', phone: '', email: '', address: '', taxNumber: '' });
            setShowModal(true);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-lg shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Supplier</span>
        </button>
      </div>

      {successMsg && (
        <div className="flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 p-3 rounded-xl font-bold shadow-sm animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-3.5">Supplier Name</th>
              <th className="p-3.5">Company Name</th>
              <th className="p-3.5">Contact Phone</th>
              <th className="p-3.5">Outstanding Balance</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {suppliers.map((s) => (
              <tr key={s.id} className="hover:bg-slate-800/40">
                <td className="p-3.5 font-bold text-slate-100">{s.name}</td>
                <td className="p-3.5 text-slate-300">{s.companyName || '-'}</td>
                <td className="p-3.5 font-mono text-slate-300">{s.phone}</td>
                <td className="p-3.5 font-bold text-amber-400 font-mono">Rs. {s.outstandingBalance.toLocaleString()}</td>
                <td className="p-3.5 text-right space-x-2">
                  <button
                    onClick={() => {
                      setEditingId(s.id);
                      setFormData({
                        name: s.name,
                        companyName: s.companyName || '',
                        phone: s.phone,
                        email: s.email || '',
                        address: s.address || '',
                        taxNumber: s.taxNumber || '',
                      });
                      setShowModal(true);
                    }}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg transition-colors"
                    title="Edit Supplier"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(s)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-red-400 rounded-lg transition-colors"
                    title="Delete Supplier"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}

            {suppliers.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-slate-500">
                  No suppliers registered. Click "Add New Supplier" to get started.
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
                {editingId ? 'Edit Supplier' : 'Add New Supplier'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Supplier / Contact Person *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Company / Firm Name</label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono"
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
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE SUPPLIER MODAL */}
      {deletingSupplier && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-red-600 border-b border-slate-100 pb-3">
              <AlertCircle className="w-6 h-6 shrink-0 text-red-600" />
              <div>
                <h2 className="text-sm font-bold text-slate-800">Confirm Supplier Delete</h2>
                <p className="text-[11px] text-slate-500 font-medium">Supplier Management System</p>
              </div>
            </div>

            {deletingError ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs space-y-2">
                <div className="font-bold flex items-center space-x-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>Cannot Delete Supplier</span>
                </div>
                <p className="leading-relaxed">{deletingError}</p>
              </div>
            ) : (
              <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
                <p>
                  Are you sure you want to permanently delete supplier{' '}
                  <strong className="text-slate-900 font-bold">"{deletingSupplier.name}"</strong>?
                </p>
                <p className="text-slate-500 text-[11px]">
                  Suppliers referenced in purchase history or active product listings are protected from deletion.
                </p>
              </div>
            )}

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setDeletingSupplier(null);
                  setDeletingError(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
              >
                {deletingError ? 'Close' : 'Cancel'}
              </button>
              {!deletingError && (
                <button
                  type="button"
                  onClick={confirmDeleteSupplier}
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

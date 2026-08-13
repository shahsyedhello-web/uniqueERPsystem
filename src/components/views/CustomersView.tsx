import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { Customer } from '../../types/pos';
import { Users, Plus, Edit2, Trash2, X, AlertCircle, CheckCircle } from 'lucide-react';

export const CustomersView: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedCust, setSelectedCust] = useState<Customer | null>(null);

  // Deletion state
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [deletingError, setDeletingError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({ name: '', phone: '', email: '', address: '' });
  const [payAmount, setPayAmount] = useState('');

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const data = await apiFetch<Customer[]>('/customers');
      setCustomers(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await apiFetch(`/customers/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
      } else {
        await apiFetch('/customers', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
      }
      setShowAddModal(false);
      setEditingId(null);
      setFormData({ name: '', phone: '', email: '', address: '' });
      loadCustomers();
    } catch (err: any) {
      alert(err.message || 'Failed to save customer');
    }
  };

  const handleDeleteClick = (c: Customer) => {
    setDeletingCustomer(c);
    setDeletingError(null);
  };

  const confirmDeleteCustomer = async () => {
    if (!deletingCustomer) return;
    try {
      const res = await apiFetch<{ message: string }>(`/customers/${deletingCustomer.id}`, { method: 'DELETE' });
      setSuccessMessage(res.message || `Customer "${deletingCustomer.name}" deleted successfully.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      setDeletingCustomer(null);
      setDeletingError(null);
      loadCustomers();
    } catch (err: any) {
      setDeletingError(err.message || 'Failed to delete customer.');
    }
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCust || !payAmount) return;

    try {
      await apiFetch('/customers/payment', {
        method: 'POST',
        body: JSON.stringify({
          customerId: selectedCust.id,
          amount: Number(payAmount),
        }),
      });
      setShowPayModal(false);
      setSelectedCust(null);
      setPayAmount('');
      loadCustomers();
    } catch (err: any) {
      alert(err.message || 'Payment recording failed');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            <span>Customer Credit & Loyalty Management</span>
          </h1>
          <p className="text-xs text-slate-400">Manage customer balances, credit payments, and loyalty points</p>
        </div>

        <button
          onClick={() => {
            setEditingId(null);
            setFormData({ name: '', phone: '', email: '', address: '' });
            setShowAddModal(true);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-lg shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Customer</span>
        </button>
      </div>

      {successMessage && (
        <div className="flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 p-3 rounded-xl font-bold shadow-sm animate-fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-3.5">Customer Name</th>
              <th className="p-3.5">Phone Number</th>
              <th className="p-3.5">Credit Balance</th>
              <th className="p-3.5">Loyalty Points</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-slate-800/40">
                <td className="p-3.5 font-bold text-slate-100">{c.name}</td>
                <td className="p-3.5 font-mono text-slate-300">{c.phone}</td>
                <td className="p-3.5 font-bold text-amber-400 font-mono">Rs. {c.outstandingBalance.toLocaleString()}</td>
                <td className="p-3.5 font-bold text-purple-400 font-mono">{c.loyaltyPoints} pts</td>
                <td className="p-3.5 text-right space-x-2">
                  {c.outstandingBalance > 0 && (
                    <button
                      onClick={() => {
                        setSelectedCust(c);
                        setShowPayModal(true);
                      }}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[11px]"
                    >
                      Receive Payment
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingId(c.id);
                      setFormData({
                        name: c.name,
                        phone: c.phone,
                        email: c.email || '',
                        address: c.address || '',
                      });
                      setShowAddModal(true);
                    }}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg transition-colors"
                    title="Edit Customer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(c)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-red-400 rounded-lg transition-colors"
                    title="Delete Customer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}

            {customers.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-slate-500">
                  No customers added yet. Click "Add New Customer" to start.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ADD / EDIT CUSTOMER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100">
                {editingId ? 'Edit Customer' : 'Add New Customer'}
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREDIT PAYMENT RECEIPT MODAL */}
      {showPayModal && selectedCust && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100">Receive Customer Credit Payment</h2>
              <button onClick={() => setShowPayModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-800/60 p-3 rounded-xl text-xs space-y-1">
              <div className="font-bold text-slate-200">{selectedCust.name} ({selectedCust.phone})</div>
              <div className="text-amber-400 font-bold">Outstanding Due: Rs. {selectedCust.outstandingBalance}</div>
            </div>

            <form onSubmit={handlePaySubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Amount Received (PKR) *</label>
                <input
                  type="number"
                  required
                  max={selectedCust.outstandingBalance}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-emerald-400 font-bold text-base"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CUSTOMER CONFIRMATION MODAL */}
      {deletingCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-red-600 border-b border-slate-100 pb-3">
              <AlertCircle className="w-6 h-6 shrink-0 text-red-600" />
              <div>
                <h2 className="text-sm font-bold text-slate-800">Confirm Customer Delete</h2>
                <p className="text-[11px] text-slate-500 font-medium">Customer Account Database</p>
              </div>
            </div>

            {deletingError ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs space-y-2">
                <div className="font-bold flex items-center space-x-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>Cannot Delete Customer</span>
                </div>
                <p className="leading-relaxed">{deletingError}</p>
              </div>
            ) : (
              <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
                <p>
                  Are you sure you want to delete customer{' '}
                  <strong className="text-slate-900 font-bold">"{deletingCustomer.name}"</strong> (Phone:{' '}
                  <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-blue-600 font-bold">
                    {deletingCustomer.phone}
                  </code>
                  )?
                </p>
                <p className="text-slate-500 text-[11px]">
                  Customers with active sales history or pending credit balances are safeguarded from deletion.
                </p>
              </div>
            )}

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setDeletingCustomer(null);
                  setDeletingError(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
              >
                {deletingError ? 'Close' : 'Cancel'}
              </button>
              {!deletingError && (
                <button
                  type="button"
                  onClick={confirmDeleteCustomer}
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

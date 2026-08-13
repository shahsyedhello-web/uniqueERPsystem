import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { Expense } from '../../types/pos';
import { DollarSign, Plus, Trash2, X } from 'lucide-react';

export const ExpensesView: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    category: 'Utilities',
    title: '',
    amount: '',
    paymentMethod: 'CASH',
    notes: '',
  });

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      const data = await apiFetch<Expense[]>('/expenses');
      setExpenses(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/expenses', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setShowModal(false);
      setFormData({ category: 'Utilities', title: '', amount: '', paymentMethod: 'CASH', notes: '' });
      loadExpenses();
    } catch (err: any) {
      alert(err.message || 'Failed to record expense');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense record?')) return;
    try {
      await apiFetch(`/expenses/${id}`, { method: 'DELETE' });
      loadExpenses();
    } catch (e: any) {
      alert(e.message || 'Delete failed');
    }
  };

  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-red-400" />
            <span>Store Expense Tracker</span>
          </h1>
          <p className="text-xs text-slate-400">Log utility bills, raw material transport, rents, and operational costs</p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-lg shadow-red-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Add Expense</span>
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex justify-between items-center">
        <span className="text-xs font-bold text-slate-300">Total Logged Expenses</span>
        <span className="text-2xl font-black text-red-400 font-mono">Rs. {totalExpense.toLocaleString()}</span>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-3.5">Date</th>
              <th className="p-3.5">Category</th>
              <th className="p-3.5">Expense Title</th>
              <th className="p-3.5">Payment Method</th>
              <th className="p-3.5">Amount</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {expenses.map((e) => (
              <tr key={e.id} className="hover:bg-slate-800/40">
                <td className="p-3.5 text-slate-400">{new Date(e.createdAt).toLocaleDateString()}</td>
                <td className="p-3.5">
                  <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] font-bold">
                    {e.category}
                  </span>
                </td>
                <td className="p-3.5 font-bold text-slate-100">{e.title}</td>
                <td className="p-3.5 text-slate-400">{e.paymentMethod}</td>
                <td className="p-3.5 font-bold text-red-400 font-mono">Rs. {e.amount.toLocaleString()}</td>
                <td className="p-3.5 text-right">
                  <button
                    onClick={() => handleDelete(e.id)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-red-400 rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}

            {expenses.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-slate-500">
                  No expense records logged yet. Click "Add Expense" to start.
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
              <h2 className="text-sm font-bold text-slate-100">Log Store Expense</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Expense Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                >
                  <option value="Utilities">Utilities (Electricity/Gas/Water)</option>
                  <option value="Rent">Shop Rent</option>
                  <option value="Salaries">Staff Salary / Advance</option>
                  <option value="Packaging">Packaging Materials</option>
                  <option value="Transport">Carriage & Freight</option>
                  <option value="Maintenance">Equipment Maintenance</option>
                  <option value="Other">Other Expenses</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Expense Title / Particulars *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                  placeholder="e.g. July Electricity Bill Payment"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Amount (PKR) *</label>
                <input
                  type="number"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-red-400 font-bold"
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
                  className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

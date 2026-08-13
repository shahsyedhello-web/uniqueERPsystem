import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { User, UserRole, Branch, CashRegister } from '../../types/pos';
import { Plus, Shield, Edit2, Trash2, X, Key, UserCheck, UserX, RefreshCw, AlertCircle } from 'lucide-react';

export const UsersView: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetUserName, setResetUserName] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'CASHIER' as UserRole,
    branchId: '',
    registerId: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [uData, bData, rData] = await Promise.all([
        apiFetch<User[]>('/users'),
        apiFetch<Branch[]>('/branches').catch(() => []),
        apiFetch<CashRegister[]>('/finance/registers').catch(() => []),
      ]);
      setUsers(uData);
      setBranches(bData);
      setRegisters(rData);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormError(null);
    setFormData({
      name: '',
      username: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      role: 'CASHIER',
      branchId: branches[0]?.id || '',
      registerId: registers[0]?.id || '',
    });
    setShowModal(true);
  };

  const handleOpenEdit = (u: User) => {
    setEditingUser(u);
    setFormError(null);
    setFormData({
      name: u.name,
      username: u.username || u.email.split('@')[0],
      email: u.email,
      phone: u.phone || '',
      password: '',
      confirmPassword: '',
      role: u.role,
      branchId: u.branchId || '',
      registerId: u.registerId || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!editingUser) {
      if (!formData.password || formData.password.length < 4) {
        setFormError('Password must be at least 4 characters long.');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setFormError('Password and Confirm Password do not match.');
        return;
      }
    }

    try {
      if (editingUser) {
        await apiFetch(`/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: formData.name,
            username: formData.username,
            email: formData.email,
            phone: formData.phone,
            role: formData.role,
            branchId: formData.branchId,
            registerId: formData.registerId,
            password: formData.password || undefined,
          }),
        });
      } else {
        await apiFetch('/users', {
          method: 'POST',
          body: JSON.stringify({
            name: formData.name,
            username: formData.username,
            email: formData.email,
            phone: formData.phone,
            password: formData.password,
            role: formData.role,
            branchId: formData.branchId,
            registerId: formData.registerId,
          }),
        });
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save user account.');
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      alert('Password must be at least 4 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('Password and Confirm Password do not match.');
      return;
    }

    try {
      await apiFetch(`/users/${resetUserId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      });
      alert(`Password reset successfully for ${resetUserName}.`);
      setShowResetModal(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      alert(e.message || 'Failed to reset password.');
    }
  };

  const handleToggleStatus = async (u: User) => {
    try {
      await apiFetch(`/users/${u.id}/toggle-status`, { method: 'POST' });
      loadData();
    } catch (e: any) {
      alert(e.message || 'Failed to update user status.');
    }
  };

  const handleDelete = async (u: User) => {
    try {
      await apiFetch(`/users/${u.id}`, { method: 'DELETE' });
      loadData();
    } catch (e: any) {
      if (e.canDeactivate) {
        if (confirm(`${e.message}\n\nWould you like to DEACTIVATE this user account now instead?`)) {
          handleToggleStatus(u);
        }
      } else {
        alert(e.message || 'Failed to delete user account.');
      }
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            <span>Users & Role-Based Access Control (RBAC)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage user identity, roles, assigned cash registers, authentication credentials, and status
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
            title="Refresh Users"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-lg shadow-blue-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create User</span>
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">User Details</th>
                <th className="p-3.5">Contact</th>
                <th className="p-3.5">Role</th>
                <th className="p-3.5">Assigned Branch & Register</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Last Login</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3.5">
                    <div className="font-bold text-slate-100">{u.name}</div>
                    <div className="text-[11px] text-blue-400 font-mono">@{u.username || u.email.split('@')[0]}</div>
                  </td>
                  <td className="p-3.5">
                    <div className="text-slate-300">{u.email}</div>
                    {u.phone && <div className="text-[10px] text-slate-500 font-mono">{u.phone}</div>}
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide ${
                        u.role === 'SUPER_ADMIN'
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : u.role === 'ADMIN'
                          ? 'bg-indigo-500/20 text-indigo-400'
                          : u.role === 'MANAGER'
                          ? 'bg-blue-500/20 text-blue-400'
                          : u.role === 'KITCHEN'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="p-3.5">
                    <div className="text-slate-200">{u.branchName || u.branchId || 'Head Office'}</div>
                    {u.registerName && <div className="text-[10px] text-slate-400">Reg: {u.registerName}</div>}
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                        u.isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                      {u.isActive ? 'ACTIVE' : 'SUSPENDED'}
                    </span>
                  </td>
                  <td className="p-3.5 text-slate-400 text-[11px]">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                  </td>
                  <td className="p-3.5 text-right space-x-1.5">
                    <button
                      onClick={() => handleOpenEdit(u)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg transition-colors"
                      title="Edit User Profile & Role"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setResetUserId(u.id);
                        setResetUserName(u.name);
                        setNewPassword('');
                        setConfirmPassword('');
                        setShowResetModal(true);
                      }}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg transition-colors"
                      title="Reset Password"
                    >
                      <Key className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(u)}
                      className={`p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors ${
                        u.isActive ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                      title={u.isActive ? 'Suspend / Deactivate User' : 'Activate User'}
                    >
                      {u.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleDelete(u)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-red-400 rounded-lg transition-colors"
                      title="Delete User (Only Unused)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT USER MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100">
                {editingUser ? `Edit User: ${editingUser.name}` : 'Create New System User'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
                    placeholder="e.g. Ali Ahmed"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono"
                    placeholder="e.g. cashier1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono"
                    placeholder="e.g. cashier1@uniquesweets.com"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono"
                    placeholder="0300-1234567"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">System Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-bold"
                >
                  <option value="SUPER_ADMIN">SUPER ADMIN (Unrestricted System Administration)</option>
                  <option value="ADMIN">ADMIN (Operational, Financial & Inventory Admin)</option>
                  <option value="MANAGER">MANAGER (Sales, Inventory & Customer Management)</option>
                  <option value="CASHIER">CASHIER (POS Billing & Shift Register ONLY)</option>
                  <option value="KITCHEN">KITCHEN STAFF (Bakery Orders & Production ONLY)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Assigned Branch</label>
                  <select
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
                  >
                    <option value="">-- All Branches --</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.branchName || b.name} ({b.branchCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Assigned Register</label>
                  <select
                    value={formData.registerId}
                    onChange={(e) => setFormData({ ...formData, registerId: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100"
                  >
                    <option value="">-- Any Register --</option>
                    {registers.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.registerNo})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!editingUser && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Password *</label>
                    <input
                      type="password"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono"
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Confirm Password *</label>
                    <input
                      type="password"
                      required
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20"
                >
                  {editingUser ? 'Save Changes' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <span>Reset Password for {resetUserName}</span>
              </h2>
              <button onClick={() => setShowResetModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">New Password *</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono"
                  placeholder="At least 4 characters"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Confirm New Password *</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono"
                  placeholder="Repeat new password"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

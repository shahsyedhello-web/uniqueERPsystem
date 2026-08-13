import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { Employee, Attendance, Payroll, Department } from '../../types/pos';
import { UserCheck, Plus, Edit2, Trash2, Calendar, DollarSign, X, Check, Clock, AlertCircle, Building2 } from 'lucide-react';

export const EmployeesView: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [activeTab, setActiveTab] = useState<'EMPLOYEES' | 'DEPARTMENTS' | 'ATTENDANCE' | 'PAYROLL'>('EMPLOYEES');
  
  const [showAddEmpModal, setShowAddEmpModal] = useState(false);
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);

  // Department Modal State
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [deptFormData, setDeptFormData] = useState({ name: '', code: '', description: '' });
  const [deletingDept, setDeletingDept] = useState<Department | null>(null);
  const [deletingDeptError, setDeletingDeptError] = useState<string | null>(null);
  const [deptSuccessMsg, setDeptSuccessMsg] = useState<string | null>(null);

  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showPayrollModal, setShowPayrollModal] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    designation: 'Baker / Chef',
    department: '',
    phone: '',
    email: '',
    salary: '',
  });

  const [attData, setAttData] = useState({
    employeeId: '',
    status: 'PRESENT' as 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'LEAVE',
    notes: '',
  });

  const [payData, setPayData] = useState({
    employeeId: '',
    monthYear: new Date().toISOString().substring(0, 7),
    bonuses: '0',
    deductions: '0',
  });

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      const [empRes, deptRes, attRes, payRes] = await Promise.all([
        apiFetch<Employee[]>('/employees'),
        apiFetch<Department[]>('/departments'),
        apiFetch<Attendance[]>('/employees/attendance'),
        apiFetch<Payroll[]>('/employees/payroll'),
      ]);
      setEmployees(empRes);
      setDepartments(deptRes);
      setAttendances(attRes);
      setPayrolls(payRes);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingDeptId) {
        await apiFetch(`/departments/${editingDeptId}`, {
          method: 'PUT',
          body: JSON.stringify(deptFormData),
        });
        setDeptSuccessMsg(`Department updated successfully.`);
      } else {
        await apiFetch('/departments', {
          method: 'POST',
          body: JSON.stringify(deptFormData),
        });
        setDeptSuccessMsg(`Department added successfully.`);
      }
      setTimeout(() => setDeptSuccessMsg(null), 4000);
      setShowDeptModal(false);
      setEditingDeptId(null);
      setDeptFormData({ name: '', code: '', description: '' });
      loadAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to save department');
    }
  };

  const confirmDeleteDept = async () => {
    if (!deletingDept) return;
    try {
      const res = await apiFetch<{ message: string }>(`/departments/${deletingDept.id}`, { method: 'DELETE' });
      setDeptSuccessMsg(res.message || `Department deleted successfully.`);
      setTimeout(() => setDeptSuccessMsg(null), 4000);
      setDeletingDept(null);
      setDeletingDeptError(null);
      loadAllData();
    } catch (err: any) {
      setDeletingDeptError(err.message || 'Failed to delete department.');
    }
  };

  const handleEmpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEmpId) {
        await apiFetch(`/employees/${editingEmpId}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
      } else {
        await apiFetch('/employees', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
      }
      setShowAddEmpModal(false);
      setEditingEmpId(null);
      setFormData({ name: '', designation: 'Baker / Chef', department: 'Kitchen', phone: '', email: '', salary: '' });
      loadAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to save employee');
    }
  };

  // Employee delete state
  const [deletingEmp, setDeletingEmp] = useState<Employee | null>(null);
  const [deletingEmpError, setDeletingEmpError] = useState<string | null>(null);
  const [empSuccessMessage, setEmpSuccessMessage] = useState<string | null>(null);

  const handleDeleteEmpClick = (emp: Employee) => {
    setDeletingEmp(emp);
    setDeletingEmpError(null);
  };

  const confirmDeleteEmp = async () => {
    if (!deletingEmp) return;
    try {
      const res = await apiFetch<{ message: string }>(`/employees/${deletingEmp.id}`, { method: 'DELETE' });
      setEmpSuccessMessage(res.message || `Employee "${deletingEmp.name}" deleted successfully.`);
      setTimeout(() => setEmpSuccessMessage(null), 4000);
      setDeletingEmp(null);
      setDeletingEmpError(null);
      loadAllData();
    } catch (err: any) {
      setDeletingEmpError(err.message || 'Failed to delete employee');
    }
  };

  const handleDeactivateEmp = async () => {
    if (!deletingEmp) return;
    try {
      await apiFetch(`/employees/${deletingEmp.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...deletingEmp, status: 'INACTIVE' }),
      });
      setEmpSuccessMessage(`Employee "${deletingEmp.name}" has been set to INACTIVE.`);
      setTimeout(() => setEmpSuccessMessage(null), 4000);
      setDeletingEmp(null);
      setDeletingEmpError(null);
      loadAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to deactivate employee.');
    }
  };

  const handleMarkAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/employees/attendance', {
        method: 'POST',
        body: JSON.stringify(attData),
      });
      setShowAttendanceModal(false);
      setAttData({ employeeId: '', status: 'PRESENT', notes: '' });
      loadAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to record attendance');
    }
  };

  const handleProcessPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/employees/payroll', {
        method: 'POST',
        body: JSON.stringify(payData),
      });
      setShowPayrollModal(false);
      setPayData({ employeeId: '', monthYear: new Date().toISOString().substring(0, 7), bonuses: '0', deductions: '0' });
      loadAllData();
    } catch (err: any) {
      alert(err.message || 'Failed to process payroll');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-400" />
            <span>Staff HR, Attendance & Payroll</span>
          </h1>
          <p className="text-xs text-slate-400">Manage employee directory, daily attendance, and payroll processing</p>
        </div>

        <div className="flex items-center space-x-2">
          {activeTab === 'EMPLOYEES' && (
            <button
              onClick={() => {
                setEditingEmpId(null);
                setFormData({ name: '', designation: 'Baker / Chef', department: departments[0]?.name || 'Sales', phone: '', email: '', salary: '' });
                setShowAddEmpModal(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-lg shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Employee</span>
            </button>
          )}

          {activeTab === 'DEPARTMENTS' && (
            <button
              onClick={() => {
                setEditingDeptId(null);
                setDeptFormData({ name: '', code: '', description: '' });
                setShowDeptModal(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-lg shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>Add Department</span>
            </button>
          )}

          {activeTab === 'ATTENDANCE' && (
            <button
              onClick={() => {
                if (employees.length > 0) setAttData({ ...attData, employeeId: employees[0].id });
                setShowAttendanceModal(true);
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-lg shadow-emerald-600/20"
            >
              <Clock className="w-4 h-4" />
              <span>Mark Attendance</span>
            </button>
          )}

          {activeTab === 'PAYROLL' && (
            <button
              onClick={() => {
                if (employees.length > 0) setPayData({ ...payData, employeeId: employees[0].id });
                setShowPayrollModal(true);
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 shadow-lg shadow-purple-600/20"
            >
              <DollarSign className="w-4 h-4" />
              <span>Process Salary</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('EMPLOYEES')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'EMPLOYEES' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          Staff Directory ({employees.length})
        </button>
        <button
          onClick={() => setActiveTab('DEPARTMENTS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'DEPARTMENTS' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          Departments ({departments.length})
        </button>
        <button
          onClick={() => setActiveTab('ATTENDANCE')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'ATTENDANCE' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          Daily Attendance ({attendances.length})
        </button>
        <button
          onClick={() => setActiveTab('PAYROLL')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'PAYROLL' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          Salary & Payroll ({payrolls.length})
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'EMPLOYEES' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Emp Code</th>
                <th className="p-3.5">Employee Name</th>
                <th className="p-3.5">Designation</th>
                <th className="p-3.5">Department</th>
                <th className="p-3.5">Phone</th>
                <th className="p-3.5">Monthly Salary</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {employees.map((e) => (
                <tr key={e.id} className="hover:bg-slate-800/40">
                  <td className="p-3.5 font-mono text-blue-400 font-bold">{e.employeeCode}</td>
                  <td className="p-3.5 font-bold text-slate-100">{e.name}</td>
                  <td className="p-3.5 text-slate-300">{e.designation}</td>
                  <td className="p-3.5 text-slate-400">{e.department}</td>
                  <td className="p-3.5 font-mono text-slate-300">{e.phone}</td>
                  <td className="p-3.5 font-bold text-emerald-400 font-mono">Rs. {e.salary.toLocaleString()}</td>
                  <td className="p-3.5 text-right space-x-2">
                    <button
                      onClick={() => {
                        setEditingEmpId(e.id);
                        setFormData({
                          name: e.name,
                          designation: e.designation,
                          department: e.department,
                          phone: e.phone,
                          email: e.email || '',
                          salary: e.salary.toString(),
                        });
                        setShowAddEmpModal(true);
                      }}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteEmpClick(e)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-red-400 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}

              {employees.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    No staff members added yet. Click "Add Employee" to register staff.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'DEPARTMENTS' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Code</th>
                <th className="p-3.5">Department Name</th>
                <th className="p-3.5">Description</th>
                <th className="p-3.5">Active Staff Count</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {departments.map((d) => {
                const count = employees.filter((e) => e.department === d.name || e.departmentId === d.id).length;
                return (
                  <tr key={d.id} className="hover:bg-slate-800/40">
                    <td className="p-3.5 font-mono text-purple-400 font-bold">{d.code}</td>
                    <td className="p-3.5 font-bold text-slate-100 flex items-center space-x-2">
                      <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>{d.name}</span>
                    </td>
                    <td className="p-3.5 text-slate-400">{d.description || '-'}</td>
                    <td className="p-3.5 font-bold text-emerald-400 font-mono">{count} staff member(s)</td>
                    <td className="p-3.5 text-right space-x-2">
                      <button
                        onClick={() => {
                          setEditingDeptId(d.id);
                          setDeptFormData({
                            name: d.name,
                            code: d.code,
                            description: d.description || '',
                          });
                          setShowDeptModal(true);
                        }}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg"
                        title="Edit Department"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setDeletingDept(d);
                          setDeletingDeptError(null);
                        }}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-red-400 rounded-lg"
                        title="Delete Department"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {departments.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500">
                    No departments found. Click "Add Department" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'ATTENDANCE' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Employee Name</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Check In Time</th>
                <th className="p-3.5">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {attendances.map((a) => (
                <tr key={a.id} className="hover:bg-slate-800/40">
                  <td className="p-3.5 font-mono text-slate-400">{a.date}</td>
                  <td className="p-3.5 font-bold text-slate-100">{a.employeeName}</td>
                  <td className="p-3.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      a.status === 'PRESENT' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                      a.status === 'ABSENT' ? 'bg-red-950 text-red-400 border border-red-800' :
                      'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="p-3.5 font-mono text-slate-300">{new Date(a.checkIn || Date.now()).toLocaleTimeString()}</td>
                  <td className="p-3.5 text-slate-400">{a.notes || '-'}</td>
                </tr>
              ))}

              {attendances.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500">
                    No attendance records recorded yet. Click "Mark Attendance" to record daily entries.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'PAYROLL' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Month/Year</th>
                <th className="p-3.5">Employee Name</th>
                <th className="p-3.5">Basic Salary</th>
                <th className="p-3.5">Bonuses</th>
                <th className="p-3.5">Deductions</th>
                <th className="p-3.5">Net Salary</th>
                <th className="p-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {payrolls.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/40">
                  <td className="p-3.5 font-mono text-blue-400 font-bold">{p.monthYear}</td>
                  <td className="p-3.5 font-bold text-slate-100">{p.employeeName}</td>
                  <td className="p-3.5 font-mono text-slate-300">Rs. {p.basicSalary.toLocaleString()}</td>
                  <td className="p-3.5 font-mono text-emerald-400">+Rs. {p.bonuses.toLocaleString()}</td>
                  <td className="p-3.5 font-mono text-red-400">-Rs. {p.deductions.toLocaleString()}</td>
                  <td className="p-3.5 font-bold font-mono text-emerald-300 text-sm">Rs. {p.netSalary.toLocaleString()}</td>
                  <td className="p-3.5">
                    <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded text-[10px] font-bold">
                      {p.paymentStatus}
                    </span>
                  </td>
                </tr>
              ))}

              {payrolls.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    No payroll entries generated yet. Click "Process Salary" to calculate monthly salary.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Employee Modal */}
      {showAddEmpModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100">
                {editingEmpId ? 'Edit Staff Member' : 'Register New Staff Member'}
              </h2>
              <button onClick={() => setShowAddEmpModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEmpSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Designation</label>
                <input
                  type="text"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Department *</label>
                <select
                  required
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                >
                  <option value="" disabled>Select Department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Phone *</label>
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Monthly Basic Salary (PKR) *</label>
                <input
                  type="number"
                  required
                  value={formData.salary}
                  onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-emerald-400 font-bold focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddEmpModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl"
                >
                  Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendance Modal */}
      {showAttendanceModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100">Record Daily Attendance</h2>
              <button onClick={() => setShowAttendanceModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleMarkAttendance} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Select Employee *</label>
                <select
                  value={attData.employeeId}
                  onChange={(e) => setAttData({ ...attData, employeeId: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Status</label>
                <select
                  value={attData.status}
                  onChange={(e) => setAttData({ ...attData, status: e.target.value as any })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                >
                  <option value="PRESENT">PRESENT</option>
                  <option value="ABSENT">ABSENT</option>
                  <option value="LATE">LATE</option>
                  <option value="HALF_DAY">HALF_DAY</option>
                  <option value="LEAVE">LEAVE</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Notes / Remarks</label>
                <input
                  type="text"
                  value={attData.notes}
                  onChange={(e) => setAttData({ ...attData, notes: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                  placeholder="e.g. On-time kitchen shift"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAttendanceModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl"
                >
                  Record Attendance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payroll Modal */}
      {showPayrollModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100">Process Salary Disbursement</h2>
              <button onClick={() => setShowPayrollModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleProcessPayroll} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Select Employee *</label>
                <select
                  value={payData.employeeId}
                  onChange={(e) => setPayData({ ...payData, employeeId: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} - Basic: Rs. {e.salary.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Month / Year (YYYY-MM)</label>
                <input
                  type="month"
                  required
                  value={payData.monthYear}
                  onChange={(e) => setPayData({ ...payData, monthYear: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Bonuses / Allowance (PKR)</label>
                <input
                  type="number"
                  value={payData.bonuses}
                  onChange={(e) => setPayData({ ...payData, bonuses: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-emerald-400 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Deductions / Advance (PKR)</label>
                <input
                  type="number"
                  value={payData.deductions}
                  onChange={(e) => setPayData({ ...payData, deductions: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-red-400 font-bold"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowPayrollModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl"
                >
                  Confirm Salary Disbursement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* DELETE EMPLOYEE CONFIRMATION MODAL */}
      {deletingEmp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-red-600 border-b border-slate-100 pb-3">
              <AlertCircle className="w-6 h-6 shrink-0 text-red-600" />
              <div>
                <h2 className="text-sm font-bold text-slate-800">Confirm Employee Delete</h2>
                <p className="text-[11px] text-slate-500 font-medium">HR Database Management</p>
              </div>
            </div>

            {deletingEmpError ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs space-y-2">
                <div className="font-bold flex items-center space-x-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>Cannot Delete Employee</span>
                </div>
                <p className="leading-relaxed">{deletingEmpError}</p>
              </div>
            ) : (
              <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
                <p>
                  Are you sure you want to permanently delete employee{' '}
                  <strong className="text-slate-900 font-bold">"{deletingEmp.name}"</strong> (Code:{' '}
                  <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-blue-600 font-bold">
                    {deletingEmp.employeeCode}
                  </code>
                  )?
                </p>
                <p className="text-slate-500 text-[11px]">
                  If this employee has active payroll or attendance history, the database will safeguard their record.
                </p>
              </div>
            )}

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setDeletingEmp(null);
                  setDeletingEmpError(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
              >
                {deletingEmpError ? 'Close' : 'Cancel'}
              </button>
              {deletingEmpError ? (
                <button
                  type="button"
                  onClick={handleDeactivateEmp}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-lg shadow-amber-600/30 text-xs transition-all active:scale-95"
                >
                  Deactivate Employee (Set INACTIVE)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={confirmDeleteEmp}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-600/30 text-xs transition-all active:scale-95"
                >
                  Confirm Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ADD / EDIT DEPARTMENT MODAL */}
      {showDeptModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-100">
                {editingDeptId ? 'Edit Department' : 'Add New Department'}
              </h2>
              <button onClick={() => setShowDeptModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDeptSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Department Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sales, Kitchen, Finance"
                  value={deptFormData.name}
                  onChange={(e) => setDeptFormData({ ...deptFormData, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Department Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SALES, KITCHEN"
                  value={deptFormData.code}
                  onChange={(e) => setDeptFormData({ ...deptFormData, code: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono uppercase focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Optional department details..."
                  value={deptFormData.description}
                  onChange={(e) => setDeptFormData({ ...deptFormData, description: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowDeptModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl"
                >
                  Save Department
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE DEPARTMENT MODAL */}
      {deletingDept && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-red-600 border-b border-slate-100 pb-3">
              <AlertCircle className="w-6 h-6 shrink-0 text-red-600" />
              <div>
                <h2 className="text-sm font-bold text-slate-800">Confirm Department Delete</h2>
                <p className="text-[11px] text-slate-500 font-medium">Department Management System</p>
              </div>
            </div>

            {deletingDeptError ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs space-y-2">
                <div className="font-bold flex items-center space-x-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>Cannot Delete Department</span>
                </div>
                <p className="leading-relaxed">{deletingDeptError}</p>
              </div>
            ) : (
              <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
                <p>
                  Are you sure you want to delete department{' '}
                  <strong className="text-slate-900 font-bold">"{deletingDept.name}"</strong> (Code:{' '}
                  <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-purple-600 font-bold">
                    {deletingDept.code}
                  </code>
                  )?
                </p>
                <p className="text-slate-500 text-[11px]">
                  Departments with assigned active employees are protected from deletion to maintain staff records.
                </p>
              </div>
            )}

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => {
                  setDeletingDept(null);
                  setDeletingDeptError(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
              >
                {deletingDeptError ? 'Close' : 'Cancel'}
              </button>
              {!deletingDeptError && (
                <button
                  type="button"
                  onClick={confirmDeleteDept}
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

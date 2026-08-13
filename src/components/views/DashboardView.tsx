import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  DollarSign,
  TrendingUp,
  Boxes,
  AlertTriangle,
  ShoppingCart,
  Receipt,
  Truck,
  PlusCircle,
  Clock,
  CheckCircle2,
  Users,
  Wallet,
  Building2,
  Bell,
  Sun,
  Cloud,
  ChefHat,
  Factory,
  ArrowDownRight,
  ArrowUpRight,
  FileText,
  UserCheck,
  RefreshCw,
  Search,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

interface DashboardViewProps {
  onNavigate: (module: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { branches, activeBranch, setActiveBranch } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(new Date());

  // Live Clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchStats = async () => {
    try {
      const data = await apiFetch('/dashboard/stats');
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-slate-500 space-y-4">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold tracking-wide text-slate-600">
          Loading Enterprise POS Analytics & Financial Data...
        </p>
      </div>
    );
  }

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4'];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto font-sans">
      {/* Top Header & Context Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 font-bold text-[11px] rounded-full border border-blue-100 uppercase tracking-wider">
              Enterprise Dashboard
            </span>
            <span className="text-xs text-slate-400 font-medium">&bull;</span>
            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Database Connected
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Unique Sweets & Bakers POS
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Real-time multi-branch counter overview, financial metrics, kitchen routing, and stock analytics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Branch Selector */}
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700">
            <Building2 className="w-4 h-4 text-blue-600" />
            <select
              value={activeBranch?.id || ''}
              onChange={(e) => {
                const found = branches.find((b) => b.id === e.target.value);
                if (found) setActiveBranch(found);
              }}
              className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.branchName || b.name} ({b.branchCode || b.code}){b.isHeadOffice || b.isMain ? ' - Head Office' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Live Clock */}
          <div className="flex items-center space-x-2 bg-slate-900 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm font-mono">
            <Clock className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '8s' }} />
            <span>{time.toLocaleTimeString()}</span>
          </div>

          {/* Weather Widget */}
          <div className="flex items-center space-x-2 bg-blue-50/70 text-blue-800 border border-blue-100 px-3 py-2 rounded-xl text-xs font-semibold">
            <Sun className="w-4 h-4 text-amber-500" />
            <span>28°C &bull; Sunny</span>
          </div>

          {/* Quick Action: POS Billing */}
          <button
            onClick={() => onNavigate('pos')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center space-x-2 shadow-lg shadow-blue-600/20 active:scale-95 transition-all cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Open POS Counter (F2)</span>
          </button>

          <button
            onClick={fetchStats}
            title="Refresh Data"
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notifications Banner if any */}
      {stats?.notifications && stats.notifications.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {stats.notifications.map((notif: any) => (
            <div
              key={notif.id}
              className={`p-3.5 rounded-xl border flex items-start space-x-3 text-xs font-medium shadow-xs ${
                notif.type === 'danger'
                  ? 'bg-red-50/80 border-red-200 text-red-900'
                  : notif.type === 'warning'
                  ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                  : 'bg-blue-50/80 border-blue-200 text-blue-900'
              }`}
            >
              <Bell className="w-4 h-4 shrink-0 mt-0.5 text-current" />
              <div className="flex-1">
                <div className="font-bold">{notif.title}</div>
                <div className="text-[11px] opacity-90">{notif.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Metric Cards Grid - Enterprise 8-Card Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Today's Sales</span>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <DollarSign className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            Rs. {stats?.todaySales?.toLocaleString() || '0'}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
            <span className="flex items-center gap-1 font-medium text-slate-600">
              <Receipt className="w-3.5 h-3.5 text-blue-600" />
              {stats?.todayCount || 0} Orders Today
            </span>
            <span className="text-emerald-600 font-bold flex items-center gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> Live
            </span>
          </div>
        </div>

        {/* Monthly Revenue */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Monthly Revenue</span>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <TrendingUp className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            Rs. {stats?.monthlySales?.toLocaleString() || '0'}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
            <span className="font-semibold text-slate-700">Yearly Total</span>
            <span className="font-bold text-slate-900">Rs. {stats?.yearlySales?.toLocaleString() || '0'}</span>
          </div>
        </div>

        {/* Gross & Net Profit */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Net Profit</span>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
              <Wallet className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className={`text-2xl font-black tracking-tight ${stats?.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            Rs. {stats?.netProfit?.toLocaleString() || '0'}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
            <span className="font-semibold text-slate-700">Gross Margin</span>
            <span className="font-bold text-slate-900">Rs. {stats?.grossProfit?.toLocaleString() || '0'}</span>
          </div>
        </div>

        {/* Inventory Value */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Stock Valuation</span>
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl border border-purple-100">
              <Boxes className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            Rs. {stats?.inventoryValue?.toLocaleString() || '0'}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
            <span className="font-semibold text-slate-700">Active SKUs</span>
            <span className="font-bold text-purple-700">{stats?.totalProducts || 0} Products</span>
          </div>
        </div>

        {/* Cash in Hand */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Cash in Hand</span>
            <div className="p-2.5 bg-cyan-50 text-cyan-600 rounded-xl border border-cyan-100">
              <Wallet className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            Rs. {stats?.cashInHand?.toLocaleString() || '0'}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
            <span className="font-semibold text-slate-700">Bank Balance</span>
            <span className="font-bold text-slate-900">Rs. {stats?.bankBalance?.toLocaleString() || '0'}</span>
          </div>
        </div>

        {/* Receivables & Payables */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Customer Dues</span>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <Users className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-900 tracking-tight">
            Rs. {stats?.pendingReceivables?.toLocaleString() || '0'}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
            <span className="font-semibold text-slate-700">Supplier Dues</span>
            <span className="font-bold text-amber-700">Rs. {stats?.pendingPayables?.toLocaleString() || '0'}</span>
          </div>
        </div>

        {/* Expenses Today */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Today's Expenses</span>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
              <ArrowDownRight className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            Rs. {stats?.todayExpenses?.toLocaleString() || '0'}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
            <span className="font-semibold text-slate-700">Total Expenses</span>
            <span className="font-bold text-rose-600">Rs. {stats?.totalExpenses?.toLocaleString() || '0'}</span>
          </div>
        </div>

        {/* Active Staff & Customers */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-3 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Customers & Staff</span>
            <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl border border-teal-100">
              <UserCheck className="w-4.5 h-4.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight flex items-baseline gap-2">
            <span>{stats?.totalCustomers || 0}</span>
            <span className="text-xs font-normal text-slate-500">Customers</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
            <span className="font-semibold text-slate-700">Active Staff</span>
            <span className="font-bold text-teal-700">{stats?.activeEmployees || 0} Employees</span>
          </div>
        </div>
      </div>

      {/* Interactive Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend Line/Area Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span>Sales & Profit Trend (Last 7 Days)</span>
              </h2>
              <p className="text-[11px] text-slate-500">Daily revenue and gross margin metrics</p>
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
              Weekly Overview
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.salesTrendChart || []}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="sales" name="Sales (Rs.)" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                <Area type="monotone" dataKey="profit" name="Profit Est. (Rs.)" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Product Category Distribution Chart */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Category Share</h2>
              <p className="text-[11px] text-slate-500">Stock inventory value by category</p>
            </div>
            <button onClick={() => onNavigate('categories')} className="text-xs text-blue-600 font-semibold hover:underline">
              Categories
            </button>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {stats?.categoryChart && stats.categoryChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.categoryChart}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {stats.categoryChart.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '11px' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-400">No category chart data.</p>
            )}
          </div>
        </div>
      </div>

      {/* Operational Widgets: Kitchen KOT, Production & Stock Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Kitchen KOT Status Widget */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ChefHat className="w-4 h-4 text-amber-600" />
              <span>Kitchen Display (KOT)</span>
            </h2>
            <button onClick={() => onNavigate('kitchen')} className="text-xs text-blue-600 font-bold hover:underline cursor-pointer">
              Open Kitchen &rarr;
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
              <div className="text-amber-800 font-medium">Pending Orders</div>
              <div className="text-xl font-black text-amber-900">{stats?.kitchenOrdersStatus?.pending || 0}</div>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
              <div className="text-blue-800 font-medium">Preparing</div>
              <div className="text-xl font-black text-blue-900">{stats?.kitchenOrdersStatus?.preparing || 0}</div>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
              <div className="text-emerald-800 font-medium">Ready for Counter</div>
              <div className="text-xl font-black text-emerald-900">{stats?.kitchenOrdersStatus?.ready || 0}</div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <div className="text-slate-600 font-medium">Served</div>
              <div className="text-xl font-black text-slate-800">{stats?.kitchenOrdersStatus?.served || 0}</div>
            </div>
          </div>
        </div>

        {/* Production Batch Status Widget */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Factory className="w-4 h-4 text-purple-600" />
              <span>Production & Baking</span>
            </h2>
            <button onClick={() => onNavigate('production')} className="text-xs text-blue-600 font-bold hover:underline cursor-pointer">
              Manage Batches &rarr;
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100">
              <span className="font-semibold text-slate-700">Batches Planned</span>
              <span className="px-2.5 py-0.5 bg-purple-100 text-purple-800 font-bold rounded-full">
                {stats?.productionStatus?.planned || 0}
              </span>
            </div>
            <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100">
              <span className="font-semibold text-slate-700">In Oven / Production</span>
              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 font-bold rounded-full">
                {stats?.productionStatus?.inProgress || 0}
              </span>
            </div>
            <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100">
              <span className="font-semibold text-slate-700">Completed Batches</span>
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-full">
                {stats?.productionStatus?.completed || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Inventory Stock & Low Stock Widget */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <span>Low Stock Alerts</span>
            </h2>
            <button onClick={() => onNavigate('inventory')} className="text-xs text-blue-600 font-bold hover:underline cursor-pointer">
              Reorder Stock &rarr;
            </button>
          </div>

          {stats?.lowStockList && stats.lowStockList.length > 0 ? (
            <div className="space-y-2 max-h-40 overflow-y-auto text-xs pr-1">
              {stats.lowStockList.map((item: any) => (
                <div key={item.id} className="flex justify-between items-center p-2 bg-rose-50/60 rounded-xl border border-rose-100">
                  <span className="font-bold text-slate-800 truncate max-w-[150px]">{item.name}</span>
                  <span className="text-rose-700 font-black">
                    {item.currentStock} {item.unit} left
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>All product stocks are sufficient!</span>
            </div>
          )}
        </div>
      </div>

      {/* Best Selling Products & Top Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Products */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Best Selling Products</span>
            </h2>
            <button onClick={() => onNavigate('products')} className="text-xs text-blue-600 font-bold hover:underline cursor-pointer">
              All Products
            </button>
          </div>

          {stats?.bestSellingProducts && stats.bestSellingProducts.length > 0 ? (
            <div className="space-y-2 text-xs">
              {stats.bestSellingProducts.map((prod: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                  <div className="flex items-center space-x-3">
                    <span className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-slate-900">{prod.name}</div>
                      <div className="text-[10px] text-slate-500">{prod.category}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-slate-900">Rs. {prod.revenue?.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-500 font-medium">{prod.qty} units sold</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-4 text-center">No sales logged yet.</p>
          )}
        </div>

        {/* Top Customers */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span>Top Customers</span>
            </h2>
            <button onClick={() => onNavigate('customers')} className="text-xs text-blue-600 font-bold hover:underline cursor-pointer">
              Customer Directory
            </button>
          </div>

          {stats?.topCustomers && stats.topCustomers.length > 0 ? (
            <div className="space-y-2 text-xs">
              {stats.topCustomers.map((cust: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                      {cust.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{cust.name}</div>
                      <div className="text-[10px] text-slate-500">{cust.phone} &bull; {cust.ordersCount} Orders</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-emerald-700">Rs. {cust.totalSpent?.toLocaleString()}</div>
                    <div className="text-[10px] text-slate-400">Total Spent</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-4 text-center">No customer sales registered yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

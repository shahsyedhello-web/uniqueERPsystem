import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  ShoppingCart,
  UtensilsCrossed,
  Package,
  Boxes,
  ChefHat,
  Truck,
  Users,
  Receipt,
  UserCheck,
  BarChart3,
  Settings,
  ShieldCheck,
  FolderTree,
  DollarSign,
  Layers,
  Landmark,
} from 'lucide-react';

interface SidebarProps {
  currentModule: string;
  onNavigate: (module: string) => void;
}

export function isModuleAllowedForRole(module: string, role?: string): boolean {
  if (!role || role === 'SUPER_ADMIN' || role === 'ADMIN') return true;

  if (role === 'CASHIER') {
    return ['pos', 'sales', 'customers'].includes(module);
  }

  if (role === 'KITCHEN') {
    return ['kitchen', 'production'].includes(module);
  }

  if (role === 'MANAGER') {
    return [
      'dashboard',
      'pos',
      'kitchen',
      'products',
      'categories',
      'production',
      'inventory',
      'purchases',
      'suppliers',
      'sales',
      'customers',
      'reports',
    ].includes(module);
  }

  return false;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentModule, onNavigate }) => {
  const { user } = useAuth();

  const menuGroups = [
    {
      title: 'CORE OPERATIONAL',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'pos', label: 'POS Billing', icon: ShoppingCart, hotkey: 'F2' },
        { id: 'kitchen', label: 'Kitchen Orders', icon: UtensilsCrossed },
      ],
    },
    {
      title: 'CATALOG & BAKERY',
      items: [
        { id: 'products', label: 'Products', icon: Package },
        { id: 'categories', label: 'Categories', icon: FolderTree },
        { id: 'production', label: 'Recipe & Production', icon: ChefHat },
      ],
    },
    {
      title: 'STOCK & SUPPLIES',
      items: [
        { id: 'inventory', label: 'Inventory & Stock', icon: Boxes },
        { id: 'purchases', label: 'Purchases', icon: Truck },
        { id: 'suppliers', label: 'Suppliers', icon: Layers },
      ],
    },
    {
      title: 'SALES & HR',
      items: [
        { id: 'sales', label: 'Sales & Invoices', icon: Receipt },
        { id: 'customers', label: 'Customers & Credit', icon: Users },
        { id: 'expenses', label: 'Expenses', icon: DollarSign },
        { id: 'employees', label: 'Employees & Payroll', icon: UserCheck },
      ],
    },
    {
      title: 'BUSINESS & SYSTEM',
      items: [
        { id: 'accounting', label: 'Finance & Accounts', icon: Landmark },
        { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
        { id: 'users', label: 'Users & Permissions', icon: ShieldCheck },
        { id: 'settings', label: 'Settings & Printers', icon: Settings },
      ],
    },
  ];

  const filteredGroups = menuGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isModuleAllowedForRole(item.id, user?.role)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 text-slate-300 flex flex-col h-[calc(100vh-4rem)] select-none shrink-0 overflow-y-auto">
      <div className="p-3 space-y-5">
        {filteredGroups.map((group, idx) => (
          <div key={idx} className="space-y-1">
            <h2 className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {group.title}
            </h2>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = currentModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white font-bold shadow-lg shadow-blue-900/30'
                      : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.hotkey && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        isActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {item.hotkey}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
};

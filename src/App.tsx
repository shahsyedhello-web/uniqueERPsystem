import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, isModuleAllowedForRole } from './components/layout/Sidebar';
import { LoginView } from './components/views/LoginView';
import { SetupWizardView } from './components/views/SetupWizardView';
import { DashboardView } from './components/views/DashboardView';
import { POSView } from './components/views/POSView';
import { ProductsView } from './components/views/ProductsView';
import { CategoriesView } from './components/views/CategoriesView';
import { InventoryView } from './components/views/InventoryView';
import { PurchaseView } from './components/views/PurchaseView';
import { SuppliersView } from './components/views/SuppliersView';
import { SalesView } from './components/views/SalesView';
import { CustomersView } from './components/views/CustomersView';
import { ExpensesView } from './components/views/ExpensesView';
import { EmployeesView } from './components/views/EmployeesView';
import { KitchenView } from './components/views/KitchenView';
import { ProductionView } from './components/views/ProductionView';
import { ReportsView } from './components/views/ReportsView';
import { SettingsView } from './components/views/SettingsView';
import { UsersView } from './components/views/UsersView';
import { AccountingView } from './components/views/AccountingView';
import { ShieldAlert } from 'lucide-react';

const MainContent: React.FC = () => {
  const { user, isAuthenticated, isSetupRequired, loading } = useAuth();
  const [currentModule, setCurrentModuleState] = useState(() => {
    return localStorage.getItem('pos_current_module') || 'dashboard';
  });
  const [showSetupWizard, setShowSetupWizard] = useState(false);

  const setCurrentModule = (module: string) => {
    setCurrentModuleState(module);
    localStorage.setItem('pos_current_module', module);
  };

  // Default module landing page based on user role
  useEffect(() => {
    if (user?.role) {
      const savedModule = localStorage.getItem('pos_current_module');
      if (savedModule && isModuleAllowedForRole(savedModule, user.role)) {
        setCurrentModuleState(savedModule);
      } else {
        const defaultModule =
          user.role === 'CASHIER' ? 'pos' : user.role === 'KITCHEN' ? 'kitchen' : 'dashboard';
        setCurrentModule(defaultModule);
      }
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        if (isModuleAllowedForRole('pos', user?.role)) {
          setCurrentModule('pos');
        }
      } else if (e.key === 'F1') {
        e.preventDefault();
        if (isModuleAllowedForRole('dashboard', user?.role)) {
          setCurrentModule('dashboard');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user?.role]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold tracking-wide text-slate-300">
          Initializing PostgreSQL & Unique POS Database...
        </p>
      </div>
    );
  }

  if (isSetupRequired || showSetupWizard) {
    return <SetupWizardView onSetupComplete={() => setShowSetupWizard(false)} />;
  }

  if (!isAuthenticated) {
    return <LoginView onStartSetup={() => setShowSetupWizard(true)} />;
  }

  const defaultAllowedModule =
    user?.role === 'CASHIER' ? 'pos' : user?.role === 'KITCHEN' ? 'kitchen' : 'dashboard';

  const renderModule = () => {
    if (!isModuleAllowedForRole(currentModule, user?.role)) {
      return (
        <div className="p-12 text-center flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Access Denied</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6">
            Your account role (<span className="font-semibold text-slate-700 dark:text-slate-200">{user?.role}</span>) does not have permission to access the <strong className="text-blue-500">{currentModule}</strong> module.
          </p>
          <button
            onClick={() => setCurrentModule(defaultAllowedModule)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-600/20 transition-all"
          >
            Return to Allowed Module
          </button>
        </div>
      );
    }

    switch (currentModule) {
      case 'dashboard':
        return <DashboardView onNavigate={setCurrentModule} />;
      case 'pos':
        return <POSView />;
      case 'products':
        return <ProductsView />;
      case 'categories':
        return <CategoriesView />;
      case 'inventory':
        return <InventoryView />;
      case 'purchases':
        return <PurchaseView />;
      case 'suppliers':
        return <SuppliersView />;
      case 'sales':
        return <SalesView />;
      case 'customers':
        return <CustomersView />;
      case 'expenses':
        return <ExpensesView />;
      case 'employees':
        return <EmployeesView />;
      case 'kitchen':
        return <KitchenView />;
      case 'production':
        return <ProductionView />;
      case 'reports':
        return <ReportsView />;
      case 'accounting':
        return <AccountingView />;
      case 'settings':
        return <SettingsView />;
      case 'users':
        return <UsersView />;
      default:
        return <DashboardView onNavigate={setCurrentModule} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      <Navbar currentModule={currentModule} onNavigate={setCurrentModule} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar currentModule={currentModule} onNavigate={setCurrentModule} />

        <main className="flex-1 overflow-y-auto bg-slate-50/60 dark:bg-slate-900/60">
          {renderModule()}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}

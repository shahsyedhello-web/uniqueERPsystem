import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Store,
  Sun,
  Moon,
  LogOut,
  Clock,
  Wifi,
  Bell,
  User as UserIcon,
  Search,
  DollarSign,
  Maximize,
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { BusinessSettings } from '../../types/pos';

interface NavbarProps {
  currentModule: string;
  onNavigate: (module: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentModule, onNavigate }) => {
  const { user, logout, theme, toggleTheme, branches, activeBranch, setActiveBranch } = useAuth();
  const [settings, setSettings] = useState<Partial<BusinessSettings>>({});
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    apiFetch('/settings')
      .then((data) => setSettings(data))
      .catch((e) => console.error(e));
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 flex items-center justify-between px-6 sticky top-0 z-40 select-none shadow-sm">
      {/* Brand & Branch */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-black text-xl text-white shadow-lg shadow-blue-600/20">
          U
        </div>
        <div>
          <h1 className="font-bold text-base tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
            {settings.name || 'Unique Sweets & Bakers'}{' '}
            <span className="text-blue-600 dark:text-blue-400 font-bold">POS</span>
            <span className="text-[10px] bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 font-semibold px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
              v1.0
            </span>
          </h1>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <select
              value={activeBranch?.id || ''}
              onChange={(e) => {
                const found = branches.find((b) => b.id === e.target.value);
                if (found) setActiveBranch(found);
              }}
              className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-200 text-xs px-2 py-0.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.branchName || b.name} ({b.branchCode || b.code}){b.isHeadOffice || b.isMain ? ' - Head Office' : ''}
                </option>
              ))}
            </select>
            <span className="text-slate-400 dark:text-slate-500 text-[10px]">&bull; {settings.counterName || 'Counter #01'}</span>
          </div>
        </div>
      </div>

      {/* Center Quick Navigation & Live Clock */}
      <div className="hidden md:flex items-center space-x-4">
        <button
          onClick={() => onNavigate('pos')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all ${
            currentModule === 'pos'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 active:scale-95'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>POS BILLING</span>
          <span className="text-[10px] bg-slate-900 text-white px-1.5 py-0.5 rounded font-mono">F2</span>
        </button>

        <button
          onClick={() => onNavigate('kitchen')}
          className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all ${
            currentModule === 'kitchen'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <span>Kitchen Orders</span>
        </button>

        <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl text-xs font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>{currentTime}</span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-3">
        {/* Sync / Offline badge */}
        <div className="hidden sm:flex items-center space-x-1.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-lg font-medium">
          <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Sync Ready</span>
        </div>

        {/* Fullscreen toggle */}
        <button
          onClick={toggleFullScreen}
          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
          title="Toggle Fullscreen"
        >
          <Maximize className="w-4 h-4" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>

        {/* User Info & Logout */}
        <div className="flex items-center space-x-2 pl-3 border-l border-slate-200 dark:border-slate-800">
          <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700 shadow-sm">
            {user?.name ? user.name[0].toUpperCase() : 'U'}
          </div>
          <div className="hidden lg:block text-left">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{user?.name}</div>
            <div className="text-[10px] text-blue-600 dark:text-blue-400 font-mono tracking-wider font-bold">{user?.role}</div>
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-xl bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900 transition-colors ml-1"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

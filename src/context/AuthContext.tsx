import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Branch } from '../types/pos';
import { apiFetch } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isSetupRequired: boolean;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  setDirectAuth: (token: string, user: User) => void;
  checkSetupStatus: () => Promise<boolean>;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  branches: Branch[];
  activeBranch: Branch | null;
  setActiveBranch: (branch: Branch) => void;
  refreshBranches: () => Promise<Branch[]>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('pos_token'));
  const [isSetupRequired, setIsSetupRequired] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>((localStorage.getItem('pos_theme') as any) || 'dark');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranch, setActiveBranchState] = useState<Branch | null>(null);

  const refreshBranches = useCallback(async (): Promise<Branch[]> => {
    try {
      const data = await apiFetch<Branch[]>('/branches');
      setBranches(data);
      if (data && data.length > 0) {
        const savedId = localStorage.getItem('pos_active_branch_id');
        let selected = data.find((b) => b.id === savedId);
        if (!selected) {
          selected = data.find((b) => b.isHeadOffice || b.isMain) || data[0];
        }
        setActiveBranchState(selected);
        if (selected) {
          localStorage.setItem('pos_active_branch_id', selected.id);
        }
      }
      return data;
    } catch (e) {
      console.error('Failed to load branches:', e);
      return [];
    }
  }, []);

  const setActiveBranch = (branch: Branch) => {
    setActiveBranchState(branch);
    localStorage.setItem('pos_active_branch_id', branch.id);
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('pos_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const checkSetupStatus = async (): Promise<boolean> => {
    try {
      const data = await apiFetch('/setup/status');
      const required = Boolean(data.isSetupRequired);
      setIsSetupRequired(required);
      return required;
    } catch (e) {
      console.error('Failed to fetch setup status:', e);
      return false;
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);
      const setupNeeded = await checkSetupStatus();

      if (token && !setupNeeded) {
        try {
          const data = await apiFetch('/auth/me');
          setUser(data.user);
        } catch {
          localStorage.removeItem('pos_token');
          setToken(null);
          setUser(null);
        }
      } else if (setupNeeded) {
        localStorage.removeItem('pos_token');
        setToken(null);
        setUser(null);
      }
      
      await refreshBranches();
      setLoading(false);
    };

    initAuth();
  }, [token, refreshBranches]);

  const login = async (email: string, pass: string) => {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: pass }),
    });

    localStorage.setItem('pos_token', data.token);
    setToken(data.token);
    setUser(data.user);
    setIsSetupRequired(false);
  };

  const setDirectAuth = (newToken: string, newUser: User) => {
    localStorage.setItem('pos_token', newToken);
    setToken(newToken);
    setUser(newUser);
    setIsSetupRequired(false);
  };

  const logout = () => {
    localStorage.removeItem('pos_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(user && token),
        isSetupRequired,
        loading,
        login,
        logout,
        setDirectAuth,
        checkSetupStatus,
        theme,
        toggleTheme,
        branches,
        activeBranch,
        setActiveBranch,
        refreshBranches,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

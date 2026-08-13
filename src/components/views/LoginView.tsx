import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Lock, Mail, AlertCircle, ShieldAlert } from 'lucide-react';

interface LoginViewProps {
  onStartSetup?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onStartSetup }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address or username.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      const msg = err.message || 'Login failed. Please check your credentials.';
      setError(msg);
      if (msg.includes('setup wizard') || msg.includes('No user accounts') || msg.includes('initial setup')) {
        if (onStartSetup) onStartSetup();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 selection:bg-blue-500 selection:text-white">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center font-black text-3xl text-white mx-auto shadow-lg shadow-blue-600/30">
            U
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">
            Unique Sweets & Bakers
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            POS Terminal & Management System
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{error}</span>
              {(error.includes('setup') || error.includes('No user')) && onStartSetup && (
                <button
                  type="button"
                  onClick={onStartSetup}
                  className="mt-2 block font-bold text-blue-600 hover:underline text-xs"
                >
                  Launch First-Time Setup Wizard →
                </button>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Email / Username
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                placeholder="Enter email or username"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-lg shadow-blue-600/30 active:scale-95 disabled:opacity-50"
          >
            {submitting ? 'Authenticating...' : 'Sign In to POS'}
          </button>
        </form>

        <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-500 text-center border border-slate-200 font-medium">
          🔒 Protected by PostgreSQL, Prisma ORM, and Bcrypt Hashing.
        </div>
      </div>
    </div>
  );
};

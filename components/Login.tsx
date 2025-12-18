import React, { useState } from 'react';
import { db } from '../services/db';
import { t } from '../services/i18n';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Package, User, Lock, AlertCircle } from 'lucide-react';

interface Props {
  onLogin: () => void;
}

export const Login: React.FC<Props> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError(t('please_enter_info'));
      return;
    }

    setLoading(true);
    try {
      // Try async login first (cloud)
      const user = await (db as any).loginAsync?.(username, password) || db.login(username, password);
      if (user) {
        onLogin();
      } else {
        setError(t('login_error'));
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(t('login_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher compact />
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img 
            src="https://shikoku-taiyo-g.com/wp-content/uploads/2023/03/logo.png" 
            alt="TaiyoTakamatsu" 
            className="w-20 h-20 mx-auto rounded-2xl object-contain bg-white p-2 shadow-lg mb-4"
          />
          <h1 className="text-3xl font-bold text-white">{t('app_name')}</h1>
          <p className="text-orange-300 mt-2">{t('rental_system')}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">{t('login')}</h2>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">{t('username')}</label>
              <div className="relative">
                <User className="w-5 h-5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('enter_username')}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">{t('password')}</label>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('enter_password')}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 rounded-xl font-bold hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg disabled:opacity-50"
            >
              {loading ? '...' : t('login')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { LanguageSelector } from '../../components/common/LanguageSelector.jsx';
import { ImagePlaceholder } from '../../components/common/ImagePlaceholder.jsx';
import { Mail, Lock, LogIn, AlertCircle, ShieldAlert, Loader2 } from 'lucide-react';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [loading, setLoading] = useState(false);

  const { login, sessionExpiredNotice } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect to original route or /rutinas
  const from = location.state?.from?.pathname || '/rutinas';
  const isExpired = sessionExpiredNotice || new URLSearchParams(location.search).get('expired') === 'true';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsRateLimited(false);

    if (!email.trim() || !password) {
      setError(t('login_fill_fields') || 'Please fill in all required fields.');
      return;
    }

    try {
      setLoading(true);
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err.status === 429) {
        setIsRateLimited(true);
      }
      setError(err.message || t('login_error') || 'Error logging in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-tea-calm relative">
      <div className="absolute top-4 right-4">
        <LanguageSelector />
      </div>

      <div className="max-w-4xl w-full bg-white rounded-3xl shadow-sm border border-tea-border overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Side column: Visual info */}
        <div className="hidden md:flex flex-col justify-between p-8 bg-slate-50 border-r border-tea-border">
          <div>
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white font-extrabold text-xl shadow-sm mb-4">
              U
            </div>
            <h2 className="text-2xl font-extrabold text-tea-text tracking-tight">
              {t('welcome_back') || 'Welcome back'}
            </h2>
            <p className="text-sm text-tea-muted mt-2">
              {t('welcome_desc') || 'ASD visual schedule and routine management web platform for schools and therapy centers.'}
            </p>
          </div>

          <div className="my-6">
            <ImagePlaceholder
              name="login-lateral.jpg"
              alt="ASD Educational Support Illustration"
              aspect="aspect-[4/3]"
            />
          </div>

          <div className="text-xs text-tea-muted">
            {t('no_account') || "Don't have an institutional account?"}{' '}
            <Link to="/register" className="text-brand-600 font-bold hover:underline">
              {t('register_here') || 'Register here'}
            </Link>
          </div>
        </div>

        {/* Form Column */}
        <div className="p-8 sm:p-10 flex flex-col justify-center">
          <div className="md:hidden mb-6">
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white font-extrabold text-xl shadow-sm mb-2">
              U
            </div>
            <h1 className="text-2xl font-extrabold text-tea-text tracking-tight">{t('login_title') || 'Sign In'}</h1>
            <p className="text-xs text-tea-muted">{t('login_subtitle') || 'Access U-Pad Web Portal'}</p>
          </div>

          <div className="hidden md:block mb-6">
            <h1 className="text-2xl font-extrabold text-tea-text tracking-tight">{t('login_title') || 'Sign In'}</h1>
            <p className="text-xs text-tea-muted mt-1">{t('login_instruction') || 'Enter your authorized credentials'}</p>
          </div>

          {/* Alerta de Sesión Expirada */}
          {isExpired && !error && (
            <div
              className="p-3.5 rounded-2xl mb-5 text-sm flex items-start gap-2.5 border bg-amber-50 border-amber-200 text-amber-900"
              role="alert"
            >
              <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-700" />
              <div className="flex-1 text-xs leading-relaxed font-semibold">
                Sesión expirada: Tu token de acceso ha vencido por inactividad. Por favor, inicia sesión nuevamente para continuar.
              </div>
            </div>
          )}

          {/* Error / Rate Limit message */}
          {error && (
            <div
              className={`p-3.5 rounded-2xl mb-5 text-sm flex items-start gap-2.5 border ${
                isRateLimited
                  ? 'bg-amber-50 border-amber-200 text-tea-warm'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
              role="alert"
            >
              {isRateLimited ? (
                <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 text-xs leading-relaxed font-semibold">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold uppercase tracking-wider text-tea-text mb-1.5"
              >
                {t('email_label') || 'Email Address'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  disabled={loading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@school.edu"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-tea-border bg-slate-50 focus:bg-white text-tea-text placeholder:text-slate-400 transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold uppercase tracking-wider text-tea-text mb-1.5"
              >
                {t('password_label') || 'Password'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-tea-border bg-slate-50 focus:bg-white text-tea-text placeholder:text-slate-400 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm text-white bg-brand-600 hover:bg-brand-700 active:bg-brand-800 disabled:bg-slate-300 disabled:cursor-not-allowed shadow-sm transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('verifying') || 'Verifying credentials...'}</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>{t('btn_login') || 'Sign In to Dashboard'}</span>
                </>
              )}
            </button>
          </form>

          <div className="md:hidden mt-6 text-center text-xs text-tea-muted">
            {t('no_account') || "Don't have an account?"}{' '}
            <Link to="/register" className="text-brand-600 font-bold hover:underline">
              {t('register_here') || 'Register here'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

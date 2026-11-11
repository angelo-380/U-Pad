import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { LanguageSelector } from '../../components/common/LanguageSelector.jsx';
import { ImagePlaceholder } from '../../components/common/ImagePlaceholder.jsx';
import { User, Mail, Lock, UserPlus, AlertCircle, Loader2, Briefcase, KeyRound } from 'lucide-react';

export const RegisterPage = () => {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState('empresario');
  const [codigoOrganizacion, setCodigoOrganizacion] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!nombre.trim() || !email.trim() || !password) {
      setError(t('register_fill_fields') || 'Please fill in all required fields.');
      return;
    }

    if (password.length < 8) {
      setError(t('register_pass_short') || 'Password must be at least 8 characters.');
      return;
    }

    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
      setError(t('register_pass_policy') || 'Password must include uppercase, numbers, and special symbols.');
      return;
    }

    try {
      setLoading(true);
      // Nunca se envía un organizacionId; el código de organización es opcional y solo aplica a tutores
      await register({
        nombre,
        email,
        password,
        rol,
        codigoOrganizacion: rol === 'tutor' ? codigoOrganizacion.trim() : '',
      });
      // La redirección por rol lleva al empresario a su panel, donde ve el código de su organización
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || t('register_error') || 'Error processing registration.');
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
        {/* Side Column */}
        <div className="hidden md:flex flex-col justify-between p-8 bg-slate-50 border-r border-tea-border">
          <div>
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white font-extrabold text-xl shadow-sm mb-4">
              U
            </div>
            <h2 className="text-2xl font-extrabold text-tea-text tracking-tight">
              {t('register_hero_title') || 'Create your U-Pad Account'}
            </h2>
            <p className="text-sm text-tea-muted mt-2">
              {t('register_hero_desc') || 'Join the platform to coordinate and supervise visual schedules for schools and therapy centers.'}
            </p>
          </div>

          <div className="my-6">
            <ImagePlaceholder
              name="register-lateral.png"
              fallbackNames={['tutor.png', 'libros.png']}
              alt="Registration and educational collaboration illustration"
              aspect="aspect-[4/3]"
            />
          </div>

          <div className="text-xs text-tea-muted">
            {t('have_account') || 'Already have an account?'}{' '}
            <Link to="/login" className="text-brand-600 font-bold hover:underline">
              {t('login_here') || 'Sign in'}
            </Link>
          </div>
        </div>

        {/* Form Column */}
        <div className="p-8 sm:p-10 flex flex-col justify-center">
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold text-tea-text tracking-tight">{t('register_title') || 'Account Registration'}</h1>
            <p className="text-xs text-tea-muted mt-1">{t('register_subtitle') || 'Fill in the information to enable access'}</p>
          </div>

          {error && (
            <div
              className="p-3.5 rounded-2xl mb-5 text-sm flex items-start gap-2.5 bg-rose-50 border border-rose-200 text-rose-800"
              role="alert"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-xs leading-relaxed font-semibold">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="nombre"
                className="block text-xs font-bold uppercase tracking-wider text-tea-text mb-1.5"
              >
                {rol === 'empresario' ? t('org_name_label') : t('person_name_label')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="nombre"
                  type="text"
                  required
                  disabled={loading}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder={rol === 'empresario' ? t('org_name_placeholder') : t('person_name_placeholder')}
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-tea-border bg-slate-50 focus:bg-white text-tea-text placeholder:text-slate-400 transition-colors"
                />
              </div>
            </div>

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
                htmlFor="rol"
                className="block text-xs font-bold uppercase tracking-wider text-tea-text mb-1.5"
              >
                {t('role_label') || 'Profile Type'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Briefcase className="w-4 h-4" />
                </div>
                <select
                  id="rol"
                  value={rol}
                  onChange={(e) => {
                    setRol(e.target.value);
                    setCodigoOrganizacion(''); // el código solo aplica a tutores
                  }}
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-tea-border bg-slate-50 focus:bg-white text-tea-text transition-colors"
                >
                  <option value="empresario">{t('role_org_option') || 'School / Therapy Center Admin'}</option>
                  <option value="tutor">{t('role_tutor_option') || 'Tutor / Family Therapist'}</option>
                </select>
              </div>
            </div>

            {rol === 'tutor' && (
              <div>
                <label
                  htmlFor="codigoOrganizacion"
                  className="block text-xs font-bold uppercase tracking-wider text-tea-text mb-1.5"
                >
                  {t('org_code_label')}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    id="codigoOrganizacion"
                    type="text"
                    disabled={loading}
                    value={codigoOrganizacion}
                    onChange={(e) => setCodigoOrganizacion(e.target.value.toUpperCase())}
                    maxLength={12}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={t('org_code_placeholder')}
                    aria-describedby="codigoOrganizacionAyuda"
                    className="w-full pl-10 pr-4 py-2.5 text-sm font-mono tracking-widest rounded-xl border border-tea-border bg-slate-50 focus:bg-white text-tea-text placeholder:text-slate-400 placeholder:tracking-normal placeholder:font-sans transition-colors"
                  />
                </div>
                <p id="codigoOrganizacionAyuda" className="mt-1.5 text-[11px] leading-relaxed text-tea-muted">
                  {t('org_code_hint')}
                </p>
              </div>
            )}

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold uppercase tracking-wider text-tea-text mb-1.5"
              >
                {t('password_policy_label') || 'Password (min. 8 characters, Uppercase, Numbers & Symbols)'}
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
                  <span>{t('creating_account') || 'Creating secure account...'}</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>{t('btn_register') || 'Complete Registration'}</span>
                </>
              )}
            </button>
          </form>

          <div className="md:hidden mt-6 text-center text-xs text-tea-muted">
            {t('have_account') || 'Already have an account?'}{' '}
            <Link to="/login" className="text-brand-600 font-bold hover:underline">
              {t('login_here') || 'Sign in'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

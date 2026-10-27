import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ImagePlaceholder } from '../../components/common/ImagePlaceholder.jsx';
import { Mail, Lock, LogIn, AlertCircle, ShieldAlert, Loader2 } from 'lucide-react';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirigir a la ruta original o a /rutinas
  const from = location.state?.from?.pathname || '/rutinas';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsRateLimited(false);

    if (!email.trim() || !password) {
      setError('Por favor completa todos los campos requeridos.');
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
      setError(err.message || 'Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-tea-calm">
      <div className="max-w-4xl w-full bg-white rounded-3xl shadow-sm border border-tea-border overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Columna lateral: Placeholder de Imagen */}
        <div className="hidden md:flex flex-col justify-between p-8 bg-slate-50 border-r border-tea-border">
          <div>
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white font-extrabold text-xl shadow-sm mb-4">
              U
            </div>
            <h2 className="text-2xl font-extrabold text-tea-text tracking-tight">
              Bienvenido de nuevo
            </h2>
            <p className="text-sm text-tea-muted mt-2">
              Plataforma web de gestión de rutinas y apoyos visuales para niños con TEA.
            </p>
          </div>

          <div className="my-6">
            <ImagePlaceholder
              name="login-lateral.jpg"
              alt="Ilustración o fotografía de apoyo educativo TEA"
              aspect="aspect-[4/3]"
            />
          </div>

          <div className="text-xs text-tea-muted">
            ¿No tienes cuenta institucional?{' '}
            <Link to="/register" className="text-brand-600 font-bold hover:underline">
              Regístrate aquí
            </Link>
          </div>
        </div>

        {/* Columna de Formulario */}
        <div className="p-8 sm:p-10 flex flex-col justify-center">
          <div className="md:hidden mb-6">
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white font-extrabold text-xl shadow-sm mb-2">
              U
            </div>
            <h1 className="text-2xl font-extrabold text-tea-text tracking-tight">Iniciar Sesión</h1>
            <p className="text-xs text-tea-muted">Accede al panel de U-Pad Web</p>
          </div>

          <div className="hidden md:block mb-6">
            <h1 className="text-2xl font-extrabold text-tea-text tracking-tight">Iniciar Sesión</h1>
            <p className="text-xs text-tea-muted mt-1">Ingresa tus credenciales autorizadas</p>
          </div>

          {/* Mensaje de Error / Rate Limit */}
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
                Correo Electrónico
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
                  placeholder="ejemplo@colegio.edu.pe"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-tea-border bg-slate-50 focus:bg-white text-tea-text placeholder:text-slate-400 transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold uppercase tracking-wider text-tea-text mb-1.5"
              >
                Contraseña
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
                  <span>Verificando credenciales...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Entrar al Panel</span>
                </>
              )}
            </button>
          </form>

          <div className="md:hidden mt-6 text-center text-xs text-tea-muted">
            ¿Aún no tienes cuenta?{' '}
            <Link to="/register" className="text-brand-600 font-bold hover:underline">
              Regístrate aquí
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

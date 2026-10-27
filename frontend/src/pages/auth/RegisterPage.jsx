import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ImagePlaceholder } from '../../components/common/ImagePlaceholder.jsx';
import { User, Mail, Lock, UserPlus, AlertCircle, Loader2, Briefcase } from 'lucide-react';

export const RegisterPage = () => {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState('empresario');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!nombre.trim() || !email.trim() || !password) {
      setError('Por favor completa todos los campos.');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe contener al menos 6 caracteres.');
      return;
    }

    try {
      setLoading(true);
      await register({ nombre, email, password, rol });
      navigate('/rutinas', { replace: true });
    } catch (err) {
      setError(err.message || 'Error al procesar el registro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-tea-calm">
      <div className="max-w-4xl w-full bg-white rounded-3xl shadow-sm border border-tea-border overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Columna lateral informativa */}
        <div className="hidden md:flex flex-col justify-between p-8 bg-slate-50 border-r border-tea-border">
          <div>
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white font-extrabold text-xl shadow-sm mb-4">
              U
            </div>
            <h2 className="text-2xl font-extrabold text-tea-text tracking-tight">
              Crea tu Cuenta U-Pad
            </h2>
            <p className="text-sm text-tea-muted mt-2">
              Únete a la plataforma para coordinar y supervisar agendas visuales TEA para colegios y centros de terapia.
            </p>
          </div>

          <div className="my-6">
            <ImagePlaceholder
              name="register-lateral.jpg"
              alt="Ilustración de registro y colaboración educativa"
              aspect="aspect-[4/3]"
            />
          </div>

          <div className="text-xs text-tea-muted">
            ¿Ya tienes una cuenta registrada?{' '}
            <Link to="/login" className="text-brand-600 font-bold hover:underline">
              Inicia sesión
            </Link>
          </div>
        </div>

        {/* Columna de Formulario */}
        <div className="p-8 sm:p-10 flex flex-col justify-center">
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold text-tea-text tracking-tight">Registro de Cuenta</h1>
            <p className="text-xs text-tea-muted mt-1">Completa los datos para habilitar el acceso</p>
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
                Nombre Completo o Institución
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
                  placeholder="Ej. Centro Terapéutico San Juan"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-tea-border bg-slate-50 focus:bg-white text-tea-text placeholder:text-slate-400 transition-colors"
                />
              </div>
            </div>

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
                  placeholder="contacto@institucion.edu.pe"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-tea-border bg-slate-50 focus:bg-white text-tea-text placeholder:text-slate-400 transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="rol"
                className="block text-xs font-bold uppercase tracking-wider text-tea-text mb-1.5"
              >
                Tipo de Perfil
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Briefcase className="w-4 h-4" />
                </div>
                <select
                  id="rol"
                  value={rol}
                  onChange={(e) => setRol(e.target.value)}
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-tea-border bg-slate-50 focus:bg-white text-tea-text transition-colors"
                >
                  <option value="empresario">Empresario / Colegio / Centro de Terapia</option>
                  <option value="tutor">Tutor / Terapeuta Familiar</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold uppercase tracking-wider text-tea-text mb-1.5"
              >
                Contraseña (mínimo 6 caracteres)
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
                  <span>Creando cuenta segura...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Completar Registro</span>
                </>
              )}
            </button>
          </form>

          <div className="md:hidden mt-6 text-center text-xs text-tea-muted">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-brand-600 font-bold hover:underline">
              Inicia sesión
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

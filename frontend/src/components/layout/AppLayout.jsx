import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { RoleBadge } from '../common/RoleBadge.jsx';
import { Tooltip } from '../common/Tooltip.jsx';
import {
  LogOut,
  CalendarCheck,
  Compass,
  Cpu,
  ShieldAlert,
  Menu,
  X,
  User,
  Lock,
} from 'lucide-react';

export const AppLayout = ({ children }) => {
  const { user, logout, sessionExpiredNotice, clearSessionNotice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = [
    {
      label: 'Rutinas Visuales',
      path: '/rutinas',
      icon: CalendarCheck,
      inDev: false,
    },
    {
      label: 'Seguimiento GPS',
      path: '/gps',
      icon: Compass,
      inDev: true,
      tooltip: 'Módulo en desarrollo (Fase beta próxima) · Próximamente disponible',
    },
    {
      label: 'Sugerencias IA',
      path: '/ia',
      icon: Cpu,
      inDev: true,
      tooltip: 'Módulo en desarrollo (Groq / LLaMA 3.3) · Próximamente disponible',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-tea-calm font-sans text-tea-text">
      {/* Alerta flotante de sesión expirada */}
      {sessionExpiredNotice && (
        <div
          role="alert"
          className="bg-amber-100 border-b border-amber-300 text-amber-950 px-4 py-3 flex items-center justify-between text-sm font-semibold"
        >
          <div className="flex items-center gap-2.5 max-w-4xl mx-auto w-full">
            <ShieldAlert className="w-5 h-5 flex-shrink-0 text-amber-700" aria-hidden="true" />
            <span>Tu sesión ha expirado por seguridad. Por favor inicia sesión nuevamente.</span>
          </div>
          <button
            type="button"
            onClick={clearSessionNotice}
            className="p-1.5 hover:bg-amber-200 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            aria-label="Cerrar aviso de sesión expirada"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Barra superior de navegación */}
      <header className="bg-white border-b border-tea-border sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo y Nombre */}
            <div className="flex items-center gap-4">
              <Link
                to="/rutinas"
                className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded-xl p-1"
                aria-label="Ir a Inicio U-Pad"
              >
                <div className="w-10 h-10 rounded-2xl bg-brand-600 flex items-center justify-center text-white font-extrabold text-xl shadow-xs group-hover:bg-brand-700 transition-colors">
                  U
                </div>
                <div className="flex flex-col">
                  <span className="font-extrabold text-xl tracking-tight text-slate-900 leading-tight">
                    U-Pad
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Panel Web Accesible
                  </span>
                </div>
              </Link>
            </div>

            {/* Enlaces de escritorio */}
            <nav
              aria-label="Navegación principal"
              className="hidden md:flex items-center gap-1.5"
            >
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.path;

                // Estilo para módulos en desarrollo (claramente deshabilitados con tooltip)
                if (link.inDev) {
                  return (
                    <Tooltip
                      key={link.path}
                      content={link.tooltip}
                      position="bottom"
                    >
                      <div
                        tabIndex={0}
                        role="link"
                        aria-disabled="true"
                        className="flex items-center gap-2 px-3.5 py-2 min-h-[44px] rounded-xl text-xs font-bold text-slate-400 bg-slate-50/70 border border-dashed border-slate-200 cursor-not-allowed select-none opacity-70 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                        title={link.tooltip}
                      >
                        <Icon className="w-4 h-4 text-slate-400" aria-hidden="true" />
                        <span>{link.label}</span>
                        <span className="inline-flex items-center gap-1 text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">
                          <Lock className="w-2.5 h-2.5" /> Próx
                        </span>
                      </div>
                    </Tooltip>
                  );
                }

                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-2 px-3.5 py-2 min-h-[44px] rounded-xl text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                      isActive
                        ? 'bg-brand-50 text-brand-800 border border-brand-200 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-brand-600" aria-hidden="true" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Información del usuario y botón Salir */}
            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
                <div className="w-9 h-9 rounded-full bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700">
                  <User className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-slate-800 leading-tight">
                    {user?.nombre || user?.email || 'Usuario'}
                  </span>
                  <span className="text-[11px] text-slate-500 truncate max-w-[150px]">
                    {user?.email}
                  </span>
                </div>
                <RoleBadge role={user?.rol} />
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-xl text-xs font-bold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
                aria-label="Cerrar sesión de usuario"
                title="Cerrar sesión"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Salir</span>
              </button>
            </div>

            {/* Botón menú móvil */}
            <div className="md:hidden flex items-center">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2.5 rounded-xl text-slate-700 hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú de navegación'}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6" aria-hidden="true" />
                ) : (
                  <Menu className="w-6 h-6" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Menú móvil desplegable */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-4 pb-5 space-y-3 animate-fadeIn motion-reduce:animate-none">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex flex-col">
                <span className="font-bold text-sm text-slate-900">
                  {user?.nombre || user?.email}
                </span>
                <span className="text-xs text-slate-500">{user?.email}</span>
              </div>
              <RoleBadge role={user?.rol} />
            </div>

            <div className="space-y-1.5">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.path;

                if (link.inDev) {
                  return (
                    <div
                      key={link.path}
                      className="flex items-center justify-between px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold text-slate-400 bg-slate-50 border border-dashed border-slate-200"
                      aria-disabled="true"
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 text-slate-400" />
                        <span>{link.label}</span>
                      </div>
                      <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                        En desarrollo
                      </span>
                    </div>
                  );
                }

                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-bold transition-colors ${
                      isActive
                        ? 'bg-brand-50 text-brand-800 border border-brand-200'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 text-brand-600" />
                      <span>{link.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] mt-2 rounded-xl text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        )}
      </header>

      {/* Contenido principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Pie de página con atribución formal a ARASAAC */}
      <footer className="bg-white border-t border-tea-border py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600 text-center sm:text-left">
          <div className="space-y-1">
            <p className="font-semibold text-slate-800">
              © 2026 U-Pad · Plataforma de apoyo para personas con Trastorno del Espectro Autista (TEA).
            </p>
            <p className="text-[11px] text-slate-500 max-w-2xl leading-relaxed">
              Los símbolos pictográficos utilizados son propiedad del Gobierno de Aragón y han sido creados por Sergio Palao para{' '}
              <a
                href="https://arasaac.org"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline text-brand-700 hover:text-brand-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-600 rounded"
              >
                ARASAAC
              </a>
              , que los distribuye bajo Licencia Creative Commons (BY-NC-SA).
            </p>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500 flex-shrink-0">
            <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
              WCAG AA
            </span>
            <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
              Baja Carga Sensorial
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

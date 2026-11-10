import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { RoleBadge } from '../common/RoleBadge.jsx';
import { LanguageSelector } from '../common/LanguageSelector.jsx';
import { BackupsModal } from '../admin/BackupsModal.jsx';
import {
  LogOut,
  CalendarCheck,
  Compass,
  Cpu,
  ShieldAlert,
  Menu,
  X,
  Database,
} from 'lucide-react';

export const AppLayout = ({ children }) => {
  const { user, logout, sessionExpiredNotice, clearSessionNotice } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [backupsModalOpen, setBackupsModalOpen] = useState(false);

  const isDeveloperOrAdmin = user?.rol === 'developer' || user?.rol === 'admin';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const mainLinks = [
    { label: t('nav_routines'), path: '/rutinas', icon: CalendarCheck },
    { label: t('nav_gps') || 'GPS & Ubicación', path: '/gps', icon: Compass },
    { label: t('nav_ai') || 'Asistente IA', path: '/ia', icon: Cpu },
  ];

  const displayName = user?.nombre || (user?.email ? user.email.split('@')[0] : 'Usuario');

  return (
    <div className="min-h-screen flex flex-col bg-tea-calm font-sans text-tea-text">
      {/* Alerta flotante de sesión expirada */}
      {sessionExpiredNotice && (
        <div
          role="alert"
          className="bg-accent-100 border-b border-accent-200 text-accent-700 px-4 py-3 flex items-center justify-between text-sm font-semibold"
        >
          <div className="flex items-center gap-2.5 max-w-7xl mx-auto w-full">
            <ShieldAlert className="w-5 h-5 flex-shrink-0 text-accent-600" aria-hidden="true" />
            <span>{t('session_expired')}</span>
          </div>
          <button
            type="button"
            onClick={clearSessionNotice}
            className="p-1.5 hover:bg-accent-200 rounded-xl transition-tea min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            aria-label="Cerrar aviso de sesión expirada"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Barra superior de navegación */}
      <header className="bg-white sticky top-0 z-40 shadow-soft">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <Link
                to="/rutinas"
                className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded-xl p-1"
                aria-label="U-Pad Inicio"
              >
                <div className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center font-black text-lg tracking-wider shadow-soft-xs overflow-hidden">
                  <img
                    src="/images/logo_upad.png"
                    alt="U-Pad"
                    className="w-full h-full object-contain p-0.5"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <span className="text-white font-black text-lg">U</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-extrabold text-base tracking-tight text-tea-text leading-none">
                    U-Pad
                  </span>
                  <span className="text-[11px] font-medium text-tea-subtle tracking-wide">
                    {t('panel_title')}
                  </span>
                </div>
              </Link>

              <nav aria-label="Navegación principal" className="hidden md:flex items-center gap-1">
                {mainLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = location.pathname === link.path;

                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      aria-current={isActive ? 'page' : undefined}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-xl text-sm font-semibold transition-tea focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                        isActive
                          ? 'bg-brand-50 text-brand-700 font-bold'
                          : 'text-tea-muted hover:text-tea-text hover:bg-tea-cardSubtle'
                      }`}
                    >
                      <Icon className="w-4 h-4" aria-hidden="true" />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}

                {/* Botón de Backups del Sistema para Developer / Admin */}
                {isDeveloperOrAdmin && (
                  <button
                    type="button"
                    onClick={() => setBackupsModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] rounded-xl text-sm font-semibold transition-tea text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 cursor-pointer"
                    title="Administración de copias de seguridad de la base de datos"
                  >
                    <Database className="w-4 h-4" />
                    <span>Backups</span>
                    <span className="text-[10px] font-extrabold uppercase bg-indigo-600 text-white px-1.5 py-0.2 rounded-md">
                      Dev
                    </span>
                  </button>
                )}
              </nav>
            </div>

            <div className="hidden md:flex items-center gap-3">
              {/* Selector de Idioma */}
              <LanguageSelector />

              <div className="flex items-center gap-2.5 pl-3 border-l border-tea-border">
                <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-xs">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-bold text-tea-text leading-tight">
                    {displayName}
                  </span>
                  <span className="text-xs text-tea-subtle truncate max-w-[150px]">
                    {user?.email}
                  </span>
                </div>
                <RoleBadge role={user?.rol} />
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl text-sm font-semibold text-tea-muted hover:text-rose-700 hover:bg-rose-50 transition-tea focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 cursor-pointer"
                aria-label="Cerrar sesión de usuario"
                title={t('logout_confirm')}
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span>{t('logout')}</span>
              </button>
            </div>

            <div className="md:hidden flex items-center gap-2">
              <LanguageSelector />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2.5 rounded-xl text-tea-muted hover:text-tea-text hover:bg-tea-cardSubtle min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 cursor-pointer"
                aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú de navegación'}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-tea-border bg-white px-4 pt-4 pb-5 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-tea-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-sm">
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm text-tea-text">{displayName}</span>
                  <span className="text-xs text-tea-subtle">{user?.email}</span>
                </div>
              </div>
              <RoleBadge role={user?.rol} />
            </div>

            <div className="space-y-1">
              {mainLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-tea ${
                      isActive
                        ? 'bg-brand-50 text-brand-700 font-bold'
                        : 'text-tea-muted hover:text-tea-text hover:bg-tea-cardSubtle'
                    }`}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}

              {/* Backups en menú móvil */}
                {isDeveloperOrAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setBackupsModalOpen(true);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-tea text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                  >
                    <div className="flex items-center gap-2.5">
                      <Database className="w-4 h-4" />
                      <span>Backups del Sistema</span>
                    </div>
                    <span className="text-[10px] font-extrabold uppercase bg-indigo-600 text-white px-1.5 py-0.5 rounded">
                      Cloud DB
                    </span>
                  </button>
                )}
              </div>

            <div className="pt-2 border-t border-tea-border">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 transition-tea min-h-[44px]"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span>{t('logout_confirm')}</span>
              </button>
            </div>
          </div>
        )}
      </header>

      <main id="main-content" className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="bg-white border-t border-tea-border py-6 text-center text-xs text-tea-subtle">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} {t('footer_copy')}</p>
          <p className="flex items-center gap-1.5">
            <span>{t('footer_arasaac')}</span>
            <span className="font-semibold text-tea-muted">ARASAAC (Gobierno de Aragón)</span>
          </p>
        </div>
      </footer>

      {isDeveloperOrAdmin && (
        <BackupsModal
          isOpen={backupsModalOpen}
          onClose={() => setBackupsModalOpen(false)}
        />
      )}
    </div>
  );
};

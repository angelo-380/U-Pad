import React, { useEffect, useState } from 'react';
import { X, UserRound, Building2, KeyRound, Copy, Check, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { organizacionesService } from '../../services/organizacionesService.js';
import { RoleBadge } from '../common/RoleBadge.jsx';

/**
 * «Mi perfil» (solo lectura): nombre, correo, rol y organización del usuario.
 * El director (propietario) ve además el código para que sus tutores se unan al registrarse.
 * Datos actualizados al abrir: GET /api/auth/me y GET /api/organizaciones/mia.
 */
export const ConfiguracionUsuarioModal = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const { user, refreshUser } = useAuth();
  const [organizacion, setOrganizacion] = useState(null);
  const [cargandoOrg, setCargandoOrg] = useState(false);
  const [errorOrg, setErrorOrg] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const cargarOrganizacion = async () => {
    setCargandoOrg(true);
    setErrorOrg(false);
    try {
      setOrganizacion(await organizacionesService.obtenerMia());
    } catch (e) {
      setOrganizacion(null);
      setErrorOrg(true);
    } finally {
      setCargandoOrg(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    setCopiado(false);
    refreshUser().catch(() => {});
    cargarOrganizacion();

    const alPulsarTecla = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', alPulsarTecla);
    return () => window.removeEventListener('keydown', alPulsarTecla);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const nombre = user.nombre || user.email || t('user_fallback');
  const esDeveloper = user.rol === 'developer';

  const copiarCodigo = async () => {
    if (!organizacion?.codigo) return;
    try {
      await navigator.clipboard.writeText(organizacion.codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (e) {
      setCopiado(false);
    }
  };

  const renderOrganizacion = () => {
    if (cargandoOrg) {
      return (
        <p className="flex items-center gap-2 text-xs text-tea-muted">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          {t('profile_loading')}
        </p>
      );
    }
    if (errorOrg) {
      return (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-rose-700">{t('profile_org_error')}</p>
          <button
            type="button"
            onClick={cargarOrganizacion}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            {t('profile_retry')}
          </button>
        </div>
      );
    }
    if (!organizacion) {
      return (
        <p className="text-xs text-tea-muted">
          {esDeveloper ? t('profile_org_none_developer') : t('profile_org_none')}
        </p>
      );
    }
    return (
      <div className="space-y-3">
        <p className="text-sm font-bold text-tea-text">{organizacion.nombre}</p>
        {organizacion.codigo && (
          <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <KeyRound className="w-4 h-4 text-amber-600 flex-shrink-0" aria-hidden="true" />
              <div>
                <p className="text-[11px] font-bold text-tea-subtle uppercase tracking-wider">{t('org_code_card_title')}</p>
                <p className="text-lg font-black font-mono tracking-widest text-tea-text">{organizacion.codigo}</p>
                <p className="text-[11px] text-tea-muted">{t('org_code_card_hint')}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={copiarCodigo}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-tea-text bg-white border border-tea-border hover:bg-slate-50 transition-tea cursor-pointer"
            >
              {copiado ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiado ? t('org_code_copied') : t('org_code_copy')}</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="perfil-titulo"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-tea-border relative animate-scaleIn max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('profile_close')}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700 font-black text-lg">
            {nombre.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 id="perfil-titulo" className="text-lg font-extrabold text-tea-text">{t('profile_title')}</h3>
            <p className="text-xs text-tea-muted">{t('profile_subtitle')}</p>
          </div>
        </div>

        <dl className="space-y-3 mb-5">
          <div className="flex items-start gap-3">
            <UserRound className="w-4 h-4 mt-0.5 text-tea-subtle flex-shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <dt className="text-[11px] font-bold text-tea-subtle uppercase tracking-wider">{t('profile_name')}</dt>
              <dd className="text-sm font-semibold text-tea-text break-words">{nombre}</dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-4 h-4 mt-0.5 text-tea-subtle flex-shrink-0 text-center text-xs font-bold" aria-hidden="true">@</span>
            <div className="min-w-0">
              <dt className="text-[11px] font-bold text-tea-subtle uppercase tracking-wider">{t('profile_email')}</dt>
              <dd className="text-sm font-semibold text-tea-text break-all">{user.email}</dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <div>
              <dt className="text-[11px] font-bold text-tea-subtle uppercase tracking-wider mb-1">{t('profile_role')}</dt>
              <dd><RoleBadge role={user.rol} /></dd>
            </div>
          </div>
        </dl>

        <section className="p-4 rounded-2xl bg-tea-cardSubtle border border-tea-border" aria-labelledby="perfil-org">
          <h4 id="perfil-org" className="flex items-center gap-2 text-xs font-bold text-tea-text uppercase tracking-wider mb-2">
            <Building2 className="w-4 h-4 text-tea-subtle" aria-hidden="true" />
            {t('profile_org_title')}
          </h4>
          {renderOrganizacion()}
        </section>
      </div>
    </div>
  );
};

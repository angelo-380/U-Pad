import React, { useState, useEffect } from 'react';
import { devicesService } from '../../services/devicesService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { X, Tablet, KeyRound, CheckCircle2, Loader2, Trash2, AlertCircle, RefreshCw, Timer, Info } from 'lucide-react';

// Errores del backend al vincular, traducidos a mensajes claros para el tutor
const ERRORES_VINCULACION = {
  PAIRING_CODE_INVALID: 'link_error_invalid',
  PAIRING_CODE_EXPIRED: 'link_error_expired',
  PAIRING_CODE_USED: 'link_error_used',
};

/**
 * Vincular y desvincular hijos. El código de 6 dígitos lo muestra el teléfono del niño y caduca a los 60 s.
 * Un tutor puede tener varios hijos vinculados.
 */
export const VincularDispositivoModal = ({ isOpen, onClose, onLinked }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [childName, setChildName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [existingDevices, setExistingDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState(null);
  const toast = useToast();

  const cargarDispositivos = async () => {
    try {
      setLoadingDevices(true);
      const devs = await devicesService.listar();
      setExistingDevices(Array.isArray(devs) ? devs : []);
    } catch (e) {
      console.warn('Error al cargar dispositivos existentes:', e);
    } finally {
      setLoadingDevices(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      cargarDispositivos();
      setCode('');
      setChildName('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const nombreLimpio = childName.trim();
  const codigoValido = /^\d{6}$/.test(code);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombreLimpio) {
      setError(t('link_error_name_required'));
      return;
    }
    if (!codigoValido) {
      setError(t('link_error_format'));
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await devicesService.vincularConCodigo(code, nombreLimpio);
      toast.success(`${t('link_success')} ${nombreLimpio}`, t('link_success_title'));
      if (onLinked) onLinked(res);
      await cargarDispositivos();
      setCode('');
      setChildName('');
      onClose();
    } catch (err) {
      const clave = ERRORES_VINCULACION[err?.errors?.code];
      setError(clave ? t(clave) : err.message || t('link_error_generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleDesvincular = async (deviceId, dName) => {
    if (!window.confirm(`${t('unlink_confirm')} ${dName}?`)) {
      return;
    }
    try {
      setUnlinkingId(deviceId);
      await devicesService.desvincular(deviceId);
      toast.success(`${t('unlink_success')} ${dName}`, t('unlink_success_title'));
      await cargarDispositivos();
      if (onLinked) onLinked(null);
    } catch (err) {
      toast.error(err.message || t('unlink_error'));
    } finally {
      setUnlinkingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vincular-titulo"
    >
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-tea-border relative animate-scaleIn max-h-[90vh] overflow-y-auto">
        {/* Botón cerrar */}
        <button
          type="button"
          onClick={onClose}
          disabled={loading || !!unlinkingId}
          aria-label={t('link_close')}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600">
            <Tablet className="w-6 h-6" />
          </div>
          <div>
            <h3 id="vincular-titulo" className="text-lg font-extrabold text-tea-text">
              {t('link_title')}
            </h3>
            <p className="text-xs text-tea-muted">{t('link_subtitle')}</p>
          </div>
        </div>

        {/* Aviso de Modo Demostración/Capacitación para el Director */}
        {user?.rol === 'empresario' && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="leading-snug">{t('devices_dir_demo_notice')}</p>
          </div>
        )}

        {/* Hijos ya vinculados, cada uno con su opción de desvincular */}
        {existingDevices.length > 0 && (
          <div className="mb-5 p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {t('linked_children_title')} ({existingDevices.length})
              </span>
              <button
                type="button"
                onClick={cargarDispositivos}
                className="text-xs text-emerald-700 hover:underline flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${loadingDevices ? 'animate-spin' : ''}`} />
                {t('linked_children_refresh')}
              </button>
            </div>
            <div className="space-y-2 mt-2">
              {existingDevices.map((dev) => {
                const devId = dev.deviceId || dev.device_id;
                const dName = dev.childName || dev.child_name || t('child_unnamed');
                const dModel = dev.deviceModel || dev.device_model || '';
                const isDeleting = unlinkingId === devId;

                return (
                  <div
                    key={devId}
                    className="flex items-center justify-between p-3 rounded-xl bg-white border border-emerald-100 shadow-xs"
                  >
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 min-w-0">
                      <span className="truncate">{dName}</span>
                      {dModel && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-mono truncate">
                          {dModel}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => handleDesvincular(devId, dName)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-semibold transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      <span>{t('unlink_button')}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="text-xs text-slate-600 leading-relaxed bg-brand-50/50 p-3.5 rounded-2xl border border-brand-100 mb-5 space-y-1.5">
          <p>{t('link_instructions')}</p>
          <p className="flex items-center gap-1.5 font-semibold text-brand-800">
            <Timer className="w-3.5 h-3.5 flex-shrink-0" />
            {t('link_expiry_hint')}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2" role="alert">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="vincular-nombre" className="block text-xs font-bold text-slate-700 mb-1.5">
              {t('link_child_name_label')}
            </label>
            <input
              id="vincular-nombre"
              type="text"
              value={childName}
              maxLength={60}
              onChange={(e) => setChildName(e.target.value)}
              placeholder={t('link_child_name_placeholder')}
              disabled={loading}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-brand-600 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="vincular-codigo" className="block text-xs font-bold text-slate-700 mb-1.5">
              {t('link_code_label')}
            </label>
            <div className="relative">
              <input
                id="vincular-codigo"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                disabled={loading}
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 text-lg font-mono font-bold tracking-widest text-center focus:ring-2 focus:ring-brand-600 focus:outline-none"
              />
              <KeyRound className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
            >
              {t('link_close')}
            </button>
            <button
              type="submit"
              disabled={loading || !codigoValido || !nombreLimpio}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('link_submitting')}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t('link_submit')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

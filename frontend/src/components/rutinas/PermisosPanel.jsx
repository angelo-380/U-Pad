import React, { useState, useEffect, useCallback } from 'react';
import { permisosService } from '../../services/permisosService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { Clock, CheckCircle2, XCircle, Loader2, Bell, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Panel de permisos: muestra solicitudes pendientes del niño para terminar su rutina antes de tiempo.
 * Solo visible para tutores (rol: tutor). Hace polling cada 30 s.
 */
export const PermisosPanel = () => {
  const { t } = useLanguage();
  const toast = useToast();
  const [pendientes, setPendientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resolviendo, setResolviendo] = useState(null);
  const [abierto, setAbierto] = useState(true);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const data = await permisosService.listarPendientes();
      setPendientes(Array.isArray(data) ? data : []);
    } catch {
      // silencioso — no interrumpe la página de rutinas
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, 30000);
    return () => clearInterval(intervalo);
  }, [cargar]);

  const handleResolver = async (permisoId, accion, childName, rutinaTitle) => {
    try {
      setResolviendo(permisoId);
      await permisosService.resolver(permisoId, accion);
      const msg =
        accion === 'CONCEDER'
          ? t('permisos_granted_ok').replace('{nombre}', childName)
          : t('permisos_denied_ok').replace('{nombre}', childName);
      toast.success(msg, t('permisos_panel_title'));
      setPendientes((prev) => prev.filter((p) => p.id !== permisoId));
    } catch (err) {
      toast.error(err.message || t('permisos_resolve_error'));
    } finally {
      setResolviendo(null);
    }
  };

  if (pendientes.length === 0 && !loading) return null;

  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden shadow-sm">
      {/* Header */}
      <button
        type="button"
        onClick={() => setAbierto((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-amber-100 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Bell className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-bold text-amber-900">
            {t('permisos_panel_title')}
          </span>
          {pendientes.length > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
              {pendientes.length}
            </span>
          )}
        </div>
        {abierto ? (
          <ChevronUp className="w-4 h-4 text-amber-600" />
        ) : (
          <ChevronDown className="w-4 h-4 text-amber-600" />
        )}
      </button>

      {abierto && (
        <div className="px-5 pb-4 space-y-3">
          {loading && pendientes.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-amber-700 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{t('permisos_loading')}</span>
            </div>
          )}
          {pendientes.map((p) => {
            const childName = p.childName || p.child_name || t('child_unnamed');
            const rutinaTitle = p.rutinaTitle || p.rutina_title || t('routine_singular');
            const minutosRestantes = p.minutosRestantes ?? p.minutos_restantes ?? '?';
            const isResolving = resolviendo === p.id;

            return (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-amber-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">
                    {t('permisos_child_requests').replace('{nombre}', childName)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {t('permisos_routine_label')}: <span className="font-semibold">{rutinaTitle}</span>
                  </p>
                  <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 flex-shrink-0" />
                    {t('permisos_minutes_left').replace('{minutos}', minutosRestantes)}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    type="button"
                    disabled={isResolving}
                    onClick={() => handleResolver(p.id, 'CONCEDER', childName, rutinaTitle)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {isResolving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    {t('permisos_grant')}
                  </button>
                  <button
                    type="button"
                    disabled={isResolving}
                    onClick={() => handleResolver(p.id, 'RECHAZAR', childName, rutinaTitle)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {isResolving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                    {t('permisos_deny')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { devicesService } from '../../services/devicesService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { X, Tablet, KeyRound, CheckCircle2, Loader2, Trash2, AlertCircle } from 'lucide-react';

export const VincularDispositivoModal = ({ isOpen, onClose, onLinked }) => {
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
      const lista = Array.isArray(devs) ? devs : [];
      setExistingDevices(lista);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!childName.trim()) {
      setError('Por favor indica el nombre de tu hijo(a) para identificarlo.');
      return;
    }

    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length !== 6) {
      setError('El código de vinculación debe tener exactamente 6 dígitos.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await devicesService.vincularConCodigo(cleanCode, childName.trim());
      toast.success(
        `¡Dispositivo de ${childName.trim()} vinculado exitosamente!`,
        'Tablet Sincronizada'
      );
      if (onLinked) onLinked(res.device);
      await cargarDispositivos();
      setCode('');
      setChildName('');
      onClose();
    } catch (err) {
      setError(err.message || 'Código inválido o expirado. Genera uno nuevo en la tablet del niño.');
    } finally {
      setLoading(false);
    }
  };

  const handleDesvincular = async (deviceId, dName) => {
    if (!window.confirm(`¿Estás seguro de eliminar y desvincular el dispositivo de ${dName || 'este niño'}?`)) {
      return;
    }
    try {
      setUnlinkingId(deviceId);
      await devicesService.desvincular(deviceId);
      toast.success('Dispositivo eliminado y desvinculado exitosamente.', 'Dispositivo Eliminado');
      await cargarDispositivos();
      window.dispatchEvent(new CustomEvent('upad:device_changed'));
      if (onLinked) onLinked(null);
    } catch (err) {
      toast.error(err.message || 'Error al desvincular dispositivo');
    } finally {
      setUnlinkingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-tea-border relative animate-scaleIn max-h-[90vh] overflow-y-auto">
        {/* Botón cerrar */}
        <button
          type="button"
          onClick={onClose}
          disabled={loading || !!unlinkingId}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600">
            <Tablet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-tea-text">
              Vincular Tablet
            </h3>
            <p className="text-xs text-tea-muted">
              Vincula o elimina tablets y dispositivos infantiles
            </p>
          </div>
        </div>

        {/* Sección de Dispositivos ya Vinculados con opción de Eliminar */}
        {existingDevices.length > 0 && (
          <div className="mb-5 p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Dispositivo(s) Vinculado(s) Actualmente
            </span>
            <div className="space-y-2 mt-2">
              {existingDevices.map((dev) => {
                const devId = dev.device_id || dev.id || 'dev_unknown';
                const dName = dev.child_name || dev.childName || 'Hijo';
                const dModel = dev.device_model || dev.model || 'Android Tablet';
                const isDeleting = unlinkingId === devId;

                return (
                  <div
                    key={devId}
                    className="flex items-center justify-between p-3 rounded-xl bg-white border border-emerald-100 shadow-xs"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <span>{dName}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-mono">
                          {dModel}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        ID: {devId.substring(0, 16)}...
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => handleDesvincular(devId, dName)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-semibold transition-colors disabled:opacity-50"
                      title="Eliminar este dispositivo"
                    >
                      {isDeleting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      <span>Eliminar</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-xs text-slate-600 leading-relaxed bg-brand-50/50 p-3.5 rounded-2xl border border-brand-100 mb-5">
          Abre la aplicación móvil <strong>U-Pad</strong> en la tablet o teléfono de tu hijo. El código de emparejamiento de <strong>6 dígitos</strong> que aparece allí se escribe en este formulario para asociar las rutinas y sincronizar en tiempo real.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Nombre de tu hijo(a)
            </label>
            <input
              type="text"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              placeholder="Escribe el nombre de tu hijo(a)"
              disabled={loading}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-brand-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Código de 6 dígitos generado en el teléfono del niño
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={6}
                value={code}
              onChange={(e) => {
                const next = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(next);
              }}
              placeholder="Ej. 123456"
                disabled={loading}
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 text-lg font-mono font-bold tracking-widest text-center uppercase focus:ring-2 focus:ring-brand-600 focus:outline-none"
              />
              <KeyRound className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              El código solo aparece en la pantalla del teléfono/tablet del niño y vence en 60 segundos.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
            >
              Cerrar
            </button>
            <button
              type="submit"
              disabled={loading || code.trim().length !== 6}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Vinculando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Vincular Nuevo Dispositivo</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

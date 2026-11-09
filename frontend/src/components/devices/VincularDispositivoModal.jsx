import React, { useState } from 'react';
import { devicesService } from '../../services/devicesService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { X, Tablet, KeyRound, CheckCircle2, Loader2, Sparkles, AlertCircle } from 'lucide-react';

export const VincularDispositivoModal = ({ isOpen, onClose, onLinked }) => {
  const [code, setCode] = useState('');
  const [childName, setChildName] = useState('Diego');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length !== 6) {
      setError('El código de vinculación debe tener 6 caracteres alfanuméricos.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await devicesService.vincularConCodigo(cleanCode, childName.trim() || 'Diego');
      toast.success(
        `¡Dispositivo de ${childName} vinculado exitosamente!`,
        'Tablet Sincronizada'
      );
      if (onLinked) onLinked(res.device);
      onClose();
    } catch (err) {
      setError(err.message || 'Código inválido o expirado. Genera uno nuevo en la tablet del niño.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-tea-border relative animate-scaleIn">
        {/* Botón cerrar */}
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
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
              Vincular Tablet del Niño
            </h3>
            <p className="text-xs text-tea-muted">
              Sincroniza la app móvil con tu panel web
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed bg-brand-50/50 p-3.5 rounded-2xl border border-brand-100 mb-5">
          Abre la aplicación móvil <strong>U-Pad</strong> en la tablet de tu hijo y obtén el código de emparejamiento de <strong>6 dígitos</strong> para asociar las rutinas y pictogramas automáticamente.
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
              placeholder="Ej. Diego"
              disabled={loading}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-brand-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Código de 6 dígitos de la Tablet
            </label>
            <div className="relative">
              <input
                type="text"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Ej. AB12CD"
                disabled={loading}
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 text-lg font-mono font-bold tracking-widest text-center uppercase focus:ring-2 focus:ring-brand-600 focus:outline-none"
              />
              <KeyRound className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Código temporal visible en la pantalla inicial de la tablet
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
            >
              Cancelar
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
                  <span>Vincular Dispositivo</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
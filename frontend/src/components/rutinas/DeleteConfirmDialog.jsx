import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';

export const DeleteConfirmDialog = ({
  isOpen,
  rutina,
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const cancelBtnRef = useRef(null);

  // Escuchar tecla ESC y foco accesible
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Enfocar botón cancelar al abrir para prevenir borrado accidental
    const timeout = setTimeout(() => {
      cancelBtnRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timeout);
    };
  }, [isOpen, loading, onCancel]);

  if (!isOpen || !rutina) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn motion-reduce:animate-none"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-desc"
    >
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
        {/* Cabecera del diálogo */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h3
                id="delete-dialog-title"
                className="text-base font-extrabold text-slate-900"
              >
                ¿Eliminar esta rutina?
              </h3>
              <span className="text-xs text-slate-500 font-semibold">
                Confirmación de seguridad
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="p-2 -mr-1 -mt-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            aria-label="Cerrar diálogo de confirmación"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del diálogo */}
        <div className="py-4 space-y-3">
          <p id="delete-dialog-desc" className="text-sm text-slate-600 leading-relaxed">
            Estás a punto de eliminar permanentemente la rutina visual{' '}
            <strong className="text-slate-900 font-bold">"{rutina.titulo}"</strong>.
            Esta acción no se puede deshacer y retirará la secuencia de pasos de la agenda.
          </p>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-600 flex items-center justify-between">
            <span>Turno asignado:</span>
            <span className="font-bold text-slate-800 uppercase">{rutina.turno}</span>
          </div>

          {rutina.pasos && rutina.pasos.length > 0 && (
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-600 flex items-center justify-between">
              <span>Actividades asociadas:</span>
              <span className="font-bold text-slate-800">
                {rutina.pasos.length} pasos
              </span>
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2.5 min-h-[44px] rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Eliminando...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                <span>Sí, Eliminar Rutina</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

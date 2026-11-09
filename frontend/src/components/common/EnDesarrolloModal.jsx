import React from 'react';
import { X, Wrench, CheckCircle } from 'lucide-react';

export const EnDesarrolloModal = ({ isOpen, onClose, titulo = 'Sección en Desarrollo', descripcion }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200">
              <Wrench className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-tea-text">{titulo}</h3>
              <span className="text-[10px] text-tea-muted uppercase font-bold tracking-wider">
                Entrega del 25% completada
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-5 text-sm text-tea-muted space-y-3">
          <p>
            {descripcion ||
              'Esta funcionalidad ya cuenta con la estructura técnica y el endpoint en el backend, y estará 100% activa en la siguiente entrega del proyecto.'}
          </p>
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-2.5 text-xs text-slate-600">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>El listado y la creación se encuentran totalmente operativos.</span>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-brand-600 text-white font-bold text-sm hover:bg-brand-700 shadow-sm transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

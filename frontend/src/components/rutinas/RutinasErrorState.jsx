import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export const RutinasErrorState = ({
  error,
  onRetry,
}) => {
  return (
    <div
      role="alert"
      className="p-5 sm:p-6 rounded-3xl bg-rose-50/80 border border-rose-200 text-rose-950 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs"
    >
      <div className="flex items-start sm:items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-rose-100 border border-rose-300 flex items-center justify-center flex-shrink-0 text-rose-700">
          <AlertCircle className="w-5 h-5" aria-hidden="true" />
        </div>
        <div>
          <h4 className="text-sm font-extrabold text-rose-950">
            No se pudieron cargar las rutinas
          </h4>
          <p className="text-xs text-rose-800 font-medium mt-0.5 leading-relaxed">
            {error || 'Ocurrió un problema de comunicación con el servidor de U-Pad.'}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold transition-colors shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 flex-shrink-0"
      >
        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Reintentar</span>
      </button>
    </div>
  );
};

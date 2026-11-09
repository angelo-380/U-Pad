import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ type = 'info', title = '', message = '', duration = 4000 }) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newToast = { id, type, title, message };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }

      return id;
    },
    [removeToast]
  );

  const toast = {
    success: (message, title = 'Operación Exitosa') =>
      addToast({ type: 'success', title, message }),
    error: (message, title = 'Ocurrió un Error') =>
      addToast({ type: 'error', title, message }),
    info: (message, title = 'Información') =>
      addToast({ type: 'info', title, message }),
  };

  return (
    <ToastContext.Provider value={{ toast, addToast, removeToast }}>
      {children}
      {/* Contenedor flotante de notificaciones accesible */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((t) => {
          const isError = t.type === 'error';
          const isSuccess = t.type === 'success';

          return (
            <div
              key={t.id}
              role={isError ? 'alert' : 'status'}
              className={`pointer-events-auto p-4 rounded-2xl border shadow-lg backdrop-blur-sm flex items-start gap-3 transition-all duration-200 transform translate-y-0 opacity-100 motion-reduce:transition-none ${
                isSuccess
                  ? 'bg-emerald-50/95 border-emerald-200 text-emerald-900'
                  : isError
                  ? 'bg-rose-50/95 border-rose-200 text-rose-900'
                  : 'bg-sky-50/95 border-sky-200 text-sky-900'
              }`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {isSuccess && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden="true" />
                )}
                {isError && (
                  <AlertCircle className="w-5 h-5 text-rose-600" aria-hidden="true" />
                )}
                {!isSuccess && !isError && (
                  <Info className="w-5 h-5 text-sky-600" aria-hidden="true" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                {t.title && (
                  <h4 className="text-xs font-bold uppercase tracking-wider mb-0.5">
                    {t.title}
                  </h4>
                )}
                <p className="text-xs leading-relaxed font-medium break-words">
                  {t.message}
                </p>
              </div>

              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="flex-shrink-0 p-1.5 -mr-1 -mt-1 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-black/5 transition-colors"
                aria-label="Cerrar notificación"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe ser utilizado dentro de un ToastProvider');
  }
  return context.toast;
};

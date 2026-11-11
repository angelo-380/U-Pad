import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.jsx';

export const DeleteConfirmDialog = ({
  isOpen,
  rutina,
  title,
  message,
  loading = false,
  onConfirm,
  onCancel,
  onClose,
}) => {
  const cancelBtnRef = useRef(null);
  const { t, translateDynamicText } = useLanguage();
  const handleClose = onCancel || onClose || (() => {});

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    const timeout = setTimeout(() => {
      cancelBtnRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timeout);
    };
  }, [isOpen, loading, handleClose]);

  if (!isOpen) return null;

  const targetRutina = rutina || { titulo: title || 'Rutina', id: 'rut_item', pasos: [] };
  const displayTitle = translateDynamicText ? translateDynamicText(targetRutina.titulo) : targetRutina.titulo;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn motion-reduce:animate-none"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-desc"
    >
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-tea-border">
        {/* Cabecera del diálogo */}
        <div className="flex items-start justify-between pb-4 border-b border-tea-border">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h3
                id="delete-dialog-title"
                className="text-base font-extrabold text-tea-text"
              >
                {title || t('delete_modal_title')}
              </h3>
              {targetRutina.id && targetRutina.id !== 'rut_item' && (
                <span className="text-xs text-tea-subtle font-semibold">
                  ID: {targetRutina.id.substring(0, 10)}...
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="p-1.5 rounded-xl text-tea-subtle hover:text-tea-text hover:bg-tea-cardSubtle transition-tea min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
            aria-label="Cerrar diálogo"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del mensaje */}
        <div className="py-5 space-y-3">
          <p id="delete-dialog-desc" className="text-sm text-tea-muted leading-relaxed">
            {message || t('delete_modal_msg')}
          </p>

          <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-100 flex items-center gap-2.5">
            <span className="text-xs font-bold text-rose-900">
              {displayTitle}
            </span>
            {targetRutina.pasos?.length > 0 && (
              <span className="text-xs text-rose-700/80 ml-auto font-medium">
                ({targetRutina.pasos.length} {t('visual_step_plural')})
              </span>
            )}
          </div>
        </div>

        {/* Botones de acción */}
        <div className="pt-4 border-t border-tea-border flex items-center justify-end gap-3">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold text-tea-text bg-tea-calm hover:bg-tea-cardSubtle border border-tea-border transition-tea focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 cursor-pointer"
          >
            {t('delete_modal_cancel')}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 transition-tea shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 cursor-pointer disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('drawer_loading')}</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>{t('delete_modal_confirm')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

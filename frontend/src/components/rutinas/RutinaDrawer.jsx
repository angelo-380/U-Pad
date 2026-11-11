import React, { useState, useEffect, useRef } from 'react';
import { ArasaacPictogram } from '../common/ArasaacPictogram.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { devicesService } from '../../services/devicesService.js';
import {
  X,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Loader2,
  AlertCircle,
  Sun,
  Sunset,
  Moon,
  Sparkles,
  Check,
  Tablet,
  User,
} from 'lucide-react';

export const RutinaDrawer = ({
  isOpen,
  mode = 'create', // 'create' | 'edit'
  initialData = null,
  loading = false,
  onClose,
  onSubmit,
  onOpenLinkDevice,
}) => {
  const { t } = useLanguage();
  const [titulo, setTitulo] = useState('');
  const [turno, setTurno] = useState('MANANA');
  const [ninoId, setNinoId] = useState('');
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [pasos, setPasos] = useState([
    { orden: 1, texto: '', palabraClave: '' },
  ]);

  // Estados de validación
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const drawerRef = useRef(null);
  const titleInputRef = useRef(null);

  // Inicializar o resetear formulario según initialData o modo
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && initialData) {
        setTitulo(initialData.titulo || '');
        setTurno(initialData.turno || 'MANANA');
        setNinoId(initialData.ninoId || '');
        if (Array.isArray(initialData.pasos) && initialData.pasos.length > 0) {
          setPasos(
            initialData.pasos.map((p, idx) => ({
              orden: p.orden || idx + 1,
              texto: p.texto || '',
              palabraClave: p.palabraClave || '',
            }))
          );
        } else {
          setPasos([{ orden: 1, texto: '', palabraClave: '' }]);
        }
      } else {
        setTitulo('');
        setTurno(initialData?.turno || 'MANANA');
        setNinoId('');
        setPasos([{ orden: 1, texto: '', palabraClave: '' }]);
      }
      setErrors({});
      setTouched({});

      // Foco automático en el título al abrir
      const timeout = setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [isOpen, mode, initialData]);

  // Cargar dispositivos vinculados (tablets del niño)
  useEffect(() => {
    if (isOpen) {
      setLoadingDevices(true);
      devicesService
        .listar()
        .then((devs) => {
          setDevices(devs || []);
          if (devs && devs.length > 0 && !ninoId) {
            setNinoId(devs[0].childName || devs[0].child_name || devs[0].deviceId || devs[0].device_id);
          }
        })
        .catch(() => setDevices([]))
        .finally(() => setLoadingDevices(false));
    }
  }, [isOpen]);

  // Manejo de ESC para cerrar drawer de forma accesible
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  // Validación de formulario
  const validate = () => {
    const newErrors = {};

    if (!titulo.trim()) {
      newErrors.titulo = 'El título de la rutina es obligatorio.';
    } else if (titulo.trim().length < 3) {
      newErrors.titulo = 'El título debe tener al menos 3 caracteres.';
    }

    if (!['MANANA', 'TARDE', 'NOCHE'].includes(turno)) {
      newErrors.turno = 'Selecciona un turno válido.';
    }

    // Validar pasos
    const pasosErrors = [];
    pasos.forEach((paso, idx) => {
      const pError = {};
      if (!paso.texto.trim()) {
        pError.texto = 'La descripción es obligatoria.';
      }
      if (Object.keys(pError).length > 0) {
        pasosErrors[idx] = pError;
      }
    });

    if (pasosErrors.length > 0) {
      newErrors.pasos = pasosErrors;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || submitting) return;

    setTouched({ titulo: true, turno: true, pasos: true });

    if (!validate()) {
      return;
    }

    const payload = {
      titulo: titulo.trim(),
      turno,
      ninoId: ninoId.trim() || null,
      pasos: pasos.map((p, idx) => ({
        orden: idx + 1,
        texto: p.texto.trim(),
        palabraClave: (p.palabraClave || p.texto).trim().toLowerCase(),
      })),
    };

    try {
      setSubmitting(true);
      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  };

  // Manejadores de pasos
  const handlePasoChange = (index, field, value) => {
    const updated = [...pasos];
    updated[index] = {
      ...updated[index],
      [field]: value,
      // Si cambia el texto y la palabra clave no ha sido modificada manualmente, sugerimos el texto
      palabraClave:
        field === 'texto' && !updated[index].keywordTouched
          ? value.toLowerCase()
          : field === 'palabraClave'
          ? value.toLowerCase()
          : updated[index].palabraClave,
      keywordTouched: field === 'palabraClave' ? true : updated[index].keywordTouched,
    };
    setPasos(updated);
  };

  const handleAddPaso = () => {
    setPasos([...pasos, { orden: pasos.length + 1, texto: '', palabraClave: '' }]);
  };

  const handleRemovePaso = (index) => {
    if (pasos.length <= 1) return;
    const filtered = pasos.filter((_, idx) => idx !== index);
    const reordered = filtered.map((p, idx) => ({ ...p, orden: idx + 1 }));
    setPasos(reordered);
  };

  const handleMovePaso = (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= pasos.length) return;

    const updated = [...pasos];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);

    const reordered = updated.map((p, idx) => ({ ...p, orden: idx + 1 }));
    setPasos(reordered);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
    >
      {/* Backdrop con desenfoque suave */}
      <div
        onClick={!loading ? onClose : undefined}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-fadeIn"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div
          ref={drawerRef}
          className="w-screen max-w-xl bg-white shadow-2xl flex flex-col border-l border-tea-border animate-slideInRight"
        >
          {/* Cabecera del Drawer */}
          <div className="p-6 border-b border-tea-border flex items-center justify-between gap-4 bg-tea-calm">
            <div>
              <h2
                id="drawer-title"
                className="text-xl font-extrabold text-tea-text tracking-tight"
              >
                {mode === 'create' ? t('drawer_create_title') : t('drawer_edit_title')}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="p-2.5 rounded-xl text-tea-muted hover:text-tea-text hover:bg-tea-cardSubtle min-h-[44px] min-w-[44px] flex items-center justify-center transition-tea focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              aria-label="Cerrar panel lateral"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          {/* Formulario scrollable */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Campo: Título */}
            <div className="space-y-1.5">
              <label
                htmlFor="rutina-titulo"
                className="block text-sm font-bold text-tea-text"
              >
                {t('drawer_field_title')} <span className="text-rose-600">*</span>
              </label>
              <input
                id="rutina-titulo"
                ref={titleInputRef}
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                onBlur={() => setTouched({ ...touched, titulo: true })}
                disabled={loading}
                placeholder={t('drawer_field_title_placeholder')}
                className={`w-full px-4 py-3 min-h-[44px] rounded-xl text-sm border font-medium transition-tea bg-white ${
                  touched.titulo && errors.titulo
                    ? 'border-rose-400 focus:ring-rose-500'
                    : 'border-tea-border focus:ring-brand-600'
                } focus-visible:outline-none focus-visible:ring-2`}
              />
              {touched.titulo && errors.titulo && (
                <p className="text-xs text-rose-600 font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{errors.titulo}</span>
                </p>
              )}
            </div>

            {/* Campo: Selector de Turno */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-tea-text">
                {t('drawer_field_shift')} <span className="text-rose-600">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: 'MANANA', label: t('tab_morning'), icon: Sun, color: 'text-amber-700 bg-amber-50 border-amber-200' },
                  { id: 'TARDE', label: t('tab_afternoon'), icon: Sunset, color: 'text-teal-700 bg-teal-50 border-teal-200' },
                  { id: 'NOCHE', label: t('tab_night'), icon: Moon, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = turno === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTurno(item.id)}
                      className={`flex flex-col items-center gap-2 p-3 min-h-[64px] rounded-2xl border text-xs font-bold transition-tea cursor-pointer ${
                        isSelected
                          ? `border-brand-600 bg-brand-50/70 text-brand-900 ring-2 ring-brand-600/30`
                          : 'border-tea-border bg-white text-tea-muted hover:bg-tea-calm'
                      }`}
                    >
                      <Icon className="w-5 h-5" aria-hidden="true" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Asignación del Niño / Tablet Vinculada */}
            <div className="space-y-2 p-3.5 bg-tea-calm rounded-2xl border border-tea-border">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-tea-text flex items-center gap-1.5">
                  <User className="w-4 h-4 text-brand-600" />
                  <span>Asignado a:</span>
                </label>
                {devices.length > 0 && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    ● Tablet Sincronizada
                  </span>
                )}
              </div>

              {devices.length > 1 ? (
                <select
                  value={ninoId}
                  onChange={(e) => setNinoId(e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 rounded-xl text-xs font-semibold border border-tea-border bg-white text-tea-text focus:ring-2 focus:ring-brand-600 focus:outline-none"
                >
                  {devices.map((d) => {
                    const dName = d.childName || d.child_name || 'Hijo';
                    const dId = d.deviceId || d.device_id;
                    const dModel = d.deviceModel || d.device_model || 'Tablet';
                    return (
                      <option key={dId} value={dName || dId}>
                        🧒 {dName} · {dModel}
                      </option>
                    );
                  })}
                </select>
              ) : devices.length === 1 ? (
                <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-tea-border text-xs">
                  <div className="flex items-center gap-2">
                    <Tablet className="w-4 h-4 text-brand-600" />
                    <div>
                      <p className="font-bold text-tea-text">
                        🧒 {devices[0].childName || devices[0].child_name || 'Mi Hijo'}
                      </p>
                      <p className="text-[11px] text-tea-muted">
                        {devices[0].deviceModel || devices[0].device_model || 'Android Tablet'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-tea-muted">
                    ID: {(devices[0].deviceId || devices[0].device_id || '').substring(0, 10)}...
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-tea-border text-xs">
                  <div className="flex items-center gap-2">
                    <Tablet className="w-4 h-4 text-slate-400" />
                    <p className="text-tea-text font-medium text-xs">
                      🧒 Perfil de tu hijo(a) · Sincronización automática con la app
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Lista de Pasos Interactivos con ARASAAC */}
            <div className="space-y-3 pt-2 border-t border-tea-border">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-tea-text">
                    {t('drawer_steps_title')}
                  </h3>
                  <p className="text-xs text-tea-muted mt-0.5">
                    Previsualiza y ajusta cada pictograma en tiempo real.
                  </p>
                </div>

                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">
                  {pasos.length} {pasos.length === 1 ? t('visual_step_single') : t('visual_step_plural')}
                </span>
              </div>

              <div className="space-y-3">
                {pasos.map((paso, index) => {
                  const stepError = errors.pasos && errors.pasos[index];
                  return (
                    <div
                      key={index}
                      className="p-4 rounded-2xl bg-tea-calm border border-tea-border space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-brand-600 text-white text-xs font-extrabold flex items-center justify-center">
                            {paso.orden}
                          </span>
                          <span className="text-xs font-bold text-tea-text">
                            {t('drawer_step_label')} {paso.orden}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMovePaso(index, 'up')}
                            disabled={index === 0}
                            className="p-1.5 rounded-lg text-tea-subtle hover:text-tea-text hover:bg-white disabled:opacity-30 min-h-[32px] min-w-[32px] flex items-center justify-center"
                            aria-label={`Subir paso ${paso.orden}`}
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMovePaso(index, 'down')}
                            disabled={index === pasos.length - 1}
                            className="p-1.5 rounded-lg text-tea-subtle hover:text-tea-text hover:bg-white disabled:opacity-30 min-h-[32px] min-w-[32px] flex items-center justify-center"
                            aria-label={`Bajar paso ${paso.orden}`}
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemovePaso(index)}
                            disabled={pasos.length <= 1}
                            className="p-1.5 rounded-lg text-tea-subtle hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 min-h-[32px] min-w-[32px] flex items-center justify-center"
                            aria-label={`Eliminar paso ${paso.orden}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        {/* Pictograma ARASAAC en vivo */}
                        <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white border border-tea-border shadow-soft-xs flex-shrink-0">
                          <ArasaacPictogram
                            keyword={paso.palabraClave || paso.texto}
                            alt={`Pictograma para: ${paso.texto}`}
                            size="md"
                          />
                          <span className="text-[10px] font-mono text-tea-subtle mt-1 max-w-[64px] truncate text-center">
                            {paso.palabraClave || '...'}
                          </span>
                        </div>

                        {/* Campos de texto y palabra clave */}
                        <div className="flex-1 space-y-2">
                          <div>
                            <input
                              type="text"
                              value={paso.texto}
                              onChange={(e) => handlePasoChange(index, 'texto', e.target.value)}
                              disabled={loading}
                              placeholder={t('drawer_step_text_placeholder')}
                              className={`w-full px-3 py-2 text-xs rounded-xl border bg-white ${
                                stepError?.texto ? 'border-rose-400' : 'border-tea-border'
                              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600`}
                            />
                            {stepError?.texto && (
                              <p className="text-[11px] text-rose-600 font-medium mt-0.5">
                                {stepError.texto}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-tea-subtle flex-shrink-0">
                              {t('drawer_step_keyword_label')}
                            </span>
                            <input
                              type="text"
                              value={paso.palabraClave}
                              onChange={(e) => handlePasoChange(index, 'palabraClave', e.target.value)}
                              disabled={loading}
                              placeholder={t('drawer_step_keyword_placeholder')}
                              className="w-full px-2.5 py-1 text-xs rounded-lg border border-tea-border bg-white font-mono text-tea-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleAddPaso}
                disabled={loading}
                className="w-full py-3 min-h-[44px] rounded-2xl border-2 border-dashed border-tea-border hover:border-brand-500 hover:bg-brand-50/50 text-xs font-bold text-tea-muted hover:text-brand-700 transition-tea flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              >
                <Plus className="w-4 h-4" />
                <span>{t('drawer_add_step')}</span>
              </button>
            </div>
          </form>

          {/* Footer de Acciones del Drawer */}
          <div className="p-5 border-t border-tea-border bg-tea-calm flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold text-tea-text bg-white border border-tea-border hover:bg-tea-cardSubtle transition-tea focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 cursor-pointer"
            >
              {t('drawer_cancel')}
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || submitting}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 min-h-[44px] rounded-xl text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 transition-tea shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 cursor-pointer disabled:opacity-60"
            >
              {loading || submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('drawer_loading')}</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{mode === 'create' ? t('drawer_save_create') : t('drawer_save_edit')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

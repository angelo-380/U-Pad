import React, { useState, useEffect, useRef } from 'react';
import { ArasaacPictogram } from '../common/ArasaacPictogram.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
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
  Clock,
} from 'lucide-react';

// Límites de los pasos (los mismos que valida el backend en utils/pasosRutina.js)
const PASOS_MAX = 20;
const MINUTOS_MIN = 1;
const MINUTOS_MAX = 120;
const MINUTOS_POR_DEFECTO = 5;
const pasoVacio = (orden) => ({ orden, texto: '', palabraClave: '', duracionMinutos: MINUTOS_POR_DEFECTO });
const minutosValidos = (valor) => Number.isInteger(Number(valor)) && Number(valor) >= MINUTOS_MIN && Number(valor) <= MINUTOS_MAX;

export const RutinaDrawer = ({
  isOpen,
  mode = 'create', // 'create' | 'edit'
  initialData = null,
  loading = false,
  onClose,
  onSubmit,
  onOpenLinkDevice,
  devices = [], // hijos vinculados del usuario (los carga RutinasPage y se actualizan al vincular)
}) => {
  const { t } = useLanguage();
  const [titulo, setTitulo] = useState('');
  const [turno, setTurno] = useState('MANANA');
  const [ninoId, setNinoId] = useState('');
  // Niño asignado al abrir en modo edición: si no cambia, no se reenvía (datos antiguos o rutinas de un tutor)
  const [ninoIdInicial, setNinoIdInicial] = useState('');
  const [pasos, setPasos] = useState([pasoVacio(1)]);

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
        setNinoIdInicial(initialData.ninoId || '');
        if (Array.isArray(initialData.pasos) && initialData.pasos.length > 0) {
          setPasos(
            initialData.pasos.map((p, idx) => ({
              orden: p.orden || idx + 1,
              texto: p.texto || '',
              palabraClave: p.palabraClave || '',
              duracionMinutos: minutosValidos(p.duracionMinutos) ? Number(p.duracionMinutos) : MINUTOS_POR_DEFECTO,
            }))
          );
        } else {
          setPasos([pasoVacio(1)]);
        }
      } else {
        setTitulo('');
        setTurno(initialData?.turno || 'MANANA');
        setNinoId('');
        setNinoIdInicial('');
        setPasos([pasoVacio(1)]);
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
      newErrors.titulo = t('drawer_error_title_required');
    } else if (titulo.trim().length < 3) {
      newErrors.titulo = t('drawer_error_title_min');
    }

    if (!['MANANA', 'TARDE', 'NOCHE'].includes(turno)) {
      newErrors.turno = t('drawer_error_shift');
    }

    // Validar pasos
    const pasosErrors = [];
    pasos.forEach((paso, idx) => {
      const pError = {};
      if (!paso.texto.trim()) {
        pError.texto = t('drawer_error_step_required');
      }
      if (!minutosValidos(paso.duracionMinutos)) {
        pError.duracionMinutos = t('drawer_error_step_minutes', { min: MINUTOS_MIN, max: MINUTOS_MAX });
      }
      if (Object.keys(pError).length > 0) {
        pasosErrors[idx] = pError;
      }
    });

    if (pasosErrors.length > 0) {
      newErrors.pasos = pasosErrors;
    }

    // ninoId vacío = «Todos mis hijos»; si no, debe ser uno de los hijos vinculados (o el valor inicial al editar)
    const idsHijos = devices.map((d) => d.deviceId || d.device_id);
    if (ninoId && ninoId !== ninoIdInicial && !idsHijos.includes(ninoId)) {
      newErrors.ninoId = t('drawer_child_required');
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
      // En edición, si el niño no cambió no se envía (se conserva tal cual en el servidor)
      ninoId: mode === 'edit' && ninoId === ninoIdInicial ? undefined : ninoId || null,
      pasos: pasos.map((p, idx) => ({
        orden: idx + 1,
        texto: p.texto.trim(),
        palabraClave: (p.palabraClave || p.texto).trim().toLowerCase(),
        duracionMinutos: Number(p.duracionMinutos),
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
    if (pasos.length >= PASOS_MAX) return;
    setPasos([...pasos, pasoVacio(pasos.length + 1)]);
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

  const duracionTotal = pasos.reduce((total, p) => total + (minutosValidos(p.duracionMinutos) ? Number(p.duracionMinutos) : 0), 0);

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
              aria-label={t('btn_close')}
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

            {/* Hijo asignado: desplegable con los hijos vinculados (si hay uno, queda elegido) */}
            <div className="space-y-2 p-3.5 bg-tea-calm rounded-2xl border border-tea-border">
              <label htmlFor="drawer-nino" className="text-xs font-bold text-tea-text flex items-center gap-1.5">
                <User className="w-4 h-4 text-brand-600" />
                <span>{t('drawer_child_label')}</span>
              </label>

              {devices.length > 0 ? (
                <>
                  <select
                    id="drawer-nino"
                    value={ninoId}
                    onChange={(e) => setNinoId(e.target.value)}
                    disabled={loading}
                    aria-invalid={Boolean(errors.ninoId)}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border bg-white text-tea-text focus:ring-2 focus:ring-brand-600 focus:outline-none ${
                      errors.ninoId ? 'border-rose-400' : 'border-tea-border'
                    }`}
                  >
                    <option value="">{t('drawer_child_all')}</option>
                    {devices.map((d) => {
                      const dId = d.deviceId || d.device_id;
                      return (
                        <option key={dId} value={dId}>
                          {d.childName || d.child_name || t('child_unnamed')}
                        </option>
                      );
                    })}
                    {ninoIdInicial && !devices.some((d) => (d.deviceId || d.device_id) === ninoIdInicial) && (
                      <option value={ninoIdInicial}>{t('child_unnamed')}</option>
                    )}
                  </select>
                  <p className="text-[11px] text-tea-muted">{t('drawer_child_hint')}</p>
                  {errors.ninoId && (
                    <p className="text-xs text-rose-600 flex items-center gap-1" role="alert">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {errors.ninoId}
                    </p>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-between gap-3 p-2.5 bg-white rounded-xl border border-tea-border text-xs">
                  <p className="text-tea-muted">{t('drawer_child_none')}</p>
                  {onOpenLinkDevice && (
                    <button
                      type="button"
                      onClick={onOpenLinkDevice}
                      className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 text-brand-700 border border-brand-200 font-bold hover:bg-brand-100 transition-colors"
                    >
                      <Tablet className="w-3.5 h-3.5" />
                      {t('drawer_child_link')}
                    </button>
                  )}
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
                    {t('drawer_steps_hint')}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">
                    {pasos.length} {pasos.length === 1 ? t('visual_step_single') : t('visual_step_plural')}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-tea-text" aria-live="polite">
                    <Clock className="w-3.5 h-3.5 text-brand-600" aria-hidden="true" />
                    {t('drawer_total_duration', { minutos: duracionTotal })}
                  </span>
                </div>
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

                          <div>
                            <div className="flex items-center gap-1.5">
                              <label htmlFor={`paso-minutos-${index}`} className="text-[11px] font-semibold text-tea-subtle flex-shrink-0 inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" aria-hidden="true" />
                                {t('drawer_step_minutes_label')}
                              </label>
                              <input
                                id={`paso-minutos-${index}`}
                                type="number"
                                inputMode="numeric"
                                min={MINUTOS_MIN}
                                max={MINUTOS_MAX}
                                step={1}
                                value={paso.duracionMinutos}
                                onChange={(e) => handlePasoChange(index, 'duracionMinutos', e.target.value === '' ? '' : Number(e.target.value))}
                                disabled={loading}
                                className={`w-20 px-2.5 py-1 text-xs rounded-lg border bg-white text-tea-text font-bold ${
                                  stepError?.duracionMinutos ? 'border-rose-400' : 'border-tea-border'
                                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600`}
                              />
                              <span className="text-[11px] text-tea-muted">{t('drawer_minutes_unit')}</span>
                            </div>
                            {stepError?.duracionMinutos && (
                              <p className="text-[11px] text-rose-600 font-medium mt-0.5">{stepError.duracionMinutos}</p>
                            )}
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
                disabled={loading || pasos.length >= PASOS_MAX}
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

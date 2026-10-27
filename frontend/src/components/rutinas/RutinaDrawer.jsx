import React, { useState, useEffect, useRef } from 'react';
import { ArasaacPictogram } from '../common/ArasaacPictogram.jsx';
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
} from 'lucide-react';

export const RutinaDrawer = ({
  isOpen,
  mode = 'create', // 'create' | 'edit'
  initialData = null,
  loading = false,
  onClose,
  onSubmit,
}) => {
  const [titulo, setTitulo] = useState('');
  const [turno, setTurno] = useState('MANANA');
  const [ninoId, setNinoId] = useState('');
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
        setTurno('MANANA');
        setNinoId('');
        setPasos([{ orden: 1, texto: '', palabraClave: '' }]);
      }
      setErrors({});
      setTouched({});

      // Enfocar título accesiblemente
      const timer = setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, mode, initialData]);

  // Manejo de tecla Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  // Reordenar pasos
  const movePaso = (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= pasos.length) return;

    const updated = [...pasos];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);

    // Reasignar órdenes
    const reordered = updated.map((p, idx) => ({
      ...p,
      orden: idx + 1,
    }));
    setPasos(reordered);
  };

  const handleAddPaso = () => {
    setPasos((prev) => [
      ...prev,
      { orden: prev.length + 1, texto: '', palabraClave: '' },
    ]);
  };

  const handleRemovePaso = (index) => {
    if (pasos.length <= 1) return;
    const filtered = pasos.filter((_, i) => i !== index);
    const reordered = filtered.map((p, idx) => ({
      ...p,
      orden: idx + 1,
    }));
    setPasos(reordered);
  };

  const handlePasoChange = (index, field, value) => {
    const updated = [...pasos];
    updated[index][field] = value;
    setPasos(updated);

    // Limpiar error del paso si ya tiene texto
    if (field === 'texto' && value.trim()) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[`paso_${index}`];
        return next;
      });
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!titulo.trim()) {
      newErrors.titulo = 'El título de la rutina es obligatorio.';
    } else if (titulo.trim().length < 3) {
      newErrors.titulo = 'El título debe tener al menos 3 caracteres.';
    }

    if (!['MANANA', 'TARDE', 'NOCHE'].includes(turno)) {
      newErrors.turno = 'Selecciona un turno válido para la rutina.';
    }

    const emptySteps = pasos.filter((p) => !p.texto.trim());
    if (emptySteps.length === pasos.length) {
      newErrors.pasos = 'Debes incluir al menos un paso con texto.';
    } else {
      pasos.forEach((p, idx) => {
        if (!p.texto.trim()) {
          newErrors[`paso_${idx}`] = 'Indica la descripción de este paso.';
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched({ titulo: true, pasos: true });

    if (!validate()) return;

    const pasosValidos = pasos
      .filter((p) => p.texto.trim())
      .map((p, idx) => ({
        orden: idx + 1,
        texto: p.texto.trim(),
        palabraClave: p.palabraClave.trim().toLowerCase(),
      }));

    onSubmit({
      titulo: titulo.trim(),
      turno,
      ninoId: ninoId.trim() || 'nino_default',
      pasos: pasosValidos,
    });
  };

  if (!isOpen) return null;

  const turnosOptions = [
    {
      id: 'MANANA',
      label: 'Mañana',
      icon: Sun,
      color: 'text-amber-800 bg-amber-50 border-amber-200',
      activeColor: 'bg-amber-500 text-white border-amber-600',
    },
    {
      id: 'TARDE',
      label: 'Tarde',
      icon: Sunset,
      color: 'text-emerald-800 bg-emerald-50 border-emerald-200',
      activeColor: 'bg-emerald-600 text-white border-emerald-700',
    },
    {
      id: 'NOCHE',
      label: 'Noche',
      icon: Moon,
      color: 'text-indigo-800 bg-indigo-50 border-indigo-200',
      activeColor: 'bg-indigo-600 text-white border-indigo-700',
    },
  ];

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
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-200 animate-fadeIn motion-reduce:animate-none"
        aria-hidden="true"
      />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div
          ref={drawerRef}
          className="w-screen max-w-lg bg-white shadow-2xl border-l border-slate-200 flex flex-col justify-between overflow-y-auto animate-slideInRight motion-reduce:animate-none"
        >
          {/* Cabecera del Drawer */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xs px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-600 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                {mode === 'edit' ? 'Modificar Rutina' : 'Nueva Rutina Visual'}
              </span>
              <h2
                id="drawer-title"
                className="text-xl font-extrabold text-slate-900 tracking-tight"
              >
                {mode === 'edit' ? 'Editar Rutina' : 'Crear Secuencia'}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="p-2 -mr-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              aria-label="Cerrar panel lateral"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="flex-1 p-6 space-y-5">
            {/* Mensaje de error general de pasos si existe */}
            {errors.pasos && (
              <div
                role="alert"
                className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errors.pasos}</span>
              </div>
            )}

            {/* Campo: Título */}
            <div>
              <label
                htmlFor="drawer-rutina-titulo"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Título de la Rutina <span className="text-rose-500">*</span>
              </label>
              <input
                id="drawer-rutina-titulo"
                ref={titleInputRef}
                type="text"
                disabled={loading}
                value={titulo}
                onChange={(e) => {
                  setTitulo(e.target.value);
                  if (errors.titulo) {
                    setErrors((prev) => ({ ...prev, titulo: undefined }));
                  }
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, titulo: true }))}
                placeholder="Ej. Rutina de Mañana y Desayuno"
                aria-invalid={Boolean(errors.titulo)}
                aria-describedby={errors.titulo ? 'titulo-error' : undefined}
                className={`w-full px-4 py-2.5 min-h-[44px] text-sm rounded-xl border ${
                  errors.titulo
                    ? 'border-rose-300 bg-rose-50/40 focus:border-rose-500 focus:ring-rose-200'
                    : 'border-slate-200 bg-slate-50 focus:bg-white focus:border-brand-500 focus:ring-brand-200'
                } text-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2`}
              />
              {errors.titulo && (
                <p id="titulo-error" className="text-xs text-rose-600 font-medium mt-1">
                  {errors.titulo}
                </p>
              )}
            </div>

            {/* Campo: Turno del Día */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Turno Horario <span className="text-rose-500">*</span>
              </label>
              <div
                role="radiogroup"
                aria-label="Selecciona el turno del día"
                className="grid grid-cols-3 gap-2"
              >
                {turnosOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = turno === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      disabled={loading}
                      onClick={() => setTurno(opt.id)}
                      className={`flex flex-col items-center justify-center gap-1 p-3 rounded-2xl border text-xs font-bold min-h-[56px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                        isSelected
                          ? `${opt.activeColor} shadow-xs`
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" aria-hidden="true" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Campo: Niño / Paciente */}
            <div>
              <label
                htmlFor="drawer-rutina-nino"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Identificador de Alumno o Niño (Opcional)
              </label>
              <input
                id="drawer-rutina-nino"
                type="text"
                disabled={loading}
                value={ninoId}
                onChange={(e) => setNinoId(e.target.value)}
                placeholder="Ej. nino_mateo o sala_azul"
                className="w-full px-4 py-2.5 min-h-[44px] text-sm rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              />
            </div>

            {/* Sección de Pasos con Reordenamiento y Vista Previa ARASAAC en Vivo */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Pasos Visuales ({pasos.length})
                  </label>
                  <p className="text-[11px] text-slate-500">
                    Escribe la acción y la palabra clave en inglés para la vista previa del pictograma
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddPaso}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold border border-brand-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Agregar Paso</span>
                </button>
              </div>

              <div className="space-y-3 pr-0.5">
                {pasos.map((paso, index) => {
                  const stepError = errors[`paso_${index}`];
                  const previewKeyword = paso.palabraClave || paso.texto;

                  return (
                    <div
                      key={index}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 shadow-xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        {/* Indicador de orden y controles de reordenamiento */}
                        <div className="flex items-center gap-1.5">
                          <span
                            aria-label={`Paso número ${paso.orden}`}
                            className="w-6 h-6 rounded-lg bg-brand-600 text-white text-xs font-extrabold flex items-center justify-center flex-shrink-0"
                          >
                            {paso.orden}
                          </span>
                          <span className="text-xs font-bold text-slate-700">
                            Paso {paso.orden}
                          </span>
                        </div>

                        {/* Botones de subir / bajar / eliminar */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => movePaso(index, 'up')}
                            disabled={index === 0 || loading}
                            aria-label={`Mover paso ${paso.orden} arriba`}
                            title="Mover arriba"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 disabled:opacity-30 disabled:pointer-events-none min-h-[36px] min-w-[36px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => movePaso(index, 'down')}
                            disabled={index === pasos.length - 1 || loading}
                            aria-label={`Mover paso ${paso.orden} abajo`}
                            title="Mover abajo"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 disabled:opacity-30 disabled:pointer-events-none min-h-[36px] min-w-[36px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>

                          {pasos.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemovePaso(index)}
                              disabled={loading}
                              aria-label={`Eliminar paso ${paso.orden}`}
                              title="Eliminar paso"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 min-h-[36px] min-w-[36px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 ml-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inputs y Vista Previa en Vivo */}
                      <div className="flex items-start gap-3">
                        {/* Vista previa en vivo del pictograma ARASAAC */}
                        <div className="flex-shrink-0 flex flex-col items-center">
                          <ArasaacPictogram
                            keyword={previewKeyword}
                            alt={`Vista previa ARASAAC paso ${paso.orden}`}
                            size="md"
                          />
                          <span className="text-[9px] text-slate-600 font-semibold mt-1">
                            Vista previa
                          </span>
                        </div>

                        {/* Campos de texto y palabra clave */}
                        <div className="flex-1 space-y-2">
                          <div>
                            <input
                              type="text"
                              value={paso.texto}
                              disabled={loading}
                              onChange={(e) =>
                                handlePasoChange(index, 'texto', e.target.value)
                              }
                              placeholder="Ej. Lavarse los dientes"
                              aria-label={`Texto del paso ${paso.orden}`}
                              className={`w-full px-3 py-2 text-xs rounded-xl border ${
                                stepError
                                  ? 'border-rose-300 bg-rose-50/30'
                                  : 'border-slate-200 bg-white'
                              } text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600`}
                            />
                            {stepError && (
                              <p className="text-[10px] text-rose-600 font-medium mt-0.5">
                                {stepError}
                              </p>
                            )}
                          </div>

                          <div>
                            <input
                              type="text"
                              value={paso.palabraClave}
                              disabled={loading}
                              onChange={(e) =>
                                handlePasoChange(
                                  index,
                                  'palabraClave',
                                  e.target.value
                                )
                              }
                              placeholder="Clave ARASAAC en inglés (ej: brush)"
                              aria-label={`Palabra clave ARASAAC paso ${paso.orden}`}
                              className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </form>

          {/* Pie del Drawer con botones de guardar y cancelar */}
          <div className="sticky bottom-0 z-10 bg-white/95 backdrop-blur-xs px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 min-h-[44px] rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 min-h-[44px] rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" aria-hidden="true" />
                  <span>{mode === 'edit' ? 'Actualizar Rutina' : 'Crear Rutina'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

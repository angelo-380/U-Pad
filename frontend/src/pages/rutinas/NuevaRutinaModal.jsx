import React, { useState } from 'react';
import { rutinasService } from '../../services/rutinasService.js';
import { X, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';

export const NuevaRutinaModal = ({ isOpen, onClose, onRutinaCreada }) => {
  const [titulo, setTitulo] = useState('');
  const [turno, setTurno] = useState('MANANA');
  const [ninoId, setNinoId] = useState('');
  const [pasos, setPasos] = useState([
    { orden: 1, texto: '', palabraClave: '' },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleAddPaso = () => {
    setPasos([...pasos, { orden: pasos.length + 1, texto: '', palabraClave: '' }]);
  };

  const handleRemovePaso = (index) => {
    if (pasos.length <= 1) return;
    const filtered = pasos.filter((_, i) => i !== index);
    const reordered = filtered.map((p, idx) => ({ ...p, orden: idx + 1 }));
    setPasos(reordered);
  };

  const handlePasoChange = (index, field, value) => {
    const updated = [...pasos];
    updated[index][field] = value;
    setPasos(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!titulo.trim()) {
      setError('Por favor indica un título para la rutina.');
      return;
    }

    const pasosValidos = pasos.filter((p) => p.texto.trim().length > 0);
    if (pasosValidos.length === 0) {
      setError('Agrega al menos una actividad o paso visual.');
      return;
    }

    try {
      setLoading(true);
      await rutinasService.crear({
        titulo,
        turno,
        ninoId: ninoId.trim() || 'nino_default',
        pasos: pasosValidos,
      });

      // Limpiar y cerrar
      setTitulo('');
      setTurno('MANANA');
      setNinoId('');
      setPasos([{ orden: 1, texto: '', palabraClave: '' }]);
      onRutinaCreada();
      onClose();
    } catch (err) {
      setError(err.message || 'Error al guardar la rutina.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-extrabold text-tea-text">Crear Rutina Visual</h2>
            <p className="text-xs text-tea-muted mt-0.5">Define los pictogramas y el turno horario</p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-tea-text mb-1.5">
              Título de la Rutina
            </label>
            <input
              type="text"
              required
              disabled={loading}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej. Rutina de Almuerzo y Lavado"
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-tea-border bg-slate-50 focus:bg-white text-tea-text transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-tea-text mb-1.5">
                Turno del Día
              </label>
              <select
                value={turno}
                onChange={(e) => setTurno(e.target.value)}
                disabled={loading}
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-tea-border bg-slate-50 focus:bg-white text-tea-text"
              >
                <option value="MANANA">Mañana (08:00 - 12:00)</option>
                <option value="TARDE">Tarde (13:00 - 18:00)</option>
                <option value="NOCHE">Noche (19:00 - 22:00)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-tea-text mb-1.5">
                Identificador del Niño / Paciente
              </label>
              <input
                type="text"
                disabled={loading}
                value={ninoId}
                onChange={(e) => setNinoId(e.target.value)}
                placeholder="Ej. nino_mateo"
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-tea-border bg-slate-50 focus:bg-white text-tea-text"
              />
            </div>
          </div>

          {/* Pasos / Actividades de la rutina */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-tea-text">
                Pasos y Pictogramas
              </label>
              <button
                type="button"
                onClick={handleAddPaso}
                disabled={loading}
                className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar Paso
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {pasos.map((paso, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2.5 rounded-2xl bg-slate-50 border border-slate-200"
                >
                  <span className="w-6 h-6 rounded-lg bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {paso.orden}
                  </span>
                  <input
                    type="text"
                    required
                    disabled={loading}
                    value={paso.texto}
                    onChange={(e) => handlePasoChange(index, 'texto', e.target.value)}
                    placeholder="Acción (ej. Lavarse los dientes)"
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                  />
                  <input
                    type="text"
                    disabled={loading}
                    value={paso.palabraClave}
                    onChange={(e) => handlePasoChange(index, 'palabraClave', e.target.value)}
                    placeholder="Palabra ARASAAC"
                    className="w-28 px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                  />
                  {pasos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePaso(index)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                      aria-label="Eliminar paso"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm disabled:bg-slate-300"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <span>Guardar Rutina</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

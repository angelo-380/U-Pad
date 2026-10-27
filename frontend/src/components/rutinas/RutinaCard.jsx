import React, { useState } from 'react';
import { ArasaacPictogram } from '../common/ArasaacPictogram.jsx';
import {
  Sun,
  Sunset,
  Moon,
  Clock,
  Layers,
  Edit3,
  Trash2,
  User,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export const RutinaCard = ({
  rutina,
  onEditar,
  onEliminar,
}) => {
  const [expandSteps, setExpandSteps] = useState(false);

  const getTurnoBadge = (turno) => {
    switch (turno) {
      case 'MANANA':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <Sun className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
            Mañana
          </span>
        );
      case 'TARDE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
            <Sunset className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
            Tarde
          </span>
        );
      case 'NOCHE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-900 border border-indigo-300">
            <Moon className="w-3.5 h-3.5 text-indigo-700" aria-hidden="true" />
            Noche
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">
            {turno}
          </span>
        );
    }
  };

  const formattedDate = rutina.creadoEn
    ? new Date(rutina.creadoEn).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null;

  const totalPasos = rutina.pasos?.length || 0;
  const visiblePasos = expandSteps ? rutina.pasos : rutina.pasos?.slice(0, 3) || [];
  const hiddenCount = totalPasos - 3;

  return (
    <article
      aria-labelledby={`rutina-titulo-${rutina.id}`}
      className="bg-white rounded-3xl border border-tea-border p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
    >
      <div>
        {/* Cabecera de la tarjeta */}
        <div className="flex items-center justify-between gap-2 mb-3.5">
          {getTurnoBadge(rutina.turno)}

          {formattedDate && (
            <span className="text-xs text-slate-600 font-semibold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              {formattedDate}
            </span>
          )}
        </div>

        {/* Título de la Rutina */}
        <h3
          id={`rutina-titulo-${rutina.id}`}
          className="text-base font-extrabold text-slate-900 tracking-tight mb-2 line-clamp-2"
        >
          {rutina.titulo}
        </h3>

        {/* Metadatos: pasos y niño */}
        <div className="flex items-center gap-2 text-xs text-slate-600 mb-4 font-medium flex-wrap">
          <span className="inline-flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-brand-600" aria-hidden="true" />
            {totalPasos} {totalPasos === 1 ? 'paso visual' : 'pasos visuales'}
          </span>

          {rutina.ninoId && (
            <span className="inline-flex items-center gap-1 ml-auto text-[11px] bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-semibold border border-slate-200">
              <User className="w-3 h-3 text-slate-500" aria-hidden="true" />
              {rutina.ninoId}
            </span>
          )}
        </div>

        {/* Lista de Pasos con Pictogramas ARASAAC */}
        {rutina.pasos && rutina.pasos.length > 0 ? (
          <div className="space-y-2 mb-4">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Secuencia de pasos:
            </h4>

            <div className="space-y-2">
              {visiblePasos.map((paso, idx) => {
                const keywordToUse = paso.palabraClave || paso.texto;
                const stepNumber = paso.orden || idx + 1;

                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-2 rounded-2xl bg-slate-50 border border-slate-200/80 transition-colors hover:bg-slate-100/70"
                  >
                    {/* Número de paso */}
                    <span
                      aria-label={`Paso ${stepNumber}`}
                      className="w-6 h-6 rounded-lg bg-brand-100 text-brand-800 text-xs font-extrabold flex items-center justify-center flex-shrink-0"
                    >
                      {stepNumber}
                    </span>

                    {/* Pictograma ARASAAC */}
                    <ArasaacPictogram
                      keyword={keywordToUse}
                      alt={`Pictograma para: ${paso.texto}`}
                      size="sm"
                    />

                    {/* Texto de la actividad */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {paso.texto}
                      </p>
                      {paso.palabraClave && (
                        <p className="text-[10px] text-slate-500 font-mono truncate">
                          Clave: {paso.palabraClave}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Botón para expandir/colapsar pasos si son más de 3 */}
            {totalPasos > 3 && (
              <button
                type="button"
                onClick={() => setExpandSteps(!expandSteps)}
                className="w-full mt-1.5 py-1 text-center text-xs font-bold text-brand-700 hover:text-brand-800 flex items-center justify-center gap-1 transition-colors"
                aria-expanded={expandSteps}
              >
                {expandSteps ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    Mostrar menos pasos
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    Ver {hiddenCount} {hiddenCount === 1 ? 'actividad más' : 'actividades más'}
                  </>
                )}
              </button>
            )}
          </div>
        ) : (
          <div className="p-3 rounded-2xl bg-slate-50 text-slate-500 text-xs italic text-center mb-4">
            Sin pasos configurados
          </div>
        )}
      </div>

      {/* Botones de acción inferiores */}
      <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
        <span className="text-[11px] font-mono text-slate-600 truncate max-w-[120px]">
          ID: {rutina.id.substring(0, 8)}...
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onEditar(rutina)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] min-w-[44px] rounded-xl text-xs font-bold text-slate-700 hover:text-brand-700 bg-slate-50 hover:bg-brand-50 border border-slate-200 hover:border-brand-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            aria-label={`Editar rutina: ${rutina.titulo}`}
            title="Editar rutina"
          >
            <Edit3 className="w-4 h-4 text-brand-600" aria-hidden="true" />
            <span>Editar</span>
          </button>

          <button
            type="button"
            onClick={() => onEliminar(rutina)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] min-w-[44px] rounded-xl text-xs font-bold text-slate-700 hover:text-rose-700 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
            aria-label={`Eliminar rutina: ${rutina.titulo}`}
            title="Eliminar rutina"
          >
            <Trash2 className="w-4 h-4 text-rose-600" aria-hidden="true" />
            <span>Eliminar</span>
          </button>
        </div>
      </div>
    </article>
  );
};

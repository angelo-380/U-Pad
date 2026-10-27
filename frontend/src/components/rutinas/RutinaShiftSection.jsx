import React from 'react';
import { RutinaCard } from './RutinaCard.jsx';
import { Sun, Sunset, Moon, Plus } from 'lucide-react';

const SHIFT_CONFIGS = {
  MANANA: {
    title: 'Mañana',
    subtitle: 'Horario matutino (08:00 - 12:00)',
    icon: Sun,
    badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
    iconBg: 'bg-amber-100 text-amber-800',
    containerBg: 'bg-amber-50/20',
    borderColor: 'border-amber-200/60',
    headerBg: 'bg-gradient-to-r from-amber-50 to-white',
    accentText: 'text-amber-900',
  },
  TARDE: {
    title: 'Tarde',
    subtitle: 'Horario vespertino (13:00 - 18:00)',
    icon: Sunset,
    badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    iconBg: 'bg-emerald-100 text-emerald-800',
    containerBg: 'bg-emerald-50/20',
    borderColor: 'border-emerald-200/60',
    headerBg: 'bg-gradient-to-r from-emerald-50 to-white',
    accentText: 'text-emerald-900',
  },
  NOCHE: {
    title: 'Noche',
    subtitle: 'Horario nocturno (19:00 - 22:00)',
    icon: Moon,
    badgeBg: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    iconBg: 'bg-indigo-100 text-indigo-800',
    containerBg: 'bg-indigo-50/20',
    borderColor: 'border-indigo-200/60',
    headerBg: 'bg-gradient-to-r from-indigo-50 to-white',
    accentText: 'text-indigo-900',
  },
};

export const RutinaShiftSection = ({
  shiftKey,
  rutinas = [],
  onEditar,
  onEliminar,
  onCrearEnTurno,
}) => {
  const config = SHIFT_CONFIGS[shiftKey] || SHIFT_CONFIGS.MANANA;
  const IconComponent = config.icon;
  const count = rutinas.length;

  return (
    <section
      aria-labelledby={`shift-heading-${shiftKey}`}
      className={`rounded-3xl border ${config.borderColor} ${config.containerBg} p-5 sm:p-6 transition-all shadow-xs`}
    >
      {/* Encabezado de la Sección de Turno */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-200/60">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-2xl ${config.iconBg} flex items-center justify-center flex-shrink-0 shadow-xs`}
          >
            <IconComponent className="w-5 h-5" aria-hidden="true" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2
                id={`shift-heading-${shiftKey}`}
                className={`text-lg font-extrabold ${config.accentText} tracking-tight`}
              >
                Turno {config.title}
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${config.badgeBg}`}
              >
                {count} {count === 1 ? 'rutina' : 'rutinas'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {config.subtitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onCrearEnTurno(shiftKey)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-xs self-start sm:self-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
        >
          <Plus className="w-3.5 h-3.5 text-brand-600" aria-hidden="true" />
          <span>Añadir a {config.title}</span>
        </button>
      </div>

      {/* Contenido: Tarjetas o estado vacío del turno */}
      {count > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {rutinas.map((rutina) => (
            <RutinaCard
              key={rutina.id}
              rutina={rutina}
              onEditar={onEditar}
              onEliminar={onEliminar}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white/80 rounded-2xl border border-dashed border-slate-200 p-6 text-center flex flex-col items-center justify-center">
          <p className="text-xs font-medium text-slate-500">
            No hay rutinas registradas para el turno de {config.title.toLowerCase()}.
          </p>
          <button
            type="button"
            onClick={() => onCrearEnTurno(shiftKey)}
            className="mt-2.5 inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-800"
          >
            <Plus className="w-3.5 h-3.5" /> Crear rutina en este turno
          </button>
        </div>
      )}
    </section>
  );
};

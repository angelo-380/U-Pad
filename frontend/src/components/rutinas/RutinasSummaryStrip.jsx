import React from 'react';
import { Sun, Sunset, Moon, Layers } from 'lucide-react';

export const RutinasSummaryStrip = ({
  rutinas = [],
  filtroTurno = '',
  onSelectTurno,
}) => {
  const conteoManana = rutinas.filter((r) => r.turno === 'MANANA').length;
  const conteoTarde = rutinas.filter((r) => r.turno === 'TARDE').length;
  const conteoNoche = rutinas.filter((r) => r.turno === 'NOCHE').length;
  const total = rutinas.length;

  const cards = [
    {
      id: '',
      label: 'Total Rutinas',
      count: total,
      sublabel: 'Registradas en el sistema',
      icon: Layers,
      bgColor: 'bg-white',
      borderColor: filtroTurno === '' ? 'border-brand-500 ring-2 ring-brand-200' : 'border-slate-200',
      iconBg: 'bg-brand-50 text-brand-700',
      countColor: 'text-brand-900',
      activeBadge: 'bg-brand-100 text-brand-800',
    },
    {
      id: 'MANANA',
      label: 'Mañana',
      count: conteoManana,
      sublabel: 'Turno matutino (08:00 - 12:00)',
      icon: Sun,
      bgColor: 'bg-amber-50/50',
      borderColor: filtroTurno === 'MANANA' ? 'border-amber-500 ring-2 ring-amber-200' : 'border-amber-200/70',
      iconBg: 'bg-amber-100 text-amber-800',
      countColor: 'text-amber-950',
      activeBadge: 'bg-amber-100 text-amber-900',
    },
    {
      id: 'TARDE',
      label: 'Tarde',
      count: conteoTarde,
      sublabel: 'Turno vespertino (13:00 - 18:00)',
      icon: Sunset,
      bgColor: 'bg-emerald-50/50',
      borderColor: filtroTurno === 'TARDE' ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-emerald-200/70',
      iconBg: 'bg-emerald-100 text-emerald-800',
      countColor: 'text-emerald-950',
      activeBadge: 'bg-emerald-100 text-emerald-900',
    },
    {
      id: 'NOCHE',
      label: 'Noche',
      count: conteoNoche,
      sublabel: 'Turno nocturno (19:00 - 22:00)',
      icon: Moon,
      bgColor: 'bg-indigo-50/50',
      borderColor: filtroTurno === 'NOCHE' ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-indigo-200/70',
      iconBg: 'bg-indigo-100 text-indigo-800',
      countColor: 'text-indigo-950',
      activeBadge: 'bg-indigo-100 text-indigo-900',
    },
  ];

  return (
    <div
      role="region"
      aria-label="Resumen de rutinas por turno"
      className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
    >
      {cards.map((card) => {
        const IconComponent = card.icon;
        const isSelected = filtroTurno === card.id;

        return (
          <button
            key={card.id || 'all'}
            type="button"
            onClick={() => onSelectTurno && onSelectTurno(card.id)}
            aria-pressed={isSelected}
            className={`text-left p-4 rounded-2xl border ${card.bgColor} ${card.borderColor} shadow-xs hover:shadow-sm transition-all flex flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 min-h-[100px] cursor-pointer`}
          >
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-xs font-bold text-slate-700 tracking-wide">
                {card.label}
              </span>
              <div
                className={`w-8 h-8 rounded-xl ${card.iconBg} flex items-center justify-center flex-shrink-0`}
              >
                <IconComponent className="w-4 h-4" aria-hidden="true" />
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-extrabold ${card.countColor} tracking-tight`}>
                {card.count}
              </span>
              <span className="text-[11px] text-slate-500 font-semibold truncate hidden sm:inline">
                {card.count === 1 ? 'rutina' : 'rutinas'}
              </span>
            </div>

            <span className="text-[10px] text-slate-500 mt-1 line-clamp-1">
              {card.sublabel}
            </span>
          </button>
        );
      })}
    </div>
  );
};

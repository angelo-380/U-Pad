import React from 'react';
import { Sun, Sunset, Moon, Layers } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.jsx';

export const RutinasSummaryStrip = ({
  rutinas = [],
  filtroTurno = '',
  onSelectTurno,
}) => {
  const { t } = useLanguage();
  const conteoManana = rutinas.filter((r) => r.turno === 'MANANA').length;
  const conteoTarde = rutinas.filter((r) => r.turno === 'TARDE').length;
  const conteoNoche = rutinas.filter((r) => r.turno === 'NOCHE').length;
  const total = rutinas.length;

  const tabs = [
    {
      id: '',
      label: t('tab_all'),
      count: total,
      icon: Layers,
    },
    {
      id: 'MANANA',
      label: t('tab_morning'),
      count: conteoManana,
      icon: Sun,
    },
    {
      id: 'TARDE',
      label: t('tab_afternoon'),
      count: conteoTarde,
      icon: Sunset,
    },
    {
      id: 'NOCHE',
      label: t('tab_night'),
      count: conteoNoche,
      icon: Moon,
    },
  ];

  return (
    <nav
      role="tablist"
      aria-label="Filtrar rutinas por turno del día"
      className="flex items-center gap-1.5 p-1 bg-tea-cardSubtle rounded-2xl w-full sm:w-auto self-start overflow-x-auto scrollbar-none"
    >
      {tabs.map((tab) => {
        const IconComponent = tab.icon;
        const isSelected = filtroTurno === tab.id;

        return (
          <button
            key={tab.id || 'all'}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelectTurno && onSelectTurno(tab.id)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold transition-tea focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 cursor-pointer whitespace-nowrap ${
              isSelected
                ? 'bg-white text-tea-text shadow-soft font-bold'
                : 'text-tea-muted hover:text-tea-text hover:bg-white/60'
            }`}
          >
            <IconComponent
              className={`w-4 h-4 transition-tea ${
                isSelected ? 'text-brand-600' : 'text-tea-subtle'
              }`}
              aria-hidden="true"
            />
            <span>{tab.label}</span>
            <span
              className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold transition-tea ${
                isSelected
                  ? 'bg-brand-50 text-brand-700'
                  : 'bg-white/80 text-tea-muted'
              }`}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

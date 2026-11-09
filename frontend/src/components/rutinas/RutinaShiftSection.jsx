import React from 'react';
import { RutinaCard } from './RutinaCard.jsx';
import { Sun, Sunset, Moon, Plus } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.jsx';

export const RutinaShiftSection = ({
  shiftKey,
  rutinas = [],
  onEditar,
  onEliminar,
  onCrearEnTurno,
}) => {
  const { t } = useLanguage();
  const count = rutinas.length;

  const SHIFT_CONFIGS = {
    MANANA: {
      title: t('tab_morning'),
      heading: t('shift_morning_title'),
      subtitle: t('shift_morning_sub'),
      icon: Sun,
      iconColor: 'text-amber-700',
      iconBg: 'bg-amber-50',
      badgeBg: 'bg-amber-50 text-amber-900 border-amber-200',
    },
    TARDE: {
      title: t('tab_afternoon'),
      heading: t('shift_afternoon_title'),
      subtitle: t('shift_afternoon_sub'),
      icon: Sunset,
      iconColor: 'text-teal-700',
      iconBg: 'bg-teal-50',
      badgeBg: 'bg-teal-50 text-teal-900 border-teal-200',
    },
    NOCHE: {
      title: t('tab_night'),
      heading: t('shift_night_title'),
      subtitle: t('shift_night_sub'),
      icon: Moon,
      iconColor: 'text-indigo-700',
      iconBg: 'bg-indigo-50',
      badgeBg: 'bg-indigo-50 text-indigo-900 border-indigo-200',
    },
  };

  const config = SHIFT_CONFIGS[shiftKey] || SHIFT_CONFIGS.MANANA;
  const IconComponent = config.icon;

  return (
    <section
      aria-labelledby={`shift-heading-${shiftKey}`}
      className="space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-2xl ${config.iconBg} ${config.iconColor} flex items-center justify-center flex-shrink-0 shadow-soft-xs`}
          >
            <IconComponent className="w-5 h-5" aria-hidden="true" />
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <h2
                id={`shift-heading-${shiftKey}`}
                className="text-xl font-bold text-tea-text tracking-tight"
              >
                {config.heading}
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${config.badgeBg}`}
              >
                {count} {count === 1 ? t('routine_single') : t('routine_plural')}
              </span>
            </div>
            <p className="text-sm text-tea-muted font-normal mt-0.5">
              {config.subtitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onCrearEnTurno(shiftKey)}
          className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-xl text-sm font-semibold text-tea-text hover:text-brand-700 bg-white hover:bg-brand-50 border border-tea-border hover:border-brand-200 transition-tea shadow-soft-xs self-start sm:self-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-brand-600" aria-hidden="true" />
          <span>{t('add_in_shift')} {config.title}</span>
        </button>
      </div>

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
        <div className="p-8 rounded-3xl bg-white border border-tea-border/60 text-center shadow-soft-xs">
          <p className="text-sm text-tea-muted">
            {t('no_routines_in_shift')} {config.title.toLowerCase()}.
          </p>
        </div>
      )}
    </section>
  );
};

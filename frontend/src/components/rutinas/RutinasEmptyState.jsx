import React from 'react';
import { Plus, Sparkles, ArrowRight } from 'lucide-react';
import { ArasaacPictogram } from '../common/ArasaacPictogram.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';

export const RutinasEmptyState = ({
  filtroTurno = '',
  onCrearRutina,
}) => {
  const { t } = useLanguage();

  const getTurnoLabel = (turno) => {
    switch (turno) {
      case 'MANANA':
        return t('the_morning');
      case 'TARDE':
        return t('the_afternoon');
      case 'NOCHE':
        return t('the_night');
      default:
        return t('this_shift');
    }
  };

  const pasosEjemplo = [
    { orden: 1, texto: t('empty_step_1'), palabraClave: 'manos' },
    { orden: 2, texto: t('empty_step_2'), palabraClave: 'desayuno' },
    { orden: 3, texto: t('empty_step_3'), palabraClave: 'dientes' },
  ];

  return (
    <div
      role="region"
      aria-label="Sin rutinas registradas"
      className="p-8 sm:p-12 bg-white rounded-3xl shadow-soft text-center flex flex-col items-center max-w-xl mx-auto border border-tea-border/60"
    >
      {/* Vista previa ilustrada de una rutina modelo con ARASAAC */}
      <div className="w-full bg-tea-calm rounded-2xl p-4 sm:p-5 mb-6 text-left border border-tea-border/50">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('empty_example_badge')}</span>
          </div>
          <span className="text-xs font-medium text-tea-subtle">
            {t('empty_example_turn')}
          </span>
        </div>

        <p className="text-sm font-bold text-tea-text mb-3">
          {t('empty_example_title')}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {pasosEjemplo.map((paso) => (
            <div
              key={paso.orden}
              className="bg-white rounded-xl p-2.5 border border-tea-border/80 flex sm:flex-col items-center sm:text-center gap-2.5 shadow-soft-xs"
            >
              <div className="w-6 h-6 rounded-md bg-brand-50 text-brand-700 text-xs font-extrabold flex items-center justify-center flex-shrink-0">
                {paso.orden}
              </div>
              <ArasaacPictogram
                keyword={paso.palabraClave}
                alt={`Pictograma para: ${paso.texto}`}
                size="md"
              />
              <span className="text-xs font-semibold text-tea-text line-clamp-2 leading-tight">
                {paso.texto}
              </span>
            </div>
          ))}
        </div>
      </div>

      <h3 className="text-xl sm:text-2xl font-extrabold text-tea-text tracking-tight">
        {filtroTurno
          ? `${t('empty_title_filtered')} ${getTurnoLabel(filtroTurno)}`
          : t('empty_title_general')}
      </h3>

      <p className="text-sm sm:text-base text-tea-muted mt-2 max-w-md leading-relaxed">
        {filtroTurno
          ? t('empty_desc_filtered')
          : t('empty_desc_general')}
      </p>

      <button
        type="button"
        onClick={onCrearRutina}
        className="mt-6 inline-flex items-center justify-center gap-2 px-6 py-3.5 min-h-[48px] rounded-2xl bg-brand-600 hover:bg-brand-700 active:scale-98 text-white text-sm font-bold shadow-soft transition-tea focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
      >
        <Plus className="w-5 h-5" aria-hidden="true" />
        <span>{t('empty_btn_create')}</span>
        <ArrowRight className="w-4 h-4 ml-0.5" aria-hidden="true" />
      </button>
    </div>
  );
};

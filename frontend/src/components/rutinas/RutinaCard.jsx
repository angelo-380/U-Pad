import React, { useState } from 'react';
import { ArasaacPictogram } from '../common/ArasaacPictogram.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
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
  const { t, translateDynamicText, language } = useLanguage();

  const getTurnoBadge = (turno) => {
    switch (turno) {
      case 'MANANA':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
            <Sun className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
            {t('tab_morning')}
          </span>
        );
      case 'TARDE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-900 border border-teal-200">
            <Sunset className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
            {t('tab_afternoon')}
          </span>
        );
      case 'NOCHE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-900 border border-indigo-200">
            <Moon className="w-3.5 h-3.5 text-indigo-700" aria-hidden="true" />
            {t('tab_night')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-tea-cardSubtle text-tea-text border border-tea-border">
            {turno}
          </span>
        );
    }
  };

  const formattedDate = rutina.creadoEn
    ? new Date(rutina.creadoEn).toLocaleDateString(language, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null;

  const totalPasos = rutina.pasos?.length || 0;
  const visiblePasos = expandSteps ? rutina.pasos : rutina.pasos?.slice(0, 3) || [];
  const hiddenCount = totalPasos - 3;

  // Título traducido dinámicamente si coincide con vocabulario estándar de rutinas
  const displayTitle = translateDynamicText(rutina.titulo);

  return (
    <article
      aria-labelledby={`rutina-titulo-${rutina.id}`}
      className="bg-white rounded-3xl p-5 sm:p-6 shadow-soft hover:shadow-soft-md transition-tea flex flex-col justify-between border border-tea-border/60"
    >
      <div>
        {/* Cabecera de la tarjeta */}
        <div className="flex items-center justify-between gap-2 mb-3">
          {getTurnoBadge(rutina.turno)}

          {formattedDate && (
            <span className="text-xs text-tea-muted font-medium flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-tea-subtle" aria-hidden="true" />
              {formattedDate}
            </span>
          )}
        </div>

        {/* Título de la Rutina (Traducido) */}
        <h3
          id={`rutina-titulo-${rutina.id}`}
          className="text-lg font-bold text-tea-text tracking-tight mb-2.5 line-clamp-2"
        >
          {displayTitle}
        </h3>

        {/* Metadatos secundarios */}
        <div className="flex items-center gap-2 text-sm text-tea-muted mb-4 font-medium flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-brand-600" aria-hidden="true" />
            <span>{totalPasos} {totalPasos === 1 ? t('visual_step_single') : t('visual_step_plural')}</span>
          </span>

          {rutina.organizacionId && (
            <span className="inline-flex items-center gap-1 text-xs bg-brand-50 text-brand-800 px-2.5 py-0.5 rounded-full font-semibold border border-brand-200/70">
              {t('org_label')} {rutina.organizacionId}
            </span>
          )}

          {rutina.ninoId && (
            <span className="inline-flex items-center gap-1 ml-auto text-xs bg-tea-cardSubtle text-tea-text px-2.5 py-0.5 rounded-full font-semibold border border-tea-border">
              <User className="w-3.5 h-3.5 text-tea-subtle" aria-hidden="true" />
              {rutina.ninoId}
            </span>
          )}
        </div>

        {/* Lista de Pasos con Pictogramas ARASAAC */}
        {rutina.pasos && rutina.pasos.length > 0 ? (
          <div className="space-y-2 mb-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-tea-subtle">
              {t('activity_sequence')}
            </h4>

            <div className="space-y-2">
              {visiblePasos.map((paso, idx) => {
                const keywordToUse = paso.palabraClave || paso.texto;
                const stepNumber = paso.orden || idx + 1;
                const translatedStepText = translateDynamicText(paso.texto);
                const translatedKeyword = translateDynamicText(paso.palabraClave);

                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-2.5 rounded-2xl bg-tea-calm border border-tea-border/60 hover:bg-tea-cardSubtle/60 transition-tea"
                  >
                    {/* Número de paso */}
                    <span
                      aria-label={`${t('step_prefix')} ${stepNumber}`}
                      className="w-7 h-7 rounded-xl bg-brand-50 text-brand-700 text-xs font-extrabold flex items-center justify-center flex-shrink-0"
                    >
                      {stepNumber}
                    </span>

                    {/* Pictograma ARASAAC (utiliza keyword en inglés o español para la API de ARASAAC) */}
                    <ArasaacPictogram
                      keyword={keywordToUse}
                      alt={`Pictograma para: ${translatedStepText}`}
                      size="sm"
                    />

                    {/* Texto de la actividad (Traducido) */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-tea-text truncate">
                        {translatedStepText}
                      </p>
                      {paso.palabraClave && (
                        <p className="text-xs text-tea-subtle truncate">
                          {t('keyword_label')} {translatedKeyword}
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
                className="w-full mt-2 py-2 text-center text-sm font-bold text-brand-700 hover:text-brand-800 flex items-center justify-center gap-1.5 transition-tea rounded-xl hover:bg-brand-50/60 min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                aria-expanded={expandSteps}
              >
                {expandSteps ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    {t('show_less_steps')}
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    {t('see_more_steps')} {hiddenCount} {hiddenCount === 1 ? t('activities_more_single') : t('activities_more_plural')}
                  </>
                )}
              </button>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-tea-calm text-tea-muted text-sm italic text-center mb-4">
            {t('no_steps_configured')}
          </div>
        )}
      </div>

      {/* Botones de acción inferiores */}
      <div className="pt-4 border-t border-tea-border/60 flex items-center justify-between gap-2">
        <span className="text-xs font-mono text-tea-subtle truncate max-w-[120px]">
          ID: {rutina.id.substring(0, 8)}...
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onEditar(rutina)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl text-sm font-bold text-tea-text hover:text-brand-700 bg-tea-calm hover:bg-brand-50 border border-tea-border hover:border-brand-200 transition-tea focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 cursor-pointer"
            aria-label={`${t('btn_edit')} rutina: ${displayTitle}`}
            title={t('btn_edit')}
          >
            <Edit3 className="w-4 h-4 text-brand-600" aria-hidden="true" />
            <span>{t('btn_edit')}</span>
          </button>

          <button
            type="button"
            onClick={() => onEliminar(rutina)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 min-h-[44px] rounded-xl text-sm font-bold text-tea-muted hover:text-rose-700 bg-tea-calm hover:bg-rose-50 border border-tea-border hover:border-rose-200 transition-tea focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 cursor-pointer"
            aria-label={`${t('btn_delete')} rutina: ${displayTitle}`}
            title={t('btn_delete')}
          >
            <Trash2 className="w-4 h-4 text-rose-600" aria-hidden="true" />
            <span>{t('btn_delete')}</span>
          </button>
        </div>
      </div>
    </article>
  );
};

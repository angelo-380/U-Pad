import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Tablet,
  MapPin,
  BarChart2,
  X,
  ArrowRight,
  ArrowLeft,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';

const TUTORIAL_KEY = 'upad_tutorial_visto_v1';

const STEP_ICONS = [BookOpen, Tablet, MapPin, BarChart2];

/**
 * Tutorial interactivo paso a paso. Se muestra automáticamente en el primer login.
 * El usuario puede abrirlo de nuevo con el botón "?" en la barra de navegación.
 */
export const TutorialInteractivo = ({ visible, onClose }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const panelRef = useRef(null);

  const steps = [
    {
      icon: BookOpen,
      titleKey: 'tutorial_step1_title',
      descKey: 'tutorial_step1_desc',
      action: () => navigate('/rutinas'),
      actionKey: 'tutorial_step1_action',
    },
    {
      icon: Tablet,
      titleKey: 'tutorial_step2_title',
      descKey: 'tutorial_step2_desc',
      action: null,
      actionKey: null,
    },
    {
      icon: MapPin,
      titleKey: 'tutorial_step3_title',
      descKey: 'tutorial_step3_desc',
      action: () => navigate('/gps'),
      actionKey: 'tutorial_step3_action',
    },
    {
      icon: BarChart2,
      titleKey: 'tutorial_step4_title',
      descKey: 'tutorial_step4_desc',
      action: () => navigate('/desempeno'),
      actionKey: 'tutorial_step4_action',
    },
  ];

  useEffect(() => {
    if (visible) setStep(0);
  }, [visible]);

  // Trap focus
  useEffect(() => {
    if (visible && panelRef.current) {
      panelRef.current.focus();
    }
  }, [visible]);

  if (!visible) return null;

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;
  const isFirst = step === 0;

  const handleFinish = () => {
    localStorage.setItem(TUTORIAL_KEY, '1');
    onClose();
  };

  const handleSkip = () => {
    localStorage.setItem(TUTORIAL_KEY, '1');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t('tutorial_title')}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-tea-border outline-none overflow-hidden"
      >
        {/* Progress bar */}
        <div className="h-1.5 bg-slate-100">
          <div
            className="h-full bg-brand-500 transition-all duration-500"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="p-7">
          {/* Close */}
          <div className="flex items-center justify-between mb-6">
            <span className="text-xs font-bold text-tea-muted uppercase tracking-wider">
              {t('tutorial_step_label')
                .replace('{actual}', step + 1)
                .replace('{total}', steps.length)}
            </span>
            <button
              type="button"
              onClick={handleSkip}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              {t('tutorial_skip')}
            </button>
          </div>

          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center mb-5 text-brand-600">
            <Icon className="w-8 h-8" />
          </div>

          {/* Content */}
          <h2 className="text-xl font-extrabold text-tea-text mb-2">
            {t(current.titleKey)}
          </h2>
          <p className="text-sm text-tea-muted leading-relaxed mb-6">
            {t(current.descKey)}
          </p>

          {/* Step dots */}
          <div className="flex items-center justify-center gap-1.5 mb-6">
            {steps.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setStep(i)}
                className={`rounded-full transition-all ${
                  i === step
                    ? 'w-6 h-2 bg-brand-500'
                    : 'w-2 h-2 bg-slate-200 hover:bg-slate-300'
                }`}
                aria-label={`${t('tutorial_go_to_step')} ${i + 1}`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              disabled={isFirst}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('tutorial_prev')}
            </button>

            <div className="flex gap-2">
              {current.action && (
                <button
                  type="button"
                  onClick={current.action}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-brand-300 text-brand-700 text-xs font-bold hover:bg-brand-50 transition-colors"
                >
                  {t(current.actionKey)}
                </button>
              )}

              {isLast ? (
                <button
                  type="button"
                  onClick={handleFinish}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {t('tutorial_finish')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep((s) => s + 1)}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition-colors"
                >
                  {t('tutorial_next')}
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Botón flotante "?" para abrir el tutorial en cualquier momento.
 */
export const TutorialButton = ({ onClick }) => {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      onClick={onClick}
      title={t('tutorial_open_btn')}
      className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-brand-50 border border-brand-200 text-brand-600 hover:bg-brand-100 transition-colors"
    >
      <HelpCircle className="w-4 h-4" />
    </button>
  );
};

/** Hook: returns true if the tutorial should auto-open (first visit) */
export const useTutorialAutoShow = () => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem(TUTORIAL_KEY)) {
      // Small delay so the page renders first
      const t = setTimeout(() => setShow(true), 1200);
      return () => clearTimeout(t);
    }
  }, []);
  return [show, setShow];
};

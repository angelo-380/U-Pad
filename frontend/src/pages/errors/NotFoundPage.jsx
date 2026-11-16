import React from 'react';
import { Link } from 'react-router-dom';
import { ImagePlaceholder } from '../../components/common/ImagePlaceholder.jsx';
import { Home, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.jsx';

export const NotFoundPage = () => {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-tea-calm">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-tea-border shadow-sm text-center">
        {/* Contenedor de la Mascota */}
        <div className="w-52 h-52 mx-auto mb-5">
          <ImagePlaceholder
            name="404.png"
            fallbackNames={['pagina-404.png', 'mascota-404-perdido.png', '404.jpg']}
            alt={t('error_404_alt')}
            aspect="aspect-square"
            className="border-none bg-transparent shadow-none"
          />
        </div>

        <span className="text-xs font-mono font-bold text-brand-600 bg-brand-50 px-3 py-1 rounded-full uppercase tracking-wider">
          {t('error_404_badge')}
        </span>

        <h1 className="text-2xl font-extrabold text-tea-text tracking-tight mt-3">
          {t('error_404_title')}
        </h1>

        <p className="text-xs text-tea-muted mt-2 leading-relaxed">
          {t('error_404_desc')}
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <Link
            to="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 shadow-sm transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>{t('error_go_home')}</span>
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('error_go_back')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

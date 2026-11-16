import React from 'react';
import { Link } from 'react-router-dom';
import { ImagePlaceholder } from '../../components/common/ImagePlaceholder.jsx';
import { ShieldX, Home } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.jsx';

export const ForbiddenPage = () => {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-tea-calm">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-tea-border shadow-sm text-center">
        <div className="w-56 mx-auto mb-6">
          <ImagePlaceholder
            name="prohibido.png"
            alt={t('error_403_alt')}
            aspect="aspect-[4/3]"
          />
        </div>

        <span className="text-xs font-mono font-bold text-rose-700 bg-rose-50 px-3 py-1 rounded-full uppercase tracking-wider">
          {t('error_403_badge')}
        </span>

        <h1 className="text-2xl font-extrabold text-tea-text tracking-tight mt-3">
          {t('error_403_title')}
        </h1>

        <p className="text-xs text-tea-muted mt-2 leading-relaxed">
          {t('error_403_desc')}
        </p>

        <div className="mt-6 flex justify-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 shadow-sm transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>{t('error_go_home')}</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

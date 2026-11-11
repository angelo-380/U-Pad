import React, { useState, useEffect } from 'react';
import { arasaacService } from '../../services/arasaacService.js';
import { Sparkles, ImageOff } from 'lucide-react';

const SIZE_MAP = {
  xs: 'w-7 h-7',
  sm: 'w-9 h-9',
  md: 'w-11 h-11',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20',
};

const ICON_SIZE_MAP = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
};

export const ArasaacPictogram = ({
  keyword,
  alt,
  size = 'md',
  className = '',
  showLabel = false,
  directUrl = null,
}) => {
  const [imageUrl, setImageUrl] = useState(directUrl || null);
  const [loading, setLoading] = useState(!directUrl && Boolean(keyword));
  const [hasError, setHasError] = useState(false);

  const containerSizeClass = SIZE_MAP[size] || SIZE_MAP.md;
  const iconSizeClass = ICON_SIZE_MAP[size] || ICON_SIZE_MAP.md;

  useEffect(() => {
    let isMounted = true;

    if (directUrl) {
      setImageUrl(directUrl);
      setLoading(false);
      setHasError(false);
      return;
    }

    if (!keyword || !keyword.trim()) {
      setImageUrl(null);
      setLoading(false);
      setHasError(false);
      return;
    }

    const cleanKeyword = keyword.trim().toLowerCase();
    setLoading(true);
    setHasError(false);

    arasaacService
      .getPictogramByKeyword(cleanKeyword, 'es')
      .then((result) => {
        if (!isMounted) return;
        if (result && result.url) {
          setImageUrl(result.url);
        } else {
          setImageUrl(null);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setImageUrl(null);
        setHasError(true);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [keyword, directUrl]);

  const accessibleAlt = alt || (keyword ? `Pictograma ARASAAC para ${keyword}` : 'Pictograma visual');

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div
        className={`${containerSizeClass} flex-shrink-0 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-center p-1 overflow-hidden transition-all`}
        title={keyword ? `Pictograma: ${keyword}` : undefined}
      >
        {loading ? (
          <div
            className="w-full h-full bg-slate-100 rounded-lg animate-pulse motion-reduce:animate-none flex items-center justify-center"
            aria-label="Cargando pictograma..."
          >
            <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
          </div>
        ) : imageUrl && !hasError ? (
          <img
            src={imageUrl}
            alt={accessibleAlt}
            loading="lazy"
            onError={() => setHasError(true)}
            className="w-full h-full object-contain filter contrast-105"
          />
        ) : (
          <div
            className="w-full h-full bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 border border-dashed border-slate-200"
            aria-label={keyword ? `Sin pictograma para: ${keyword}` : 'Sin palabra clave'}
          >
            {hasError ? (
              <ImageOff className={`${iconSizeClass} text-slate-300`} aria-hidden="true" />
            ) : (
              <Sparkles className={`${iconSizeClass} text-brand-300`} aria-hidden="true" />
            )}
          </div>
        )}
      </div>

      {showLabel && keyword && (
        <span className="text-[10px] text-tea-muted font-medium truncate max-w-[70px] mt-0.5">
          {keyword}
        </span>
      )}
    </div>
  );
};

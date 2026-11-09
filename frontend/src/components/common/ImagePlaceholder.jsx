import React, { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

/**
 * Componente ImagePlaceholder:
 * - Contenedor con aspecto fijo (evita desplazamientos acumulados CLS).
 * - Intenta cargar la imagen desde /images/{name} o la lista de fallbacks.
 * - Si no existe aún, muestra un contenedor neutral con el nombre del archivo esperado.
 */
export const ImagePlaceholder = ({
  name,
  fallbackNames = [],
  alt = 'Espacio reservado para imagen',
  aspect = 'aspect-video',
  className = '',
}) => {
  const [candidateIndex, setCandidateIndex] = useState(0);
  const candidates = [name, ...fallbackNames];

  const currentName = candidates[candidateIndex] || name;
  const isExhausted = candidateIndex >= candidates.length;

  const handleImageError = () => {
    setCandidateIndex((prev) => prev + 1);
  };

  return (
    <div
      className={`relative w-full ${aspect} rounded-2xl overflow-hidden flex items-center justify-center transition-all ${className}`}
    >
      {!isExhausted ? (
        <img
          src={`/images/${currentName}`}
          alt={alt}
          loading="lazy"
          onError={handleImageError}
          className="w-full h-full object-contain"
        />
      ) : (
        <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500 bg-slate-100 border border-slate-200 rounded-2xl w-full h-full">
          <div className="p-3 bg-white rounded-full shadow-sm mb-2 border border-slate-200">
            <ImageIcon className="w-6 h-6 text-brand-600" aria-hidden="true" />
          </div>
          <span className="text-xs font-bold text-slate-700 font-mono tracking-tight bg-slate-200/80 px-2 py-0.5 rounded">
            /images/{name}
          </span>
          <span className="text-xs text-slate-500 mt-1 max-w-[200px] line-clamp-2">
            {alt}
          </span>
        </div>
      )}
    </div>
  );
};

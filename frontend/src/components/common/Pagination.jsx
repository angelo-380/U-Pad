import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Componente visual de paginación para U-Pad Web (Entrega 80%).
 * Permite cambiar de página, ver el total de elementos y seleccionar tamaño de página.
 */
export const Pagination = ({
  page = 1,
  limit = 10,
  total = 0,
  totalPages = 1,
  hasNext = false,
  hasPrev = false,
  onPageChange,
  onLimitChange,
}) => {
  if (total === 0) return null;

  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  // Generar números de página a mostrar
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2 border-t border-tea-border text-sm text-tea-muted">
      {/* Información de rango actual */}
      <div className="flex items-center gap-3">
        <span>
          Mostrando <strong className="text-tea-text">{startItem}</strong> -{' '}
          <strong className="text-tea-text">{endItem}</strong> de{' '}
          <strong className="text-tea-text">{total}</strong> rutinas
        </span>

        {/* Selector de límite por página */}
        {onLimitChange && (
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-xs">Por página:</span>
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="bg-white border border-tea-border text-tea-text text-xs rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-600 cursor-pointer"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        )}
      </div>

      {/* Controles de navegación */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev}
          className="p-2 rounded-lg border border-tea-border bg-white hover:bg-tea-cardSubtle disabled:opacity-40 disabled:cursor-not-allowed text-tea-text transition-colors flex items-center justify-center cursor-pointer"
          title="Página anterior"
          aria-label="Página anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {getPageNumbers().map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => onPageChange(num)}
            className={`min-w-[36px] h-9 px-3 rounded-lg font-medium text-xs transition-colors flex items-center justify-center cursor-pointer ${
              num === page
                ? 'bg-brand-600 text-white font-bold shadow-soft-xs'
                : 'bg-white border border-tea-border text-tea-text hover:bg-tea-cardSubtle'
            }`}
          >
            {num}
          </button>
        ))}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
          className="p-2 rounded-lg border border-tea-border bg-white hover:bg-tea-cardSubtle disabled:opacity-40 disabled:cursor-not-allowed text-tea-text transition-colors flex items-center justify-center cursor-pointer"
          title="Página siguiente"
          aria-label="Página siguiente"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

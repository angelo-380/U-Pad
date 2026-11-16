import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.jsx';

/**
 * Números de página a mostrar: primera, última y la actual ±vecinas, con '…' en los huecos.
 * Ejemplo (actual 6 de 128): [1, '…', 4, 5, 6, 7, 8, '…', 128]. Tamaño acotado sin importar el total.
 */
export const paginasVisibles = (actual, total, vecinas = 2) => {
  if (total <= 1) return [1];
  const paginas = new Set([1, total]);
  for (let p = actual - vecinas; p <= actual + vecinas; p += 1) {
    if (p >= 1 && p <= total) paginas.add(p);
  }
  const ordenadas = [...paginas].sort((a, b) => a - b);
  const resultado = [];
  ordenadas.forEach((p, i) => {
    if (i > 0 && p - ordenadas[i - 1] > 1) resultado.push(`hueco-${p}`);
    resultado.push(p);
  });
  return resultado;
};

/**
 * Barra de paginación reutilizable. No se rompe con muchas páginas (p. ej. 128).
 * - page, totalPages, total: estado de la paginación del backend.
 * - onChange(pagina): se llama con la página elegida.
 * - etiquetaTotal: texto del total (p. ej. «rutinas»).
 */
export const Paginacion = ({ page, totalPages, total, onChange, disabled = false, etiquetaTotal = '' }) => {
  const { t } = useLanguage();
  if (!totalPages || totalPages <= 1) return null;

  const ir = (p) => {
    if (!disabled && p >= 1 && p <= totalPages && p !== page) onChange(p);
  };

  const botonBase =
    'inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-tea-border bg-white text-xs font-bold text-tea-text hover:bg-tea-cardSubtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer';

  return (
    <nav
      aria-label={t('pagination_label')}
      className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-tea-border"
    >
      <span className="text-xs text-tea-muted font-medium">
        {t('pagination_page')} <strong>{page}</strong> {t('pagination_of')} <strong>{totalPages}</strong>
        {typeof total === 'number' && (
          <>
            {' '}
            ({total.toLocaleString()} {etiquetaTotal})
          </>
        )}
      </span>

      <div className="flex items-center gap-2 flex-wrap justify-center">
        <button type="button" onClick={() => ir(page - 1)} disabled={disabled || page <= 1} className={botonBase}>
          <ChevronLeft className="w-4 h-4" />
          <span>{t('pagination_prev')}</span>
        </button>

        <div className="flex items-center gap-1">
          {paginasVisibles(page, totalPages).map((p) =>
            typeof p === 'string' ? (
              <span key={p} className="w-6 text-center text-xs text-tea-subtle" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => ir(p)}
                disabled={disabled}
                aria-current={p === page ? 'page' : undefined}
                className={`min-w-[2rem] h-8 px-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  p === page ? 'bg-brand-600 text-white shadow-soft-xs' : 'text-tea-muted hover:bg-tea-cardSubtle'
                }`}
              >
                {p}
              </button>
            )
          )}
        </div>

        <button type="button" onClick={() => ir(page + 1)} disabled={disabled || page >= totalPages} className={botonBase}>
          <span>{t('pagination_next')}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
};

export default Paginacion;

/**
 * Servicio para consultar y cachear pictogramas abiertos de ARASAAC.
 * API oficial: https://api.arasaac.org/
 * CDN oficial: https://static.arasaac.org/pictograms/{id}/{id}_{size}.png
 *
 * Utiliza el idioma español ('es') por defecto para coincidir con las palabras clave de la aplicación.
 */

const ARASAAC_API_BASE = 'https://api.arasaac.org/api';
const ARASAAC_STATIC_BASE = 'https://static.arasaac.org/pictograms';

// Cache en memoria para evitar llamadas redundantes de red
const pictogramCache = new Map();
const searchCache = new Map();

export const arasaacService = {
  /**
   * Obtiene la URL completa del pictograma en tamaño 300 o 500 px.
   */
  getPictogramUrl(id, size = 300) {
    if (!id) return null;
    return `${ARASAAC_STATIC_BASE}/${id}/${id}_${size}.png`;
  },

  /**
   * Busca pictogramas por palabra clave en ARASAAC (idioma español por defecto).
   * Retorna una lista de coincidencias con su _id, keywords y URL de imagen.
   */
  async searchPictograms(keyword, locale = 'es') {
    if (!keyword || typeof keyword !== 'string') return [];
    const term = keyword.trim().toLowerCase();
    if (!term) return [];

    const lang = locale || 'es';
    const cacheKey = `${lang}:${term}`;
    if (searchCache.has(cacheKey)) {
      return searchCache.get(cacheKey);
    }

    try {
      const url = `${ARASAAC_API_BASE}/pictograms/${lang}/search/${encodeURIComponent(term)}`;
      const res = await fetch(url);

      if (!res.ok) {
        // Si no se encuentra (404), cacheamos arreglo vacío sin ruido
        searchCache.set(cacheKey, []);
        return [];
      }

      const data = await res.json();
      if (!Array.isArray(data)) {
        searchCache.set(cacheKey, []);
        return [];
      }

      const formatted = data.map((item) => ({
        id: item._id,
        url: this.getPictogramUrl(item._id, 300),
        keywords: item.keywords?.map((k) => k.keyword) || [],
      }));

      searchCache.set(cacheKey, formatted);
      return formatted;
    } catch {
      // Si falla la red o da error, retornamos vacío de manera silenciosa
      searchCache.set(cacheKey, []);
      return [];
    }
  },

  /**
   * Obtiene el pictograma más representativo para una palabra clave (locale 'es' por defecto).
   * Retorna { id, url, keyword } o null si no se encuentra.
   */
  async getPictogramByKeyword(keyword, locale = 'es') {
    if (!keyword || typeof keyword !== 'string') return null;
    const term = keyword.trim().toLowerCase();
    if (!term) return null;

    const lang = locale || 'es';
    const cacheKey = `${lang}:${term}`;
    if (pictogramCache.has(cacheKey)) {
      return pictogramCache.get(cacheKey);
    }

    const results = await this.searchPictograms(term, lang);
    if (results && results.length > 0) {
      const best = results[0];
      const match = {
        id: best.id,
        url: best.url,
        keyword: term,
      };
      pictogramCache.set(cacheKey, match);
      return match;
    }

    // Si contiene varias palabras o guiones, probar con la primera palabra significativa
    const firstWord = term.split(/[\s_-]+/)[0];
    if (firstWord && firstWord !== term) {
      const fallbackResults = await this.searchPictograms(firstWord, lang);
      if (fallbackResults && fallbackResults.length > 0) {
        const best = fallbackResults[0];
        const match = {
          id: best.id,
          url: best.url,
          keyword: firstWord,
        };
        pictogramCache.set(cacheKey, match);
        return match;
      }
    }

    pictogramCache.set(cacheKey, null);
    return null;
  },
};

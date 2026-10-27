/**
 * Servicio para consultar y cachear pictogramas abiertos de ARASAAC.
 * API oficial: https://api.arasaac.org/
 * CDN oficial: https://static.arasaac.org/pictograms/{id}/{id}_{size}.png
 *
 * Utiliza el idioma inglés ('en') según requerimiento.
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
   * Busca pictogramas por palabra clave en ARASAAC (idioma inglés por defecto).
   * Retorna una lista de coincidencias con su _id, keywords y URL de imagen.
   */
  async searchPictograms(keyword, locale = 'en') {
    if (!keyword || typeof keyword !== 'string') return [];
    const term = keyword.trim().toLowerCase();
    if (!term) return [];

    const cacheKey = `${locale}:${term}`;
    if (searchCache.has(cacheKey)) {
      return searchCache.get(cacheKey);
    }

    try {
      const url = `${ARASAAC_API_BASE}/pictograms/${locale}/search/${encodeURIComponent(term)}`;
      const res = await fetch(url);

      if (!res.ok) {
        // Si no se encuentra (404), cacheamos arreglo vacío
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
    } catch (err) {
      console.warn(`[ARASAAC] Error buscando "${term}":`, err.message);
      return [];
    }
  },

  /**
   * Obtiene el pictograma más representativo para una palabra clave (locale 'en').
   * Retorna { id, url, keyword } o null si no se encuentra.
   */
  async getPictogramByKeyword(keyword, locale = 'en') {
    if (!keyword || typeof keyword !== 'string') return null;
    const term = keyword.trim().toLowerCase();
    if (!term) return null;

    const cacheKey = `${locale}:${term}`;
    if (pictogramCache.has(cacheKey)) {
      return pictogramCache.get(cacheKey);
    }

    const results = await this.searchPictograms(term, locale);
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

    // Si no encontró en inglés directo, probamos con una palabra limpia
    // (por ejemplo si contiene guiones o múltiples palabras, tomamos la primera)
    const firstWord = term.split(/[\s_-]+/)[0];
    if (firstWord && firstWord !== term) {
      const fallbackResults = await this.searchPictograms(firstWord, locale);
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

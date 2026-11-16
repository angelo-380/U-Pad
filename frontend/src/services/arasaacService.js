/**
 * Servicio para consultar y cachear pictogramas abiertos de ARASAAC.
 * API oficial: https://api.arasaac.org/
 * CDN oficial: https://static.arasaac.org/pictograms/{id}/{id}_{size}.png
 *
 * Busca en español ('es'): las palabras clave de las rutinas se escriben en español.
 * Las búsquedas sin resultado o fallidas también se guardan en caché para no repetirlas.
 */

const ARASAAC_API_BASE = 'https://api.arasaac.org/api';
const ARASAAC_STATIC_BASE = 'https://static.arasaac.org/pictograms';

// Cache en memoria para evitar llamadas redundantes de red
const pictogramCache = new Map();
const searchCache = new Map();

// Palabras sin contenido que no se buscan solas
const PALABRAS_VACIAS = new Set(['el', 'la', 'los', 'las', 'lo', 'de', 'del', 'al', 'a', 'y', 'e', 'o', 'en', 'con', 'por', 'para', 'un', 'una', 'unos', 'unas', 'mi', 'mis', 'tu', 'su', 'sus', 'se', 'me', 'te']);

// «lavarse» → «lavar», «ponerse» → «poner», «vestirse» → «vestir»
const sinReflexivo = (texto) => texto.replace(/(ar|er|ir)se\b/g, '$1');

/** Candidatos de búsqueda en orden de preferencia, sin repetidos (ver getPictogramByKeyword). */
export const candidatosPictograma = (term) => {
  const lista = [term, sinReflexivo(term)];
  const palabras = term.split(/[\s,.;:_-]+/).filter((p) => p.length > 2 && !PALABRAS_VACIAS.has(p));
  for (const palabra of [...palabras].reverse()) {
    lista.push(palabra, sinReflexivo(palabra));
  }
  return [...new Set(lista.filter(Boolean))];
};

export const arasaacService = {
  /**
   * Obtiene la URL completa del pictograma en tamaño 300 o 500 px.
   */
  getPictogramUrl(id, size = 300) {
    if (!id) return null;
    return `${ARASAAC_STATIC_BASE}/${id}/${id}_${size}.png`;
  },

  /**
   * Busca pictogramas por palabra clave en ARASAAC (español por defecto).
   * Retorna una lista de coincidencias con su _id, keywords y URL de imagen.
   */
  async searchPictograms(keyword, locale = 'es') {
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
      // Sin red o error del servicio: se recuerda como vacía para no repetir la búsqueda
      searchCache.set(cacheKey, []);
      return [];
    }
  },

  /**
   * bestsearch de ARASAAC: devuelve SOLO coincidencias buenas (404 si no hay). Con caché, incluida la vacía.
   */
  async bestSearch(term, locale = 'es') {
    const cacheKey = `best:${locale}:${term}`;
    if (searchCache.has(cacheKey)) return searchCache.get(cacheKey);
    let resultado = null;
    try {
      const res = await fetch(`${ARASAAC_API_BASE}/pictograms/${locale}/bestsearch/${encodeURIComponent(term)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) resultado = data[0]._id;
      }
    } catch (err) {
      resultado = null;
    }
    searchCache.set(cacheKey, resultado);
    return resultado;
  },

  /**
   * Obtiene el pictograma más representativo para una palabra clave o frase (español por defecto).
   * Retorna { id, url, keyword } o null si no se encuentra.
   *
   * Orden de búsqueda (probado contra la API; el mismo algoritmo usa la app Android):
   *   1. bestsearch de la frase completa («cepillar los dientes»);
   *   2. la frase sin el «se» de los verbos («lavarse las manos» → «lavar las manos»): ARASAAC no los indexa;
   *   3. cada palabra con contenido, de la ÚLTIMA a la primera (el sustantivo suele ir al final:
   *      «tomar desayuno» → «desayuno»), también sin el «se»;
   *   4. como último recurso, la búsqueda aproximada de la frase.
   */
  async getPictogramByKeyword(keyword, locale = 'es') {
    if (!keyword || typeof keyword !== 'string') return null;
    const term = keyword.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!term) return null;

    const cacheKey = `${locale}:${term}`;
    if (pictogramCache.has(cacheKey)) {
      return pictogramCache.get(cacheKey);
    }

    const match = async () => {
      for (const candidato of candidatosPictograma(term)) {
        const id = await this.bestSearch(candidato, locale);
        if (id) return { id, url: this.getPictogramUrl(id, 300), keyword: candidato };
      }
      const aproximados = await this.searchPictograms(term, locale);
      if (aproximados.length > 0) return { id: aproximados[0].id, url: aproximados[0].url, keyword: term };
      return null;
    };

    const resultado = await match();
    pictogramCache.set(cacheKey, resultado);
    return resultado;
  },
};

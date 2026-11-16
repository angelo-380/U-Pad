import { AppError } from './AppError.js';

/**
 * Pasos de una rutina (puntos 12-14 del docente): cada paso tiene su texto, la palabra para buscar su pictograma
 * y los minutos que fija el padre. La duración de la rutina es la suma de sus pasos.
 *
 * Formato guardado (columna rutinas.pasos, JSON):
 *   [{ orden, texto, palabraClave, duracionMinutos, pictogramaId? }]
 * Las rutinas antiguas sin duración se leen con DURACION_POR_DEFECTO minutos por paso.
 */
export const PASOS_MAX = 20;
export const TEXTO_PASO_MAX = 120;
export const DURACION_MIN = 1;
export const DURACION_MAX = 120;
export const DURACION_POR_DEFECTO = 5;

const errorPasos = (mensaje, detalles = {}) =>
  new AppError(mensaje, 400, { field: 'pasos', code: 'PASOS_INVALIDOS', ...detalles });

const textoDe = (paso) => {
  if (typeof paso === 'string') return paso;
  if (paso && typeof paso === 'object') return paso.texto ?? paso.descripcion ?? paso.titulo ?? '';
  return '';
};

/**
 * Valida y normaliza los pasos que envía un cliente. Sin pasos (lista vacía o ausente), la rutina tiene un único
 * paso con su título. Lanza 400 PASOS_INVALIDOS si algo no cumple las reglas.
 */
export const normalizarPasos = (pasos, tituloRespaldo) => {
  if (pasos !== undefined && pasos !== null && !Array.isArray(pasos)) {
    throw errorPasos('Los pasos deben enviarse como una lista.');
  }
  const lista = Array.isArray(pasos) ? pasos : [];
  if (lista.length === 0) {
    const texto = String(tituloRespaldo || '').trim().slice(0, TEXTO_PASO_MAX);
    return [{ orden: 1, texto, palabraClave: texto.toLowerCase(), duracionMinutos: DURACION_POR_DEFECTO }];
  }
  if (lista.length > PASOS_MAX) {
    throw errorPasos(`Una rutina admite como máximo ${PASOS_MAX} pasos.`, { maximo: PASOS_MAX });
  }

  return lista.map((paso, indice) => {
    const texto = typeof textoDe(paso) === 'string' ? textoDe(paso).trim().replace(/\s+/g, ' ') : '';
    if (!texto || texto.length > TEXTO_PASO_MAX) {
      throw errorPasos(`El paso ${indice + 1} necesita un texto de 1 a ${TEXTO_PASO_MAX} caracteres.`, { paso: indice + 1 });
    }

    const crudo = paso && typeof paso === 'object' ? paso.duracionMinutos : undefined;
    let duracionMinutos = DURACION_POR_DEFECTO;
    if (crudo !== undefined && crudo !== null && crudo !== '') {
      duracionMinutos = Number(crudo);
      if (!Number.isInteger(duracionMinutos) || duracionMinutos < DURACION_MIN || duracionMinutos > DURACION_MAX) {
        throw errorPasos(`Los minutos del paso ${indice + 1} deben ser un entero de ${DURACION_MIN} a ${DURACION_MAX}.`, {
          paso: indice + 1,
        });
      }
    }

    const clave = paso && typeof paso === 'object' && typeof paso.palabraClave === 'string' ? paso.palabraClave.trim() : '';
    const normalizado = {
      orden: indice + 1,
      texto,
      palabraClave: (clave || texto).toLowerCase().slice(0, TEXTO_PASO_MAX),
      duracionMinutos,
    };
    const pictogramaId = paso && typeof paso === 'object' ? Number(paso.pictogramaId) : NaN;
    if (Number.isInteger(pictogramaId) && pictogramaId > 0) normalizado.pictogramaId = pictogramaId;
    return normalizado;
  });
};

/** Lee los pasos guardados (JSON o lista) y completa los datos que faltan en las rutinas antiguas. Nunca lanza. */
export const leerPasos = (valor, titulo = '') => {
  let lista = valor;
  if (typeof valor === 'string') {
    try {
      lista = JSON.parse(valor || '[]');
    } catch (e) {
      lista = [];
    }
  }
  if (!Array.isArray(lista)) lista = [];
  const pasos = lista
    .map((paso) => {
      const texto = String(textoDe(paso) || '').trim();
      if (!texto) return null;
      const minutos = Number(paso?.duracionMinutos);
      const resultado = {
        ...(paso && typeof paso === 'object' ? paso : {}),
        texto,
        palabraClave: String(paso?.palabraClave || texto).toLowerCase(),
        duracionMinutos:
          Number.isInteger(minutos) && minutos >= DURACION_MIN && minutos <= DURACION_MAX ? minutos : DURACION_POR_DEFECTO,
      };
      return resultado;
    })
    .filter(Boolean)
    .map((paso, indice) => ({ ...paso, orden: indice + 1 }));
  // Rutina antigua guardada sin pasos: el niño la hace como un único paso con su título
  if (pasos.length === 0 && String(titulo || '').trim()) {
    const texto = String(titulo).trim();
    return [{ orden: 1, texto, palabraClave: texto.toLowerCase(), duracionMinutos: DURACION_POR_DEFECTO }];
  }
  return pasos;
};

/** Suma de los minutos de los pasos. */
export const duracionTotal = (pasos) => (Array.isArray(pasos) ? pasos.reduce((t, p) => t + (Number(p.duracionMinutos) || 0), 0) : 0);

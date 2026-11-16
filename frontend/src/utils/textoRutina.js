/**
 * Regla de caracteres del título y de los pasos de una rutina. Es la misma del backend
 * (backend/src/utils/textoRutina.js), que es la autoridad; aquí solo se usa para avisar mientras se escribe.
 * Solo letras (con tildes, ü y ñ), números, espacios y el guion «-»; sin dos guiones seguidos;
 * empieza y termina con letra o número.
 */
export const TITULO_MIN = 3;
export const TITULO_MAX = 60;
export const TITULO_GUIONES_MAX = 4;
export const PASO_TEXTO_MAX = 120;
export const PASO_GUIONES_MAX = 6;

const PERMITIDO = /^[\p{L}\p{N} -]$/u;
const LETRA_O_NUMERO = /[\p{L}\p{N}]/u;

export const limpiarTexto = (texto) => (typeof texto === 'string' ? texto.trim().replace(/\s+/g, ' ') : '');

/** Caracteres no permitidos del texto, sin repetir (para decir cuáles quitar). */
export const signosNoPermitidos = (texto) => [...new Set([...String(texto || '')].filter((c) => !PERMITIDO.test(c)))];

/**
 * null si el texto cumple; si no, { clave, vars } para t().
 * Las claves son comunes a título y pasos: rutina_texto_longitud, rutina_texto_signos, rutina_texto_bordes,
 * rutina_texto_guiones_seguidos y rutina_texto_guiones_max.
 */
export const errorTexto = (texto, { min, max, guionesMax }) => {
  const limpio = limpiarTexto(texto);
  // Primero los signos: es lo que más ayuda mientras se escribe
  const signos = signosNoPermitidos(limpio);
  if (signos.length > 0) return { clave: 'rutina_texto_signos', vars: { signos: signos.join(' ') } };
  if (limpio.length < min || limpio.length > max) return { clave: 'rutina_texto_longitud', vars: { min, max } };
  if (!LETRA_O_NUMERO.test(limpio[0]) || !LETRA_O_NUMERO.test(limpio[limpio.length - 1])) {
    return { clave: 'rutina_texto_bordes', vars: {} };
  }
  if (/-\s*-/.test(limpio)) return { clave: 'rutina_texto_guiones_seguidos', vars: {} };
  if ((limpio.match(/-/g) || []).length > guionesMax) return { clave: 'rutina_texto_guiones_max', vars: { max: guionesMax } };
  return null;
};

export const errorTitulo = (titulo) =>
  errorTexto(titulo, { min: TITULO_MIN, max: TITULO_MAX, guionesMax: TITULO_GUIONES_MAX });

export const errorPaso = (texto) => errorTexto(texto, { min: 1, max: PASO_TEXTO_MAX, guionesMax: PASO_GUIONES_MAX });

import { AppError } from './AppError.js';

/**
 * Textos de una rutina que ve el niño (título y texto de cada paso). Decisión del usuario (16-nov-2026):
 *   - solo letras (con tildes, ü y ñ), números, espacios y el guion «-»: ningún otro signo;
 *   - título de 3 a 60 caracteres con como máximo 4 guiones; cada paso de 1 a 120 con como máximo 6;
 *   - sin dos guiones seguidos, y el texto empieza y termina por letra o número;
 *   - los espacios repetidos se juntan en uno.
 * La web (RutinaDrawer) y la app (CreateRoutineScreen) repiten esta regla para avisar mientras se escribe;
 * el backend es la autoridad.
 */
export const TITULO_MIN = 3;
export const TITULO_MAX = 60;
export const TITULO_GUIONES_MAX = 4;
export const PASO_TEXTO_MAX = 120;
export const PASO_GUIONES_MAX = 6;

const PERMITIDO = /^[\p{L}\p{N} -]+$/u;
const LETRA_O_NUMERO = /[\p{L}\p{N}]/u;

/** Junta los espacios y quita los de los extremos. */
export const limpiarTexto = (texto) => (typeof texto === 'string' ? texto.trim().replace(/\s+/g, ' ') : '');

/**
 * Devuelve null si el texto cumple la regla o el motivo (en español) si no.
 * `min`, `max` y `guionesMax` cambian entre título y paso.
 */
export const motivoTextoInvalido = (texto, { min, max, guionesMax, nombre }) => {
  const limpio = limpiarTexto(texto);
  if (limpio.length < min || limpio.length > max) {
    return min === 1
      ? `${nombre} debe tener de 1 a ${max} caracteres.`
      : `${nombre} debe tener de ${min} a ${max} caracteres.`;
  }
  if (!PERMITIDO.test(limpio)) {
    const signos = [...new Set([...limpio].filter((c) => !PERMITIDO.test(c)))].join(' ');
    return `${nombre} solo admite letras, números, espacios y el guion (-). No se permite: ${signos}`;
  }
  if (!LETRA_O_NUMERO.test(limpio[0]) || !LETRA_O_NUMERO.test(limpio[limpio.length - 1])) {
    return `${nombre} debe empezar y terminar con una letra o un número.`;
  }
  if (/-\s*-/.test(limpio)) {
    return `${nombre} no puede tener dos guiones seguidos.`;
  }
  const guiones = (limpio.match(/-/g) || []).length;
  if (guiones > guionesMax) {
    return `${nombre} admite como máximo ${guionesMax} guiones.`;
  }
  return null;
};

/** Valida y devuelve el título limpio. Lanza 400 TITULO_INVALIDO. */
export const validarTitulo = (titulo, campo = 'titulo') => {
  const motivo = motivoTextoInvalido(titulo, {
    min: TITULO_MIN,
    max: TITULO_MAX,
    guionesMax: TITULO_GUIONES_MAX,
    nombre: 'El título',
  });
  if (motivo) throw new AppError(motivo, 400, { field: campo, code: 'TITULO_INVALIDO' });
  return limpiarTexto(titulo);
};

/** Motivo por el que el texto de un paso no vale, o null. */
export const motivoPasoInvalido = (texto, numeroPaso) =>
  motivoTextoInvalido(texto, {
    min: 1,
    max: PASO_TEXTO_MAX,
    guionesMax: PASO_GUIONES_MAX,
    nombre: `El paso ${numeroPaso}`,
  });

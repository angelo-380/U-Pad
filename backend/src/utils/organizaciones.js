import crypto from 'node:crypto';

/**
 * Utilidades de organizaciones (instituciones: colegios y centros).
 *
 * Reciben la conexión SQLite como parámetro (no importan config/database.js), de modo que
 * sirven al servidor, a la migración de datos y a los tests con bases en memoria.
 */

// Alfabeto sin caracteres ambiguos (sin I, O, 0 ni 1): 32 símbolos, 8 posiciones ≈ 2^40 combinaciones
export const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const LONGITUD_CODIGO = 8;

const MAX_INTENTOS_CODIGO = 10;

/** Genera un código de organización aleatorio criptográficamente seguro (ej. K7M2Q9XD). */
export const generarCodigo = () => {
  let codigo = '';
  for (let i = 0; i < LONGITUD_CODIGO; i += 1) {
    codigo += ALFABETO_CODIGO[crypto.randomInt(ALFABETO_CODIGO.length)];
  }
  return codigo;
};

/**
 * Normaliza un código ingresado por una persona: mayúsculas y sin guiones, espacios u otros símbolos.
 * Devuelve null si no es un string o si no tiene el formato válido (8 caracteres del alfabeto).
 */
export const normalizarCodigo = (valor) => {
  if (typeof valor !== 'string') return null;
  const limpio = valor.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (limpio.length !== LONGITUD_CODIGO) return null;
  for (const caracter of limpio) {
    if (!ALFABETO_CODIGO.includes(caracter)) return null;
  }
  return limpio;
};

/** Formato para mostrar al usuario: K7M2-Q9XD. */
export const formatearCodigo = (codigo) => {
  if (typeof codigo !== 'string' || codigo.length !== LONGITUD_CODIGO) return codigo;
  return `${codigo.slice(0, 4)}-${codigo.slice(4)}`;
};

/** Identificador de organización (mismo patrón que los demás ids: prefijo + 16 hex). */
export const generarIdOrganizacion = () => `org_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

const esColisionDeCodigo = (error) => String(error?.message || '').includes('organizaciones.codigo');

/**
 * Crea una organización con un código único (reintenta si el código generado ya existe).
 * @param conexion DatabaseSync
 * @param datos { nombre, propietarioId?, id? } (id solo lo usa la migración para conservar ids existentes)
 * @param generador función generadora de códigos (inyectable para pruebas)
 * @returns { id, nombre, codigo, propietarioId, creadoEn }
 */
export const crearOrganizacion = (conexion, { nombre, propietarioId = null, id = null }, generador = generarCodigo) => {
  const organizacion = {
    id: id || generarIdOrganizacion(),
    nombre: String(nombre).trim(),
    propietarioId,
    creadoEn: new Date().toISOString(),
  };

  for (let intento = 0; intento < MAX_INTENTOS_CODIGO; intento += 1) {
    const codigo = generador();
    try {
      conexion.prepare(`
        INSERT INTO organizaciones (id, nombre, codigo, propietarioId, creadoEn)
        VALUES (?, ?, ?, ?, ?)
      `).run(organizacion.id, organizacion.nombre, codigo, organizacion.propietarioId, organizacion.creadoEn);
      return { ...organizacion, codigo };
    } catch (error) {
      if (!esColisionDeCodigo(error)) throw error;
    }
  }

  throw new Error('No fue posible generar un código de organización único.');
};

/** Busca una organización por el código que escribió una persona (con cualquier formato). */
export const buscarPorCodigo = (conexion, codigoIngresado) => {
  const codigo = normalizarCodigo(codigoIngresado);
  if (!codigo) return null;
  return conexion.prepare('SELECT id, nombre, codigo, propietarioId, creadoEn FROM organizaciones WHERE codigo = ?').get(codigo) || null;
};

/** Obtiene una organización por su id (o null). */
export const obtenerOrganizacionPorId = (conexion, id) => {
  if (!id) return null;
  return conexion.prepare('SELECT id, nombre, codigo, propietarioId, creadoEn FROM organizaciones WHERE id = ?').get(id) || null;
};

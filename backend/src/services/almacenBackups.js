import fs from 'fs';
import path from 'path';
import { DB_PATH } from '../config/database.js';

/**
 * Dónde se guardan los backups (.db):
 * - Cloud Storage (gs://UPAD_BUCKET/backups/) si existe UPAD_BUCKET: se conservan entre reinicios y despliegues.
 * - Disco del servidor (carpeta backups/ junto a la base) en local y en los tests.
 * Todos los almacenes exponen: tipo, ubicacion, guardar(origen, nombre), listar(), abrir(nombre).
 */

const PREFIJO = 'backups/';

export const crearAlmacenLocal = (dir) => ({
  tipo: 'disco',
  ubicacion: dir,
  rutaDe: (nombre) => path.join(dir, nombre),
  async guardar(origen, nombre) {
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(origen, path.join(dir, nombre));
  },
  async listar() {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.db'))
      .map((nombre) => {
        const stats = fs.statSync(path.join(dir, nombre));
        return { nombre, tamano: stats.size, modificado: stats.mtime.toISOString() };
      });
  },
  async abrir(nombre) {
    const ruta = path.join(dir, nombre);
    if (!fs.existsSync(ruta)) return null;
    return { stream: fs.createReadStream(ruta), tamano: fs.statSync(ruta).size };
  },
});

export const crearAlmacenGcs = (nombreBucket, storage) => {
  const bucket = storage.bucket(nombreBucket);
  return {
    tipo: 'cloud-storage',
    ubicacion: `gs://${nombreBucket}/${PREFIJO}`,
    rutaDe: (nombre) => `gs://${nombreBucket}/${PREFIJO}${nombre}`,
    async guardar(origen, nombre) {
      await bucket.upload(origen, { destination: `${PREFIJO}${nombre}`, contentType: 'application/vnd.sqlite3' });
    },
    async listar() {
      const [archivos] = await bucket.getFiles({ prefix: PREFIJO });
      return archivos
        .filter((f) => f.name.endsWith('.db'))
        .map((f) => ({
          nombre: f.name.slice(PREFIJO.length),
          tamano: Number(f.metadata?.size) || 0,
          modificado: f.metadata?.updated || f.metadata?.timeCreated || null,
        }));
    },
    async abrir(nombre) {
      const archivo = bucket.file(`${PREFIJO}${nombre}`);
      const [existe] = await archivo.exists();
      if (!existe) return null;
      const [metadatos] = await archivo.getMetadata();
      return { stream: archivo.createReadStream(), tamano: Number(metadatos?.size) || undefined };
    },
  };
};

let almacenActual = null;

/** Almacén activo: Cloud Storage si existe UPAD_BUCKET; si no, el disco junto a la base. */
export const obtenerAlmacenBackups = async () => {
  if (almacenActual) return almacenActual;
  const bucket = (process.env.UPAD_BUCKET || '').trim();
  if (bucket) {
    const { Storage } = await import('@google-cloud/storage');
    almacenActual = crearAlmacenGcs(bucket, new Storage());
  } else {
    almacenActual = crearAlmacenLocal(path.resolve(path.dirname(DB_PATH), 'backups'));
  }
  return almacenActual;
};

/** Solo para tests: fija el almacén (null vuelve al de por defecto). */
export const establecerAlmacenBackups = (almacen) => {
  almacenActual = almacen || null;
};

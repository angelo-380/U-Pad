import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { db } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { obtenerAlmacenBackups } from './almacenBackups.js';

const HORAS_ENTRE_AUTOMATICOS = 12;

const exigirDeveloper = (usuarioActual) => {
  if (usuarioActual?.rol !== 'developer') {
    throw new AppError(
      'Acceso denegado: los backups están reservados al rol developer.',
      403,
      { code: 'FORBIDDEN_BACKUP_ACCESS', requiredRole: 'developer' }
    );
  }
};

const formatearTamano = (bytes) =>
  bytes > 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(2)} MB` : `${(bytes / 1024).toFixed(2)} KB`;

const NOMBRE_VALIDO = /^[A-Za-z0-9._-]+\.db$/;

/** Copia consistente de la base y la guarda en el almacén activo (Cloud Storage o disco). */
async function generarBackup({ tipo, creadoPor }) {
  const almacen = await obtenerAlmacenBackups();
  // Sufijo aleatorio: dos backups en el mismo milisegundo no pueden pisarse ni repetir id
  const unico = crypto.randomBytes(3).toString('hex');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `upad_relational_backup_${timestamp}_${unico}.db`;
  const temporal = path.join(os.tmpdir(), `upad_tmp_${process.pid}_${Date.now()}_${filename}`);

  try {
    // VACUUM INTO: copia atómica y consistente sin detener las escrituras
    db.exec(`VACUUM INTO '${temporal.replace(/'/g, "''")}'`);
    const sizeBytes = fs.statSync(temporal).size;
    await almacen.guardar(temporal, filename);

    const ahora = new Date().toISOString();
    const backupId = `bkp_${Date.now().toString(16)}_${unico}`;
    const sizeFormatted = formatearTamano(sizeBytes);
    const filePath = almacen.rutaDe(filename);
    db.prepare(`
      INSERT INTO backups_history (id, filename, file_path, size_bytes, size_formatted, tipo, creado_por, creado_en)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(backupId, filename, filePath, sizeBytes, sizeFormatted, tipo, creadoPor, ahora);

    return {
      id: backupId,
      filename,
      filePath,
      almacenamiento: almacen.tipo,
      sizeBytes,
      sizeFormatted,
      tipo,
      creadoPor,
      creadoEn: ahora,
      estado: 'COMPLETADO_EXITOSO',
    };
  } finally {
    fs.rmSync(temporal, { force: true });
  }
}

export const backupService = {
  /** Backup manual (solo developer). */
  async crearBackup(usuarioActual) {
    exigirDeveloper(usuarioActual);
    return generarBackup({ tipo: 'MANUAL', creadoPor: usuarioActual.email || usuarioActual.id });
  },

  /** Dónde se guardan los backups: { almacenamiento: 'cloud-storage' | 'disco', ubicacion }. */
  async info(usuarioActual) {
    exigirDeveloper(usuarioActual);
    const almacen = await obtenerAlmacenBackups();
    return { almacenamiento: almacen.tipo, ubicacion: almacen.ubicacion };
  },

  /** Backups existentes en el almacén activo, del más reciente al más antiguo. */
  async listarBackups(usuarioActual) {
    exigirDeveloper(usuarioActual);
    const almacen = await obtenerAlmacenBackups();
    const archivos = await almacen.listar();
    return archivos
      .map((a) => ({
        filename: a.nombre,
        sizeBytes: a.tamano,
        sizeFormatted: formatearTamano(a.tamano),
        fechaModificacion: a.modificado,
      }))
      .sort((a, b) => new Date(b.fechaModificacion) - new Date(a.fechaModificacion));
  },

  /** Abre un backup para descargarlo: { stream, tamano, filename }. 404 si no existe. */
  async abrirBackup(filename, usuarioActual) {
    exigirDeveloper(usuarioActual);
    const nombre = path.basename(String(filename || ''));
    if (!NOMBRE_VALIDO.test(nombre)) {
      throw new AppError('Archivo de backup no encontrado', 404, { code: 'BACKUP_NOT_FOUND' });
    }
    const almacen = await obtenerAlmacenBackups();
    const abierto = await almacen.abrir(nombre);
    if (!abierto) {
      throw new AppError('Archivo de backup no encontrado', 404, { code: 'BACKUP_NOT_FOUND' });
    }
    return { ...abierto, filename: nombre };
  },

  /**
   * Backup automático: se crea si no hay ninguno o si el último tiene más de 12 horas.
   * Devuelve el backup creado o null. Lo llama server.js al arrancar y cada 12 horas
   * (solo corre mientras la instancia está encendida).
   */
  async backupAutomaticoSiCorresponde({ ahora = Date.now() } = {}) {
    const almacen = await obtenerAlmacenBackups();
    const archivos = await almacen.listar();
    const ultimo = archivos.reduce((max, a) => Math.max(max, new Date(a.modificado).getTime() || 0), 0);
    if (ultimo && ahora - ultimo < HORAS_ENTRE_AUTOMATICOS * 60 * 60 * 1000) return null;
    return generarBackup({ tipo: 'AUTOMATICO', creadoPor: 'sistema (backup automático)' });
  },
};

export const INTERVALO_BACKUP_AUTOMATICO_MS = HORAS_ENTRE_AUTOMATICOS * 60 * 60 * 1000;

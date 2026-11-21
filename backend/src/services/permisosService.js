import crypto from 'node:crypto';
import { db } from '../config/database.js';
import { AppError } from '../utils/AppError.js';

export const permisosService = {
  /** Lista solicitudes de permiso pendientes para el padre actual */
  listarPendientes(padreId) {
    return db.prepare(`
      SELECT id, deviceId, childName, rutinaId, rutinaTitulo, minutosRestantes, estado, creadoEn
      FROM solicitudes_permiso
      WHERE padreId = ? AND estado = 'PENDIENTE'
      ORDER BY creadoEn DESC
    `).all(padreId);
  },

  /** El niño (o emulador) solicita permiso para terminar una rutina antes de tiempo */
  solicitar({ deviceId, rutinaId, minutosRestantes = 0 }) {
    if (!deviceId || !rutinaId) {
      throw new AppError('deviceId y rutinaId son requeridos.', 400);
    }

    const dispositivo = db.prepare('SELECT parent_id, child_name FROM child_devices WHERE device_id = ?').get(deviceId);
    if (!dispositivo || !dispositivo.parent_id) {
      throw new AppError('Dispositivo no vinculado.', 404);
    }

    const rutina = db.prepare('SELECT id, titulo, turno FROM rutinas WHERE id = ?').get(rutinaId);
    if (!rutina) {
      throw new AppError('Rutina no encontrada.', 404);
    }

    // Buscar todos los padres vinculados (para soporte multitutor)
    const padres = db.prepare(`
      SELECT parent_id FROM child_devices WHERE device_id = ? AND parent_id IS NOT NULL
      UNION
      SELECT parent_id FROM device_parents WHERE device_id = ?
    `).all(deviceId, deviceId);

    const ahora = new Date().toISOString();
    const creadas = [];

    for (const p of padres) {
      const id = `perm_${Date.now().toString(16)}_${crypto.randomBytes(3).toString('hex')}`;
      db.prepare(`
        INSERT INTO solicitudes_permiso (id, padreId, deviceId, childName, rutinaId, rutinaTitulo, minutosRestantes, estado, creadoEn)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDIENTE', ?)
      `).run(id, p.parent_id, deviceId, dispositivo.child_name || 'Hijo', rutina.id, rutina.titulo, Number(minutosRestantes) || 0, ahora);
      creadas.push(id);
    }

    return { ok: true, creadas };
  },

  /** El padre resuelve la solicitud: CONCEDIDO o RECHAZADO */
  resolver(padreId, permisoId, accion) {
    const solicitud = db.prepare('SELECT * FROM solicitudes_permiso WHERE id = ? AND padreId = ?').get(permisoId, padreId);
    if (!solicitud) {
      throw new AppError('Solicitud no encontrada.', 404);
    }
    if (solicitud.estado !== 'PENDIENTE') {
      return { ok: true, solicitud };
    }

    const nuevoEstado = accion === 'CONCEDER' ? 'CONCEDIDO' : 'RECHAZADO';
    const ahora = new Date().toISOString();

    db.prepare(`
      UPDATE solicitudes_permiso
      SET estado = ?, resueltoEn = ?
      WHERE id = ?
    `).run(nuevoEstado, ahora, permisoId);

    // Si se concede el permiso, se registra automáticamente el cumplimiento de la rutina
    if (nuevoEstado === 'CONCEDIDO') {
      const padre = db.prepare('SELECT organizacionId FROM usuarios WHERE id = ?').get(padreId);
      const rutina = db.prepare('SELECT turno FROM rutinas WHERE id = ?').get(solicitud.rutinaId);
      const cmpId = `cmp_${Date.now().toString(16)}_${crypto.randomBytes(3).toString('hex')}`;
      const fechaHoy = ahora.slice(0, 10);

      db.prepare(`
        INSERT OR REPLACE INTO cumplimientos (id, padreId, deviceId, rutinaId, actividad, turno, fecha, completadoEn, organizacionId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        cmpId,
        padreId,
        solicitud.deviceId,
        solicitud.rutinaId,
        solicitud.rutinaTitulo,
        rutina?.turno || 'MANANA',
        fechaHoy,
        ahora,
        padre?.organizacionId ?? null
      );
    }

    return { ok: true, estado: nuevoEstado };
  },
};

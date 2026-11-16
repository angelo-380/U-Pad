import crypto from 'node:crypto';
import { db } from '../config/database.js';
import { AppError } from '../utils/AppError.js';

/**
 * Avisos del teléfono del niño para su padre («completó una tarea», «completó la rutina»).
 * El niño los publica sin token (como la telemetría) y el servidor decide el padre: el dueño del dispositivo.
 * El padre los consulta con su token. Se guardan 30 días.
 */
export const TIPOS_NOTIFICACION = Object.freeze(['tarea_completada', 'rutina_completada']);
export const MAX_TITULO = 120;
export const MAX_DESCRIPCION = 500;
export const MAX_LISTADO = 50;
export const DIAS_RETENCION = 30;

const textoLimpio = (valor, max) => (typeof valor === 'string' ? valor.trim().replace(/\s+/g, ' ').slice(0, max) : '');

export const notificacionesService = {
  crear(deviceId, { tipo, titulo, descripcion } = {}) {
    if (!TIPOS_NOTIFICACION.includes(tipo)) {
      throw new AppError(`Tipo de aviso no válido. Usa: ${TIPOS_NOTIFICACION.join(', ')}.`, 400, { field: 'tipo', code: 'NOTIFICACION_TIPO_INVALIDO' });
    }
    const tituloLimpio = textoLimpio(titulo, MAX_TITULO);
    if (!tituloLimpio) {
      throw new AppError('Falta el título del aviso.', 400, { field: 'titulo', code: 'NOTIFICACION_TITULO_REQUERIDO' });
    }

    const dispositivo = db.prepare('SELECT parent_id FROM child_devices WHERE device_id = ? AND parent_id IS NOT NULL').get(deviceId);
    if (!dispositivo) {
      throw new AppError('Dispositivo no vinculado.', 404, { code: 'DEVICE_NOT_FOUND' });
    }

    // Limpieza: los avisos de más de 30 días se borran
    const limite = new Date(Date.now() - DIAS_RETENCION * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('DELETE FROM notificaciones WHERE creadoEn < ?').run(limite);

    const notificacion = {
      id: `ntf_${Date.now().toString(16)}_${crypto.randomBytes(4).toString('hex')}`,
      padreId: dispositivo.parent_id,
      deviceId,
      tipo,
      titulo: tituloLimpio,
      descripcion: textoLimpio(descripcion, MAX_DESCRIPCION),
      creadoEn: new Date().toISOString(),
      leida: false,
    };
    db.prepare(`
      INSERT INTO notificaciones (id, padreId, deviceId, tipo, titulo, descripcion, creadoEn, leida)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `).run(notificacion.id, notificacion.padreId, deviceId, tipo, notificacion.titulo, notificacion.descripcion, notificacion.creadoEn);

    // Al niño no se le devuelve el id del padre
    const { padreId, ...publica } = notificacion;
    return publica;
  },

  /** Avisos del padre, del más reciente al más antiguo (máx. 50). Con `desde` (ISO), solo los posteriores. */
  listar(padreId, { desde } = {}) {
    let fechaDesde = null;
    if (desde !== undefined && desde !== null && desde !== '') {
      const ms = Date.parse(String(desde));
      if (!Number.isFinite(ms)) {
        throw new AppError('El parámetro desde debe ser una fecha ISO.', 400, { field: 'desde', code: 'FECHA_INVALIDA' });
      }
      fechaDesde = new Date(ms).toISOString();
    }

    const filas = fechaDesde
      ? db.prepare(`
          SELECT n.*, d.child_name AS nombreHijo FROM notificaciones n
          LEFT JOIN child_devices d ON d.device_id = n.deviceId
          WHERE n.padreId = ? AND n.creadoEn > ? ORDER BY n.creadoEn DESC LIMIT ${MAX_LISTADO}
        `).all(padreId, fechaDesde)
      : db.prepare(`
          SELECT n.*, d.child_name AS nombreHijo FROM notificaciones n
          LEFT JOIN child_devices d ON d.device_id = n.deviceId
          WHERE n.padreId = ? ORDER BY n.creadoEn DESC LIMIT ${MAX_LISTADO}
        `).all(padreId);

    const noLeidas = Number(db.prepare('SELECT COUNT(*) AS n FROM notificaciones WHERE padreId = ? AND leida = 0').get(padreId).n);

    return {
      notificaciones: filas.map(({ padreId: _p, leida, ...n }) => ({ ...n, nombreHijo: n.nombreHijo || null, leida: Boolean(leida) })),
      noLeidas,
    };
  },

  /** Marca como leídos los avisos indicados (ids) del padre, o todos si no se indican. */
  marcarLeidas(padreId, ids) {
    if (Array.isArray(ids) && ids.length > 0) {
      const validos = ids.filter((id) => typeof id === 'string').slice(0, 200);
      if (validos.length === 0) return { marcadas: 0 };
      const marcas = validos.map(() => '?').join(', ');
      const r = db.prepare(`UPDATE notificaciones SET leida = 1 WHERE padreId = ? AND leida = 0 AND id IN (${marcas})`).run(padreId, ...validos);
      return { marcadas: Number(r.changes) };
    }
    const r = db.prepare('UPDATE notificaciones SET leida = 1 WHERE padreId = ? AND leida = 0').run(padreId);
    return { marcadas: Number(r.changes) };
  },
};

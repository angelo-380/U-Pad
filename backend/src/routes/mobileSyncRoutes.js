import express from 'express';
import { db } from '../config/database.js';
import { verifyToken } from '../utils/jwt.js';
import { AppError } from '../utils/AppError.js';
import { compatibilidadMovilActiva } from '../utils/compatMovil.js';
import { normalizarPasos, leerPasos, duracionTotal } from '../utils/pasosRutina.js';
import { validarNino } from '../services/rutinasService.js';
import { limpiarTexto, validarTitulo } from '../utils/textoRutina.js';

const router = express.Router();

/*
 * Sincronización de rutinas con la app Android (/api/v1/mobile/sync-routines).
 *
 * Identidad del usuario, en este orden:
 *  1. Token JWT (`Authorization: Bearer ...`): el usuario sale del token. Si además llega un `userId`
 *     distinto, se rechaza (403).
 *  2. Compatibilidad con el APK actual (no envía token): solo si MOBILE_SIN_TOKEN no es 'false'.
 *     El `userId` debe ser una cuenta existente y activa. Nunca se usa una cuenta por defecto.
 * PUT exige token siempre (la app no lo usa).
 */

const extraerToken = (req) => {
  const cabecera = req.headers.authorization || '';
  const partes = cabecera.trim().split(/\s+/);
  if (partes.length === 2 && partes[0].toLowerCase() === 'bearer') {
    return partes[1].replace(/^["']|["']$/g, '');
  }
  return null;
};

const userIdDelCliente = (req) => {
  const valor = req.body?.userId ?? req.query?.userId;
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null;
};

const buscarUsuarioActivo = (id) => {
  const usuario = db.prepare('SELECT id, rol, organizacionId, activo FROM usuarios WHERE id = ?').get(id);
  return usuario && Number(usuario.activo) === 1 ? usuario : null;
};

/**
 * Identifica al usuario de la petición móvil y lo deja en req.usuarioMovil.
 * - compatibilidad: permite el modo sin token (userId) si MOBILE_SIN_TOKEN no es 'false'.
 * - anonimoVacio: en modo compatibilidad, un userId desconocido no es un error (req.usuarioMovil = null).
 */
const identificarUsuarioMovil = ({ compatibilidad = true, anonimoVacio = false } = {}) => (req, res, next) => {
  try {
    const token = extraerToken(req);
    const userIdCliente = userIdDelCliente(req);

    if (token) {
      let payload;
      try {
        payload = verifyToken(token);
      } catch (e) {
        throw new AppError('Token inválido o expirado. Inicia sesión de nuevo.', 401, { code: 'INVALID_TOKEN' });
      }
      if (userIdCliente && userIdCliente !== payload.id) {
        throw new AppError('El usuario enviado no coincide con la sesión.', 403, { code: 'USUARIO_NO_COINCIDE' });
      }
      const usuario = buscarUsuarioActivo(payload.id);
      if (!usuario) {
        throw new AppError('La cuenta de la sesión no existe o está desactivada.', 401, { code: 'MOBILE_USUARIO_INVALIDO' });
      }
      req.usuarioMovil = usuario;
      return next();
    }

    if (!compatibilidad || !compatibilidadMovilActiva()) {
      throw new AppError('Se requiere iniciar sesión (token) para sincronizar rutinas.', 401, { code: 'TOKEN_REQUERIDO' });
    }

    const usuario = userIdCliente && userIdCliente.startsWith('usr_') ? buscarUsuarioActivo(userIdCliente) : null;
    if (!usuario) {
      if (anonimoVacio) {
        req.usuarioMovil = null;
        return next();
      }
      throw new AppError('Usuario no válido para sincronizar rutinas.', 401, { code: 'MOBILE_USUARIO_INVALIDO' });
    }
    req.usuarioMovil = usuario;
    return next();
  } catch (error) {
    return next(error);
  }
};

const normalizarTurno = (turno) => {
  const valor = typeof turno === 'string' && turno.trim() ? turno.trim().toUpperCase() : 'MANANA';
  return valor === 'MAÑANA' ? 'MANANA' : valor;
};

const actividadValida = (actividad) => {
  if (typeof actividad !== 'string' || !actividad.trim()) {
    throw new AppError('Falta la actividad.', 400, { code: 'ACTIVIDAD_REQUERIDA' });
  }
  return actividad.trim().slice(0, 120);
};

/**
 * Pasos que envía la app: la lista nueva `pasos[]` ({texto, palabraClave?, duracionMinutos?, pictogramaId?})
 * o el formato antiguo de una sola actividad (`palabraClave` y `duracionMinutos` opcionales).
 */
const pasosDelCuerpo = (cuerpo, titulo, opciones = {}) => {
  if (Array.isArray(cuerpo?.pasos) && cuerpo.pasos.length > 0) return normalizarPasos(cuerpo.pasos, titulo, opciones);
  const palabraClave = typeof cuerpo?.palabraClave === 'string' && cuerpo.palabraClave.trim() ? cuerpo.palabraClave.trim() : titulo;
  return normalizarPasos([{ texto: titulo, palabraClave, duracionMinutos: cuerpo?.duracionMinutos, pictogramaId: cuerpo?.pictogramaId }], titulo, opciones);
};

/** ninoId enviado por la app: undefined = no cambiar; '' / null / 'TODOS' = para todos los hijos; si no, un hijo propio. */
const ninoDelCuerpo = (cuerpo, usuarioId) => {
  if (!cuerpo || !Object.prototype.hasOwnProperty.call(cuerpo, 'ninoId')) return undefined;
  const valor = cuerpo.ninoId;
  if (valor === null || valor === undefined || (typeof valor === 'string' && ['', 'TODOS'].includes(valor.trim().toUpperCase()))) {
    return null;
  }
  return validarNino(valor, usuarioId);
};

/**
 * POST /api/v1/mobile/sync-routines
 * Guarda una rutina creada en la app a nombre del usuario identificado (sin duplicados).
 */
router.post('/mobile/sync-routines', identificarUsuarioMovil(), (req, res, next) => {
  try {
    const usuario = req.usuarioMovil;
    // Título nuevo: misma regla que la web (letras, números, espacios y guion; 3 a 60 caracteres)
    const titulo = validarTitulo(actividadValida(req.body?.actividad), 'actividad');
    const turnoNormalizado = normalizarTurno(req.body?.turno);

    const existente = db.prepare(`
      SELECT id FROM rutinas
      WHERE creadoPor = ? AND UPPER(titulo) = UPPER(?) AND turno = ? AND activa = 1
      LIMIT 1
    `).get(usuario.id, titulo, turnoNormalizado);

    if (existente) {
      return res.status(200).json({
        status: 'success',
        message: 'Rutina ya sincronizada previamente',
        id: existente.id,
        duplicada: true,
      });
    }

    const id = `rut_app_${Date.now().toString(16)}_${Math.random().toString(16).slice(2, 8)}`;
    const pasos = pasosDelCuerpo(req.body, titulo);
    const ninoId = ninoDelCuerpo(req.body, usuario.id) ?? null;
    const creadoEn = new Date().toISOString();

    // La organización la define el servidor (la del usuario), nunca el cliente
    db.prepare(`
      INSERT INTO rutinas (id, titulo, turno, ninoId, organizacionId, pasos, activa, creadoPor, creadoEn, actualizadoEn)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(id, titulo, turnoNormalizado, ninoId, usuario.organizacionId || null, JSON.stringify(pasos), usuario.id, creadoEn, creadoEn);

    return res.status(201).json({
      status: 'success',
      message: 'Rutina creada desde la app',
      id,
      ninoId,
      pasos,
      duracionTotalMinutos: duracionTotal(pasos),
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/v1/mobile/sync-routines
 * Rutinas activas del usuario identificado. Un userId desconocido (sin token) recibe una lista vacía.
 */
router.get('/mobile/sync-routines', identificarUsuarioMovil({ anonimoVacio: true }), (req, res, next) => {
  try {
    if (!req.usuarioMovil) {
      return res.status(200).json({ status: 'success', total: 0, data: [] });
    }

    // Teléfono del niño (?deviceId=): solo las rutinas para él o «para todos mis hijos». Si ese dispositivo no es
    // un hijo vinculado de este usuario, la lista es vacía.
    const deviceId = typeof req.query?.deviceId === 'string' ? req.query.deviceId.trim() : '';
    let rows;
    if (deviceId) {
      const esHijo = db.prepare(`
        SELECT 1 FROM child_devices WHERE device_id = ? AND parent_id = ?
        UNION
        SELECT 1 FROM device_parents WHERE device_id = ? AND parent_id = ?
      `).get(deviceId, req.usuarioMovil.id, deviceId, req.usuarioMovil.id);
      rows = esHijo
        ? db.prepare(`
            SELECT * FROM rutinas
            WHERE activa = 1
              AND (
                (creadoPor = ? AND (ninoId IS NULL OR ninoId = ?))
                OR (ninoId = ? AND creadoPor IN (SELECT parent_id FROM device_parents WHERE device_id = ?))
                OR (ninoId = ? AND creadoPor IN (SELECT parent_id FROM child_devices WHERE device_id = ?))
              )
            ORDER BY creadoEn ASC, rowid ASC
          `).all(req.usuarioMovil.id, deviceId, deviceId, deviceId, deviceId, deviceId)
        : [];
    } else {
      rows = db.prepare('SELECT * FROM rutinas WHERE activa = 1 AND creadoPor = ? ORDER BY creadoEn ASC, rowid ASC').all(req.usuarioMovil.id);
    }

    // En orden de creación: el niño empieza por la primera rutina que creó su padre
    const tasks = rows.map((r) => {
      const pasos = leerPasos(r.pasos, r.titulo);
      const total = duracionTotal(pasos);
      return {
        id: r.id,
        actividad: r.titulo.toUpperCase(),
        palabraClave: (pasos[0]?.palabraClave || r.titulo).toLowerCase(),
        dias: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'],
        completada: false,
        turno: r.turno,
        ninoId: r.ninoId || null,
        pasos,
        duracionTotalMinutos: total,
        duration: total,
        creadoEn: r.creadoEn,
      };
    });

    return res.status(200).json({ status: 'success', total: tasks.length, data: tasks });
  } catch (error) {
    return next(error);
  }
});

/**
 * DELETE /api/v1/mobile/sync-routines
 * Elimina SOLO rutinas del usuario identificado: por id, o por título exacto (y turno, si se envía).
 */
router.delete('/mobile/sync-routines', identificarUsuarioMovil(), (req, res, next) => {
  try {
    const usuario = req.usuarioMovil;
    const id = req.body?.id || req.query?.id;
    const actividad = req.body?.actividad || req.query?.actividad;
    const turno = req.body?.turno || req.query?.turno;

    let resultado;
    if (id) {
      resultado = db.prepare('DELETE FROM rutinas WHERE id = ? AND creadoPor = ?').run(String(id), usuario.id);
    } else if (actividad) {
      const titulo = actividadValida(actividad);
      if (turno) {
        resultado = db.prepare('DELETE FROM rutinas WHERE creadoPor = ? AND UPPER(titulo) = UPPER(?) AND turno = ?')
          .run(usuario.id, titulo, normalizarTurno(turno));
      } else {
        resultado = db.prepare('DELETE FROM rutinas WHERE creadoPor = ? AND UPPER(titulo) = UPPER(?)').run(usuario.id, titulo);
      }
    } else {
      throw new AppError('Se requiere id o actividad a eliminar.', 400, { code: 'ID_O_ACTIVIDAD_REQUERIDO' });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Rutina eliminada',
      eliminadas: resultado.changes,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * PUT /api/v1/mobile/sync-routines
 * Actualiza una rutina propia. Exige token (sin modo de compatibilidad).
 */
router.put('/mobile/sync-routines', identificarUsuarioMovil({ compatibilidad: false }), (req, res, next) => {
  try {
    const usuario = req.usuarioMovil;
    const { id } = req.body || {};
    let actividad = actividadValida(req.body?.actividad);
    const turnoNormalizado = normalizarTurno(req.body?.turno);

    // La rutina que se edita: su título y sus pasos actuales no se revalidan (rutinas antiguas con signos)
    const actual = id
      ? db.prepare('SELECT titulo, pasos FROM rutinas WHERE id = ? AND creadoPor = ?').get(String(id), usuario.id)
      : db.prepare('SELECT titulo, pasos FROM rutinas WHERE UPPER(titulo) = UPPER(?) AND turno = ? AND creadoPor = ? AND activa = 1 LIMIT 1')
          .get(actividad, turnoNormalizado, usuario.id);
    if (id && (!actual || limpiarTexto(actividad) !== limpiarTexto(actual.titulo))) {
      actividad = validarTitulo(actividad, 'actividad');
    }
    const textosConservados = new Set(leerPasos(actual?.pasos, actual?.titulo || '').map((paso) => limpiarTexto(paso.texto)));
    if (actual) textosConservados.add(limpiarTexto(actual.titulo));
    const pasos = JSON.stringify(pasosDelCuerpo(req.body, actividad, { textosConservados }));
    const ninoId = ninoDelCuerpo(req.body, usuario.id); // undefined = no se cambia
    const actualizadoEn = new Date().toISOString();

    let resultado;
    if (id) {
      resultado = db.prepare(`
        UPDATE rutinas SET titulo = ?, turno = ?, pasos = ?, ninoId = COALESCE(?, ninoId), actualizadoEn = ?
        WHERE id = ? AND creadoPor = ?
      `).run(actividad, turnoNormalizado, pasos, ninoId === undefined ? null : ninoId, actualizadoEn, String(id), usuario.id);
      if (ninoId === null) {
        db.prepare('UPDATE rutinas SET ninoId = NULL WHERE id = ? AND creadoPor = ?').run(String(id), usuario.id);
      }
    } else {
      resultado = db.prepare(`
        UPDATE rutinas SET pasos = ?, actualizadoEn = ?
        WHERE UPPER(titulo) = UPPER(?) AND turno = ? AND creadoPor = ?
      `).run(pasos, actualizadoEn, actividad, turnoNormalizado, usuario.id);
    }

    return res.status(200).json({
      status: 'success',
      message: 'Rutina actualizada',
      actualizadas: resultado.changes,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;

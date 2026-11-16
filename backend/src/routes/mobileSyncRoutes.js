import express from 'express';
import { db } from '../config/database.js';
import { verifyToken } from '../utils/jwt.js';
import { AppError } from '../utils/AppError.js';
import { compatibilidadMovilActiva } from '../utils/compatMovil.js';

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
 * POST /api/v1/mobile/sync-routines
 * Guarda una rutina creada en la app a nombre del usuario identificado (sin duplicados).
 */
router.post('/mobile/sync-routines', identificarUsuarioMovil(), (req, res, next) => {
  try {
    const usuario = req.usuarioMovil;
    const titulo = actividadValida(req.body?.actividad);
    const { palabraClave } = req.body;
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
    const pasos = JSON.stringify([{
      orden: 1,
      texto: titulo,
      palabraClave: typeof palabraClave === 'string' && palabraClave.trim() ? palabraClave.trim() : titulo.toLowerCase(),
    }]);
    const creadoEn = new Date().toISOString();

    // La organización la define el servidor (la del usuario), nunca el cliente
    db.prepare(`
      INSERT INTO rutinas (id, titulo, turno, ninoId, organizacionId, pasos, activa, creadoPor, creadoEn, actualizadoEn)
      VALUES (?, ?, ?, NULL, ?, ?, 1, ?, ?, ?)
    `).run(id, titulo, turnoNormalizado, usuario.organizacionId || null, pasos, usuario.id, creadoEn, creadoEn);

    return res.status(201).json({
      status: 'success',
      message: 'Rutina creada desde la app',
      id,
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

    const rows = db.prepare('SELECT * FROM rutinas WHERE activa = 1 AND creadoPor = ? ORDER BY creadoEn DESC').all(req.usuarioMovil.id);
    const tasks = rows.map((r) => {
      let pasos = [];
      try {
        pasos = typeof r.pasos === 'string' ? JSON.parse(r.pasos) : r.pasos;
      } catch (e) {
        pasos = [];
      }
      return {
        id: r.id,
        actividad: r.titulo.toUpperCase(),
        palabraClave: (pasos?.[0]?.palabraClave || pasos?.[0]?.texto || r.titulo).toLowerCase(),
        dias: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'],
        completada: false,
        turno: r.turno,
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
    const { id, palabraClave } = req.body || {};
    const actividad = actividadValida(req.body?.actividad);
    const turnoNormalizado = normalizarTurno(req.body?.turno);
    const pasos = JSON.stringify([{
      orden: 1,
      texto: actividad,
      palabraClave: typeof palabraClave === 'string' && palabraClave.trim() ? palabraClave.trim() : actividad.toLowerCase(),
    }]);
    const actualizadoEn = new Date().toISOString();

    let resultado;
    if (id) {
      resultado = db.prepare(`
        UPDATE rutinas SET titulo = ?, turno = ?, pasos = ?, actualizadoEn = ?
        WHERE id = ? AND creadoPor = ?
      `).run(actividad, turnoNormalizado, pasos, actualizadoEn, String(id), usuario.id);
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

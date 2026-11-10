import { Router } from 'express';
import crypto from 'node:crypto';
import { db, hashPassword } from '../config/database.js';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js';
import { sendSuccess } from '../utils/responseHandler.js';
import { AppError } from '../utils/AppError.js';

const router = Router();

// Todas las rutas de administración requieren autenticación y rol 'developer' o 'admin'
router.use(authenticate);
router.use(authorizeRoles('developer', 'admin'));

/**
 * GET /api/admin/users
 * Lista todos los usuarios registrados en el sistema de manera paginada y con contador de rutinas.
 * Para el developer, incluye las columnas raw de base de datos como un SELECT completo.
 */
router.get('/users', (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();
    const roleFilter = (req.query.role || req.query.rol || '').trim().toLowerCase();

    let whereClause = ' WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (u.email LIKE ? OR u.nombre LIKE ? OR u.id LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (roleFilter && ['developer', 'admin', 'empresario', 'tutor'].includes(roleFilter)) {
      whereClause += ' AND u.rol = ?';
      params.push(roleFilter);
    }

    // Total de registros coincidentes
    const countSql = `SELECT COUNT(*) as total FROM usuarios u ${whereClause}`;
    const totalRow = db.prepare(countSql).get(...params);
    const total = totalRow ? totalRow.total : 0;
    const totalPages = Math.ceil(total / limit) || 1;

    // Consulta con todas las columnas de la tabla usuarios y conteo de rutinas
    const querySql = `
      SELECT 
        u.id,
        u.nombre,
        u.email,
        u.rol,
        u.organizacionId,
        u.activo,
        u.creadoEn,
        u.password_salt as saltPreview,
        (SELECT COUNT(*) FROM rutinas r WHERE r.creadoPor = u.id) as rutinasCount
      FROM usuarios u
      ${whereClause}
      ORDER BY u.creadoEn DESC
      LIMIT ? OFFSET ?
    `;

    const users = db.prepare(querySql).all(...params, limit, offset);

    return res.status(200).json({
      status: 'success',
      statusCode: 200,
      message: 'Usuarios obtenidos exitosamente para auditoría',
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/users
 * Poder absoluto de Developer: Crear nuevo usuario directamente en la base de datos
 */
router.post('/users', (req, res, next) => {
  try {
    const { nombre, email, password, rol = 'tutor', organizacionId = null } = req.body;

    if (!nombre || !email || !password) {
      throw new AppError('Nombre, email y contraseña son obligatorios', 400);
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(cleanEmail);
    if (existing) {
      throw new AppError('El email ya se encuentra registrado en el sistema.', 409);
    }

    const userId = `usr_${crypto.randomBytes(8).toString('hex')}`;
    const { hash, salt } = hashPassword(password);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO usuarios (id, nombre, email, password_hash, password_salt, rol, organizacionId, activo, creadoEn)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(userId, nombre.trim(), cleanEmail, hash, salt, rol, organizacionId || null, now);

    const created = db.prepare('SELECT id, nombre, email, rol, organizacionId, activo, creadoEn FROM usuarios WHERE id = ?').get(userId);

    return res.status(201).json({
      status: 'success',
      statusCode: 201,
      message: 'Usuario creado exitosamente por el desarrollador',
      data: created,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/admin/users/:userId
 * Poder absoluto de Developer: Editar cualquier usuario existente
 */
router.put('/users/:userId', (req, res, next) => {
  try {
    const { userId } = req.params;
    const { nombre, email, rol, organizacionId, activo, password } = req.body;

    const existing = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(userId);
    if (!existing) {
      throw new AppError('Usuario no encontrado', 404);
    }

    let cleanEmail = existing.email;
    if (email && email.trim().toLowerCase() !== existing.email) {
      cleanEmail = email.trim().toLowerCase();
      const duplicate = db.prepare('SELECT id FROM usuarios WHERE email = ? AND id != ?').get(cleanEmail, userId);
      if (duplicate) {
        throw new AppError('El nuevo email ya está en uso por otro usuario.', 409);
      }
    }

    const newNombre = nombre ? nombre.trim() : existing.nombre;
    const newRol = rol ? rol.trim() : existing.rol;
    const newOrg = organizacionId !== undefined ? (organizacionId ? organizacionId.trim() : null) : existing.organizacionId;
    const newActivo = activo !== undefined ? (activo ? 1 : 0) : existing.activo;

    if (password && password.trim().length >= 6) {
      const { hash, salt } = hashPassword(password.trim());
      db.prepare(`
        UPDATE usuarios 
        SET nombre = ?, email = ?, rol = ?, organizacionId = ?, activo = ?, password_hash = ?, password_salt = ?
        WHERE id = ?
      `).run(newNombre, cleanEmail, newRol, newOrg, newActivo, hash, salt, userId);
    } else {
      db.prepare(`
        UPDATE usuarios 
        SET nombre = ?, email = ?, rol = ?, organizacionId = ?, activo = ?
        WHERE id = ?
      `).run(newNombre, cleanEmail, newRol, newOrg, newActivo, userId);
    }

    const updated = db.prepare('SELECT id, nombre, email, rol, organizacionId, activo, creadoEn FROM usuarios WHERE id = ?').get(userId);

    return res.status(200).json({
      status: 'success',
      statusCode: 200,
      message: 'Usuario actualizado exitosamente',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/users/:userId
 * Poder absoluto de Developer: Eliminar cualquier usuario del sistema y sus dependencias
 */
router.delete('/users/:userId', (req, res, next) => {
  try {
    const { userId } = req.params;

    if (req.user.id === userId) {
      throw new AppError('No puedes eliminar tu propia cuenta de desarrollador activa.', 400);
    }

    const existing = db.prepare('SELECT id, email, rol FROM usuarios WHERE id = ?').get(userId);
    if (!existing) {
      throw new AppError('Usuario no encontrado', 404);
    }

    // Cascada de eliminación de datos asociados
    db.prepare('DELETE FROM rutinas WHERE creadoPor = ?').run(userId);
    db.prepare('DELETE FROM child_devices WHERE parent_id = ?').run(userId);
    db.prepare('DELETE FROM pairing_codes WHERE parent_id = ?').run(userId);
    db.prepare('DELETE FROM usuarios WHERE id = ?').run(userId);

    return res.status(200).json({
      status: 'success',
      statusCode: 200,
      message: `Usuario ${existing.email} eliminado definitivamente del sistema`,
      data: { userId, deleted: true },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/users/:userId/routines
 * Obtiene todas las rutinas creadas por un usuario en particular
 */
router.get('/users/:userId/routines', (req, res, next) => {
  try {
    const { userId } = req.params;

    const targetUser = db.prepare('SELECT id, nombre, email, rol, organizacionId FROM usuarios WHERE id = ?').get(userId);
    if (!targetUser) {
      throw new AppError('Usuario no encontrado', 404, { code: 'USER_NOT_FOUND' });
    }

    const rutinas = db.prepare(`
      SELECT 
        id,
        titulo,
        turno,
        organizacionId,
        pasos,
        activa,
        creadoPor,
        creadoEn
      FROM rutinas
      WHERE creadoPor = ?
      ORDER BY creadoEn DESC
    `).all(userId);

    const formattedRutinas = rutinas.map((r) => {
      let parsedPasos = [];
      try {
        parsedPasos = JSON.parse(r.pasos || '[]');
      } catch (e) {
        parsedPasos = [];
      }
      return {
        ...r,
        activa: Boolean(r.activa),
        pasos: parsedPasos,
      };
    });

    return res.status(200).json({
      status: 'success',
      statusCode: 200,
      message: `Rutinas del usuario ${targetUser.email} obtenidas exitosamente`,
      data: {
        user: targetUser,
        rutinas: formattedRutinas,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/sql-execute
 * Consola SQL directa para desarrolladores (Poder absoluto: SELECT / INSERT / UPDATE / DELETE)
 */
router.post('/sql-execute', (req, res, next) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      throw new AppError('Consulta SQL vacía', 400);
    }

    const cleanQuery = query.trim();
    const isSelect = cleanQuery.toUpperCase().startsWith('SELECT') || cleanQuery.toUpperCase().startsWith('PRAGMA');

    if (isSelect) {
      const rows = db.prepare(cleanQuery).all();
      return res.status(200).json({
        status: 'success',
        type: 'SELECT',
        rowCount: rows.length,
        data: rows,
      });
    } else {
      const result = db.prepare(cleanQuery).run();
      return res.status(200).json({
        status: 'success',
        type: 'MUTATION',
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid,
      });
    }
  } catch (error) {
    return res.status(400).json({
      status: 'error',
      statusCode: 400,
      error: { message: error.message },
    });
  }
});

export default router;

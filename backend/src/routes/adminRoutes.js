import { Router } from 'express';
import { db } from '../config/database.js';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js';
import { sendSuccess } from '../utils/responseHandler.js';
import { AppError } from '../utils/AppError.js';

const router = Router();

// Todas las rutas de administración requieren autenticación y rol 'developer' o 'admin'
router.use(authenticate);
router.use(authorizeRoles('developer', 'admin'));

/**
 * GET /api/admin/users
 * Lista todos los usuarios registrados en el sistema de manera paginada y con contador de rutinas
 */
router.get('/users', (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();
    const roleFilter = (req.query.role || req.query.rol || '').trim().toLowerCase();

    let whereClause = ' WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (u.email LIKE ? OR u.nombre LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
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

    // Consulta con conteo de rutinas asociadas
    const querySql = `
      SELECT 
        u.id,
        u.nombre,
        u.email,
        u.rol,
        u.organizacionId,
        u.activo,
        u.creadoEn,
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

export default router;

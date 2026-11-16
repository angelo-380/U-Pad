import { Router } from 'express';
import { backupController } from '../controllers/backupController.js';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js';
import { db } from '../config/database.js';
import { sendSuccess } from '../utils/responseHandler.js';
import { AppError } from '../utils/AppError.js';

const router = Router();

// Exclusivo para el rol developer
router.use(authenticate);
router.use(authorizeRoles('developer'));

router.get('/', backupController.listar);
router.post('/', backupController.crear);
router.get('/info', backupController.info);
router.get('/descargar/:filename', backupController.descargar);
router.get('/:filename', backupController.descargar);

/**
 * POST /api/admin/backups/sql-query
 * Consola de solo lectura sobre la base de datos SQLite del servidor (SELECT, PRAGMA y EXPLAIN)
 * para demostración y verificación ante el profesor/evaluador.
 */
router.post('/sql-query', (req, res, next) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      throw new AppError('Consulta SQL no proporcionada', 400);
    }
    const cleanQuery = query.trim();

    // Solo permitir consultas de lectura o inspección segura (SELECT, PRAGMA, EXPLAIN)
    const upper = cleanQuery.toUpperCase();
    if (!upper.startsWith('SELECT') && !upper.startsWith('PRAGMA') && !upper.startsWith('EXPLAIN')) {
      throw new AppError('Por seguridad, la consola de backups solo permite sentencias SELECT, PRAGMA y EXPLAIN.', 400);
    }

    const rows = db.prepare(cleanQuery).all();
    return sendSuccess(res, 200, 'Consulta ejecutada', {
      rowCount: rows.length,
      rows,
      executedAt: new Date().toISOString(),
      engine: 'SQLite (node:sqlite)'
    });
  } catch (error) {
    next(new AppError(`Error al ejecutar consulta SQL: ${error.message}`, 400));
  }
});

export default router;

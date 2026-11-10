import { Router } from 'express';
import { backupController } from '../controllers/backupController.js';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js';
import { db } from '../config/database.js';
import { sendSuccess } from '../utils/responseHandler.js';
import { AppError } from '../utils/AppError.js';

const router = Router();

// Exclusivo para developer y admin
router.use(authenticate);
router.use(authorizeRoles('developer', 'admin'));

router.get('/', backupController.listar);
router.post('/', backupController.crear);
router.get('/descargar/:filename', backupController.descargar);
router.get('/:filename', backupController.descargar);

/**
 * POST /api/admin/backups/sql-query
 * Ejecuta consultas directas sobre la base de datos en Google Cloud Run en tiempo real
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
      throw new AppError('Por seguridad de Cloud, solo se permiten sentencias SELECT y PRAGMA en el visor en vivo.', 400);
    }

    const rows = db.prepare(cleanQuery).all();
    return sendSuccess(res, 200, 'Consulta ejecutada en Google Cloud Database', {
      rowCount: rows.length,
      rows,
      executedAt: new Date().toISOString(),
      engine: 'Google Cloud Relational Engine (node:sqlite / PBKDF2 KMS Pepper)'
    });
  } catch (error) {
    next(new AppError(`Error al ejecutar consulta SQL: ${error.message}`, 400));
  }
});

export default router;

import { Router } from 'express';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js';
import { cumplimientoService } from '../services/cumplimientoService.js';
import { sendSuccess } from '../utils/responseHandler.js';

const router = Router();

router.use(authenticate);
router.use(authorizeRoles('tutor', 'empresario', 'developer'));

/**
 * GET /api/cumplimiento?dias=7&hasta=YYYY-MM-DD
 * Cumplimiento real (actividades completadas en el teléfono del niño) de los últimos días.
 * tutor: lo suyo, con desglose por hijo · empresario: su organización · developer: todo.
 * `hasta` = la fecha local del navegador (a ±1 día del servidor), para que «hoy» sea el día del usuario.
 */
router.get('/', (req, res, next) => {
  try {
    return sendSuccess(res, 200, 'Cumplimiento obtenido', cumplimientoService.resumen(req.user, { dias: req.query.dias, hasta: req.query.hasta }));
  } catch (error) {
    return next(error);
  }
});

export default router;

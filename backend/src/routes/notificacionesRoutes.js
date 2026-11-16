import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { notificacionesService } from '../services/notificacionesService.js';
import { sendSuccess } from '../utils/responseHandler.js';

const router = Router();

// Avisos del padre (tutor, empresario o developer): siempre los propios, según el token
router.use(authenticate);

/** GET /api/notificaciones?desde=<ISO> → { notificaciones: [...], noLeidas } (máx. 50, del más reciente al más antiguo) */
router.get('/', (req, res, next) => {
  try {
    return sendSuccess(res, 200, 'Avisos obtenidos', notificacionesService.listar(req.user.id, { desde: req.query.desde }));
  } catch (error) {
    return next(error);
  }
});

/** PUT /api/notificaciones/leidas { ids?: string[] } → marca como leídos esos avisos (o todos) */
router.put('/leidas', (req, res, next) => {
  try {
    return sendSuccess(res, 200, 'Avisos marcados como leídos', notificacionesService.marcarLeidas(req.user.id, req.body?.ids));
  } catch (error) {
    return next(error);
  }
});

export default router;

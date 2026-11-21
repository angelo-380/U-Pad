import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { permisosService } from '../services/permisosService.js';
import { sendSuccess } from '../utils/responseHandler.js';

const router = Router();

/** GET /api/permisos/pendientes - Lista solicitudes para el padre */
router.get('/pendientes', authenticate, (req, res, next) => {
  try {
    const data = permisosService.listarPendientes(req.user.id);
    return sendSuccess(res, 200, 'Solicitudes pendientes obtenidas', data);
  } catch (err) {
    return next(err);
  }
});

/** POST /api/permisos/:id/resolver - Padre aprueba o rechaza */
router.post('/:id/resolver', authenticate, (req, res, next) => {
  try {
    const accion = req.body?.accion === 'RECHAZAR' ? 'RECHAZAR' : 'CONCEDER';
    const resultado = permisosService.resolver(req.user.id, req.params.id, accion);
    return sendSuccess(res, 200, 'Solicitud resuelta', resultado);
  } catch (err) {
    return next(err);
  }
});

/** POST /api/permisos/solicitar - Niño o simulación solicita permiso */
router.post('/solicitar', (req, res, next) => {
  try {
    const data = permisosService.solicitar(req.body || {});
    return sendSuccess(res, 200, 'Permiso solicitado exitosamente', data);
  } catch (err) {
    return next(err);
  }
});

export default router;

import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { organizacionesService } from '../services/organizacionesService.js';
import { sendSuccess } from '../utils/responseHandler.js';

const router = Router();

// Requiere sesión (cualquier rol): cada usuario solo consulta SU propia organización
router.use(authenticate);

/**
 * GET /api/organizaciones/mia
 * Organización del usuario autenticado: { organizacion: { id, nombre, codigo? } | null }.
 * El código solo se incluye para el empresario propietario.
 */
router.get('/mia', async (req, res, next) => {
  try {
    const organizacion = await organizacionesService.obtenerMia(req.user);
    return sendSuccess(res, 200, 'Organización del usuario obtenida exitosamente', { organizacion });
  } catch (error) {
    next(error);
  }
});

export default router;

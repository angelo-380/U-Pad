import { Router } from 'express';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js';
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

/**
 * POST /api/organizaciones/unirse {codigo}
 * Solo tutores: se une (o cambia) a la institución del código. Sus rutinas y cumplimientos pasan a ella.
 */
router.post('/unirse', authorizeRoles('tutor'), async (req, res, next) => {
  try {
    const organizacion = await organizacionesService.unirse(req.user, req.body?.codigo);
    return sendSuccess(res, 200, 'Te uniste a la institución', { organizacion });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/organizaciones/membresia
 * Solo tutores: deja su institución (él, sus rutinas y sus cumplimientos quedan sin organización).
 */
router.delete('/membresia', authorizeRoles('tutor'), async (req, res, next) => {
  try {
    const organizacion = await organizacionesService.salir(req.user);
    return sendSuccess(res, 200, 'Saliste de la institución', { organizacion });
  } catch (error) {
    next(error);
  }
});

export default router;

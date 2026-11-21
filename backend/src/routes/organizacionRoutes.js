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

/**
 * POST /api/organizaciones/solicitar-retiro (Punto 12)
 * El tutor solicita retirarse con permiso del director.
 */
router.post('/solicitar-retiro', authorizeRoles('tutor'), async (req, res, next) => {
  try {
    const resultado = await organizacionesService.solicitarSalida(req.user);
    return sendSuccess(res, 200, 'Solicitud de retiro enviada al director', resultado);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/organizaciones/solicitudes-retiro (Punto 12)
 * El director consulta las solicitudes pendientes de su institución.
 */
router.get('/solicitudes-retiro', authorizeRoles('empresario'), async (req, res, next) => {
  try {
    const solicitudes = await organizacionesService.listarSolicitudesRetiro(req.user);
    return sendSuccess(res, 200, 'Solicitudes de retiro obtenidas', solicitudes);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/organizaciones/solicitudes-retiro/:id/resolver (Punto 12)
 * El director aprueba o rechaza la solicitud de retiro.
 */
router.post('/solicitudes-retiro/:id/resolver', authorizeRoles('empresario'), async (req, res, next) => {
  try {
    const accion = req.body?.accion === 'RECHAZAR' ? 'RECHAZAR' : 'APROBAR';
    const resultado = await organizacionesService.resolverSolicitudRetiro(req.user, req.params.id, accion);
    return sendSuccess(res, 200, 'Solicitud resuelta', resultado);
  } catch (error) {
    next(error);
  }
});

export default router;

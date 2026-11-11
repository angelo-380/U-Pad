import { Router } from 'express';
import { rutinasController } from '../controllers/rutinasController.js';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = Router();

// Todas las operaciones sobre rutinas requieren autenticación JWT
router.use(authenticate);

// Control de roles autorizados: developer, empresario y tutor
router.use(authorizeRoles('developer', 'empresario', 'tutor'));

// CRUD de Rutinas
router.route('/')
  .post(rutinasController.crear)
  .get(rutinasController.listar);

router.route('/:id')
  .get(rutinasController.obtenerPorId)
  .put(rutinasController.actualizar)
  .delete(rutinasController.eliminar);

export default router;

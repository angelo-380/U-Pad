import { Router } from 'express';
import { deviceController } from '../controllers/deviceController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

const router = Router();

// Endpoint público para que la tablet genere código sin estar autenticada
router.post('/pairing/create', deviceController.generarCodigo);

// Todos los demás endpoints de gestión requieren usuario autenticado
router.use(authenticate);

router.get('/', deviceController.listar);
router.post('/pairing/link', deviceController.vincular);
router.delete('/:id', deviceController.desvincular);

export default router;

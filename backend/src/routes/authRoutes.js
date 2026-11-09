import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { authLimiter } from '../middlewares/rateLimiter.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { sendSuccess } from '../utils/responseHandler.js';

const router = Router();

// Aplicamos el limitador estricto contra ataques de fuerza bruta
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);

// Endpoint protegido para obtener la sesión actual con token
router.get('/me', authenticate, (req, res) => {
  sendSuccess(res, 200, 'Sesión activa verificada', {
    usuario: req.user,
  });
});

export default router;

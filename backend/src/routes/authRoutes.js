import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { authLimiter } from '../middlewares/rateLimiter.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { sendSuccess } from '../utils/responseHandler.js';
import { crearLimiteIntentos } from '../middlewares/limiteIntentos.js';

const router = Router();

// Aplicamos el limitador estricto contra ataques de fuerza bruta
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);

// Inicio de sesión con Google (Google Identity Services en la web)
router.get('/config', authController.config);
router.post('/google', authLimiter, authController.google);
router.post('/google/registro', authLimiter, authController.googleRegistro);

// Endpoint protegido para obtener la sesión actual con token
router.get('/me', authenticate, (req, res) => {
  sendSuccess(res, 200, 'Sesión activa verificada', {
    usuario: req.user,
  });
});

// Actualizar nombre en el perfil (Punto 13)
router.put('/me', authenticate, authController.actualizarPerfil);

// Borrar la propia cuenta (confirmando la contraseña). Lo usan también las pruebas de k6 al terminar.
// Exige token y contraseña, así que usa su propio límite por cuenta (10 por minuto) en vez de authLimiter:
// cada ejecución de k6 solo gasta un cupo de registro/login, el del alta de su cuenta temporal.
export const limiteBorrarCuenta = crearLimiteIntentos({
  ventanaMs: 60_000,
  maximo: 10,
  claves: (req) => [`cuenta:${req.user?.id}`],
  codigo: 'BORRAR_CUENTA_RATE_LIMIT',
  mensaje: 'Demasiados intentos de borrar la cuenta. Espera un minuto.',
});
router.delete('/me', authenticate, limiteBorrarCuenta, authController.borrarMiCuenta);

export default router;

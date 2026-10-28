import { authService } from '../services/authService.js';
import { sendCreated, sendSuccess } from '../utils/responseHandler.js';
import { AppError } from '../utils/AppError.js';

export const authController = {
  /**
   * Manejador de Registro de Usuario (POST /api/auth/register).
   */
  async register(req, res, next) {
    try {
      const { nombre, email, password, rol, organizacionId } = req.body;

      // Validaciones de presencia
      if (!nombre || !email || !password) {
        throw new AppError('Los campos nombre, email y password son obligatorios.', 400, {
          requiredFields: ['nombre', 'email', 'password'],
        });
      }

      // Validación simple de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new AppError('El formato del correo electrónico no es válido.', 400, {
          field: 'email',
          code: 'INVALID_EMAIL_FORMAT',
        });
      }

      // Validación de longitud mínima de password (mínimo 6 caracteres)
      if (password.length < 6) {
        throw new AppError('La contraseña debe tener al menos 6 caracteres.', 400, {
          field: 'password',
          code: 'PASSWORD_TOO_SHORT',
        });
      }

      const result = await authService.register({
        nombre,
        email,
        password,
        rol,
        organizacionId,
      });

      return sendCreated(res, 'Usuario registrado exitosamente', result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Manejador de Inicio de Sesión (POST /api/auth/login).
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new AppError('Por favor proporciona correo y contraseña.', 400, {
          requiredFields: ['email', 'password'],
        });
      }

      const result = await authService.login({ email, password });

      return sendSuccess(res, 200, 'Inicio de sesión exitoso', result);
    } catch (error) {
      next(error);
    }
  },
};

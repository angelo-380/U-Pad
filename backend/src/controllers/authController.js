import { authService } from '../services/authService.js';
import { sendCreated, sendSuccess } from '../utils/responseHandler.js';
import { AppError } from '../utils/AppError.js';
import { validarPassword } from '../utils/passwordPolicy.js';
import { googleClientId, verificarCredencialGoogle } from '../utils/googleVerifier.js';

export const authController = {
  /**
   * Manejador de Registro de Usuario (POST /api/auth/register).
   */
  async register(req, res, next) {
    try {
      // El cliente NUNCA envía un organizacionId: un tutor puede enviar `codigoOrganizacion`
      // y el empresario recibe su propia organización al registrarse (ver authService.register).
      const { nombre, email, password, rol, codigoOrganizacion } = req.body;

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

      // Validación estricta de robustez de contraseña (ver utils/passwordPolicy.js)
      const errorPassword = validarPassword(password);
      if (errorPassword) {
        throw new AppError(errorPassword.message, 400, {
          field: errorPassword.field,
          code: errorPassword.code,
        });
      }

      const result = await authService.register({
        nombre,
        email,
        password,
        rol,
        codigoOrganizacion,
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

  /**
   * GET /api/auth/config: configuración pública de autenticación (client ID de Google, no es un secreto).
   */
  config(req, res) {
    return sendSuccess(res, 200, 'Configuración de autenticación', { googleClientId: googleClientId() });
  },

  /**
   * POST /api/auth/google { credential }: entra con Google o indica que falta completar el registro.
   */
  async google(req, res, next) {
    try {
      const perfil = await verificarCredencialGoogle(req.body?.credential);
      const result = await authService.loginGoogle(perfil);
      if (!result) {
        return sendSuccess(res, 200, 'Completa tu registro', {
          requiereRegistro: true,
          perfil: { nombre: perfil.nombre, email: perfil.email },
        });
      }
      return sendSuccess(res, 200, 'Inicio de sesión exitoso', result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/auth/google/registro { credential, rol, nombreInstitucion?, codigoOrganizacion? }
   */
  async googleRegistro(req, res, next) {
    try {
      const perfil = await verificarCredencialGoogle(req.body?.credential);
      const { rol, nombreInstitucion, codigoOrganizacion } = req.body || {};
      const result = await authService.registroGoogle(perfil, { rol, nombreInstitucion, codigoOrganizacion });
      return sendCreated(res, 'Usuario registrado exitosamente', result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/auth/me { password }: borra la cuenta del usuario autenticado (ver authService.borrarCuenta).
   */
  async borrarMiCuenta(req, res, next) {
    try {
      const result = await authService.borrarCuenta(req.user.id, req.body?.password);
      return sendSuccess(res, 200, 'Cuenta eliminada', result);
    } catch (error) {
      next(error);
    }
  },
};

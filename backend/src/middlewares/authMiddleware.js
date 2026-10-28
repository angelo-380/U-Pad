import { verifyToken } from '../utils/jwt.js';
import { AppError } from '../utils/AppError.js';

/**
 * Middleware para validar que la petición incluye un token JWT válido en Authorization: Bearer <token>.
 */
export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Acceso no autorizado: token no proporcionado o formato inválido.', 401, {
        code: 'TOKEN_MISSING',
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new AppError('Acceso no autorizado: token vacío.', 401, {
        code: 'TOKEN_EMPTY',
      });
    }

    // Decodifica el token usando la firma secreta
    const decoded = verifyToken(token);

    // Inyecta el usuario decodificado en el objeto request para su uso en controladores
    req.user = decoded;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware para autorizar acceso únicamente a ciertos roles (ej. 'admin', 'empresario').
 * @param  {...string} rolesPermitidos Lista de roles con permiso
 */
export const authorizeRoles = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.user || !rolesPermitidos.includes(req.user.rol)) {
      return next(
        new AppError(
          `Acceso denegado: tu rol [${req.user?.rol || 'anónimo'}] no tiene permisos suficientes para este recurso.`,
          403,
          {
            code: 'FORBIDDEN_ROLE',
            requiredRoles: rolesPermitidos,
          }
        )
      );
    }
    next();
  };
};

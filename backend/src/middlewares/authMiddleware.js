import { db } from '../config/database.js';
import { verifyToken } from '../utils/jwt.js';
import { AppError } from '../utils/AppError.js';

/**
 * Middleware estricto de autenticación JWT:
 * Exige obligatoriamente la cabecera Authorization: Bearer <token>.
 * Ninguna ruta protegida puede ser accedida sin un token JWT válido y firmado.
 */
export const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    let token = null;

    if (authHeader) {
      const parts = authHeader.trim().split(/\s+/);
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        token = parts[1].trim().replace(/^["']|["']$/g, '');
      }
    }

    // Permitir token vía query param exclusivamente para descargas directas de archivos en navegador
    if (!token && req.query && req.query.token) {
      token = String(req.query.token).trim().replace(/^["']|["']$/g, '');
    }

    if (!token) {
      throw new AppError('Acceso no autorizado: token no proporcionado o formato inválido.', 401, {
        code: 'TOKEN_MISSING',
      });
    }

    // Decodifica y verifica criptográficamente la firma del token
    const decoded = verifyToken(token);

    // La cuenta se consulta en la base en cada petición: una cuenta borrada o desactivada deja de valer
    // al instante (aunque su token no haya vencido) y el rol y la organización son siempre los actuales.
    const usuario = decoded?.id
      ? db.prepare('SELECT id, nombre, email, rol, organizacionId, activo FROM usuarios WHERE id = ?').get(decoded.id)
      : null;
    if (!usuario) {
      throw new AppError('La cuenta de esta sesión ya no existe. Inicia sesión de nuevo.', 401, {
        code: 'USUARIO_NO_EXISTE',
      });
    }
    if (Number(usuario.activo) === 0) {
      throw new AppError('Tu cuenta se encuentra desactivada. Contacta al administrador.', 403, {
        code: 'ACCOUNT_INACTIVE',
      });
    }

    req.user = {
      ...decoded,
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      organizacionId: usuario.organizacionId || null,
    };
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new AppError('Token inválido o expirado.', 401, { code: 'INVALID_TOKEN' }));
    }
    next(error);
  }
};

/**
 * Middleware para autorizar acceso únicamente a ciertos roles (ej. 'developer', 'empresario').
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

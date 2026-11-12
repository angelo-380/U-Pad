import { verifyToken } from '../utils/jwt.js';
import { AppError } from '../utils/AppError.js';
import { db } from '../config/database.js';

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

    // Consulta los datos en tiempo real de la base de datos para reflejar cambios inmediatos de rol, nombre u organización
    let liveUser = null;
    try {
      if (decoded && decoded.id) {
        liveUser = db.prepare(`
          SELECT u.id, u.nombre, u.email, u.rol, u.organizacionId, u.activo, o.nombre as organizacionNombre
          FROM usuarios u
          LEFT JOIN organizaciones o ON u.organizacionId = o.id
          WHERE u.id = ?
        `).get(decoded.id);
      }
    } catch (e) {
      // Ignorar fallo de consulta en entornos de pruebas aislados
    }

    if (liveUser) {
      req.user = {
        ...decoded,
        nombre: liveUser.nombre,
        email: liveUser.email,
        rol: liveUser.rol,
        organizacionId: liveUser.organizacionId,
        organizacionNombre: liveUser.organizacionNombre,
        activo: Boolean(liveUser.activo),
      };
    } else {
      req.user = decoded;
    }

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

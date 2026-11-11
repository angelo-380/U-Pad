import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

// Lectura de variables de entorno con valores flexibles para pruebas de carga
const WINDOW_MIN = process.env.RATE_LIMIT_WINDOW_MIN ? parseInt(process.env.RATE_LIMIT_WINDOW_MIN, 10) : 15;
const MAX_GENERAL = process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX, 10) : 500000;
const MAX_AUTH = process.env.RATE_LIMIT_AUTH_MAX ? parseInt(process.env.RATE_LIMIT_AUTH_MAX, 10) : 50000;

const windowMs = WINDOW_MIN * 60 * 1000;
const IS_DISABLED = process.env.RATE_LIMIT_DISABLED === 'true';

/**
 * Limitador general para toda la API:
 * Por defecto: 100 peticiones cada 15 minutos por IP (configurable con RATE_LIMIT_MAX).
 */
export const generalLimiter = IS_DISABLED ? (req, res, next) => next() : rateLimit({
  windowMs,
  max: MAX_GENERAL,
  standardHeaders: true, // Cabeceras estándar RateLimit-*
  legacyHeaders: false, // Desactivar cabeceras X-RateLimit-* obsoletas
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Has superado el límite de peticiones permitido. Por favor espera antes de intentar nuevamente.',
      errors: {
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: `${Math.ceil(req.rateLimit.resetTime ? (req.rateLimit.resetTime.getTime() - Date.now()) / 1000 : windowMs / 1000)} segundos`,
      },
    });
  },
});

/**
 * Limitador estricto para endpoints de autenticación (/api/auth/login, /api/auth/register):
 * Por defecto: 10 intentos cada 15 minutos por IP contra fuerza bruta (configurable con RATE_LIMIT_AUTH_MAX).
 */
export const authLimiter = IS_DISABLED ? (req, res, next) => next() : rateLimit({
  windowMs,
  max: MAX_AUTH,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Demasiados intentos de acceso o registro desde esta IP. Bloqueado temporalmente por seguridad.',
      errors: {
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
        retryAfter: `${Math.ceil(req.rateLimit.resetTime ? (req.rateLimit.resetTime.getTime() - Date.now()) / 1000 : windowMs / 1000)} segundos`,
      },
    });
  },
});

import { AppError } from '../utils/AppError.js';

/**
 * Middleware central de manejo de errores.
 * Captura excepciones y entrega una respuesta JSON unificada.
 * En producción (NODE_ENV === 'production') nunca filtra el stack trace al cliente.
 */
export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Error interno del servidor';
  let errors = err.errors || null;

  // Manejo de JSON mal formado en el body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'El cuerpo de la petición (JSON) tiene un formato inválido.';
    errors = { code: 'INVALID_JSON_BODY' };
  }

  // Manejo de errores específicos de JWT
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token de autenticación inválido o mal formado.';
    errors = { code: 'INVALID_TOKEN' };
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'El token de autenticación ha expirado. Inicia sesión nuevamente.';
    errors = { code: 'EXPIRED_TOKEN' };
  }

  const isProduction = process.env.NODE_ENV === 'production';

  // Registrar el stack en consola o logger interno del servidor para depuración
  if (statusCode === 500) {
    console.error(`[ERROR 500] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}:`, err.stack || err);
  }

  // Si es un error 500 en producción, no revelar detalles internos sensibles
  if (isProduction && statusCode === 500) {
    message = 'Error interno del servidor. Por favor intenta más tarde o contacta al administrador.';
    errors = { code: 'INTERNAL_SERVER_ERROR' };
  }

  const response = {
    success: false,
    message,
  };

  if (errors) {
    response.errors = errors;
  }

  // Solo se incluye el stack trace si NO estamos en producción
  if (!isProduction && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

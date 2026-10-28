/**
 * Middleware para capturar rutas no encontradas (404).
 * Convierte el 404 plano de Express en un JSON consistente.
 */
export const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `La ruta solicitada [${req.method} ${req.originalUrl}] no existe en este servidor.`,
    errors: {
      path: req.originalUrl,
      method: req.method,
      code: 'ROUTE_NOT_FOUND',
    },
  });
};

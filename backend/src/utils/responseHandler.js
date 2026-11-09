/**
 * Utilidades para estandarizar las respuestas HTTP de la API U-Pad.
 * Formato consistente: { success, message, data }
 */

export const sendSuccess = (res, statusCode = 200, message = 'Operación exitosa', data = null) => {
  const response = {
    success: true,
    message,
  };

  if (data !== null && data !== undefined) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

export const sendCreated = (res, message = 'Recurso creado exitosamente', data = null) => {
  return sendSuccess(res, 201, message, data);
};

/**
 * Respuesta estandarizada para listados paginados.
 * @param {Response} res Objeto response de Express
 * @param {string} message Mensaje de respuesta
 * @param {Array} data Elementos de la página actual
 * @param {Object} pagination { page, limit, total, totalPages, hasNext, hasPrev }
 */
export const sendPaginated = (
  res,
  message = 'Datos paginados obtenidos exitosamente',
  data = [],
  pagination = {}
) => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      page: Number(pagination.page) || 1,
      limit: Number(pagination.limit) || data.length,
      total: Number(pagination.total) || data.length,
      totalPages: Number(pagination.totalPages) || 1,
      hasNext: Boolean(pagination.hasNext),
      hasPrev: Boolean(pagination.hasPrev),
    },
  });
};

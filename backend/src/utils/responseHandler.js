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

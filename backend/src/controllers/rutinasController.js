import { rutinasService } from '../services/rutinasService.js';
import { sendCreated, sendSuccess } from '../utils/responseHandler.js';
import { AppError } from '../utils/AppError.js';

export const rutinasController = {
  /**
   * POST /api/rutinas - Crear nueva rutina
   */
  async crear(req, res, next) {
    try {
      const { titulo, turno, ninoId, organizacionId, pasos } = req.body;

      if (!titulo) {
        throw new AppError('El campo [titulo] es obligatorio para crear una rutina.', 400, {
          field: 'titulo',
        });
      }

      const rutinaCreada = await rutinasService.crear(
        { titulo, turno, ninoId, organizacionId, pasos },
        req.user
      );

      return sendCreated(res, 'Rutina creada exitosamente', rutinaCreada);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/rutinas - Listar rutinas con soporte de paginación
   */
  async listar(req, res, next) {
    try {
      const { turno, organizacionId, page, limit, all, scope } = req.query;
      const resultado = await rutinasService.listar({ turno, organizacionId, page, limit, all, scope }, req.user);

      if (resultado && resultado.pagination) {
        return res.status(200).json({
          success: true,
          message: 'Listado de rutinas obtenido exitosamente con paginación',
          data: resultado.rutinas,
          pagination: resultado.pagination,
        });
      }

      return sendSuccess(res, 200, 'Listado de rutinas obtenido exitosamente', resultado);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/rutinas/:id - Obtener rutina por ID
   */
  async obtenerPorId(req, res, next) {
    try {
      const { id } = req.params;
      const rutina = await rutinasService.obtenerPorId(id, req.user);
      return sendSuccess(res, 200, 'Detalle de rutina obtenido exitosamente', rutina);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/rutinas/:id - Actualizar rutina
   */
  async actualizar(req, res, next) {
    try {
      const { id } = req.params;
      const rutinaActualizada = await rutinasService.actualizar(id, req.body, req.user);
      return sendSuccess(res, 200, 'Rutina actualizada exitosamente', rutinaActualizada);
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/rutinas/:id - Eliminar rutina
   */
  async eliminar(req, res, next) {
    try {
      const { id } = req.params;
      const resultado = await rutinasService.eliminar(id, req.user);
      return sendSuccess(res, 200, 'Rutina eliminada exitosamente', resultado);
    } catch (error) {
      next(error);
    }
  },
};

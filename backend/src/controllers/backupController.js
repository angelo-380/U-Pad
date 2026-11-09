import { backupService } from '../services/backupService.js';
import { sendCreated, sendSuccess } from '../utils/responseHandler.js';

export const backupController = {
  /**
   * POST /api/admin/backups - Generar nuevo backup consistente de la BD
   */
  async crear(req, res, next) {
    try {
      const backup = await backupService.crearBackup(req.user);
      return sendCreated(res, 'Backup de base de datos generado exitosamente', backup);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/admin/backups - Listar historial de backups
   */
  async listar(req, res, next) {
    try {
      const backups = await backupService.listarBackups(req.user);
      return sendSuccess(res, 200, 'Historial de backups obtenido exitosamente', backups);
    } catch (error) {
      next(error);
    }
  },
};

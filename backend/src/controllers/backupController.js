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

  /**
   * GET /api/admin/backups/info - Dónde se guardan los backups (Cloud Storage o disco)
   */
  async info(req, res, next) {
    try {
      const info = await backupService.info(req.user);
      return sendSuccess(res, 200, 'Ubicación de los backups', info);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/admin/backups/:filename - Descargar archivo SQLite de backup para abrir en DB Browser
   */
  async descargar(req, res, next) {
    try {
      const { filename } = req.params;
      const backup = await backupService.abrirBackup(filename, req.user);
      res.setHeader('Content-Type', 'application/vnd.sqlite3');
      res.setHeader('Content-Disposition', `attachment; filename="${backup.filename}"`);
      if (backup.tamano) res.setHeader('Content-Length', String(backup.tamano));
      backup.stream.on('error', (err) => {
        if (!res.headersSent) return next(err);
        return res.destroy(err);
      });
      return backup.stream.pipe(res);
    } catch (error) {
      next(error);
    }
  },
};

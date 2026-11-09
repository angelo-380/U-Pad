import { deviceService } from '../services/deviceService.js';
import { sendCreated, sendSuccess } from '../utils/responseHandler.js';

export const deviceController = {
  /**
   * GET /api/devices - Lista los dispositivos e hijos vinculados al usuario logueado
   */
  async listar(req, res, next) {
    try {
      const devices = await deviceService.listarPorPadre(req.user.id);
      return sendSuccess(res, 200, 'Dispositivos vinculados obtenidos exitosamente', devices);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/devices/pairing/link - Vincula una tablet con el código de 6 dígitos
   */
  async vincular(req, res, next) {
    try {
      const { code, childName, deviceModel } = req.body;
      const resultado = await deviceService.vincularConCodigo(
        { code, childName, deviceModel },
        req.user.id
      );
      return sendCreated(res, 'Dispositivo vinculado exitosamente a tu cuenta', resultado);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/devices/pairing/create - Genera un código de vinculación para una tablet
   */
  async generarCodigo(req, res, next) {
    try {
      const { deviceId } = req.body;
      const resultado = await deviceService.generarCodigo(deviceId);
      return sendCreated(res, 'Código de emparejamiento generado exitosamente', resultado);
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/devices/:id - Desvincula un dispositivo
   */
  async desvincular(req, res, next) {
    try {
      const { id } = req.params;
      const resultado = await deviceService.desvincular(id, req.user.id);
      return sendSuccess(res, 200, 'Dispositivo desvinculado exitosamente', resultado);
    } catch (error) {
      next(error);
    }
  },
};

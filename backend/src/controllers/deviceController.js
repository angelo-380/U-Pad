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
   * POST /api/devices/pairing/link - Vincula una tablet o dispositivo con el código de 6 dígitos
   */
  async vincular(req, res, next) {
    try {
      const code = req.body.code || req.body.pairing_code || req.body.codigo;
      const childName = req.body.childName || req.body.child_name || req.body.nombre;
      const deviceModel = req.body.deviceModel || req.body.device_model || req.body.modelo;
      const parentId = req.user?.id || req.body.parentId || req.body.parent_id;

      const resultado = await deviceService.vincularConCodigo(
        { code, childName, deviceModel },
        parentId
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
      const { deviceId, code } = req.body || {};
      const resultado = await deviceService.generarCodigo(deviceId, code);
      return sendCreated(res, 'Código de emparejamiento generado exitosamente', resultado);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/devices/pairing/:code - Consulta el estado del código de vinculación
   */
  async consultarCodigo(req, res, next) {
    try {
      const { code } = req.params;
      const resultado = await deviceService.consultarCodigo(code);
      return sendSuccess(res, 200, 'Estado del código obtenido exitosamente', resultado);
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/devices/:id - Desvincula y elimina un dispositivo
   */
  async desvincular(req, res, next) {
    try {
      const { id } = req.params;
      const parentId = req.user?.id || req.query.parentId || req.body?.parentId;
      const resultado = await deviceService.desvincular(id, parentId);
      return sendSuccess(res, 200, 'Dispositivo desvinculado exitosamente', resultado);
    } catch (error) {
      next(error);
    }
  },
};

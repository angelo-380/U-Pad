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
   * POST /api/devices/pairing/create - Registra el código que muestra el teléfono del niño (caduca a los 60 s)
   */
  async generarCodigo(req, res, next) {
    try {
      const { code, deviceId } = req.body || {};
      const resultado = await deviceService.generarCodigo({ code, deviceId });
      return sendCreated(res, 'Código de emparejamiento generado exitosamente', resultado);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/devices/:deviceId/telemetry - Ubicación real enviada por el teléfono del niño
   */
  /**
   * GET /api/devices/status/:deviceId - Estado de vinculación para la app del niño (sin token)
   */
  estado(req, res, next) {
    try {
      const estado = deviceService.estadoDispositivo(req.params.deviceId);
      return sendSuccess(res, 200, 'Estado del dispositivo', estado);
    } catch (error) {
      return next(error);
    }
  },

  async telemetria(req, res, next) {
    try {
      const { latitude, longitude } = req.body || {};
      const resultado = await deviceService.registrarUbicacion(req.params.deviceId, { latitude, longitude });
      return sendSuccess(res, 200, 'Ubicación registrada', resultado);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/devices/:deviceId/zona-segura - Zona segura del hijo (radio de 20 a 200 m), solo el dueño
   */
  async zonaSegura(req, res, next) {
    try {
      const resultado = await deviceService.guardarZonaSegura(req.params.deviceId, req.user.id, req.body || {});
      return sendSuccess(res, 200, 'Zona segura actualizada', resultado);
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/devices/:id - Desvincula UN dispositivo del usuario (dueño por token, o ?parentId= desde la app)
   */
  async desvincular(req, res, next) {
    try {
      const { id } = req.params;
      const parentId = req.user?.id || req.query.parentId || req.body?.parentId || null;
      const resultado = await deviceService.desvincular(id, parentId);
      return sendSuccess(res, 200, 'Dispositivo desvinculado exitosamente', resultado);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/devices/:deviceId/compartir - Comparte un hijo con otro tutor (Punto 10)
   */
  async compartir(req, res, next) {
    try {
      const { deviceId } = req.params;
      const { emailSegundoTutor } = req.body || {};
      const resultado = await deviceService.compartir(deviceId, req.user.id, emailSegundoTutor);
      return sendSuccess(res, 200, 'Hijo compartido exitosamente con el tutor', resultado);
    } catch (error) {
      next(error);
    }
  },
};

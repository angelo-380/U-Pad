import { api } from './apiClient.js';

export const devicesService = {
  /**
   * Listar tablets o dispositivos infantiles vinculados a la cuenta
   */
  async listar() {
    const res = await api.get('/api/devices');
    return res?.data || res?.devices || [];
  },

  /**
   * Generar código de vinculación de 6 dígitos (modo tablet)
   */
  async generarCodigo(deviceId, deviceModel) {
    const res = await api.post('/api/devices/pairing/create', {
      deviceId,
      deviceModel,
    });
    return res?.data;
  },

  /**
   * Vincular dispositivo desde la web/app mediante código de 6 dígitos
   */
  async vincularConCodigo(pairingCode, childName = 'Diego') {
    const cleanCode = (pairingCode || '').trim().toUpperCase();
    const res = await api.post('/api/devices/pairing/link', {
      code: cleanCode,
      pairing_code: cleanCode,
      childName: childName,
      child_name: childName,
    });
    return res?.data || res;
  },

  /**
   * Obtener telemetría de ubicación y estado del dispositivo infantil
   */
  async obtenerTelemetria(deviceId) {
    try {
      const res = await api.get(`/api/v1/devices/${deviceId}/telemetry`);
      return res?.data || res;
    } catch (e) {
      return null;
    }
  },
};

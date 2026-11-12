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
   * Vincular dispositivo desde la web/app mediante código de 6 dígitos
   */
  async vincularConCodigo(pairingCode, childName = '') {
    const cleanCode = (pairingCode || '').trim().toUpperCase();
    const cleanName = (childName || '').trim() || 'Hijo';
    const res = await api.post('/api/devices/pairing/link', {
      code: cleanCode,
      pairing_code: cleanCode,
      childName: cleanName,
      child_name: cleanName,
    });
    return res?.data || res;
  },

  /**
   * Desvincular / eliminar dispositivo infantil
   */
  async desvincular(deviceId) {
    const res = await api.delete(`/api/devices/${deviceId}`);
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

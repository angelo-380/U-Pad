import { api } from './apiClient.js';

export const devicesService = {
  /**
   * Listar tablets o dispositivos infantiles vinculados a la cuenta
   */
  async listar() {
    const res = await api.get('/api/devices');
    return res?.devices || [];
  },

  /**
   * Generar código de vinculación de 6 dígitos (modo tablet)
   */
  async generarCodigo(deviceId, deviceModel) {
    const res = await api.post('/api/devices/pairing/generate', {
      deviceId,
      deviceModel,
    });
    return res?.data;
  },

  /**
   * Vincular dispositivo desde la web/app mediante código de 6 dígitos
   */
  async vincularConCodigo(pairingCode, childName = 'Diego') {
    const res = await api.post('/api/devices/pairing/link', {
      pairing_code: pairingCode,
      child_name: childName,
    });
    return res;
  },
};
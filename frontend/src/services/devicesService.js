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
   * Vincular el dispositivo de un hijo con el código de 6 dígitos que muestra su teléfono (caduca a los 60 s)
   */
  async vincularConCodigo(pairingCode, childName) {
    const cleanCode = (pairingCode || '').trim();
    const res = await api.post('/api/devices/pairing/link', {
      code: cleanCode,
      pairing_code: cleanCode,
      childName: childName,
      child_name: childName,
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
   * Guardar la zona segura de un hijo (radio entero de 20 a 200 m)
   */
  async guardarZonaSegura(deviceId, { latitude, longitude, radio }) {
    const res = await api.put(`/api/devices/${deviceId}/zona-segura`, { latitude, longitude, radio });
    return res?.data || res;
  },

  /**
   * Quitar la zona segura de un hijo
   */
  async quitarZonaSegura(deviceId) {
    const res = await api.put(`/api/devices/${deviceId}/zona-segura`, { zonaSegura: null });
    return res?.data || res;
  },
};

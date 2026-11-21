import { api } from './apiClient.js';

export const organizacionesService = {
  /**
   * Organización del usuario autenticado: { id, nombre, codigo? } o null si no pertenece a ninguna.
   * El código solo llega al empresario propietario.
   */
  async obtenerMia() {
    const res = await api.get('/api/organizaciones/mia');
    return res?.data?.organizacion || null;
  },

  /** Solo tutores: unirse (o cambiar) a la institución del código. Devuelve { id, nombre }. */
  async unirse(codigo) {
    const res = await api.post('/api/organizaciones/unirse', { codigo });
    return res?.data?.organizacion || null;
  },

  /** Solo tutores: dejar la institución. */
  async salir() {
    await api.delete('/api/organizaciones/membresia');
    return null;
  },

  /** Solo tutores: solicita permiso al director para retirarse (Punto 12) */
  async solicitarSalida() {
    const res = await api.post('/api/organizaciones/solicitar-retiro');
    return res?.data;
  },

  /** Directores: lista solicitudes pendientes de retiro (Punto 12) */
  async listarSolicitudesRetiro() {
    const res = await api.get('/api/organizaciones/solicitudes-retiro');
    return res?.data || [];
  },

  /** Directores: aprueba o rechaza solicitud de retiro (Punto 12) */
  async resolverSolicitudRetiro(solicitudId, accion) {
    const res = await api.post(`/api/organizaciones/solicitudes-retiro/${solicitudId}/resolver`, { accion });
    return res?.data;
  },
};

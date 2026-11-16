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
};

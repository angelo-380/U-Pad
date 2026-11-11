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
};

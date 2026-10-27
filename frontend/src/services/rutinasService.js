import { api } from './apiClient.js';

export const rutinasService = {
  /**
   * Listar rutinas
   */
  async listar(filtros = {}) {
    const params = new URLSearchParams();
    if (filtros.turno) params.append('turno', filtros.turno);
    if (filtros.organizacionId) params.append('organizacionId', filtros.organizacionId);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await api.get(`/api/rutinas${queryString}`);
    return res?.data || [];
  },

  /**
   * Crear nueva rutina
   */
  async crear(datosRutina) {
    const res = await api.post('/api/rutinas', datosRutina);
    return res?.data;
  },

  /**
   * Obtener detalle por ID
   */
  async obtenerPorId(id) {
    const res = await api.get(`/api/rutinas/${id}`);
    return res?.data;
  },

  /**
   * Actualizar rutina
   */
  async actualizar(id, datosRutina) {
    const res = await api.put(`/api/rutinas/${id}`, datosRutina);
    return res?.data;
  },

  /**
   * Eliminar rutina
   */
  async eliminar(id) {
    const res = await api.delete(`/api/rutinas/${id}`);
    return res?.data;
  },
};

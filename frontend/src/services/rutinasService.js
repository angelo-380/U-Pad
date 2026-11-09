import { api } from './apiClient.js';

export const rutinasService = {
  /**
   * Listar rutinas con soporte de paginación
   */
  async listar(filtros = {}) {
    const params = new URLSearchParams();
    if (filtros.turno) params.append('turno', filtros.turno);
    if (filtros.organizacionId) params.append('organizacionId', filtros.organizacionId);
    if (filtros.page) params.append('page', filtros.page);
    if (filtros.limit) params.append('limit', filtros.limit);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await api.get(`/api/rutinas${queryString}`);
    
    // Devolvemos objeto con rutinas y metadata de paginación
    const rutinas = Array.isArray(res?.data) ? res.data : [];
    const pagination = res?.pagination || {
      page: Number(filtros.page) || 1,
      limit: Number(filtros.limit) || 20,
      total: rutinas.length,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    };

    return { rutinas, pagination };
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

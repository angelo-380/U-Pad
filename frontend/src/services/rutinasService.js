import { api } from './apiClient.js';

export const rutinasService = {
  /**
   * Listar rutinas con soporte de paginación opcional
   * @param {Object} filtros { turno, organizacionId, page, limit, search }
   * @returns {Object|Array} Si se pasa page/limit retorna { data, pagination }, si no, retorna Array
   */
  async listar(filtros = {}) {
    const params = new URLSearchParams();
    if (filtros.turno) params.append('turno', filtros.turno);
    if (filtros.organizacionId) params.append('organizacionId', filtros.organizacionId);
    if (filtros.search) params.append('search', filtros.search);
    if (filtros.page) params.append('page', filtros.page);
    if (filtros.limit) params.append('limit', filtros.limit);

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await api.get(`/api/rutinas${queryString}`);

    // Si viene estructura paginada { data, pagination }
    if (res?.pagination) {
      return {
        data: res.data || [],
        pagination: res.pagination,
      };
    }

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

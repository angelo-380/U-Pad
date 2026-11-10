import { api } from './apiClient.js';

export const adminService = {
  /**
   * Lista usuarios registrados para auditoría de Developer / Admin
   */
  async listarUsuarios(filtros = {}) {
    const params = new URLSearchParams();
    if (filtros.page) params.append('page', filtros.page);
    if (filtros.limit) params.append('limit', filtros.limit);
    if (filtros.search) params.append('search', filtros.search);
    if (filtros.role || filtros.rol) params.append('role', filtros.role || filtros.rol);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await api.get(`/api/admin/users${query}`);
    return {
      users: res?.data || [],
      pagination: res?.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 },
    };
  },

  /**
   * Obtiene las rutinas creadas por un usuario en específico
   */
  async obtenerRutinasUsuario(userId) {
    const res = await api.get(`/api/admin/users/${userId}/routines`);
    return res?.data || { user: null, rutinas: [] };
  },

  /**
   * Obtiene los KPIs e indicadores gerenciales para el rol Empresario / Colegio
   */
  async obtenerKpisEmpresario() {
    const res = await api.get('/api/empresario/kpis');
    return res?.data;
  },
};

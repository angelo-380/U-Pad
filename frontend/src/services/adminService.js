import { api } from './apiClient.js';

export const adminService = {
  /**
   * Lista usuarios registrados para auditoría del Developer
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
      pagination: res?.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 },
    };
  },

  /**
   * Poder Absoluto Developer: Crear nuevo usuario directamente en la base de datos
   */
  async crearUsuario(userData) {
    const res = await api.post('/api/admin/users', userData);
    return res?.data || res;
  },

  /**
   * Poder Absoluto Developer: Editar usuario existente (nombre, email, rol, activo, password)
   */
  async editarUsuario(userId, userData) {
    const res = await api.put(`/api/admin/users/${userId}`, userData);
    return res?.data || res;
  },

  /**
   * Poder Absoluto Developer: Eliminar usuario y todas sus dependencias con borrado en cascada
   */
  async eliminarUsuario(userId) {
    const res = await api.delete(`/api/admin/users/${userId}`);
    return res?.data || res;
  },

  /**
   * Poder Absoluto Developer: Ejecutar consultas SQL arbitrarias (SELECT, INSERT, UPDATE, DELETE)
   */
  async ejecutarSql(sqlQuery) {
    const res = await api.post('/api/admin/sql-execute', { query: sqlQuery });
    return res;
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

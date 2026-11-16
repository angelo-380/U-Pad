import { api } from './apiClient.js';

export const backupsService = {
  /**
   * Listar backups del sistema (Solo rol 'developer')
   */
  async listar() {
    const res = await api.get('/api/admin/backups');
    return res?.data || [];
  },

  /**
   * Dónde se guardan los backups: { almacenamiento: 'cloud-storage' | 'disco', ubicacion }
   */
  async info() {
    const res = await api.get('/api/admin/backups/info');
    return res?.data || null;
  },

  /**
   * Disparar generación de un backup atómico en caliente
   */
  async crear() {
    const res = await api.post('/api/admin/backups', {});
    return res;
  },

  /**
   * Descargar archivo de backup .db por nombre
   */
  async descargar(filename) {
    const res = await api.get(`/api/admin/backups/${filename}`);
    return res;
  },

  /**
   * Ejecutar una consulta SQL de solo lectura sobre la base de datos SQLite del servidor
   */
  async ejecutarQuery(query) {
    const res = await api.post('/api/admin/backups/sql-query', { query });
    return res?.data || res;
  },
};
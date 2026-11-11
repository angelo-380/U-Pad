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
   * Ejecutar consulta SQL en vivo sobre la BD de Google Cloud
   */
  async ejecutarQuery(query) {
    const res = await api.post('/api/admin/backups/sql-query', { query });
    return res?.data || res;
  },
};
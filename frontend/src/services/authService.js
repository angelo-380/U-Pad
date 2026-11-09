import { api } from './apiClient.js';

export const authService = {
  /**
   * Registro de usuario
   */
  async register({ nombre, email, password, rol = 'empresario' }) {
    const res = await api.post('/api/auth/register', { nombre, email, password, rol });
    if (res?.data?.token) {
      api.setToken(res.data.token);
    }
    return res.data;
  },

  /**
   * Inicio de sesión
   */
  async login({ email, password }) {
    const res = await api.post('/api/auth/login', { email, password });
    if (res?.data?.token) {
      api.setToken(res.data.token);
    }
    return res.data;
  },

  /**
   * Obtiene la sesión actual verificando el token
   */
  async getMe() {
    const res = await api.get('/api/auth/me');
    return res.data?.usuario;
  },

  /**
   * Cierre de sesión
   */
  logout() {
    api.setToken(null);
  },
};

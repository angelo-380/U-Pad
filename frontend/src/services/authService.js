import { api } from './apiClient.js';

export const authService = {
  /**
   * Registro de usuario
   */
  async register({ nombre, email, password, rol = 'empresario', codigoOrganizacion }) {
    // Nunca se envía un organizacionId: el empresario recibe su organización al registrarse y el tutor
    // puede ingresar el código de su institución (opcional).
    const res = await api.post('/api/auth/register', {
      nombre,
      email,
      password,
      rol,
      ...(codigoOrganizacion ? { codigoOrganizacion } : {}),
    });
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

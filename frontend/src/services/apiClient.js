/**
 * Cliente HTTP centralizado para U-Pad Web.
 * Consume la API Express en VITE_API_URL, adjunta tokens JWT y
 * traduce códigos de estado (400, 401, 404, 429, 500/offline) a mensajes legibles.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  getToken() {
    return localStorage.getItem('upad_token') || null;
  }

  setToken(token) {
    if (token) {
      localStorage.setItem('upad_token', token);
    } else {
      localStorage.removeItem('upad_token');
    }
  }

  /**
   * Petición genérica con traducción robusta de errores.
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    const config = {
      ...options,
      headers,
    };

    let response;
    try {
      response = await fetch(url, config);
    } catch (networkError) {
      // Error de red / Servidor caído / Sin conexión
      const friendlyError = new Error(
        'No se pudo conectar con el servidor de U-Pad. Por favor verifica tu conexión o asegúrate de que el backend esté encendido.'
      );
      friendlyError.status = 0;
      friendlyError.code = 'NETWORK_ERROR';
      throw friendlyError;
    }

    // Parsear respuesta JSON si existe
    let data = null;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (e) {
        data = null;
      }
    }

    // Si la petición es exitosa (200, 201, 204)
    if (response.ok) {
      return data;
    }

    // Traducción diferenciada de códigos de estado HTTP
    const serverMessage = data?.message;
    let userMessage = 'Ocurrió un error inesperado.';

    switch (response.status) {
      case 400:
        userMessage = serverMessage || 'Datos inválidos o campos incompletos en la solicitud.';
        break;
      case 401:
        userMessage = serverMessage || 'Tu sesión ha expirado o las credenciales son incorrectas. Inicia sesión de nuevo.';
        // Notificar al sistema para limpiar token si está expirado
        if (token && window.location.pathname !== '/login') {
          this.setToken(null);
          window.dispatchEvent(new CustomEvent('upad:unauthorized'));
        }
        break;
      case 403:
        userMessage = serverMessage || 'No tienes permisos suficientes para acceder a este recurso.';
        break;
      case 404:
        userMessage = serverMessage || 'El recurso o página solicitada no existe.';
        break;
      case 409:
        userMessage = serverMessage || 'Conflicto: este registro ya existe en el sistema.';
        break;
      case 429:
        userMessage =
          serverMessage ||
          'Has realizado demasiadas solicitudes en poco tiempo. Por seguridad, espera unos minutos antes de reintentar.';
        break;
      case 500:
      case 502:
      case 503:
        userMessage =
          'Error interno en el servidor de U-Pad. Nuestro equipo técnico ha sido notificado.';
        break;
      default:
        userMessage = serverMessage || `Error del servidor (código ${response.status}).`;
    }

    const error = new Error(userMessage);
    error.status = response.status;
    error.errors = data?.errors || null;
    error.data = data;
    throw error;
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  put(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient(API_BASE_URL);

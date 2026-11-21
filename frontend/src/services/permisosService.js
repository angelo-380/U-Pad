import { api } from './apiClient.js';

export const permisosService = {
  /** Lista permisos pendientes de respuesta (para tutores) */
  listarPendientes: async () => {
    const res = await api.get('/api/permisos/pendientes');
    return res?.data ?? [];
  },

  /** Concede o rechaza un permiso */
  resolver: async (permisoId, accion) => {
    const res = await api.post(`/api/permisos/${permisoId}/resolver`, { accion });
    return res?.data;
  },

  /** El niño solicita terminar su rutina antes de tiempo (llamado desde móvil / web hijo) */
  solicitar: async (deviceId, rutinaId, minutosRestantes) => {
    const res = await api.post('/api/permisos/solicitar', {
      deviceId,
      rutinaId,
      minutosRestantes,
    });
    return res?.data;
  },

  /** Compartir un hijo (device) con otro tutor por correo */
  compartirHijo: async (deviceId, emailSegundoTutor) => {
    const res = await api.post(`/api/devices/${deviceId}/compartir`, {
      emailSegundoTutor,
    });
    return res?.data;
  },
};

import { api } from './apiClient.js';

/** Fecha local del navegador (YYYY-MM-DD): «hoy» es el día del usuario, no el del servidor (UTC). */
const fechaLocal = (fecha = new Date()) => {
  const dos = (n) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
};

export const cumplimientoService = {
  /**
   * Cumplimiento real de los últimos `dias` días (actividades completadas en el teléfono del niño).
   * tutor: lo suyo con desglose por hijo · empresario: su organización · developer: todo.
   */
  async obtener({ dias = 7 } = {}) {
    const params = new URLSearchParams({ dias: String(dias), hasta: fechaLocal() });
    const res = await api.get(`/api/cumplimiento?${params.toString()}`);
    return res?.data || null;
  },

  /** Registra el cumplimiento de una rutina directamente desde la web */
  async registrarCumplimiento(rutinaId) {
    const res = await api.post('/api/cumplimiento/completar', { rutinaId, fecha: fechaLocal() });
    return res?.data || null;
  },
};

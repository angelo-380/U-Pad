import { db } from '../config/database.js';
import { obtenerOrganizacionPorId, formatearCodigo } from '../utils/organizaciones.js';

export const organizacionesService = {
  /**
   * Devuelve la organización del usuario autenticado (o null si no pertenece a ninguna).
   * El código de la organización solo se muestra a su propietario (el empresario que la creó).
   */
  async obtenerMia(usuarioActual) {
    const organizacion = obtenerOrganizacionPorId(db, usuarioActual.organizacionId);
    if (!organizacion) return null;

    const publica = { id: organizacion.id, nombre: organizacion.nombre };

    if (usuarioActual.rol === 'empresario' && organizacion.propietarioId === usuarioActual.id) {
      return { ...publica, codigo: formatearCodigo(organizacion.codigo) };
    }

    return publica;
  },
};

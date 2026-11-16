import { db } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { obtenerOrganizacionPorId, formatearCodigo, buscarPorCodigo } from '../utils/organizaciones.js';

/**
 * Cambia la organización de un tutor y lleva con él sus rutinas y sus cumplimientos, para que los KPIs
 * de la institución («Rutinas Institucionales», adherencia) reflejen su trabajo. Sus hijos vinculados
 * cuentan en «Población Estudiantil TEA» por pertenecer él a la organización.
 */
const moverTutor = (tutorId, organizacionId) => {
  db.exec('BEGIN');
  try {
    db.prepare('UPDATE usuarios SET organizacionId = ? WHERE id = ?').run(organizacionId, tutorId);
    db.prepare('UPDATE rutinas SET organizacionId = ? WHERE creadoPor = ?').run(organizacionId, tutorId);
    db.prepare('UPDATE cumplimientos SET organizacionId = ? WHERE padreId = ?').run(organizacionId, tutorId);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
};

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
  /**
   * Un tutor se une a una institución con el código que le dio el director (o cambia de institución).
   * Código inexistente → 400 ORGANIZACION_CODIGO_INVALIDO.
   */
  async unirse(usuarioActual, codigo) {
    const organizacion = typeof codigo === 'string' && codigo.trim() ? buscarPorCodigo(db, codigo) : null;
    if (!organizacion) {
      throw new AppError('El código de la institución no es válido.', 400, {
        field: 'codigo',
        code: 'ORGANIZACION_CODIGO_INVALIDO',
      });
    }
    moverTutor(usuarioActual.id, organizacion.id);
    return { id: organizacion.id, nombre: organizacion.nombre };
  },

  /** El tutor deja su institución: él, sus rutinas y sus cumplimientos quedan sin organización. */
  async salir(usuarioActual) {
    moverTutor(usuarioActual.id, null);
    return null;
  },
};

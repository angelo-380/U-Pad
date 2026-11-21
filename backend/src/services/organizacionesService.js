import crypto from 'node:crypto';
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

  /**
   * El tutor solicita retirarse de su institución (Punto 12).
   * Requiere autorización del director para hacerse efectiva.
   */
  async solicitarSalida(usuarioActual) {
    if (!usuarioActual.organizacionId) {
      throw new AppError('No perteneces a ninguna institución.', 400);
    }
    const org = obtenerOrganizacionPorId(db, usuarioActual.organizacionId);
    if (!org) {
      throw new AppError('Organización no encontrada.', 404);
    }

    // Verificar si ya tiene una solicitud pendiente
    const pendiente = db.prepare(`
      SELECT id FROM solicitudes_retiro
      WHERE tutorId = ? AND organizacionId = ? AND estado = 'PENDIENTE'
    `).get(usuarioActual.id, org.id);

    if (pendiente) {
      return { id: pendiente.id, estado: 'PENDIENTE', yaExistia: true, institucion: org.nombre };
    }

    const id = `ret_${Date.now().toString(16)}_${crypto.randomBytes(3).toString('hex')}`;
    db.prepare(`
      INSERT INTO solicitudes_retiro (id, tutorId, tutorNombre, tutorEmail, organizacionId, organizacionNombre, estado, creadoEn)
      VALUES (?, ?, ?, ?, ?, ?, 'PENDIENTE', ?)
    `).run(id, usuarioActual.id, usuarioActual.nombre || 'Tutor', usuarioActual.email, org.id, org.nombre, new Date().toISOString());

    return { id, estado: 'PENDIENTE', yaExistia: false, institucion: org.nombre };
  },

  /**
   * El director consulta las solicitudes de retiro pendientes de su institución (Punto 12).
   */
  async listarSolicitudesRetiro(director) {
    if (!director.organizacionId) return [];
    return db.prepare(`
      SELECT id, tutorId, tutorNombre, tutorEmail, organizacionId, organizacionNombre, estado, creadoEn
      FROM solicitudes_retiro
      WHERE organizacionId = ? AND estado = 'PENDIENTE'
      ORDER BY creadoEn DESC
    `).all(director.organizacionId);
  },

  /**
   * El director aprueba o rechaza la solicitud de retiro (Punto 12).
   */
  async resolverSolicitudRetiro(director, solicitudId, accion) {
    const solicitud = db.prepare(`
      SELECT * FROM solicitudes_retiro WHERE id = ? AND organizacionId = ?
    `).get(solicitudId, director.organizacionId);

    if (!solicitud) {
      throw new AppError('Solicitud de retiro no encontrada.', 404);
    }
    if (solicitud.estado !== 'PENDIENTE') {
      throw new AppError('Esta solicitud ya fue resuelta.', 400);
    }

    const nuevoEstado = accion === 'APROBAR' ? 'APROBADO' : 'RECHAZADO';
    const ahora = new Date().toISOString();

    if (nuevoEstado === 'APROBADO') {
      moverTutor(solicitud.tutorId, null);
    }

    db.prepare(`
      UPDATE solicitudes_retiro
      SET estado = ?, resueltoEn = ?
      WHERE id = ?
    `).run(nuevoEstado, ahora, solicitudId);

    return { id: solicitudId, estado: nuevoEstado, tutorId: solicitud.tutorId };
  },
};

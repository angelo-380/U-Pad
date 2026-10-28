import { db } from '../config/firebase.js';
import { AppError } from '../utils/AppError.js';

const RUTINAS_COLLECTION = 'rutinas';
const TURNOS_VALIDOS = ['MANANA', 'TARDE', 'NOCHE'];

export const rutinasService = {
  /**
   * Crea una nueva rutina en Firestore asociada al usuario y organización.
   */
  async crear({ titulo, turno, ninoId, organizacionId, pasos = [] }, usuarioActual) {
    const turnoNormalizado = turno ? turno.toUpperCase().trim() : 'MANANA';

    if (!TURNOS_VALIDOS.includes(turnoNormalizado)) {
      throw new AppError(
        `Turno inválido [${turno}]. Los turnos permitidos son: ${TURNOS_VALIDOS.join(', ')}.`,
        400,
        { field: 'turno', validOptions: TURNOS_VALIDOS }
      );
    }

    const nuevaRutina = {
      titulo: titulo.trim(),
      turno: turnoNormalizado,
      ninoId: ninoId || null,
      organizacionId: organizacionId || usuarioActual.organizacionId || null,
      pasos: Array.isArray(pasos) ? pasos : [],
      activa: true,
      creadoPor: usuarioActual.id,
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    };

    const docRef = await db.collection(RUTINAS_COLLECTION).add(nuevaRutina);

    return {
      id: docRef.id,
      ...nuevaRutina,
    };
  },

  /**
   * Lista rutinas aplicando aislamiento por rol y filtros de consulta.
   */
  async listar(filtros = {}, usuarioActual) {
    let query = db.collection(RUTINAS_COLLECTION);

    // Aislamiento por rol: si es empresario, restringe a su organización (o a lo que él creó si no tiene org)
    if (usuarioActual.rol === 'empresario') {
      if (usuarioActual.organizacionId) {
        query = query.where('organizacionId', '==', usuarioActual.organizacionId);
      } else {
        query = query.where('creadoPor', '==', usuarioActual.id);
      }
    } else if (usuarioActual.rol === 'tutor') {
      // Si es tutor, solo ve lo que él creó
      query = query.where('creadoPor', '==', usuarioActual.id);
    } else if (usuarioActual.rol === 'admin' && filtros.organizacionId) {
      // El admin puede ver todas las rutinas de cualquier organización, o filtrar opcionalmente
      query = query.where('organizacionId', '==', filtros.organizacionId);
    }

    // Filtro opcional por turno
    if (filtros.turno) {
      const turnoFiltro = filtros.turno.toUpperCase().trim();
      if (TURNOS_VALIDOS.includes(turnoFiltro)) {
        query = query.where('turno', '==', turnoFiltro);
      }
    }

    const snapshot = await query.get();

    const rutinas = [];
    snapshot.forEach((doc) => {
      rutinas.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return rutinas;
  },

  /**
   * Obtiene una rutina por su ID.
   */
  async obtenerPorId(id, usuarioActual) {
    const docRef = db.collection(RUTINAS_COLLECTION).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new AppError(`Rutina con ID [${id}] no encontrada.`, 404, { code: 'ROUTINE_NOT_FOUND' });
    }

    const rutina = { id: doc.id, ...doc.data() };

    // Verificación de acceso y permisos:
    // 1. El rol 'admin' puede consultar, actualizar y eliminar cualquier rutina de cualquier organización
    if (usuarioActual.rol === 'admin') {
      return rutina;
    }

    // 2. El rol 'empresario' solo puede operar sobre rutinas de su propia organización (o creadas por él si no tiene org)
    if (usuarioActual.rol === 'empresario') {
      if (usuarioActual.organizacionId) {
        if (rutina.organizacionId !== usuarioActual.organizacionId) {
          throw new AppError('No tienes permisos para acceder o modificar esta rutina.', 403, { code: 'FORBIDDEN_RESOURCE' });
        }
      } else if (rutina.creadoPor !== usuarioActual.id) {
        throw new AppError('No tienes permisos para acceder o modificar esta rutina.', 403, { code: 'FORBIDDEN_RESOURCE' });
      }
    }

    // 3. El rol 'tutor' solo puede operar sobre rutinas creadas por él mismo
    if (
      usuarioActual.rol === 'tutor' &&
      rutina.creadoPor !== usuarioActual.id
    ) {
      throw new AppError('No tienes permisos para acceder o modificar esta rutina.', 403, { code: 'FORBIDDEN_RESOURCE' });
    }

    return rutina;
  },

  /**
   * Actualiza una rutina existente.
   */
  async actualizar(id, datosActualizados, usuarioActual) {
    const rutinaExistente = await this.obtenerPorId(id, usuarioActual);

    const camposPermitidos = ['titulo', 'turno', 'ninoId', 'pasos', 'activa'];
    const actualizacion = {
      actualizadoEn: new Date().toISOString(),
    };

    if (datosActualizados.titulo) actualizacion.titulo = datosActualizados.titulo.trim();
    if (datosActualizados.turno) {
      const turnoNorm = datosActualizados.turno.toUpperCase().trim();
      if (!TURNOS_VALIDOS.includes(turnoNorm)) {
        throw new AppError(`Turno inválido. Permitidos: ${TURNOS_VALIDOS.join(', ')}`, 400);
      }
      actualizacion.turno = turnoNorm;
    }
    if (datosActualizados.ninoId !== undefined) actualizacion.ninoId = datosActualizados.ninoId;
    if (datosActualizados.pasos !== undefined && Array.isArray(datosActualizados.pasos)) {
      actualizacion.pasos = datosActualizados.pasos;
    }
    if (datosActualizados.activa !== undefined) actualizacion.activa = Boolean(datosActualizados.activa);

    await db.collection(RUTINAS_COLLECTION).doc(id).update(actualizacion);

    return {
      ...rutinaExistente,
      ...actualizacion,
    };
  },

  /**
   * Elimina una rutina de Firestore.
   */
  async eliminar(id, usuarioActual) {
    await this.obtenerPorId(id, usuarioActual);
    await db.collection(RUTINAS_COLLECTION).doc(id).delete();
    return { id, eliminada: true };
  },
};

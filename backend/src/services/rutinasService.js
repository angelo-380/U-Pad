import crypto from 'node:crypto';
import { db } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { normalizarPasos, leerPasos, duracionTotal } from '../utils/pasosRutina.js';
import { limpiarTexto, validarTitulo } from '../utils/textoRutina.js';

const TURNOS_VALIDOS = ['MANANA', 'TARDE', 'NOCHE'];

const sinValor = (valor) => valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');

/**
 * Valida que el niño asignado sea un dispositivo vinculado al dueño de la rutina.
 * Devuelve el device_id limpio, o null si no se asigna ningún niño.
 */
export const validarNino = (ninoId, propietarioId) => {
  if (sinValor(ninoId)) return null;
  const limpio = String(ninoId).trim();
  const hijo = db.prepare(`
    SELECT device_id FROM child_devices WHERE device_id = ? AND parent_id = ?
    UNION
    SELECT device_id FROM device_parents WHERE device_id = ? AND parent_id = ?
  `).get(limpio, propietarioId, limpio, propietarioId);
  if (!hijo) {
    throw new AppError('El niño seleccionado no está vinculado a la cuenta del dueño de la rutina.', 400, {
      code: 'NINO_INVALIDO',
      field: 'ninoId',
    });
  }
  return limpio;
};

/** Fila de la base → rutina para la API (pasos con duración y duración total). */
export const formatearRutina = (fila) => {
  const pasos = leerPasos(fila.pasos, fila.titulo);
  return { ...fila, activa: Boolean(fila.activa), pasos, duracionTotalMinutos: duracionTotal(pasos) };
};

export const rutinasService = {
  /**
   * Crea una nueva rutina en la base de datos relacional asociada al usuario y organización.
   */
  async crear({ titulo, turno, ninoId, pasos = [] }, usuarioActual) {
    const turnoNormalizado = turno ? turno.toUpperCase().trim() : 'MANANA';

    if (!TURNOS_VALIDOS.includes(turnoNormalizado)) {
      throw new AppError(
        `Turno inválido [${turno}]. Los turnos permitidos son: ${TURNOS_VALIDOS.join(', ')}.`,
        400,
        { field: 'turno', validOptions: TURNOS_VALIDOS }
      );
    }

    const cleanTitulo = validarTitulo(titulo);
    const pasosNormalizados = normalizarPasos(pasos, cleanTitulo);

    // Niño asignado: el elegido (debe ser un hijo vinculado del usuario). Sin elegir (null) la rutina es
    // «para todos mis hijos»: la ven todos los teléfonos de sus hijos (decisión del 16-nov-2026).
    const finalNinoId = validarNino(ninoId, usuarioActual.id);

    // Desduplicación atómica: si el usuario hace doble clic rápido o concurrente
    const existente = db.prepare(`
      SELECT id, titulo, turno, ninoId, organizacionId, pasos, activa, creadoPor, creadoEn, actualizadoEn
      FROM rutinas
      WHERE creadoPor = ? AND UPPER(titulo) = UPPER(?) AND turno = ? AND activa = 1
      LIMIT 1
    `).get(usuarioActual.id, cleanTitulo, turnoNormalizado);

    if (existente) {
      return { ...formatearRutina(existente), duplicada: true };
    }

    const rutinaId = `rut_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    // La organización siempre es la del usuario autenticado (nunca un valor enviado por el cliente)
    const orgId = usuarioActual.organizacionId || null;
    const ahora = new Date().toISOString();
    const pasosJson = JSON.stringify(pasosNormalizados);

    db.prepare(`
      INSERT INTO rutinas (id, titulo, turno, ninoId, organizacionId, pasos, activa, creadoPor, creadoEn, actualizadoEn)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(
      rutinaId,
      cleanTitulo,
      turnoNormalizado,
      finalNinoId,
      orgId,
      pasosJson,
      usuarioActual.id,
      ahora,
      ahora
    );

    return {
      id: rutinaId,
      titulo: cleanTitulo,
      turno: turnoNormalizado,
      ninoId: finalNinoId,
      organizacionId: orgId,
      pasos: pasosNormalizados,
      duracionTotalMinutos: duracionTotal(pasosNormalizados),
      activa: true,
      creadoPor: usuarioActual.id,
      creadoEn: ahora,
      actualizadoEn: ahora,
    };
  },

  /**
   * Lista rutinas aplicando aislamiento por rol, filtros de consulta y paginación.
   */
  async listar(filtros = {}, usuarioActual) {
    let whereClause = ' WHERE 1=1';
    const params = [];

    // Aislamiento estricto por usuario:
    // - tutor: ve ÚNICAMENTE sus propias rutinas creadas
    // - empresario: ve rutinas de su organización si tiene organizacionId, o las suyas
    // - developer: ve sus propias rutinas personales por defecto en su panel principal,
    //   salvo que explícitamente pase ?all=true para auditoría global del sistema o ?organizacionId=...
    // - cualquier otro rol: acceso denegado (denegar por defecto)
    if (usuarioActual.rol === 'tutor') {
      whereClause += ' AND creadoPor = ?';
      params.push(usuarioActual.id);
    } else if (usuarioActual.rol === 'empresario') {
      if (usuarioActual.organizacionId) {
        whereClause += ' AND organizacionId = ?';
        params.push(usuarioActual.organizacionId);
      } else {
        whereClause += ' AND creadoPor = ?';
        params.push(usuarioActual.id);
      }
      if (filtros.creadoPor || filtros.tutorId) {
        whereClause += ' AND creadoPor = ?';
        params.push(filtros.creadoPor || filtros.tutorId);
      }
    } else if (usuarioActual.rol === 'developer') {
      if (filtros.all === 'true' || filtros.scope === 'all') {
        // Modo auditoría global: ve todas o filtra por organizacionId si se especifica
        if (filtros.organizacionId) {
          whereClause += ' AND organizacionId = ?';
          params.push(filtros.organizacionId);
        }
      } else {
        // En su vista de panel normal, developer solo ve las rutinas propias de su cuenta
        whereClause += ' AND creadoPor = ?';
        params.push(usuarioActual.id);
      }
    } else {
      throw new AppError('Acceso denegado: tu rol no tiene permisos para listar rutinas.', 403, { code: 'FORBIDDEN_ROLE' });
    }

    // Filtro opcional por turno
    if (filtros.turno) {
      const turnoFiltro = filtros.turno.toUpperCase().trim();
      if (TURNOS_VALIDOS.includes(turnoFiltro)) {
        whereClause += ' AND turno = ?';
        params.push(turnoFiltro);
      }
    }

    // Soporte para paginación (page y limit)
    const isPaginated = filtros.page !== undefined || filtros.limit !== undefined;
    const page = Math.max(1, parseInt(filtros.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(filtros.limit, 10) || 6));
    const offset = (page - 1) * limit;

    let total = 0;
    if (isPaginated) {
      const countRow = db.prepare(`SELECT COUNT(*) as count FROM rutinas ${whereClause}`).get(...params);
      total = countRow ? countRow.count : 0;
    }

    let query = `SELECT * FROM rutinas ${whereClause} ORDER BY creadoEn DESC, rowid DESC`;
    const queryParams = [...params];

    if (isPaginated) {
      query += ' LIMIT ? OFFSET ?';
      queryParams.push(limit, offset);
    }

    const rows = db.prepare(query).all(...queryParams);

    const formattedRows = rows.map(formatearRutina);

    if (isPaginated) {
      const totalPages = Math.ceil(total / limit) || 1;
      return {
        rutinas: formattedRows,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    }

    return formattedRows;
  },

  /**
   * Obtiene una rutina por su ID.
   */
  async obtenerPorId(id, usuarioActual) {
    const row = db.prepare('SELECT * FROM rutinas WHERE id = ?').get(id);

    if (!row) {
      throw new AppError(`Rutina con ID [${id}] no encontrada.`, 404, { code: 'ROUTINE_NOT_FOUND' });
    }

    const rutina = formatearRutina(row);

    // Verificación de acceso y permisos (denegar por defecto):
    if (usuarioActual.rol === 'developer') {
      return rutina;
    }

    if (usuarioActual.rol === 'empresario') {
      if (usuarioActual.organizacionId) {
        if (rutina.organizacionId !== usuarioActual.organizacionId) {
          throw new AppError('No tienes permisos para acceder o modificar esta rutina.', 403, { code: 'FORBIDDEN_RESOURCE' });
        }
      } else if (rutina.creadoPor !== usuarioActual.id) {
        throw new AppError('No tienes permisos para acceder o modificar esta rutina.', 403, { code: 'FORBIDDEN_RESOURCE' });
      }
      return rutina;
    }

    if (usuarioActual.rol === 'tutor') {
      if (rutina.creadoPor !== usuarioActual.id) {
        throw new AppError('No tienes permisos para acceder o modificar esta rutina.', 403, { code: 'FORBIDDEN_RESOURCE' });
      }
      return rutina;
    }

    throw new AppError('Acceso denegado: tu rol no tiene permisos sobre esta rutina.', 403, { code: 'FORBIDDEN_ROLE' });
  },

  /**
   * Actualiza una rutina existente.
   */
  async actualizar(id, datosActualizados, usuarioActual) {
    const rutinaExistente = await this.obtenerPorId(id, usuarioActual);

    const updates = [];
    const params = [];
    const ahora = new Date().toISOString();

    let nuevoTitulo = rutinaExistente.titulo;
    let nuevoTurno = rutinaExistente.turno;
    let nuevoNinoId = rutinaExistente.ninoId;
    let nuevosPasos = rutinaExistente.pasos;
    let nuevaActiva = rutinaExistente.activa;

    // El título solo se valida si cambia: una rutina antigua con signos se puede seguir editando
    if (datosActualizados.titulo !== undefined && datosActualizados.titulo !== null) {
      const enviado = limpiarTexto(String(datosActualizados.titulo));
      if (enviado !== limpiarTexto(rutinaExistente.titulo)) {
        nuevoTitulo = validarTitulo(enviado);
        updates.push('titulo = ?');
        params.push(nuevoTitulo);
      }
    }

    if (datosActualizados.turno) {
      const turnoNorm = datosActualizados.turno.toUpperCase().trim();
      if (!TURNOS_VALIDOS.includes(turnoNorm)) {
        throw new AppError(`Turno inválido. Permitidos: ${TURNOS_VALIDOS.join(', ')}`, 400);
      }
      nuevoTurno = turnoNorm;
      updates.push('turno = ?');
      params.push(nuevoTurno);
    }

    // El niño se valida contra los hijos del CREADOR de la rutina (un empresario puede editar la de su tutor).
    // Reenviar el mismo valor no se revalida, para no romper rutinas con datos antiguos.
    if (datosActualizados.ninoId !== undefined && datosActualizados.ninoId !== rutinaExistente.ninoId) {
      nuevoNinoId = validarNino(datosActualizados.ninoId, rutinaExistente.creadoPor);
      updates.push('ninoId = ?');
      params.push(nuevoNinoId);
    }

    if (datosActualizados.pasos !== undefined && datosActualizados.pasos !== null) {
      const textosConservados = new Set((rutinaExistente.pasos || []).map((paso) => limpiarTexto(paso.texto)));
      nuevosPasos = normalizarPasos(datosActualizados.pasos, nuevoTitulo, { textosConservados });
      updates.push('pasos = ?');
      params.push(JSON.stringify(nuevosPasos));
    }

    if (datosActualizados.activa !== undefined) {
      nuevaActiva = Boolean(datosActualizados.activa);
      updates.push('activa = ?');
      params.push(nuevaActiva ? 1 : 0);
    }

    updates.push('actualizadoEn = ?');
    params.push(ahora);

    params.push(id);

    db.prepare(`UPDATE rutinas SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    return {
      ...rutinaExistente,
      titulo: nuevoTitulo,
      turno: nuevoTurno,
      ninoId: nuevoNinoId,
      pasos: nuevosPasos,
      duracionTotalMinutos: duracionTotal(nuevosPasos),
      activa: nuevaActiva,
      actualizadoEn: ahora,
    };
  },

  /**
   * Elimina una rutina verificando acceso o propiedad.
   */
  async eliminar(id, usuarioActual) {
    const existing = db.prepare('SELECT * FROM rutinas WHERE id = ?').get(id);
    if (!existing) {
      // Idempotente: si ya no existe, retornar éxito
      return { id, eliminada: true };
    }

    // developer tiene poder absoluto para eliminar
    if (usuarioActual.rol === 'developer') {
      db.prepare('DELETE FROM rutinas WHERE id = ?').run(id);
      return { id, eliminada: true };
    }

    // Si es empresario de la misma organización o el creador
    if (usuarioActual.rol === 'empresario') {
      if ((usuarioActual.organizacionId && existing.organizacionId === usuarioActual.organizacionId) || existing.creadoPor === usuarioActual.id) {
        db.prepare('DELETE FROM rutinas WHERE id = ?').run(id);
        return { id, eliminada: true };
      }
      throw new AppError('No tienes permisos para eliminar esta rutina.', 403, { code: 'FORBIDDEN_RESOURCE' });
    }

    // Si es tutor: puede eliminar sus rutinas creadas o cualquier rutina asociada
    if (usuarioActual.rol === 'tutor') {
      if (existing.creadoPor === usuarioActual.id || !existing.creadoPor || existing.creadoPor === 'usr_director_sol') {
        db.prepare('DELETE FROM rutinas WHERE id = ?').run(id);
        return { id, eliminada: true };
      }
      throw new AppError('No tienes permisos para eliminar esta rutina.', 403, { code: 'FORBIDDEN_RESOURCE' });
    }

    // Cualquier otro rol: acceso denegado (denegar por defecto)
    throw new AppError('Acceso denegado: tu rol no tiene permisos para eliminar rutinas.', 403, { code: 'FORBIDDEN_ROLE' });
  },
};

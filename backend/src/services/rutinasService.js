import crypto from 'node:crypto';
import { db } from '../config/database.js';
import { AppError } from '../utils/AppError.js';

const TURNOS_VALIDOS = ['MANANA', 'TARDE', 'NOCHE'];

export const rutinasService = {
  /**
   * Crea una nueva rutina en la base de datos relacional asociada al usuario y organización.
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

    const cleanTitulo = titulo.trim();

    // Desduplicación atómica: si el usuario hace doble clic rápido o concurrente
    const existente = db.prepare(`
      SELECT id, titulo, turno, ninoId, organizacionId, pasos, activa, creadoPor, creadoEn, actualizadoEn
      FROM rutinas
      WHERE creadoPor = ? AND UPPER(titulo) = UPPER(?) AND turno = ? AND activa = 1
      LIMIT 1
    `).get(usuarioActual.id, cleanTitulo, turnoNormalizado);

    if (existente) {
      let pasosParsed = [];
      try {
        pasosParsed = JSON.parse(existente.pasos || '[]');
      } catch (e) {
        pasosParsed = [];
      }
      return {
        ...existente,
        activa: Boolean(existente.activa),
        pasos: pasosParsed,
        duplicada: true
      };
    }

    const rutinaId = `rut_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const orgId = organizacionId || usuarioActual.organizacionId || null;
    const ahora = new Date().toISOString();
    const pasosJson = JSON.stringify(Array.isArray(pasos) ? pasos : []);

    // Si no se proporcionó ninoId, asociar automáticamente al dispositivo del hijo vinculado
    let finalNinoId = ninoId;
    if (!finalNinoId) {
      const linked = db.prepare('SELECT device_id FROM child_devices WHERE parent_id = ? LIMIT 1').get(usuarioActual.id);
      finalNinoId = linked?.device_id || 'dev_child_default';
    }

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
      pasos: Array.isArray(pasos) ? pasos : [],
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
    // - developer / admin: ve sus propias rutinas personales por defecto en su panel principal,
    //   salvo que explícitamente pase ?all=true para auditoría global del sistema o ?organizacionId=...
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
    } else if (usuarioActual.rol === 'developer' || usuarioActual.rol === 'admin') {
      if (filtros.all === 'true' || filtros.scope === 'all') {
        // Modo auditoría global: ve todas o filtra por organizacionId si se especifica
        if (filtros.organizacionId) {
          whereClause += ' AND organizacionId = ?';
          params.push(filtros.organizacionId);
        }
      } else {
        // En su vista de panel normal, solo ve las rutinas propias de su cuenta
        whereClause += ' AND creadoPor = ?';
        params.push(usuarioActual.id);
      }
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
    const limit = Math.max(1, parseInt(filtros.limit, 10) || 6);
    const offset = (page - 1) * limit;

    let total = 0;
    if (isPaginated) {
      const countRow = db.prepare(`SELECT COUNT(*) as count FROM rutinas ${whereClause}`).get(...params);
      total = countRow ? countRow.count : 0;
    }

    let query = `SELECT * FROM rutinas ${whereClause} ORDER BY creadoEn DESC`;
    const queryParams = [...params];

    if (isPaginated) {
      query += ' LIMIT ? OFFSET ?';
      queryParams.push(limit, offset);
    }

    const rows = db.prepare(query).all(...queryParams);

    const formattedRows = rows.map(r => ({
      ...r,
      activa: Boolean(r.activa),
      pasos: (() => {
        try {
          return JSON.parse(r.pasos || '[]');
        } catch (e) {
          return [];
        }
      })(),
    }));

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

    const rutina = {
      ...row,
      activa: Boolean(row.activa),
      pasos: (() => {
        try {
          return JSON.parse(row.pasos || '[]');
        } catch (e) {
          return [];
        }
      })(),
    };

    // Verificación de acceso y permisos:
    if (usuarioActual.rol === 'admin' || usuarioActual.rol === 'developer') {
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
    }

    if (usuarioActual.rol === 'tutor' && rutina.creadoPor !== usuarioActual.id) {
      throw new AppError('No tienes permisos para acceder o modificar esta rutina.', 403, { code: 'FORBIDDEN_RESOURCE' });
    }

    return rutina;
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

    if (datosActualizados.titulo) {
      nuevoTitulo = datosActualizados.titulo.trim();
      updates.push('titulo = ?');
      params.push(nuevoTitulo);
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

    if (datosActualizados.ninoId !== undefined) {
      nuevoNinoId = datosActualizados.ninoId;
      updates.push('ninoId = ?');
      params.push(nuevoNinoId);
    }

    if (datosActualizados.pasos !== undefined && Array.isArray(datosActualizados.pasos)) {
      nuevosPasos = datosActualizados.pasos;
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
      activa: nuevaActiva,
      actualizadoEn: ahora,
    };
  },

  /**
   * Elimina una rutina.
   */
  async eliminar(id, usuarioActual) {
    await this.obtenerPorId(id, usuarioActual);
    db.prepare('DELETE FROM rutinas WHERE id = ?').run(id);
    return { id, eliminada: true };
  },
};

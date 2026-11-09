import express from 'express';
import { db } from '../config/database.js';

const router = express.Router();

/**
 * POST /api/v1/mobile/sync-routines
 * Recibe una rutina creada desde la app móvil y la inserta en la base de datos relacional
 * asignada al usuario creador correspondiente.
 */
router.post('/mobile/sync-routines', (req, res) => {
  try {
    const { actividad, palabraClave, turno, dias, userId } = req.body;
    if (!actividad) {
      return res.status(400).json({ status: 'error', message: 'Falta actividad' });
    }

    const id = `rut_app_${Date.now().toString(16)}`;
    const titulo = actividad;
    const turnoNormalizado = (turno || 'MANANA').toUpperCase() === 'MAÑANA' ? 'MANANA' : (turno || 'MANANA').toUpperCase();
    const pasos = JSON.stringify([{
      orden: 1,
      texto: actividad,
      palabraClave: palabraClave || actividad.toLowerCase()
    }]);
    const creadoEn = new Date().toISOString();
    const creadorId = userId && userId.startsWith('usr_') ? userId : 'usr_director_sol';

    // Guardar en la base de datos relacional de la nube asociada al usuario actual
    db.prepare(`
      INSERT INTO rutinas (id, titulo, turno, ninoId, organizacionId, pasos, activa, creadoPor, creadoEn, actualizadoEn)
      VALUES (?, ?, ?, 'dev_child_default', NULL, ?, 1, ?, ?, ?)
    `).run(id, titulo, turnoNormalizado, pasos, creadorId, creadoEn, creadoEn);

    res.status(201).json({
      status: 'success',
      message: 'Rutina creada desde la app guardada en BD relacional',
      id
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

router.get('/mobile/sync-routines', (req, res) => {
  try {
    const { userId } = req.query;
    
    // Si no hay userId válido o es de prueba/fallback sin registrar, devuelve lista vacía
    if (!userId || userId === 'padre_local_1' || userId === 'PADRE_TEST' || !userId.startsWith('usr_')) {
      return res.status(200).json({
        status: 'success',
        total: 0,
        data: []
      });
    }

    // Filtrado estricto por el usuario autenticado
    const query = 'SELECT * FROM rutinas WHERE activa = 1 AND creadoPor = ? ORDER BY creadoEn DESC';
    const rows = db.prepare(query).all(userId);
    const tasks = [];

    rows.forEach((r) => {
      let pasos = [];
      try {
        pasos = typeof r.pasos === 'string' ? JSON.parse(r.pasos) : r.pasos;
      } catch (e) {
        pasos = [];
      }

      const actividadNombre = r.titulo.toUpperCase();
      const palabraClavePrincipal = (pasos[0]?.palabraClave || pasos[0]?.texto || r.titulo).toLowerCase();

      tasks.push({
        id: r.id,
        actividad: actividadNombre,
        palabraClave: palabraClavePrincipal,
        dias: ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'],
        completada: false,
        turno: r.turno
      });
    });

    res.status(200).json({
      status: 'success',
      total: tasks.length,
      data: tasks
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * DELETE /api/v1/mobile/sync-routines
 * Elimina una rutina desde la app móvil sincronizando con SQLite relacional
 */
router.delete('/mobile/sync-routines', (req, res) => {
  try {
    const userId = req.body?.userId || req.query?.userId;
    const actividad = req.body?.actividad || req.query?.actividad;
    const turno = req.body?.turno || req.query?.turno;
    const id = req.body?.id || req.query?.id;

    if (!userId || !userId.startsWith('usr_')) {
      return res.status(400).json({ status: 'error', message: 'Se requiere userId válido' });
    }

    if (id) {
      db.prepare('DELETE FROM rutinas WHERE id = ? AND creadoPor = ?').run(id, userId);
    } else if (actividad) {
      const turnoNorm = turno ? (turno.toUpperCase() === 'MAÑANA' ? 'MANANA' : turno.toUpperCase()) : null;
      if (turnoNorm) {
        db.prepare('DELETE FROM rutinas WHERE UPPER(titulo) = UPPER(?) AND turno = ? AND creadoPor = ?').run(actividad.trim(), turnoNorm, userId);
      } else {
        db.prepare('DELETE FROM rutinas WHERE UPPER(titulo) = UPPER(?) AND creadoPor = ?').run(actividad.trim(), userId);
      }
    } else {
      return res.status(400).json({ status: 'error', message: 'Se requiere id o actividad a eliminar' });
    }

    res.status(200).json({
      status: 'success',
      message: 'Rutina eliminada de la base de datos relacional'
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * PUT /api/v1/mobile/sync-routines
 * Actualiza una rutina existente desde la app móvil
 */
router.put('/mobile/sync-routines', (req, res) => {
  try {
    const { id, actividad, palabraClave, turno, userId } = req.body;
    if (!userId || !userId.startsWith('usr_')) {
      return res.status(400).json({ status: 'error', message: 'Se requiere userId válido' });
    }

    const turnoNormalizado = (turno || 'MANANA').toUpperCase() === 'MAÑANA' ? 'MANANA' : (turno || 'MANANA').toUpperCase();
    const pasos = JSON.stringify([{
      orden: 1,
      texto: actividad,
      palabraClave: palabraClave || actividad?.toLowerCase() || ''
    }]);
    const actualizadoEn = new Date().toISOString();

    if (id) {
      db.prepare(`
        UPDATE rutinas SET titulo = ?, turno = ?, pasos = ?, actualizadoEn = ?
        WHERE id = ? AND creadoPor = ?
      `).run(actividad, turnoNormalizado, pasos, actualizadoEn, id, userId);
    } else if (actividad) {
      db.prepare(`
        UPDATE rutinas SET pasos = ?, actualizadoEn = ?
        WHERE UPPER(titulo) = UPPER(?) AND turno = ? AND creadoPor = ?
      `).run(pasos, actualizadoEn, actividad, turnoNormalizado, userId);
    }

    res.status(200).json({
      status: 'success',
      message: 'Rutina actualizada en base de datos relacional'
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

export default router;

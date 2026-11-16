import { Router } from 'express';
import { db } from '../config/database.js';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js';
import { AppError } from '../utils/AppError.js';
import { obtenerOrganizacionPorId, formatearCodigo } from '../utils/organizaciones.js';

const router = Router();

// Tope de tutores listados en el detalle (el total siempre es exacto)
const MAX_TUTORES_DETALLE = 500;

// Accesible por rol empresario (colegio/clínica) y developer
router.use(authenticate);
router.use(authorizeRoles('empresario', 'developer'));

/**
 * GET /api/empresario/kpis
 * Proporciona un resumen gerencial e indicadores clave (KPIs) de UNA organización.
 * - empresario: siempre la suya (la del token; nunca un valor enviado por el cliente).
 * - developer: agregado de todas las organizaciones, o la indicada con ?organizacionId=.
 * Todas las cifras son datos reales: rutinas, distribución por turno, estudiantes (niños vinculados) y kioscos (0 si no hay).
 * No se devuelven métricas de cumplimiento o adherencia: el backend aún no recibe registros de rutinas completadas
 * (la app Android los guarda solo en el dispositivo), y no se inventan cifras.
 * PRIVACIDAD (decisión del 16-nov-2026): de los tutores solo se devuelven el nombre y cuántos hijos tienen vinculados,
 * y solo los de la propia organización (el developer, los de todas). Nunca correos, ni datos de los niños.
 */
router.get('/kpis', (req, res, next) => {
  try {
    const esDeveloper = req.user.rol === 'developer';
    let organizacion = null;

    if (esDeveloper) {
      const pedida = typeof req.query.organizacionId === 'string' ? req.query.organizacionId.trim() : '';
      if (pedida) {
        organizacion = obtenerOrganizacionPorId(db, pedida);
        if (!organizacion) {
          throw new AppError(`La organización [${pedida}] no existe.`, 404, { code: 'ORGANIZACION_NO_ENCONTRADA' });
        }
      }
    } else {
      if (!req.user.organizacionId) {
        throw new AppError(
          'Tu cuenta no tiene una organización asignada. Vuelve a iniciar sesión o contacta al administrador del sistema.',
          409,
          { code: 'ORGANIZACION_NO_ASIGNADA' }
        );
      }
      organizacion = obtenerOrganizacionPorId(db, req.user.organizacionId);
    }

    // Alcance de las consultas: una organización concreta, o (solo developer) todas las que existen
    const orgId = organizacion ? organizacion.id : (esDeveloper ? null : req.user.organizacionId);
    const filtroRutinas = orgId ? 'organizacionId = ?' : 'organizacionId IS NOT NULL';
    const filtroUsuarios = orgId ? 'organizacionId = ?' : 'organizacionId IS NOT NULL';
    const params = orgId ? [orgId] : [];

    // Rutinas institucionales: las creadas por cualquier miembro de la organización (empresario y tutores)
    const rutinasStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN LOWER(turno) = 'mañana' OR LOWER(turno) = 'manana' THEN 1 ELSE 0 END) as manana,
        SUM(CASE WHEN LOWER(turno) = 'tarde' THEN 1 ELSE 0 END) as tarde,
        SUM(CASE WHEN LOWER(turno) = 'noche' THEN 1 ELSE 0 END) as noche
      FROM rutinas
      WHERE ${filtroRutinas}
    `).get(...params);

    const totalRutinas = Number(rutinasStats?.total || 0);
    const mananaCount = Number(rutinasStats?.manana || 0);
    const tardeCount = Number(rutinasStats?.tarde || 0);
    const nocheCount = Number(rutinasStats?.noche || 0);

    // Niños vinculados (dispositivos) por los usuarios de la organización, y cuántos tienen el modo kiosco activo
    const dispositivos = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_kiosk_active = 1 THEN 1 ELSE 0 END) as kiosco
      FROM child_devices
      WHERE parent_id IN (SELECT id FROM usuarios WHERE ${filtroUsuarios})
    `).get(...params);

    const totalEstudiantes = Number(dispositivos?.total || 0);
    const dispositivosKiosco = Number(dispositivos?.kiosco || 0);

    // Tutores de la organización (nombre y número de hijos vinculados), de la A a la Z
    const tutores = db.prepare(`
      SELECT
        u.id,
        u.nombre,
        (SELECT COUNT(*) FROM child_devices d WHERE d.parent_id = u.id) AS cantidadNinos
      FROM usuarios u
      WHERE u.rol = 'tutor' AND u.${filtroUsuarios}
      ORDER BY u.nombre COLLATE NOCASE ASC
      LIMIT ${MAX_TUTORES_DETALLE}
    `).all(...params);
    const totalTutores = Number(
      db.prepare(`SELECT COUNT(*) AS total FROM usuarios u WHERE u.rol = 'tutor' AND u.${filtroUsuarios}`).get(...params)?.total || 0
    );

    // El código de la organización solo se muestra a su propietario
    const esPropietario = Boolean(organizacion && organizacion.propietarioId === req.user.id);
    const organizacionPublica = organizacion
      ? {
          id: organizacion.id,
          nombre: organizacion.nombre,
          ...(esPropietario ? { codigo: formatearCodigo(organizacion.codigo) } : {}),
        }
      : null;

    const data = {
      organizacionId: organizacion ? organizacion.id : null,
      organizacion: organizacionPublica,
      institucion: organizacion ? organizacion.nombre : 'Todas las organizaciones',
      rolDirector: req.user.nombre || 'Directivo Institucional',
      kpis: {
        totalEstudiantesInstitucion: totalEstudiantes,
        totalRutinasEstructuradas: totalRutinas,
        dispositivosKioskEnPerimetro: dispositivosKiosco,
        totalTutoresInstitucion: totalTutores,
        tutoresDetalle: tutores.map((t) => ({ id: t.id, nombre: t.nombre, cantidadNinos: Number(t.cantidadNinos || 0) })),
        distribucionTurnos: {
          manana: mananaCount,
          tarde: tardeCount,
          noche: nocheCount,
          porcentajes: {
            manana: Math.round((mananaCount / Math.max(1, totalRutinas)) * 100),
            tarde: Math.round((tardeCount / Math.max(1, totalRutinas)) * 100),
            noche: Math.round((nocheCount / Math.max(1, totalRutinas)) * 100),
          },
        },
      },
      politicaPrivacidad: {
        cumplimiento: 'Sin datos de los menores: solo cifras agregadas',
        datosPersonalesVisibles: true,
        formato: 'Cifras agregadas y nombres de los tutores de la propia institución (sin correos)',
      },
    };

    return res.status(200).json({
      status: 'success',
      statusCode: 200,
      message: 'Métricas gerenciales obtenidas exitosamente',
      data,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

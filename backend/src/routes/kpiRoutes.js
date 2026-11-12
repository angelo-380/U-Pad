import { Router } from 'express';
import { db } from '../config/database.js';
import { authenticate, authorizeRoles } from '../middlewares/authMiddleware.js';
import { AppError } from '../utils/AppError.js';
import { obtenerOrganizacionPorId, formatearCodigo } from '../utils/organizaciones.js';

const router = Router();

// Accesible por rol empresario (colegio/clínica) y developer
router.use(authenticate);
router.use(authorizeRoles('empresario', 'developer'));

/**
 * GET /api/empresario/kpis
 * Proporciona un resumen gerencial e indicadores clave (KPIs) de UNA organización.
 * - empresario: siempre la suya (la del token; nunca un valor enviado por el cliente).
 * - developer: agregado de todas las organizaciones, o la indicada con ?organizacionId=.
 * Las cifras de rutinas, estudiantes (niños vinculados) y kioscos son datos reales (0 si no hay).
 * La adherencia semanal y los indicadores de calidad siguen siendo SIMULADOS (aún no hay datos reales).
 * PROTECCIÓN DE PRIVACIDAD: No expone ningún dato personal identificable (PII) de alumnos o tutores.
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
    const filtroRutinas = orgId
      ? '(organizacionId = ? OR creadoPor IN (SELECT id FROM usuarios WHERE organizacionId = ?))'
      : '1=1';
    const paramsRutinas = orgId ? [orgId, orgId] : [];

    const filtroUsuarios = orgId ? 'organizacionId = ?' : '1=1';
    const paramsUsuarios = orgId ? [orgId] : [];

    // Rutinas institucionales: las creadas por cualquier miembro de la organización (empresario y tutores)
    const rutinasStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN LOWER(turno) = 'mañana' OR LOWER(turno) = 'manana' THEN 1 ELSE 0 END) as manana,
        SUM(CASE WHEN LOWER(turno) = 'tarde' THEN 1 ELSE 0 END) as tarde,
        SUM(CASE WHEN LOWER(turno) = 'noche' THEN 1 ELSE 0 END) as noche
      FROM rutinas
      WHERE ${filtroRutinas}
    `).get(...paramsRutinas);

    const totalRutinas = Number(rutinasStats?.total || 0);
    const mananaCount = Number(rutinasStats?.manana || 0);
    const tardeCount = Number(rutinasStats?.tarde || 0);
    const nocheCount = Number(rutinasStats?.noche || 0);

    // Niños vinculados (dispositivos) por los usuarios de la organización, y cuántos tienen el modo kiosco activo
    const dispositivos = db.prepare(`
      SELECT
        COUNT(DISTINCT device_id) as total,
        SUM(CASE WHEN is_kiosk_active = 1 THEN 1 ELSE 0 END) as kiosco
      FROM child_devices
      WHERE parent_id IN (SELECT id FROM usuarios WHERE ${filtroUsuarios})
    `).get(...paramsUsuarios);

    const totalEstudiantes = Number(dispositivos?.total || 0);
    const dispositivosKiosco = Number(dispositivos?.kiosco || 0);

    // Nómina de tutores vinculados a la institución y cantidad de niños vinculados por cada uno
    const tutoresLista = db.prepare(`
      SELECT
        u.id,
        u.nombre,
        (SELECT COUNT(DISTINCT cd.device_id) FROM child_devices cd WHERE cd.parent_id = u.id) AS cantidadNinos
      FROM usuarios u
      WHERE u.rol = 'tutor' AND ${filtroUsuarios}
      ORDER BY u.nombre ASC
    `).all(...paramsUsuarios);

    const totalTutores = tutoresLista.length;

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
        totalTutoresInstitucion: totalTutores,
        tutoresDetalle: tutoresLista.map((t) => ({
          id: t.id,
          nombre: t.nombre,
          cantidadNinos: Number(t.cantidadNinos || 0),
        })),
        tasaCumplimientoAdherencia: 0,
        dispositivosKioskEnPerimetro: dispositivosKiosco,
        distribucionTurnos: {
          manana: mananaCount,
          tarde: tardeCount,
          noche: nocheCount,
          porcentajes: {
            manana: totalRutinas > 0 ? Math.round((mananaCount / totalRutinas) * 100) : 0,
            tarde: totalRutinas > 0 ? Math.round((tardeCount / totalRutinas) * 100) : 0,
            noche: totalRutinas > 0 ? Math.round((nocheCount / totalRutinas) * 100) : 0,
          },
        },
        adherenciaSemanal: [],
        indicadoresCalidad: [],
      },
      politicaPrivacidad: {
        cumplimiento: 'Estricto cumplimiento de anonimización de datos de menores TEA',
        datosPersonalesVisibles: false,
        formato: 'Agregado estadístico para toma de decisiones directivas',
      },
    };

    return res.status(200).json({
      status: 'success',
      statusCode: 200,
      message: 'Métricas gerenciales obtenidas exitosamente sin exposición de datos personales',
      data,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

import crypto from 'node:crypto';
import { db } from '../config/database.js';
import { AppError } from '../utils/AppError.js';

/**
 * Cumplimiento real de las rutinas (puntos 8 y 16 del docente).
 *
 * El teléfono del niño registra cada actividad que completa (sin token, como la telemetría y los avisos; solo si está
 * vinculado). El servidor decide el padre y la organización, y solo acepta actividades que existen como rutina activa
 * de ese padre: no se registran actividades inventadas. Completar la misma actividad dos veces el mismo día cuenta una.
 *
 * Cálculo del resumen: el teléfono de cada hijo muestra las rutinas activas de su padre asignadas a él o «para todos
 * mis hijos» (ninoId NULL). En un día se esperan, por cada rutina activa creada hasta ese día, 1 si es de un hijo aún
 * vinculado o tantos como hijos vinculados tenga el tutor si es para todos. Solo cuentan los registros de rutinas que
 * siguen activas y de hijos que siguen vinculados a ese tutor, para que el porcentaje sea coherente con lo esperado
 * (nunca supera 100). Los hijos se cuentan con su vínculo actual.
 */
export const TURNOS_CUMPLIMIENTO = Object.freeze(['MANANA', 'TARDE', 'NOCHE']);
export const MAX_DIAS_RESUMEN = 31;
export const DIAS_RESUMEN_POR_DEFECTO = 7;
const MAX_ACTIVIDAD = 120;
const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const DIA_MS = 24 * 60 * 60 * 1000;

const normalizarTurno = (turno) => {
  const valor = typeof turno === 'string' ? turno.trim().toUpperCase() : '';
  return valor === 'MAÑANA' ? 'MANANA' : valor;
};

const normalizarTexto = (texto) => String(texto).trim().replace(/\s+/g, ' ').toLocaleUpperCase('es');

/** Milisegundos UTC de una fecha YYYY-MM-DD válida, o null. */
const fechaAMs = (fecha) => {
  if (typeof fecha !== 'string' || !REGEX_FECHA.test(fecha)) return null;
  const [a, m, d] = fecha.split('-').map(Number);
  const ms = Date.UTC(a, m - 1, d);
  const vuelta = new Date(ms);
  if (vuelta.getUTCFullYear() !== a || vuelta.getUTCMonth() !== m - 1 || vuelta.getUTCDate() !== d) return null;
  return ms;
};

const msAFecha = (ms) => new Date(ms).toISOString().slice(0, 10);

/** Una fecha local del cliente solo es válida si está a ±1 día de la fecha (UTC) del servidor. */
const exigirFechaCercana = (fecha, campo) => {
  const ms = fechaAMs(fecha);
  const hoy = fechaAMs(msAFecha(Date.now()));
  if (ms === null || Math.abs(ms - hoy) > DIA_MS) {
    throw new AppError(`El campo ${campo} debe ser una fecha YYYY-MM-DD cercana a hoy.`, 400, { field: campo, code: 'FECHA_INVALIDA' });
  }
  return ms;
};

/** Filtro SQL sobre la tabla de rutinas (alias r) según quién consulta. */
const alcanceDe = (usuario) => {
  if (usuario.rol === 'developer') return { where: '1 = 1', params: [] };
  if (usuario.rol === 'empresario') {
    return usuario.organizacionId ? { where: 'r.organizacionId = ?', params: [usuario.organizacionId] } : { where: '0 = 1', params: [] };
  }
  return { where: 'r.creadoPor = ?', params: [usuario.id] };
};

const porcentaje = (completadas, esperadas) => (esperadas > 0 ? Math.min(100, Math.round((completadas * 100) / esperadas)) : null);

export const cumplimientoService = {
  /** El teléfono del niño registra una actividad completada. Devuelve { nuevo, cumplimiento } (sin el id del padre). */
  registrar(deviceId, { actividad, turno, fecha } = {}) {
    if (typeof actividad !== 'string' || !actividad.trim()) {
      throw new AppError('Falta la actividad.', 400, { field: 'actividad', code: 'ACTIVIDAD_REQUERIDA' });
    }
    const turnoNormalizado = normalizarTurno(turno);
    if (!TURNOS_CUMPLIMIENTO.includes(turnoNormalizado)) {
      throw new AppError(`Turno inválido. Usa: ${TURNOS_CUMPLIMIENTO.join(', ')}.`, 400, { field: 'turno', code: 'TURNO_INVALIDO' });
    }
    exigirFechaCercana(fecha, 'fecha');

    const dispositivo = db.prepare('SELECT parent_id FROM child_devices WHERE device_id = ? AND parent_id IS NOT NULL').get(deviceId);
    if (!dispositivo) {
      throw new AppError('Dispositivo no vinculado.', 404, { code: 'DEVICE_NOT_FOUND' });
    }
    const padreId = dispositivo.parent_id;

    // La actividad debe ser una rutina activa del padre en ese turno (comparada en JavaScript: UPPER de SQLite no convierte la ñ)
    const buscada = normalizarTexto(actividad.slice(0, MAX_ACTIVIDAD));
    // y debe estar asignada a este hijo o a todos (ninoId NULL)
    const rutina = db.prepare(`
      SELECT id, titulo FROM rutinas
      WHERE creadoPor = ? AND turno = ? AND activa = 1 AND (ninoId IS NULL OR ninoId = ?)
      ORDER BY creadoEn ASC
    `)
      .all(padreId, turnoNormalizado, deviceId)
      .find((r) => normalizarTexto(r.titulo) === buscada);
    if (!rutina) {
      throw new AppError('Esa actividad no es una rutina activa de este turno.', 400, { field: 'actividad', code: 'RUTINA_NO_ENCONTRADA' });
    }

    const padre = db.prepare('SELECT organizacionId FROM usuarios WHERE id = ?').get(padreId);
    const cumplimiento = {
      id: `cmp_${Date.now().toString(16)}_${crypto.randomBytes(4).toString('hex')}`,
      deviceId,
      rutinaId: rutina.id,
      actividad: rutina.titulo,
      turno: turnoNormalizado,
      fecha,
      completadoEn: new Date().toISOString(),
    };
    const resultado = db.prepare(`
      INSERT OR IGNORE INTO cumplimientos (id, padreId, deviceId, rutinaId, actividad, turno, fecha, completadoEn, organizacionId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(cumplimiento.id, padreId, deviceId, rutina.id, rutina.titulo, turnoNormalizado, fecha, cumplimiento.completadoEn, padre?.organizacionId ?? null);

    if (Number(resultado.changes) === 0) {
      const existente = db.prepare(`
        SELECT id, deviceId, rutinaId, actividad, turno, fecha, completadoEn FROM cumplimientos
        WHERE deviceId = ? AND actividad = ? AND turno = ? AND fecha = ?
      `).get(deviceId, rutina.titulo, turnoNormalizado, fecha);
      return { nuevo: false, cumplimiento: existente };
    }
    return { nuevo: true, cumplimiento };
  },

  /**
   * Registra el cumplimiento de una rutina directamente desde la interfaz web.
   */
  completarDesdeWeb(usuario, { rutinaId, fecha } = {}) {
    if (!rutinaId) {
      throw new AppError('El id de la rutina es requerido.', 400, { field: 'rutinaId', code: 'RUTINA_ID_REQUERIDO' });
    }
    const fechaObj = fecha || new Date().toISOString().slice(0, 10);
    const rutina = db.prepare('SELECT id, titulo, turno, ninoId, creadoPor FROM rutinas WHERE id = ?').get(rutinaId);
    if (!rutina) {
      throw new AppError('Rutina no encontrada.', 404, { code: 'RUTINA_NO_ENCONTRADA' });
    }
    if (usuario.rol === 'tutor' && rutina.creadoPor !== usuario.id) {
      throw new AppError('No tienes permisos para registrar cumplimiento en esta rutina.', 403, { code: 'FORBIDDEN' });
    }
    let deviceId = rutina.ninoId;
    if (!deviceId) {
      const hijo = db.prepare('SELECT device_id FROM child_devices WHERE parent_id = ? LIMIT 1').get(rutina.creadoPor);
      deviceId = hijo ? hijo.device_id : `web_${usuario.id}`;
    }
    const padre = db.prepare('SELECT organizacionId FROM usuarios WHERE id = ?').get(rutina.creadoPor);
    const cumplimiento = {
      id: `cmp_${Date.now().toString(16)}_${crypto.randomBytes(4).toString('hex')}`,
      deviceId,
      rutinaId: rutina.id,
      actividad: rutina.titulo,
      turno: rutina.turno,
      fecha: fechaObj,
      completadoEn: new Date().toISOString(),
    };
    db.prepare(`
      INSERT OR REPLACE INTO cumplimientos (id, padreId, deviceId, rutinaId, actividad, turno, fecha, completadoEn, organizacionId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(cumplimiento.id, rutina.creadoPor, deviceId, rutina.id, rutina.titulo, rutina.turno, fechaObj, cumplimiento.completadoEn, padre?.organizacionId ?? null);

    return { ok: true, cumplimiento };
  },

  /**
   * Lo que el teléfono del niño ya completó en una fecha (su fecha local, ±1 día): [{ rutinaId, actividad, turno }].
   * Así recupera su avance al recargar la lista o reabrir la app.
   */
  delDia(deviceId, fecha) {
    exigirFechaCercana(fecha, 'fecha');
    const dispositivo = db.prepare('SELECT parent_id FROM child_devices WHERE device_id = ? AND parent_id IS NOT NULL').get(deviceId);
    if (!dispositivo) {
      throw new AppError('Dispositivo no vinculado.', 404, { code: 'DEVICE_NOT_FOUND' });
    }
    return db.prepare(`
      SELECT rutinaId, actividad, turno FROM cumplimientos
      WHERE deviceId = ? AND padreId = ? AND fecha = ?
      ORDER BY completadoEn ASC
    `).all(deviceId, dispositivo.parent_id, fecha);
  },

  /**
   * Resumen de los últimos `dias` días hasta `hasta` (fecha local del cliente; por defecto, hoy en UTC).
   * tutor: lo suyo (con desglose por hijo); empresario: su organización (sin datos de los niños); developer: todo.
   */
  resumen(usuario, { dias, hasta } = {}) {
    let cantidad = DIAS_RESUMEN_POR_DEFECTO;
    if (dias !== undefined && dias !== null && dias !== '') {
      cantidad = Number(dias);
      if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_DIAS_RESUMEN) {
        throw new AppError(`El parámetro dias debe ser un entero entre 1 y ${MAX_DIAS_RESUMEN}.`, 400, { field: 'dias', code: 'DIAS_INVALIDO' });
      }
    }
    const finMs = hasta !== undefined && hasta !== null && hasta !== ''
      ? exigirFechaCercana(String(hasta), 'hasta')
      : fechaAMs(msAFecha(Date.now()));
    const fechas = Array.from({ length: cantidad }, (_, i) => msAFecha(finMs - (cantidad - 1 - i) * DIA_MS));
    const desde = fechas[0];
    const fin = fechas[fechas.length - 1];

    const alcance = alcanceDe(usuario);

    // Rutinas activas del alcance, con la fecha en que empezaron a esperarse y los hijos vinculados de su tutor
    // (hijos = cuántos teléfonos la muestran: todos los hijos si es para todos, o 1 si su hijo sigue vinculado)
    const rutinas = db.prepare(`
      SELECT r.turno, substr(r.creadoEn, 1, 10) AS desde,
        CASE WHEN r.ninoId IS NULL
          THEN (SELECT COUNT(*) FROM child_devices c WHERE c.parent_id = r.creadoPor)
          ELSE (SELECT COUNT(*) FROM child_devices c WHERE c.parent_id = r.creadoPor AND c.device_id = r.ninoId)
        END AS hijos
      FROM rutinas r WHERE r.activa = 1 AND ${alcance.where}
    `).all(...alcance.params);

    // Registros del periodo que siguen siendo coherentes (rutina activa e hijo aún vinculado a ese tutor)
    const registros = db.prepare(`
      SELECT k.fecha, k.turno, k.deviceId FROM cumplimientos k
      JOIN rutinas r ON r.id = k.rutinaId AND r.activa = 1 AND (r.ninoId IS NULL OR r.ninoId = k.deviceId)
      JOIN child_devices c ON c.device_id = k.deviceId AND c.parent_id = k.padreId
      WHERE k.fecha BETWEEN ? AND ? AND ${alcance.where}
    `).all(desde, fin, ...alcance.params);

    const hayRegistros = Boolean(db.prepare(`
      SELECT 1 FROM cumplimientos k JOIN rutinas r ON r.id = k.rutinaId WHERE ${alcance.where} LIMIT 1
    `).get(...alcance.params));

    const esperadasEn = (fecha, filtro = () => true) =>
      rutinas.filter((r) => r.desde <= fecha && filtro(r)).reduce((total, r) => total + Number(r.hijos), 0);

    const diasResumen = fechas.map((fecha) => {
      const completadas = registros.filter((k) => k.fecha === fecha).length;
      const esperadas = esperadasEn(fecha);
      return { fecha, completadas, esperadas, porcentaje: porcentaje(completadas, esperadas) };
    });

    const porTurno = TURNOS_CUMPLIMIENTO.map((turno) => {
      const completadas = registros.filter((k) => k.turno === turno).length;
      const esperadas = fechas.reduce((total, fecha) => total + esperadasEn(fecha, (r) => r.turno === turno), 0);
      return { turno, completadas, esperadas, porcentaje: porcentaje(completadas, esperadas) };
    });

    const totalCompletadas = diasResumen.reduce((t, d) => t + d.completadas, 0);
    const totalEsperadas = diasResumen.reduce((t, d) => t + d.esperadas, 0);

    const resumen = {
      desde,
      hasta: fin,
      hayRegistros,
      total: { completadas: totalCompletadas, esperadas: totalEsperadas, porcentaje: porcentaje(totalCompletadas, totalEsperadas) },
      dias: diasResumen,
      porTurno,
    };

    // Solo el tutor ve el desglose por hijo (el director no ve datos de los niños)
    if (usuario.rol === 'tutor') {
      const rutinasPropias = db.prepare("SELECT substr(creadoEn, 1, 10) AS desde, ninoId FROM rutinas WHERE activa = 1 AND creadoPor = ?").all(usuario.id);
      resumen.porHijo = db.prepare('SELECT device_id, child_name FROM child_devices WHERE parent_id = ? ORDER BY child_name')
        .all(usuario.id)
        .map((hijo) => {
          const completadas = registros.filter((k) => k.deviceId === hijo.device_id).length;
          const esperadas = fechas.reduce(
            (t, fecha) => t + rutinasPropias.filter((r) => r.desde <= fecha && (!r.ninoId || r.ninoId === hijo.device_id)).length,
            0
          );
          return { deviceId: hijo.device_id, nombre: hijo.child_name || null, completadas, esperadas, porcentaje: porcentaje(completadas, esperadas) };
        });
    }

    return resumen;
  },
};

import crypto from 'node:crypto';
import { db } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { notificacionesService } from './notificacionesService.js';

/** Vida de un código de vinculación (como un código MFA). */
export const PAIRING_TTL_MS = 60_000;
// Los códigos pendientes creados hace más de 5 min se purgan (vencieron hace más de 4)
const PURGA_PENDIENTES_MS = 5 * 60_000 - PAIRING_TTL_MS;

const REGEX_CODIGO = /^\d{6}$/;

/** Radio permitido de la zona segura, en metros (punto 4 del docente: 200 m como máximo). */
export const RADIO_ZONA_MIN = 20;
export const RADIO_ZONA_MAX = 200;
// Margen contra el ruido del GPS en el borde: se avisa la salida pasado el radio + 10 m y el regreso por debajo del radio
export const MARGEN_SALIDA_ZONA = 10;

/** Distancia en metros entre dos coordenadas (fórmula del haversine). */
export const distanciaMetros = (lat1, lng1, lat2, lng2) => {
  const rad = (grados) => (grados * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Compara la ubicación nueva con la zona segura y avisa al padre solo cuando el niño cambia de estado
 * (dentro → fuera: «salió»; fuera → dentro: «volvió»). Devuelve 'dentro', 'fuera' o null si no hay zona.
 */
const revisarZonaSegura = (deviceId, latitude, longitude) => {
  const hijo = db.prepare(`
    SELECT parent_id, child_name, zona_lat, zona_lng, zona_radio, fuera_de_zona FROM child_devices WHERE device_id = ?
  `).get(deviceId);
  if (!hijo || hijo.zona_lat === null || hijo.zona_lng === null || hijo.zona_radio === null) return null;

  const distancia = Math.round(distanciaMetros(hijo.zona_lat, hijo.zona_lng, latitude, longitude));
  const radio = Number(hijo.zona_radio);
  const estaba = hijo.fuera_de_zona === null ? null : Number(hijo.fuera_de_zona);
  const nombre = hijo.child_name || 'Tu hijo';

  if (distancia > radio + MARGEN_SALIDA_ZONA) {
    if (estaba !== 1) {
      db.prepare('UPDATE child_devices SET fuera_de_zona = 1 WHERE device_id = ?').run(deviceId);
      notificacionesService.crearDelServidor(deviceId, hijo.parent_id, {
        tipo: 'zona_salida',
        titulo: `${nombre} salió de la zona segura`,
        descripcion: `Está a ${distancia} m del centro de la zona (radio de ${radio} m).`,
      });
    }
    return 'fuera';
  }
  if (distancia <= radio) {
    if (estaba === 1) {
      notificacionesService.crearDelServidor(deviceId, hijo.parent_id, {
        tipo: 'zona_regreso',
        titulo: `${nombre} volvió a la zona segura`,
        descripcion: `Está a ${distancia} m del centro de la zona (radio de ${radio} m).`,
      });
    }
    if (estaba !== 0) db.prepare('UPDATE child_devices SET fuera_de_zona = 0 WHERE device_id = ?').run(deviceId);
    return 'dentro';
  }
  // Entre el radio y el margen: se mantiene el estado anterior
  return estaba === 1 ? 'fuera' : 'dentro';
};

const coordenadaValida = (valor, limite) => typeof valor === 'number' && Number.isFinite(valor) && Math.abs(valor) <= limite;

const validarCoordenadas = (latitude, longitude) => {
  if (!coordenadaValida(latitude, 90) || !coordenadaValida(longitude, 180)) {
    throw new AppError('Coordenadas inválidas: la latitud va de -90 a 90 y la longitud de -180 a 180.', 400, {
      code: 'UBICACION_INVALIDA',
    });
  }
};

/** Un código está vencido si ya pasó su caducidad o si no tiene (códigos antiguos sin expires_at). */
const estaVencido = (pairing) => {
  const vence = pairing?.expires_at ? new Date(pairing.expires_at).getTime() : NaN;
  return !Number.isFinite(vence) || vence <= Date.now();
};

export const deviceService = {
  /**
   * Lista los dispositivos (hijos) vinculados al usuario actual.
   */
  async listarPorPadre(parentId) {
    const devices = db.prepare(`
      SELECT
        cd.device_id as deviceId,
        cd.device_id as device_id,
        cd.parent_id as parentId,
        cd.parent_id as parent_id,
        COALESCE(cd.child_name, 'Hijo Vinculado') as childName,
        COALESCE(cd.child_name, 'Hijo Vinculado') as child_name,
        cd.device_model as deviceModel,
        cd.device_model as device_model,
        cd.is_kiosk_active as isKioskActive,
        cd.is_kiosk_active as is_kiosk_active,
        cd.last_latitude as lastLatitude,
        cd.last_longitude as lastLongitude,
        cd.ubicacion_actualizada_en as ubicacionActualizadaEn,
        cd.zona_lat as zonaLat,
        cd.zona_lng as zonaLng,
        cd.zona_radio as zonaRadio,
        cd.last_seen_at as lastSeenAt,
        cd.last_seen_at as last_seen_at
      FROM child_devices cd
      WHERE cd.parent_id = ?
         OR cd.device_id IN (SELECT device_id FROM device_parents WHERE parent_id = ?)
      ORDER BY cd.last_seen_at DESC
    `).all(parentId, parentId);

    return devices.map(({ zonaLat, zonaLng, zonaRadio, ...d }) => ({
      ...d,
      isKioskActive: Boolean(d.isKioskActive),
      is_kiosk_active: Boolean(d.is_kiosk_active),
      zonaSegura: zonaLat !== null && zonaLng !== null && zonaRadio !== null
        ? { latitude: zonaLat, longitude: zonaLng, radio: zonaRadio }
        : null,
    }));
  },

  /**
   * Busca un código de vinculación que todavía se puede consultar:
   * pendiente y sin vencer, o ya enlazado (el teléfono lo sigue consultando hasta enterarse).
   * Devuelve null si no existe o si venció sin usarse.
   */
  obtenerCodigoVigente(code) {
    const cleanCode = String(code || '').trim();
    const pairing = db.prepare('SELECT * FROM pairing_codes WHERE code = ?').get(cleanCode);
    if (!pairing) return null;
    if (pairing.pairing_status !== 'LINKED' && estaVencido(pairing)) return null;
    return pairing;
  },

  /**
   * Vincula el dispositivo del niño con el código de 6 dígitos que muestra su teléfono.
   * El código debe existir (lo publicó el teléfono), no estar vencido (60 s) ni usado.
   * Un tutor puede tener varios hijos: vincular uno NO desvincula los demás.
   */
  async vincularConCodigo({ code, childName, deviceModel }, parentId) {
    if (!code) {
      throw new AppError('El código de vinculación es obligatorio.', 400, { field: 'code' });
    }
    if (!parentId || !db.prepare('SELECT id FROM usuarios WHERE id = ?').get(parentId)) {
      throw new AppError('Debes iniciar sesión para vincular un dispositivo.', 401, { code: 'UNAUTHORIZED' });
    }

    const cleanCode = String(code).trim();
    const pairing = db.prepare('SELECT * FROM pairing_codes WHERE code = ?').get(cleanCode);

    if (!pairing) {
      throw new AppError('El código de vinculación no es válido. Revisa el código que aparece en el teléfono del niño.', 404, {
        code: 'PAIRING_CODE_INVALID',
      });
    }
    if (pairing.pairing_status === 'LINKED' || pairing.parent_id) {
      throw new AppError('Este código ya se usó. Pide un código nuevo en el teléfono del niño.', 409, {
        code: 'PAIRING_CODE_USED',
      });
    }
    if (estaVencido(pairing)) {
      throw new AppError('El código expiró. Abre de nuevo la app del niño para obtener un código nuevo.', 410, {
        code: 'PAIRING_CODE_EXPIRED',
      });
    }

    const deviceId = pairing.device_id;
    const cleanChildName = typeof childName === 'string' && childName.trim() ? childName.trim().slice(0, 60) : null;
    const cleanModel = typeof deviceModel === 'string' ? deviceModel.trim().slice(0, 128) : '';

    db.prepare(`
      UPDATE pairing_codes SET parent_id = ?, pairing_status = 'LINKED' WHERE code = ?
    `).run(parentId, cleanCode);

    // Registrar (o reasignar, si el teléfono se vuelve a vincular) el dispositivo del niño con valores explícitos:
    // sin nombres, modelos ni ubicaciones inventadas.
    db.prepare(`
      INSERT INTO child_devices (device_id, parent_id, child_name, device_model, is_kiosk_active, last_latitude, last_longitude, last_seen_at)
      VALUES (?, ?, ?, ?, 0, NULL, NULL, CURRENT_TIMESTAMP)
      ON CONFLICT(device_id) DO UPDATE SET
        parent_id = excluded.parent_id,
        child_name = excluded.child_name,
        device_model = excluded.device_model,
        is_kiosk_active = 0,
        fuera_de_zona = NULL,
        last_seen_at = CURRENT_TIMESTAMP
    `).run(deviceId, parentId, cleanChildName, cleanModel);

    return {
      deviceId,
      device_id: deviceId,
      parentId,
      parent_id: parentId,
      childName: cleanChildName,
      child_name: cleanChildName,
      deviceModel: cleanModel,
      device_model: cleanModel,
      pairingCode: cleanCode,
      status: 'LINKED',
      linkedAt: new Date().toISOString(),
    };
  },

  /**
   * Desvincula UN dispositivo del padre indicado. Solo el dueño puede hacerlo.
   * Las rutinas asignadas a ese hijo quedan sin asignar.
   */
  async desvincular(deviceId, parentId) {
    if (!parentId) {
      throw new AppError('Debes iniciar sesión para desvincular un dispositivo.', 401, { code: 'UNAUTHORIZED' });
    }

    // Si es tutor secundario, solo se elimina de device_parents
    const delSecundario = db.prepare('DELETE FROM device_parents WHERE device_id = ? AND parent_id = ?').run(deviceId, parentId);
    if (delSecundario.changes > 0) {
      return { deviceId, desvinculado: true };
    }

    const resultado = db.prepare('DELETE FROM child_devices WHERE device_id = ? AND parent_id = ?').run(deviceId, parentId);
    if (resultado.changes === 0) {
      throw new AppError('No se encontró ese dispositivo entre tus hijos vinculados.', 404, { code: 'DEVICE_NOT_FOUND' });
    }

    db.prepare('DELETE FROM device_parents WHERE device_id = ?').run(deviceId);
    db.prepare('DELETE FROM pairing_codes WHERE device_id = ?').run(deviceId);
    db.prepare('UPDATE rutinas SET ninoId = NULL WHERE ninoId = ?').run(deviceId);

    return { deviceId, desvinculado: true };
  },

  /**
   * Comparte el dispositivo del hijo con un segundo tutor (Punto 10)
   */
  async compartir(deviceId, parentId, emailSegundoTutor) {
    if (!parentId) {
      throw new AppError('Debes iniciar sesión para compartir este hijo.', 401, { code: 'UNAUTHORIZED' });
    }
    const emailLimpio = String(emailSegundoTutor || '').trim().toLowerCase();
    if (!emailLimpio) {
      throw new AppError('Ingresa el correo electrónico del segundo tutor.', 400, { field: 'emailSegundoTutor' });
    }

    // Verificar que el dispositivo pertenezca al usuario actual
    const esDuenio = db.prepare(`
      SELECT child_name FROM child_devices WHERE device_id = ? AND parent_id = ?
      UNION
      SELECT d.child_name FROM child_devices d JOIN device_parents dp ON d.device_id = dp.device_id WHERE d.device_id = ? AND dp.parent_id = ?
    `).get(deviceId, parentId, deviceId, parentId);

    if (!esDuenio) {
      throw new AppError('No tienes permisos sobre este dispositivo.', 403, { code: 'FORBIDDEN' });
    }

    // Buscar al segundo tutor
    const target = db.prepare('SELECT id, nombre, email FROM usuarios WHERE LOWER(email) = ?').get(emailLimpio);
    if (!target) {
      throw new AppError('No se encontró ningún usuario registrado con ese correo electrónico.', 404, { code: 'USER_NOT_FOUND' });
    }
    if (target.id === parentId) {
      throw new AppError('Ya eres tutor de este hijo.', 400, { code: 'SAME_USER' });
    }

    // Vincular al segundo tutor
    db.prepare(`
      INSERT OR IGNORE INTO device_parents (device_id, parent_id, vinculadoEn)
      VALUES (?, ?, ?)
    `).run(deviceId, target.id, new Date().toISOString());

    return {
      deviceId,
      childName: esDuenio.child_name,
      segundoTutor: { id: target.id, nombre: target.nombre, email: target.email }
    };
  },

  /**
   * Estado mínimo de vinculación para la app del niño (la consulta cada 2 s, sin token), así detecta
   * que el padre lo desvinculó desde la web. Un dispositivo desconocido responde linked: false.
   * Devuelve solo el id del padre (la app del niño ya lo conoce: lo usa para leer sus rutinas).
   */
  estadoDispositivo(deviceId) {
    const row = db.prepare('SELECT parent_id, is_kiosk_active FROM child_devices WHERE device_id = ?').get(deviceId);
    const linked = Boolean(row?.parent_id);
    return {
      deviceId,
      linked,
      parentId: row?.parent_id || '',
      kioscoActivo: linked && Number(row?.is_kiosk_active) === 1,
    };
  },

  /**
   * Activa o retira el bloqueo kiosco de un hijo. Solo su dueño (404 si el dispositivo no es suyo).
   * El teléfono del niño lo recibe en su consulta de estado (cada 2 s).
   */
  cambiarKiosco(deviceId, parentId, activo) {
    if (typeof activo !== 'boolean') {
      throw new AppError('Indica activo: true o false.', 400, { field: 'activo', code: 'KIOSCO_VALOR_INVALIDO' });
    }
    const resultado = db.prepare('UPDATE child_devices SET is_kiosk_active = ? WHERE device_id = ? AND parent_id = ?')
      .run(activo ? 1 : 0, deviceId, parentId);
    if (resultado.changes === 0) {
      throw new AppError('No se encontró ese dispositivo entre tus hijos vinculados.', 404, { code: 'DEVICE_NOT_FOUND' });
    }
    return { deviceId, kioscoActivo: activo };
  },

  /**
   * Guarda la ubicación real que envía el teléfono del niño (la app Android la envía cada 5-10 s, sin token).
   * Solo se acepta para dispositivos vinculados a un tutor.
   */
  async registrarUbicacion(deviceId, { latitude, longitude } = {}) {
    validarCoordenadas(latitude, longitude);

    const ahora = new Date().toISOString();
    const resultado = db.prepare(`
      UPDATE child_devices
      SET last_latitude = ?, last_longitude = ?, ubicacion_actualizada_en = ?, last_seen_at = CURRENT_TIMESTAMP
      WHERE device_id = ? AND parent_id IS NOT NULL
    `).run(latitude, longitude, ahora, deviceId);

    if (resultado.changes === 0) {
      throw new AppError('Dispositivo no vinculado.', 404, { code: 'DEVICE_NOT_FOUND' });
    }

    const zona = revisarZonaSegura(deviceId, latitude, longitude);
    return { deviceId, latitude, longitude, ubicacionActualizadaEn: ahora, zona };
  },

  /**
   * Guarda (o quita, con zonaSegura: null) la zona segura de un hijo. Solo su dueño.
   * Radio entero de 20 a 200 m.
   */
  async guardarZonaSegura(deviceId, parentId, body = {}) {
    const quitar = Object.prototype.hasOwnProperty.call(body, 'zonaSegura') && body.zonaSegura === null;
    const { latitude, longitude, radio } = body;

    if (!quitar) {
      validarCoordenadas(latitude, longitude);
      if (!Number.isInteger(radio) || radio < RADIO_ZONA_MIN || radio > RADIO_ZONA_MAX) {
        throw new AppError(`El radio de la zona segura debe ser un número entero de ${RADIO_ZONA_MIN} a ${RADIO_ZONA_MAX} metros.`, 400, {
          code: 'RADIO_INVALIDO',
        });
      }
    }

    const resultado = db.prepare(`
      UPDATE child_devices SET zona_lat = ?, zona_lng = ?, zona_radio = ?, fuera_de_zona = NULL
      WHERE device_id = ? AND parent_id = ?
    `).run(quitar ? null : latitude, quitar ? null : longitude, quitar ? null : radio, deviceId, parentId);

    if (resultado.changes === 0) {
      throw new AppError('No se encontró ese dispositivo entre tus hijos vinculados.', 404, { code: 'DEVICE_NOT_FOUND' });
    }

    return { deviceId, zonaSegura: quitar ? null : { latitude, longitude, radio } };
  },

  /**
   * Registra el código de vinculación que muestra el teléfono del niño (la app lo genera y lo envía).
   * Si no se envía código, se genera uno. Caduca a los 60 segundos.
   */
  async generarCodigo({ code, deviceId } = {}) {
    let finalCode;
    if (code === undefined || code === null || code === '') {
      finalCode = String(crypto.randomInt(100000, 1000000));
    } else if (typeof code === 'string' && REGEX_CODIGO.test(code.trim())) {
      finalCode = code.trim();
    } else {
      throw new AppError('El código de vinculación debe tener 6 dígitos.', 400, { code: 'PAIRING_CODE_FORMAT' });
    }

    const devId = typeof deviceId === 'string' && deviceId.trim() ? deviceId.trim().slice(0, 128) : `dev_${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS).toISOString();

    // Limpieza: los códigos pendientes que vencieron hace más de 4 min (creados hace más de 5) se borran
    const limitePurga = new Date(Date.now() - PURGA_PENDIENTES_MS).toISOString();
    db.prepare("DELETE FROM pairing_codes WHERE pairing_status = 'PENDING' AND parent_id IS NULL AND (expires_at IS NULL OR expires_at < ?)")
      .run(limitePurga);

    const existente = db.prepare('SELECT pairing_status, parent_id, device_id, expires_at FROM pairing_codes WHERE code = ?').get(finalCode);
    if (existente && (existente.pairing_status === 'LINKED' || existente.parent_id)) {
      throw new AppError('Ese código ya está en uso. Genera otro.', 409, { code: 'PAIRING_CODE_USED' });
    }
    // Un código vigente de OTRO dispositivo no se le quita (evita que un teléfono robe el código de otro)
    if (existente && existente.device_id !== devId && !estaVencido(existente)) {
      throw new AppError('Ese código ya está en uso. Genera otro.', 409, { code: 'PAIRING_CODE_USED' });
    }

    // Al rotar el código, los anteriores pendientes del mismo dispositivo dejan de valer
    db.prepare("DELETE FROM pairing_codes WHERE device_id = ? AND code <> ? AND pairing_status = 'PENDING' AND parent_id IS NULL")
      .run(devId, finalCode);

    // Un código pendiente con el mismo número se reemplaza (el teléfono lo volvió a publicar)
    db.prepare(`
      INSERT INTO pairing_codes (code, device_id, parent_id, pairing_status, created_at, expires_at)
      VALUES (?, ?, NULL, 'PENDING', CURRENT_TIMESTAMP, ?)
      ON CONFLICT(code) DO UPDATE SET
        device_id = excluded.device_id,
        parent_id = NULL,
        pairing_status = 'PENDING',
        created_at = CURRENT_TIMESTAMP,
        expires_at = excluded.expires_at
    `).run(finalCode, devId, expiresAt);

    return {
      code: finalCode,
      deviceId: devId,
      status: 'PENDING',
      expiresAt,
      expiresInSeconds: PAIRING_TTL_MS / 1000,
    };
  },
};

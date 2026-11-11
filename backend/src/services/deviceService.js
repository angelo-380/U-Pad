import { db } from '../config/database.js';
import { AppError } from '../utils/AppError.js';

/**
 * Función compartida para verificar si un código PENDING ha superado el tiempo máximo de validez (60s).
 * Solo aplica a códigos en estado 'PENDING'.
 */
export function estaCodigoExpirado(pairing, maxSeconds = 60) {
  if (!pairing || pairing.pairing_status !== 'PENDING') {
    return false;
  }
  if (!pairing.created_at) {
    return false;
  }

  let createdAtMs;
  if (typeof pairing.created_at === 'number' || /^\d+$/.test(String(pairing.created_at))) {
    createdAtMs = Number(pairing.created_at);
  } else {
    const utcIso = String(pairing.created_at).trim().replace(' ', 'T') + 'Z';
    createdAtMs = new Date(utcIso).getTime();
  }

  const diffSec = (Date.now() - createdAtMs) / 1000;
  return diffSec > maxSeconds;
}

export const deviceService = {
  /**
   * Lista los dispositivos o tablets de hijos vinculados al usuario actual.
   */
  async listarPorPadre(parentId) {
    const devices = db.prepare(`
      SELECT 
        device_id as deviceId,
        device_id as device_id,
        parent_id as parentId,
        parent_id as parent_id,
        COALESCE(child_name, 'Hijo Vinculado') as childName,
        COALESCE(child_name, 'Hijo Vinculado') as child_name,
        device_model as deviceModel,
        device_model as device_model,
        is_kiosk_active as isKioskActive,
        is_kiosk_active as is_kiosk_active,
        last_latitude as lastLatitude,
        last_longitude as lastLongitude,
        last_seen_at as lastSeenAt,
        last_seen_at as last_seen_at
      FROM child_devices 
      WHERE parent_id = ?
      ORDER BY last_seen_at DESC
    `).all(parentId);

    return devices.map(d => ({
      ...d,
      isKioskActive: Boolean(d.isKioskActive),
      is_kiosk_active: Boolean(d.is_kiosk_active),
    }));
  },

  /**
   * Vincula un dispositivo mediante el código de 6 caracteres generado por la tablet o app móvil.
   */
  async vincularConCodigo({ code, childName, deviceModel }, parentId) {
    if (!code) {
      throw new AppError('El código de vinculación es obligatorio.', 400, { field: 'code' });
    }

    const cleanCode = code.trim().toUpperCase();
    const cleanChildName = childName ? childName.trim() : 'Mi Hijo';
    const cleanModel = deviceModel ? deviceModel.trim() : 'Android Tablet (U-Pad Child Edition)';

    // Buscar si el código existe en pairing_codes
    let pairing = db.prepare('SELECT * FROM pairing_codes WHERE UPPER(code) = ?').get(cleanCode);

    if (!pairing) {
      throw new AppError('El código de vinculación no existe o es inválido.', 404, { code: 'CODE_NOT_FOUND' });
    }

    // Validación B: Rechazar con 410 si ya fue usado (pairing_status !== 'PENDING')
    if (pairing.pairing_status === 'LINKED' || pairing.parent_id) {
      throw new AppError('Este código de vinculación ya fue utilizado previamente.', 410, { code: 'CODE_ALREADY_USED' });
    }

    // Validación B: Rechazar con 410 si created_at tiene más de 60 segundos
    if (estaCodigoExpirado(pairing, 60)) {
      throw new AppError('El código de vinculación ha expirado (validez máxima de 60 segundos). Genera uno nuevo en la tablet.', 410, { code: 'CODE_EXPIRED' });
    }

    let deviceId = pairing.device_id || `dev_child_${cleanCode.toLowerCase()}`;

    // Desvincular cualquier tablet previa vinculada a este padre que no sea la actual (un hijo/tablet activo a la vez por cuenta estándar)
    db.prepare('DELETE FROM child_devices WHERE parent_id = ? AND device_id != ?').run(parentId, deviceId);

    // Actualizar o registrar el pairing code como LINKED
    db.prepare(`
      INSERT INTO pairing_codes (code, device_id, parent_id, pairing_status)
      VALUES (?, ?, ?, 'LINKED')
      ON CONFLICT(code) DO UPDATE SET 
        parent_id = excluded.parent_id,
        pairing_status = 'LINKED'
    `).run(cleanCode, deviceId, parentId);

    // Registrar o actualizar el dispositivo asociado en child_devices con el nombre elegido por el padre
    db.prepare(`
      INSERT INTO child_devices (device_id, parent_id, child_name, device_model, is_kiosk_active, last_seen_at)
      VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(device_id) DO UPDATE SET
        parent_id = excluded.parent_id,
        child_name = excluded.child_name,
        device_model = excluded.device_model,
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
   * Desvincula y elimina un dispositivo vinculado a la cuenta del padre.
   */
  async desvincular(deviceId, parentId = null) {
    try {
      if (parentId) {
        db.prepare('DELETE FROM child_devices WHERE (device_id = ? OR id = ? OR parent_id = ?)').run(deviceId, deviceId, parentId);
        db.prepare('DELETE FROM pairing_codes WHERE (device_id = ? OR parent_id = ? OR code = ?)').run(deviceId, parentId, deviceId);
      } else {
        db.prepare('DELETE FROM child_devices WHERE device_id = ? OR id = ?').run(deviceId, deviceId);
        db.prepare('DELETE FROM pairing_codes WHERE device_id = ? OR code = ?').run(deviceId, deviceId);
      }
    } catch (e) {
      console.error('Error desvinculando dispositivo en DB:', e);
    }

    return { deviceId, desvinculado: true };
  },

  /**
   * Genera un código temporal de vinculación de 6 caracteres (para la tablet).
   * Invalida los PENDING anteriores de ese dispositivo.
   */
  async generarCodigo(deviceId = null, requestedCode = null) {
    let code;
    const isValid6Digits = requestedCode && typeof requestedCode === 'string' && /^\d{6}$/.test(requestedCode.trim());

    if (isValid6Digits) {
      const cleanRequested = requestedCode.trim();
      const existing = db.prepare('SELECT code, device_id, pairing_status FROM pairing_codes WHERE code = ?').get(cleanRequested);
      if (existing) {
        // Si el código ya existe y pertenece a otro dispositivo, lanzar conflicto 409
        if (deviceId && existing.device_id && existing.device_id !== deviceId) {
          throw new AppError('El código de vinculación ya está en uso por otro dispositivo.', 409, { code: 'CODE_ALREADY_EXISTS' });
        }
      }
      code = cleanRequested;
    } else {
      code = Math.floor(100000 + Math.random() * 900000).toString();
    }

    const devId = deviceId || `dev_tablet_${code}`;

    // Limpieza opcional y barata: purgar códigos PENDING con más de 5 minutos (300 s)
    try {
      const fiveMinutesAgoMs = Date.now() - (5 * 60 * 1000);
      db.prepare(`
        DELETE FROM pairing_codes 
        WHERE pairing_status = 'PENDING' 
          AND (
            (typeof(created_at) = 'integer' AND created_at < ?) 
            OR (typeof(created_at) = 'text' AND unixepoch(created_at) < ?)
          )
      `).run(fiveMinutesAgoMs, Math.floor(fiveMinutesAgoMs / 1000));
    } catch (e) {
      // Ignorar si la limpieza rápida falla
    }

    // Invalida o elimina PENDING anteriores de este mismo dispositivo
    db.prepare(`
      DELETE FROM pairing_codes 
      WHERE device_id = ? AND pairing_status = 'PENDING'
    `).run(devId);

    db.prepare(`
      INSERT INTO pairing_codes (code, device_id, pairing_status, created_at)
      VALUES (?, ?, 'PENDING', ?)
      ON CONFLICT(code) DO UPDATE SET 
        device_id = excluded.device_id, 
        pairing_status = 'PENDING', 
        parent_id = NULL, 
        created_at = excluded.created_at
    `).run(code, devId, Date.now());

    return { code, deviceId: devId, status: 'PENDING', expiresInSeconds: 60 };
  },

  /**
   * Consulta el estado de un código de vinculación.
   * Si no existe, fue marcado como EXPIRED, o es PENDING con más de 60s, lanza 404 CODE_NOT_FOUND.
   */
  async consultarCodigo(rawCode) {
    if (!rawCode) {
      throw new AppError('Pairing code not found or expired.', 404, { code: 'CODE_NOT_FOUND' });
    }

    const cleanCode = rawCode.trim().toUpperCase();
    const pairingInfo = db.prepare('SELECT code, device_id, parent_id, pairing_status, created_at FROM pairing_codes WHERE UPPER(code) = ?').get(cleanCode);

    if (!pairingInfo || pairingInfo.pairing_status === 'EXPIRED') {
      throw new AppError('Pairing code not found or expired.', 404, { code: 'CODE_NOT_FOUND' });
    }

    // Regla de 60s: aplica ÚNICAMENTE a códigos PENDING
    if (estaCodigoExpirado(pairingInfo, 60)) {
      throw new AppError('Pairing code not found or expired.', 404, { code: 'CODE_NOT_FOUND' });
    }

    let nombreTutor = '';
    if (pairingInfo.parent_id) {
      try {
        const tutorRow = db.prepare('SELECT nombre FROM usuarios WHERE id = ?').get(pairingInfo.parent_id);
        if (tutorRow) nombreTutor = tutorRow.nombre;
      } catch (e) {}
    }

    const estaEnlazado = pairingInfo.pairing_status === 'LINKED' || Boolean(pairingInfo.parent_id);

    return {
      code: pairingInfo.code,
      deviceId: pairingInfo.device_id,
      parentId: pairingInfo.parent_id || '',
      tutorName: nombreTutor,
      estado: estaEnlazado ? 'enlazado' : 'esperando'
    };
  }
};

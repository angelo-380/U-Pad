import { db } from '../config/database.js';
import { AppError } from '../utils/AppError.js';

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

    let deviceId = pairing?.device_id || `dev_child_${cleanCode.toLowerCase()}`;

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
    if (parentId) {
      db.prepare('DELETE FROM child_devices WHERE (device_id = ? OR id = ?) AND parent_id = ?').run(deviceId, deviceId, parentId);
    } else {
      db.prepare('DELETE FROM child_devices WHERE device_id = ? OR id = ?').run(deviceId, deviceId);
    }
    db.prepare('DELETE FROM pairing_codes WHERE device_id = ?').run(deviceId);

    return { deviceId, desvinculado: true };
  },

  /**
   * Genera un código temporal de vinculación de 6 caracteres (para la tablet).
   */
  async generarCodigo(deviceId = null) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const devId = deviceId || `dev_tablet_${code}`;

    db.prepare(`
      INSERT INTO pairing_codes (code, device_id, pairing_status)
      VALUES (?, ?, 'PENDING')
    `).run(code, devId);

    return { code, deviceId: devId, status: 'PENDING' };
  }
};

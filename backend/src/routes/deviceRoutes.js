import { Router } from 'express';
import { deviceController } from '../controllers/deviceController.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { db } from '../config/database.js';

const router = Router();

// Endpoints públicos o accesibles por tablet/móvil para emparejamiento
router.post('/pairing/create', deviceController.generarCodigo);
router.post('/pairing/generate', deviceController.generarCodigo);

// Consulta pública del estado del código para polling de la tablet/móvil
router.get('/pairing/:code', (req, res) => {
  const code = (req.params.code || '').trim().toUpperCase();
  const pairingInfo = db.prepare('SELECT code, device_id, parent_id, pairing_status FROM pairing_codes WHERE UPPER(code) = ?').get(code);
  if (!pairingInfo) {
    return res.status(404).json({
      status: 'error',
      statusCode: 404,
      error: { code: 'CODE_NOT_FOUND', message: 'Pairing code not found or expired.' }
    });
  }
  return res.status(200).json({
    status: 'success',
    data: {
      code: pairingInfo.code,
      deviceId: pairingInfo.device_id,
      parentId: pairingInfo.parent_id || '',
      estado: (pairingInfo.pairing_status === 'LINKED' || pairingInfo.parent_id) ? 'enlazado' : 'esperando'
    }
  });
});

// Middleware flexible: si viene token se autentica, pero si viene llamada directa de app móvil con parentId también se procesa
router.post('/pairing/link', (req, res, next) => {
  const hasAuth = req.headers.authorization || req.headers.Authorization || req.query.token;
  if (hasAuth) {
    return authenticate(req, res, next);
  }
  // Si no trae token pero trae parentId (ej. app móvil), continuar directamente
  if (req.body && (req.body.parentId || req.body.parent_id)) {
    return next();
  }
  return authenticate(req, res, next);
}, deviceController.vincular);

// Desvinculación de dispositivo (acepta token, parentId o eliminación directa por deviceId)
router.delete('/:id', (req, res, next) => {
  const hasAuth = req.headers.authorization || req.headers.Authorization || req.query.token;
  if (hasAuth) {
    return authenticate(req, res, next);
  }
  const parentId = req.query.parentId || req.headers['x-parent-id'] || (req.body && req.body.parentId);
  if (parentId) {
    req.user = { id: parentId };
  }
  return next();
}, deviceController.desvincular);

// Todos los demás endpoints de gestión requieren usuario autenticado
router.use(authenticate);

router.get('/', deviceController.listar);
router.delete('/cleanup-duplicates', (req, res, next) => {
  try {
    const parentId = req.user.id;
    // Conservar únicamente el dispositivo más reciente vinculado por el padre
    const latest = db.prepare('SELECT device_id FROM child_devices WHERE parent_id = ? ORDER BY last_seen_at DESC LIMIT 1').get(parentId);
    if (latest) {
      db.prepare('DELETE FROM child_devices WHERE parent_id = ? AND device_id != ?').run(parentId, latest.device_id);
    }
    const remaining = db.prepare('SELECT * FROM child_devices WHERE parent_id = ?').all(parentId);
    return res.status(200).json({ status: 'success', message: 'Duplicados limpiados', data: remaining });
  } catch (e) {
    next(e);
  }
});

export default router;

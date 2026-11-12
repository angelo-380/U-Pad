import { Router } from 'express';
import { deviceController } from '../controllers/deviceController.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { db } from '../config/database.js';

const router = Router();

// Endpoints públicos o accesibles por tablet/móvil para emparejamiento
router.post('/pairing/create', deviceController.generarCodigo);
router.post('/pairing/generate', deviceController.generarCodigo);

// Consulta pública del estado del código para polling de la tablet/móvil
router.get('/pairing/:code', deviceController.consultarCodigo);

// Consulta mínima y pública del estado de un dispositivo infantil. La app del
// niño la usa para detectar una desvinculación iniciada desde la web y volver a
// la pantalla inicial. No devuelve correo, nombre del tutor ni otros datos PII.
router.get('/status/:deviceId', deviceController.estado);

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

// Mantenimiento de dispositivos del padre (requiere JWT).
router.delete('/cleanup-duplicates', authenticate, (req, res, next) => {
  try {
    const parentId = req.user.id;
    // Conservar únicamente el dispositivo más reciente vinculado por el padre
    // (esta ruta requiere JWT; no debe caer en /:id).
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

// La eliminación requiere JWT o el parentId de la app móvil; nunca se
// permite borrar un dispositivo sin identificar a su padre propietario.
router.delete('/:id', (req, res, next) => {
  const hasAuth = req.headers.authorization || req.headers.Authorization || req.query.token;
  if (hasAuth) {
    return authenticate(req, res, next);
  }
  const parentId = req.query.parentId || req.headers['x-parent-id'] || (req.body && req.body.parentId);
  if (!parentId) {
    return authenticate(req, res, next);
  }
  req.user = { id: parentId };
  return next();
}, deviceController.desvincular);

// Todos los demás endpoints de gestión requieren usuario autenticado
router.use(authenticate);

router.get('/', deviceController.listar);

export default router;

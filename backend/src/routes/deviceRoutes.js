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

// Todos los demás endpoints de gestión requieren usuario autenticado
router.use(authenticate);

router.get('/', deviceController.listar);
router.delete('/:id', deviceController.desvincular);

export default router;

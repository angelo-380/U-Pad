import { Router } from 'express';
import { deviceController } from '../controllers/deviceController.js';
import { deviceService } from '../services/deviceService.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { crearLimiteIntentos } from '../middlewares/limiteIntentos.js';
import { compatibilidadMovilActiva } from '../utils/compatMovil.js';
import { AppError } from '../utils/AppError.js';

const router = Router();

/** Límites por minuto (contra la fuerza bruta de códigos de 6 dígitos y el abuso de la telemetría sin token). */
export const LIMITES_DISPOSITIVOS = Object.freeze({
  PAIRING_POR_CUENTA: 10,
  PAIRING_POR_IP: 30,
  TELEMETRIA_POR_DISPOSITIVO: 30,
  ESTADO_POR_DISPOSITIVO: 60,
});

export const limitePairingLink = crearLimiteIntentos({
  ventanaMs: 60_000,
  maximo: LIMITES_DISPOSITIVOS.PAIRING_POR_CUENTA,
  claves: (req) => {
    const cuenta = req.user?.id || req.body?.parentId || req.body?.parent_id;
    return [cuenta ? `cuenta:${cuenta}` : null];
  },
  codigo: 'PAIRING_RATE_LIMIT',
  mensaje: 'Demasiados intentos de vinculación. Espera un minuto y vuelve a intentarlo.',
});

const limitePairingIp = crearLimiteIntentos({
  ventanaMs: 60_000,
  maximo: LIMITES_DISPOSITIVOS.PAIRING_POR_IP,
  claves: (req) => [`ip:${req.ip}`],
  codigo: 'PAIRING_RATE_LIMIT',
  mensaje: 'Demasiados intentos de vinculación desde esta red. Espera un minuto y vuelve a intentarlo.',
});

export const limiteTelemetria = crearLimiteIntentos({
  ventanaMs: 60_000,
  maximo: LIMITES_DISPOSITIVOS.TELEMETRIA_POR_DISPOSITIVO,
  claves: (req) => [`dispositivo:${req.params.deviceId}`],
  codigo: 'TELEMETRIA_RATE_LIMIT',
  mensaje: 'Demasiados envíos de ubicación para este dispositivo. Espera un minuto.',
});

// La app del niño consulta su estado cada 2 s (30/min); 60/min deja margen y frena el barrido de ids
export const limiteEstadoDispositivo = crearLimiteIntentos({
  ventanaMs: 60_000,
  maximo: LIMITES_DISPOSITIVOS.ESTADO_POR_DISPOSITIVO,
  claves: (req) => [`estado:${req.params.deviceId}`],
  codigo: 'ESTADO_RATE_LIMIT',
  mensaje: 'Demasiadas consultas de estado para este dispositivo. Espera un minuto.',
});

// reiniciar() de ambos límites de vinculación (lo usan los tests)
const reiniciarLink = limitePairingLink.reiniciar;
limitePairingLink.reiniciar = () => {
  reiniciarLink();
  limitePairingIp.reiniciar();
};

const REGEX_DEVICE_ID = /^[A-Za-z0-9_.:-]{1,128}$/;
const validarDeviceId = (req, res, next) => {
  if (!REGEX_DEVICE_ID.test(req.params.deviceId || '')) {
    return next(new AppError('Identificador de dispositivo inválido.', 400, { code: 'DEVICE_ID_INVALIDO' }));
  }
  return next();
};

const exigirTokenSiCompatApagada = () =>
  new AppError('Se requiere iniciar sesión (token) para esta operación.', 401, { code: 'TOKEN_REQUERIDO' });

// Endpoints públicos o accesibles por tablet/móvil para emparejamiento
router.post('/pairing/create', deviceController.generarCodigo);
router.post('/pairing/generate', deviceController.generarCodigo);

// Consulta pública del estado del código para el polling del teléfono del niño.
// Un código pendiente que ya venció (60 s) responde igual que uno inexistente.
router.get('/pairing/:code', (req, res) => {
  const pairingInfo = deviceService.obtenerCodigoVigente(req.params.code);
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
  // Sin token pero con parentId (app móvil actual): solo en modo de compatibilidad
  if (req.body && (req.body.parentId || req.body.parent_id)) {
    return compatibilidadMovilActiva() ? next() : next(exigirTokenSiCompatApagada());
  }
  return authenticate(req, res, next);
}, limitePairingIp, limitePairingLink, deviceController.vincular);

// Desvinculación de UN dispositivo: con token, o desde la app con ?parentId= del dueño (sin ninguno → 401)
router.delete('/:id', (req, res, next) => {
  const hasAuth = req.headers.authorization || req.headers.Authorization || req.query.token;
  if (hasAuth) {
    return authenticate(req, res, next);
  }
  const parentId = req.query.parentId || req.headers['x-parent-id'] || (req.body && req.body.parentId);
  if (parentId) {
    if (!compatibilidadMovilActiva()) return next(exigirTokenSiCompatApagada());
    req.user = { id: parentId };
  }
  return next();
}, deviceController.desvincular);

// Ubicación real que envía la app Android del niño (sin token; solo dispositivos vinculados)
router.post('/:deviceId/telemetry', validarDeviceId, limiteTelemetria, deviceController.telemetria);

// Estado de vinculación para la app del niño (sin token): detecta una desvinculación hecha desde la web
router.get('/status/:deviceId', validarDeviceId, limiteEstadoDispositivo, deviceController.estado);

// Todos los demás endpoints de gestión requieren usuario autenticado
router.use(authenticate);

router.get('/', deviceController.listar);
router.put('/:deviceId/zona-segura', deviceController.zonaSegura);

export default router;

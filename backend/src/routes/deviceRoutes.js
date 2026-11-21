import { Router } from 'express';
import { deviceController } from '../controllers/deviceController.js';
import { deviceService } from '../services/deviceService.js';
import { notificacionesService } from '../services/notificacionesService.js';
import { cumplimientoService } from '../services/cumplimientoService.js';
import { sendCreated, sendSuccess } from '../utils/responseHandler.js';
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
  ESTADO_POR_DISPOSITIVO: 120,
  NOTIFICACIONES_POR_DISPOSITIVO: 30,
  CUMPLIMIENTO_POR_DISPOSITIVO: 60,
  CUMPLIMIENTO_DIA_POR_DISPOSITIVO: 60,
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

// La app consulta el estado cada 2 s (30/min por pantalla abierta: niño y mapa del padre); 120/min deja margen
export const limiteEstadoDispositivo = crearLimiteIntentos({
  ventanaMs: 60_000,
  maximo: LIMITES_DISPOSITIVOS.ESTADO_POR_DISPOSITIVO,
  claves: (req) => [`estado:${req.params.deviceId}`],
  codigo: 'ESTADO_RATE_LIMIT',
  mensaje: 'Demasiadas consultas de estado para este dispositivo. Espera un minuto.',
});

// Avisos del niño a su padre: 30 por minuto por dispositivo
export const limiteNotificaciones = crearLimiteIntentos({
  ventanaMs: 60_000,
  maximo: LIMITES_DISPOSITIVOS.NOTIFICACIONES_POR_DISPOSITIVO,
  claves: (req) => [`aviso:${req.params.deviceId}`],
  codigo: 'NOTIFICACION_RATE_LIMIT',
  mensaje: 'Demasiados avisos para este dispositivo. Espera un minuto.',
});

// Actividades completadas por el niño: 60 por minuto por dispositivo
export const limiteCumplimiento = crearLimiteIntentos({
  ventanaMs: 60_000,
  maximo: LIMITES_DISPOSITIVOS.CUMPLIMIENTO_POR_DISPOSITIVO,
  claves: (req) => [`cumplimiento:${req.params.deviceId}`],
  codigo: 'CUMPLIMIENTO_RATE_LIMIT',
  mensaje: 'Demasiados registros para este dispositivo. Espera un minuto.',
});

// Consulta de lo completado hoy por el niño: 60 por minuto por dispositivo
export const limiteCumplimientoDia = crearLimiteIntentos({
  ventanaMs: 60_000,
  maximo: LIMITES_DISPOSITIVOS.CUMPLIMIENTO_DIA_POR_DISPOSITIVO,
  claves: (req) => [`cumplimiento-dia:${req.params.deviceId}`],
  codigo: 'CUMPLIMIENTO_RATE_LIMIT',
  mensaje: 'Demasiadas consultas para este dispositivo. Espera un minuto.',
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

// Aviso del teléfono del niño para su padre (sin token; solo dispositivos vinculados; el padre lo decide el servidor)
router.post('/:deviceId/notificaciones', validarDeviceId, limiteNotificaciones, (req, res, next) => {
  try {
    const aviso = notificacionesService.crear(req.params.deviceId, req.body || {});
    return sendCreated(res, 'Aviso enviado', aviso);
  } catch (error) {
    return next(error);
  }
});

// Actividad completada en el teléfono del niño (sin token; solo vinculados; solo rutinas activas de su padre)
router.post('/:deviceId/cumplimiento', validarDeviceId, limiteCumplimiento, (req, res, next) => {
  try {
    const { nuevo, cumplimiento } = cumplimientoService.registrar(req.params.deviceId, req.body || {});
    return nuevo
      ? sendCreated(res, 'Actividad registrada', cumplimiento)
      : sendSuccess(res, 200, 'La actividad ya estaba registrada hoy', cumplimiento);
  } catch (error) {
    return next(error);
  }
});

// Lo que el niño ya completó en su fecha local (sin token; solo vinculados): recupera su avance al reabrir la app
router.get('/:deviceId/cumplimiento', validarDeviceId, limiteCumplimientoDia, (req, res, next) => {
  try {
    const completadas = cumplimientoService.delDia(req.params.deviceId, req.query?.fecha);
    return sendSuccess(res, 200, 'Actividades completadas del día', { fecha: req.query.fecha, completadas });
  } catch (error) {
    return next(error);
  }
});

// Todos los demás endpoints de gestión requieren usuario autenticado
router.use(authenticate);

router.get('/', deviceController.listar);
router.post('/:deviceId/compartir', validarDeviceId, deviceController.compartir);
router.put('/:deviceId/zona-segura', deviceController.zonaSegura);

// Bloqueo kiosco del hijo (solo su dueño, con token)
router.put('/:deviceId/kiosk', validarDeviceId, (req, res, next) => {
  try {
    const resultado = deviceService.cambiarKiosco(req.params.deviceId, req.user.id, req.body?.activo);
    return sendSuccess(res, 200, resultado.kioscoActivo ? 'Bloqueo kiosco activado' : 'Bloqueo kiosco retirado', resultado);
  } catch (error) {
    return next(error);
  }
});

export default router;

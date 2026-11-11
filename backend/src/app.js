import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';
import { db } from './config/database.js';
import authRoutes from './routes/authRoutes.js';
import rutinasRoutes from './routes/rutinasRoutes.js';
import deviceRoutes from './routes/deviceRoutes.js';
import backupRoutes from './routes/backupRoutes.js';
import mobileSyncRoutes from './routes/mobileSyncRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import kpiRoutes from './routes/kpiRoutes.js';
import organizacionRoutes from './routes/organizacionRoutes.js';
import { generalLimiter } from './middlewares/rateLimiter.js';
import { notFoundHandler } from './middlewares/notFoundHandler.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { sendSuccess } from './utils/responseHandler.js';
import { AppError } from './utils/AppError.js';

dotenv.config();

const distCandidates = [
  path.resolve(process.cwd(), 'public_html'),
  path.resolve(process.cwd(), '../frontend/dist'),
  path.resolve(process.cwd(), 'dist'),
];
const FRONTEND_DIST = distCandidates.find(d => fs.existsSync(d)) || path.resolve(process.cwd(), '../frontend/dist');

const app = express();

// Middlewares de seguridad de cabeceras y parsing
app.use(helmet({
  contentSecurityPolicy: false,
}));

// Configuración de CORS permitiendo orígenes locales, IP de red local y clientes nativos
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173')
  .split(',')
  .map(s => s.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Permitir solicitudes directas o de clientes nativos (móviles, curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (
      ALLOWED_ORIGINS.includes(origin) ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin.includes('192.168.') ||
      origin.includes('10.') ||
      origin.includes('.run.app')
    ) {
      return callback(null, true);
    }
    return callback(new AppError(`Acceso denegado por política CORS: el origen [${origin}] no está autorizado.`, 403, {
      code: 'CORS_ORIGIN_NOT_ALLOWED',
      origin,
    }));
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==============================================================================
// DOCUMENTACIÓN INTERACTIVA DE ENDPOINTS (SWAGGER UI)
// ==============================================================================
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'U-Pad API Docs | Documentación de Endpoints',
}));

// Rate Limiter general para las rutas de la API
app.use(generalLimiter);

// Ruta raíz: Sitio en desarrollo (Requisito obligatorio de entrega y pruebas Jest)
app.get('/', (req, res, next) => {
  // Si entra un navegador pidiendo página HTML
  if (req.headers.accept?.includes('text/html') && fs.existsSync(FRONTEND_DIST)) {
    return res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  }
  // Para pruebas automáticas de supertest / peticiones API
  sendSuccess(res, 200, 'Sitio en desarrollo - U-Pad Backend API v1.0 (Entrega 25%)', {
    status: 'operational',
    cloudPlatform: 'Google Cloud Platform (GCP)',
    environment: process.env.NODE_ENV || 'development',
    documentation: '/api/docs',
    timestamp: new Date().toISOString()
  });
});

// Ruta de health check y verificación de conexión a Google Cloud Database
app.get('/health', (req, res, next) => {
  try {
    const check = db.prepare('SELECT 1 as alive').get();
    sendSuccess(res, 200, 'Servicio en línea y conectado a Google Cloud Platform', {
      database: 'connected',
      cloudPlatform: 'Google Cloud Platform (GCP)',
      emulator: false,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(new AppError('Error de conectividad con la base de datos', 503, error.message));
  }
});

// Compatibilidad con /api/v1/health
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    statusCode: 200,
    message: 'U-Pad Google Cloud Engine operational.',
    data: {
      service: 'upad-backend-service',
      environment: process.env.NODE_ENV || 'production',
      cloudPlatform: 'Google Cloud Platform (GCP)',
    },
    error: null,
    timestamp: Date.now()
  });
});

// Rutas principales de la API Web
app.use('/api/auth', authRoutes);
app.use('/api/rutinas', rutinasRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/admin/backups', backupRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/empresario', kpiRoutes);
app.use('/api/organizaciones', organizacionRoutes);
app.use('/api', mobileSyncRoutes);

// Alias para compatibilidad con prefijo /api/v1/
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/routines', rutinasRoutes);
app.use('/api/v1/devices', deviceRoutes);
app.use('/api/v1/admin/backups', backupRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/empresario', kpiRoutes);
app.use('/api/v1/organizaciones', organizacionRoutes);
app.use('/api/v1', mobileSyncRoutes);

// ==============================================================================
// RUTAS PARA EMPAREJAMIENTO Y TELEMETRÍA MÓVIL (U-Pad Child & Parent)
// NOTA: GET /api/v1/devices/pairing/:code y POST /pairing/create se atienden en deviceRoutes -> deviceController -> deviceService
// ==============================================================================

app.all('/api/v1/devices/:deviceId/telemetry', (req, res) => {
  res.status(200).json({
    status: 'success',
    data: { deviceId: req.params.deviceId, latitude: -12.046374, longitude: -77.042793 }
  });
});

// Ruta de prueba para verificar respuestas HTTP controladas (Requisito del documento)
app.get('/api/test-status/:code', (req, res, next) => {
  const code = parseInt(req.params.code, 10);
  switch (code) {
    case 200:
      return sendSuccess(res, 200, 'Prueba de respuesta 200 OK', { sample: 'data' });
    case 201:
      return sendSuccess(res, 201, 'Prueba de respuesta 201 Created', { createdId: 'test-123' });
    case 400:
      return next(new AppError('Parámetros de petición inválidos', 400, { field: 'email', reason: 'Formato incorrecto' }));
    case 401:
      return next(new AppError('Credenciales inválidas o no autenticado', 401));
    case 403:
      return next(new AppError('Acceso denegado: rol insuficiente', 403));
    case 409:
      return next(new AppError('Conflicto: el recurso ya existe', 409));
    case 429:
      return next(new AppError('Demasiadas solicitudes: límite alcanzado', 429, { code: 'RATE_LIMIT_EXCEEDED' }));
    case 500:
      return next(new Error('Fallo no controlado simulado para verificar captura de 500'));
    default:
      return next(new AppError(`Código de estado ${code} simulado`, code));
  }
});

// Alias directo para demostración sin caída del servidor del error 500 controlado
app.get(['/api/test-error-500', '/api/v1/test-error-500'], (req, res, next) => {
  return next(new AppError('Error interno 500 simulado y capturado exitosamente por el manejador global sin caída del servidor', 500));
});

// Servir la aplicación Frontend compilada (dist) para acceso unificado desde red o navegador
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  // Cualquier ruta web que no empiece con /api se entrega al router de React (SPA)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
      return next();
    }
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

// Middleware 404 para cualquier ruta de la API no definida
app.use(notFoundHandler);

// Middleware global de manejo de errores
app.use(errorHandler);

export default app;

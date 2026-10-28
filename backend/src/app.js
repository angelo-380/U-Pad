import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';
import { db } from './config/firebase.js';
import authRoutes from './routes/authRoutes.js';
import rutinasRoutes from './routes/rutinasRoutes.js';
import { generalLimiter } from './middlewares/rateLimiter.js';
import { notFoundHandler } from './middlewares/notFoundHandler.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { sendSuccess } from './utils/responseHandler.js';
import { AppError } from './utils/AppError.js';

dotenv.config();

const app = express();

// Middlewares de seguridad de cabeceras y parsing
// Ajustamos helmet para permitir renderizado de Swagger UI sin bloqueos de CSP
app.use(helmet({
  contentSecurityPolicy: false,
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
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

// Ruta raíz: Sitio en desarrollo (Requisito 5)
app.get('/', (req, res) => {
  sendSuccess(res, 200, 'Sitio en desarrollo - U-Pad Backend API v1.0 (Entrega 25%)', {
    status: 'operational',
    environment: process.env.NODE_ENV || 'development',
    documentation: 'http://localhost:3000/api/docs',
    timestamp: new Date().toISOString()
  });
});

// Ruta de health check y verificación de conexión a Firestore
app.get('/health', async (req, res, next) => {
  try {
    await db.listCollections();
    sendSuccess(res, 200, 'Servicio en línea y conectado a Firestore', {
      database: 'connected',
      emulator: !!process.env.FIRESTORE_EMULATOR_HOST,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(new AppError('Error de conectividad con la base de datos', 503, error.message));
  }
});

// Rutas principales de la API
app.use('/api/auth', authRoutes);
app.use('/api/rutinas', rutinasRoutes);

// Ruta de prueba para verificar respuestas HTTP controladas
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

// Middleware 404 para cualquier ruta no definida
app.use(notFoundHandler);

// Middleware global de manejo de errores
app.use(errorHandler);

export default app;

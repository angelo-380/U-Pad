import dotenv from 'dotenv';

// Guardar valor de RATE_LIMIT_AUTH_MAX si fue provisto en el entorno de ejecución
const customAuthMax = process.env.RATE_LIMIT_AUTH_MAX;

// Cargar variables del archivo .env utilizado por el backend
dotenv.config();

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_upad_2026_super_seguro_min_32_chars';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

// Conectar al mismo emulador de Firestore y project ID utilizados por el backend
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'upad-dev-project';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';

// Configuración del límite estricto de autenticación (RATE_LIMIT_AUTH_MAX):
// Si se definió explícitamente por variable de entorno, se usa dicho valor;
// de lo contrario, se eleva a 1000 para que la suite de pruebas no sea bloqueada.
if (customAuthMax) {
  process.env.RATE_LIMIT_AUTH_MAX = customAuthMax;
} else {
  process.env.RATE_LIMIT_AUTH_MAX = '1000';
}

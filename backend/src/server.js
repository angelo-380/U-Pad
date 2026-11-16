process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '128';

import dotenv from 'dotenv';
import http from 'http';
import { resolverPepperKms } from './config/pepperKms.js';

dotenv.config();

// 1) El pepper se resuelve ANTES de cargar la app: config/database.js exige los secretos al importarse.
try {
  const { origen } = await resolverPepperKms();
  if (origen === 'kms') console.log('[U-Pad Backend] Pepper descifrado con Cloud KMS (solo en memoria).');
} catch (e) {
  console.error(`[U-Pad Backend] No se pudo obtener el pepper de Cloud KMS: ${e.message} El backend no arranca.`);
  process.exit(1);
}

// 2) Ahora sí: app, base de datos y servicios
const { default: app } = await import('./app.js');
const { DB_PATH } = await import('./config/database.js');
const { descripcionPersistencia } = await import('./config/persistencia.js');
const { backupService, INTERVALO_BACKUP_AUTOMATICO_MS } = await import('./services/backupService.js');

const PORT = process.env.PORT || 3000;

// Configuración de servidor HTTP con cola de conexiones ampliada y keep-alive optimizado
const server = http.createServer(app);

// Aumentar el backlog de conexiones para pruebas de alta concurrencia (evita TCP connection reset by peer)
server.maxConnections = 50000;
server.keepAliveTimeout = 65000; // 65 segundos
server.headersTimeout = 66000;

server.listen(PORT, '0.0.0.0', 4096, () => {
  console.log(`[U-Pad Backend] Servidor Express ejecutándose en http://localhost:${PORT}`);
  console.log(`[U-Pad Backend] Entorno: ${process.env.NODE_ENV || 'development'}`);
  const persistencia = descripcionPersistencia();
  console.log(`[U-Pad Backend] Base de datos SQLite: ${DB_PATH} (persistencia: ${persistencia})`);
  if (persistencia === 'disco temporal') {
    console.warn('[U-Pad Backend] AVISO: Cloud Run sin réplica (UPAD_BUCKET). Los datos se perderán al reiniciar o desplegar.');
  }

  // Backups automáticos: al arrancar (si el último tiene más de 12 h) y cada 12 h mientras la instancia esté viva
  const backupAutomatico = async () => {
    try {
      const creado = await backupService.backupAutomaticoSiCorresponde();
      if (creado) console.log(`[U-Pad Backup] Backup automático creado: ${creado.filePath}`);
    } catch (e) {
      console.error(`[U-Pad Backup] Error en el backup automático: ${e.message}`);
    }
  };
  setTimeout(backupAutomatico, 3000);
  setInterval(backupAutomatico, INTERVALO_BACKUP_AUTOMATICO_MS);
});

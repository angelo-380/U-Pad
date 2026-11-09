process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '128';

import app from './app.js';
import dotenv from 'dotenv';
import http from 'http';
import { backupService } from './services/backupService.js';

dotenv.config();

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
  console.log(`[U-Pad Backend] Conectado a Google Cloud Platform (GCP Relational Database Engine)`);

  // Programador de Backups Automáticos (cada 12 horas y verificación al iniciar)
  setTimeout(async () => {
    try {
      const existing = await backupService.listarBackups({ rol: 'developer' });
      if (existing.length === 0) {
        const autoBkp = await backupService.crearBackup({
          rol: 'developer',
          email: 'sistema_automatico@upad.cloud',
          tipo: 'AUTOMATICO'
        });
        console.log(`[U-Pad Backup] Backup automático inicial generado exitosamente: ${autoBkp.filename}`);
      }
    } catch (e) {
      console.warn(`[U-Pad Backup] Alerta en backup automático inicial: ${e.message}`);
    }
  }, 3000);

  setInterval(async () => {
    try {
      const autoBkp = await backupService.crearBackup({
        rol: 'developer',
        email: 'sistema_automatico@upad.cloud',
        tipo: 'AUTOMATICO'
      });
      console.log(`[U-Pad Backup] Backup automático periódico generado: ${autoBkp.filename}`);
    } catch (e) {
      console.error(`[U-Pad Backup] Error en backup automático periódico: ${e.message}`);
    }
  }, 12 * 60 * 60 * 1000);
});

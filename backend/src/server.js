import app from './app.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[U-Pad Backend] Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`[U-Pad Backend] Entorno: ${process.env.NODE_ENV || 'development'}`);
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    console.log(`[U-Pad Backend] Firestore Emulator activo en: ${process.env.FIRESTORE_EMULATOR_HOST}`);
  } else {
    console.log(`[U-Pad Backend] Conectado a Firestore Cloud: ${process.env.FIREBASE_PROJECT_ID}`);
  }
});

import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

const projectId = process.env.FIREBASE_PROJECT_ID || 'upad-dev-project';

// Si no está inicializado, lo inicializamos
if (!admin.apps.length) {
  // Cuando FIRESTORE_EMULATOR_HOST está configurada en .env,
  // el SDK de Firebase automáticamente desvía las peticiones al emulador local
  admin.initializeApp({
    projectId: projectId,
  });
}

export const db = admin.firestore();
export const authAdmin = admin.auth();
export default admin;

import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { db } from '../src/config/firebase.js';

dotenv.config();

const USERS_COLLECTION = 'usuarios';
const SALT_ROUNDS = 10;

/**
 * Script de inicialización (seed) para crear un usuario Administrador de manera segura e idempotente.
 * Se ejecuta con: npm run seed:admin
 *
 * Lee ADMIN_EMAIL, ADMIN_PASSWORD y ADMIN_NAME del entorno.
 * Hashea la contraseña con bcrypt y guarda el documento con rol 'admin'.
 * Si el usuario ya existe, no hace nada (idempotente).
 * NUNCA imprime la contraseña en los logs.
 */
async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const nombre = process.env.ADMIN_NAME || 'Administrador U-Pad';

  if (!email || !password) {
    console.error('[seed:admin] Error: Las variables ADMIN_EMAIL y ADMIN_PASSWORD son obligatorias en las variables de entorno.');
    process.exit(1);
  }

  const emailNormalizado = email.toLowerCase().trim();

  try {
    // 1. Verificar idempotencia: si ya existe el correo, no hacer nada
    const existingUserQuery = await db.collection(USERS_COLLECTION)
      .where('email', '==', emailNormalizado)
      .limit(1)
      .get();

    if (!existingUserQuery.empty) {
      console.log(`[seed:admin] El usuario administrador con email "${emailNormalizado}" ya existe. No se realizaron cambios.`);
      process.exit(0);
    }

    // 2. Hashear la contraseña con bcrypt (la contraseña nunca se loguea)
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // 3. Crear el documento con la misma estructura exacta que authService.register
    const nuevoAdmin = {
      nombre: nombre.trim(),
      email: emailNormalizado,
      password: passwordHash,
      rol: 'admin',
      organizacionId: null,
      activo: true,
      creadoEn: new Date().toISOString(),
    };

    const docRef = await db.collection(USERS_COLLECTION).add(nuevoAdmin);
    console.log(`[seed:admin] Administrador creado exitosamente con ID: ${docRef.id} y email: ${emailNormalizado}`);
    process.exit(0);
  } catch (error) {
    console.error(`[seed:admin] Error al crear el usuario administrador: ${error.message}`);
    process.exit(1);
  }
}

seedAdmin();

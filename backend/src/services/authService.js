import bcrypt from 'bcrypt';
import { db } from '../config/firebase.js';
import { AppError } from '../utils/AppError.js';
import { signToken } from '../utils/jwt.js';

const USERS_COLLECTION = 'usuarios';
const SALT_ROUNDS = 10;

/**
 * Servicio de Autenticación para U-Pad (Firestore + Bcrypt + JWT).
 */
export const authService = {
  /**
   * Registra un nuevo usuario en Firestore con contraseña hasheada.
   */
  async register({ nombre, email, password, rol = 'empresario', organizacionId = null }) {
    const emailNormalizado = email.toLowerCase().trim();

    // 1. Verificar si el correo ya existe en Firestore
    const existingUserQuery = await db.collection(USERS_COLLECTION)
      .where('email', '==', emailNormalizado)
      .limit(1)
      .get();

    if (!existingUserQuery.empty) {
      throw new AppError('El correo electrónico ya se encuentra registrado.', 409, {
        field: 'email',
        code: 'EMAIL_ALREADY_EXISTS',
      });
    }

    // 2. Lista permitida (allowlist) de roles para registro público: únicamente 'empresario' y 'tutor'
    const ALLOWED_ROLES = ['empresario', 'tutor'];
    const rolNormalizado = (rol !== undefined && rol !== null) ? String(rol).toLowerCase().trim() : 'empresario';

    if (!ALLOWED_ROLES.includes(rolNormalizado)) {
      throw new AppError(
        `Rol no permitido [${rol}]. El registro público solo acepta los roles: ${ALLOWED_ROLES.join(', ')}.`,
        400,
        {
          field: 'rol',
          code: 'INVALID_ROLE',
          allowedRoles: ALLOWED_ROLES,
        }
      );
    }

    // 3. Hashear la contraseña con bcrypt
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // 4. Preparar el nuevo documento de usuario
    const nuevoUsuario = {
      nombre: nombre.trim(),
      email: emailNormalizado,
      password: passwordHash,
      rol: rolNormalizado,
      organizacionId: organizacionId || null,
      activo: true,
      creadoEn: new Date().toISOString(),
    };

    const docRef = await db.collection(USERS_COLLECTION).add(nuevoUsuario);

    // 5. Generar token JWT
    const tokenPayload = {
      id: docRef.id,
      email: nuevoUsuario.email,
      rol: nuevoUsuario.rol,
      organizacionId: nuevoUsuario.organizacionId,
    };
    const token = signToken(tokenPayload);

    // 6. Retornar datos limpios (sin password)
    return {
      token,
      usuario: {
        id: docRef.id,
        nombre: nuevoUsuario.nombre,
        email: nuevoUsuario.email,
        rol: nuevoUsuario.rol,
        organizacionId: nuevoUsuario.organizacionId,
        activo: nuevoUsuario.activo,
        creadoEn: nuevoUsuario.creadoEn,
      },
    };
  },

  /**
   * Inicia sesión validando credenciales con bcrypt y emite token JWT.
   */
  async login({ email, password }) {
    const emailNormalizado = email.toLowerCase().trim();

    // 1. Buscar usuario por email en Firestore
    const userSnapshot = await db.collection(USERS_COLLECTION)
      .where('email', '==', emailNormalizado)
      .limit(1)
      .get();

    if (userSnapshot.empty) {
      throw new AppError('Credenciales incorrectas: correo o contraseña inválidos.', 401, {
        code: 'INVALID_CREDENTIALS',
      });
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();

    // 2. Verificar que la cuenta esté activa
    if (userData.activo === false) {
      throw new AppError('Tu cuenta se encuentra desactivada. Contacta al administrador.', 403, {
        code: 'ACCOUNT_INACTIVE',
      });
    }

    // 3. Comparar contraseñas con bcrypt
    const passwordValido = await bcrypt.compare(password, userData.password);
    if (!passwordValido) {
      throw new AppError('Credenciales incorrectas: correo o contraseña inválidos.', 401, {
        code: 'INVALID_CREDENTIALS',
      });
    }

    // 4. Generar token JWT
    const tokenPayload = {
      id: userDoc.id,
      email: userData.email,
      rol: userData.rol,
      organizacionId: userData.organizacionId || null,
    };
    const token = signToken(tokenPayload);

    // 5. Retornar datos seguros
    return {
      token,
      usuario: {
        id: userDoc.id,
        nombre: userData.nombre,
        email: userData.email,
        rol: userData.rol,
        organizacionId: userData.organizacionId || null,
        activo: userData.activo,
      },
    };
  },
};

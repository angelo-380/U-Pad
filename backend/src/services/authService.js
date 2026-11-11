import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { db, hashPassword, verifyPassword, hashPasswordAsync, verifyPasswordAsync } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { signToken } from '../utils/jwt.js';
import { ROLES, ROLES_REGISTRO_PUBLICO, normalizarRol } from '../utils/roles.js';

const LOCKOUT_THRESHOLD = 5;

// Escala de bloqueo progresivo (en minutos):
// Nivel 1 (5 fallos): 1 minuto
// Nivel 2 (6 fallos): 5 minutos
// Nivel 3 (7 fallos): 10 minutos
// Nivel 4 (8 fallos): 15 minutos
// Nivel 5 o superior (>= 9 fallos): 30 minutos (Tope máximo)
function calculateLockoutDurationMs(failedAttempts) {
  const extraFailures = Math.max(0, failedAttempts - LOCKOUT_THRESHOLD);
  const minutesProgression = [1, 5, 10, 15, 30];
  const minutes = extraFailures < minutesProgression.length
    ? minutesProgression[extraFailures]
    : 30; // Tope máximo: 30 minutos
  return minutes * 60 * 1000;
}

function formatLockoutTime(seconds) {
  if (seconds >= 60) {
    const mins = Math.ceil(seconds / 60);
    return `${mins} minuto${mins > 1 ? 's' : ''}`;
  }
  return `${seconds} segundo${seconds > 1 ? 's' : ''}`;
}

/**
 * Servicio de Autenticación para U-Pad (Google Cloud Relational DB + PBKDF2/KMS Pepper + JWT).
 */
export const authService = {
  /**
   * Registra un nuevo usuario con hashing seguro PBKDF2 + Cloud KMS Pepper.
   */
  async register({ nombre, email, password, rol = 'empresario', organizacionId = null }) {
    const emailNormalizado = email.toLowerCase().trim();

    // 1. Lista permitida (allowlist) de roles para registro público: 'empresario' y 'tutor'.
    //    'developer' (y cualquier otro rol) NUNCA se obtiene por registro público.
    const rolNormalizado = (rol === undefined || rol === null) ? ROLES.EMPRESARIO : normalizarRol(rol);

    if (!rolNormalizado || !ROLES_REGISTRO_PUBLICO.includes(rolNormalizado)) {
      throw new AppError(
        `Rol no permitido [${String(rol)}]. El registro público solo acepta los roles: ${ROLES_REGISTRO_PUBLICO.join(', ')}.`,
        400,
        {
          field: 'rol',
          code: 'INVALID_ROLE',
          allowedRoles: ROLES_REGISTRO_PUBLICO,
        }
      );
    }

    // 2. Verificar si el correo ya existe
    const existing = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(emailNormalizado);
    if (existing) {
      throw new AppError('El correo electrónico ya se encuentra registrado.', 409, {
        field: 'email',
        code: 'EMAIL_ALREADY_EXISTS',
      });
    }

    // 3. Hashear la contraseña con PBKDF2 + Salt + Cloud KMS Pepper (asíncrono para alto rendimiento)
    const { hash, salt } = await hashPasswordAsync(password, null, emailNormalizado);
    const userId = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const creadoEn = new Date().toISOString();

    db.prepare(`
      INSERT INTO usuarios (id, nombre, email, password_hash, password_salt, rol, organizacionId, activo, creadoEn)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(userId, nombre.trim(), emailNormalizado, hash, salt, rolNormalizado, organizacionId || null, creadoEn);

    // Sincronizar en la tabla users para compatibilidad con la app móvil
    try {
      db.prepare(`
        INSERT INTO users (id, email, password_hash, full_name, role)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `).run(
        userId,
        emailNormalizado,
        hash,
        nombre.trim(),
        // Valor legado de la tabla `users` (compatibilidad con la app móvil): tutor -> PARENT, empresario -> ADMIN
        rolNormalizado === 'tutor' ? 'PARENT' : 'ADMIN'
      );
    } catch (e) {}

    // 4. Generar token JWT
    const tokenPayload = {
      id: userId,
      email: emailNormalizado,
      rol: rolNormalizado,
      organizacionId: organizacionId || null,
    };
    const token = signToken(tokenPayload);

    // 5. Retornar datos limpios (sin password)
    return {
      token,
      usuario: {
        id: userId,
        nombre: nombre.trim(),
        email: emailNormalizado,
        rol: rolNormalizado,
        organizacionId: organizacionId || null,
        activo: true,
        creadoEn,
      },
    };
  },

  /**
   * Inicia sesión validando credenciales y aplicando bloqueo tras 5 intentos fallidos.
   */
  async login({ email, password }) {
    const emailNormalizado = email.toLowerCase().trim();
    const now = Date.now();

    // 1. Verificar si la cuenta está actualmente bloqueada por exceder intentos
    const lockout = db.prepare('SELECT failed_attempts, locked_until FROM login_lockouts WHERE email = ?').get(emailNormalizado);
    if (lockout && lockout.locked_until > now) {
      const remainingSeconds = Math.ceil((lockout.locked_until - now) / 1000);
      const formattedTime = formatLockoutTime(remainingSeconds);
      throw new AppError(
        `Has superado los 5 intentos fallidos permitidos. Tu cuenta ha sido bloqueada temporalmente por seguridad. Por favor espera ${formattedTime} antes de intentar nuevamente.`,
        429,
        {
          code: 'ACCOUNT_LOCKED',
          retryAfter: `${remainingSeconds} segundos`,
          remainingSeconds,
        }
      );
    }

    // 2. Buscar usuario por email en la base de datos
    const user = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(emailNormalizado);

    const recordFailedAttempt = () => {
      const newAttempts = (lockout ? lockout.failed_attempts : 0) + 1;
      if (newAttempts >= LOCKOUT_THRESHOLD) {
        const durationMs = calculateLockoutDurationMs(newAttempts);
        const lockedUntil = now + durationMs;
        const durationSeconds = Math.ceil(durationMs / 1000);
        const durationText = formatLockoutTime(durationSeconds);

        db.prepare(`
          INSERT INTO login_lockouts (email, failed_attempts, locked_until, last_attempt)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(email) DO UPDATE SET failed_attempts = excluded.failed_attempts, locked_until = excluded.locked_until, last_attempt = excluded.last_attempt
        `).run(emailNormalizado, newAttempts, lockedUntil, now);

        throw new AppError(
          `Has superado los 5 intentos fallidos permitidos. Tu cuenta ha sido bloqueada temporalmente por ${durationText} por seguridad.`,
          429,
          {
            code: 'ACCOUNT_LOCKED',
            retryAfter: `${durationSeconds} segundos`,
            remainingSeconds: durationSeconds,
            bloqueoMinutos: Math.round(durationSeconds / 60),
          }
        );
      } else {
        db.prepare(`
          INSERT INTO login_lockouts (email, failed_attempts, locked_until, last_attempt)
          VALUES (?, ?, 0, ?)
          ON CONFLICT(email) DO UPDATE SET failed_attempts = excluded.failed_attempts, last_attempt = excluded.last_attempt
        `).run(emailNormalizado, newAttempts, now);

        throw new AppError('Credenciales incorrectas: correo o contraseña inválidos.', 401, {
          code: 'INVALID_CREDENTIALS',
          intentosRestantes: LOCKOUT_THRESHOLD - newAttempts,
        });
      }
    };

    if (!user) {
      recordFailedAttempt();
    }

    // 3. Verificar que la cuenta esté activa
    if (user.activo === 0) {
      throw new AppError('Tu cuenta se encuentra desactivada. Contacta al administrador.', 403, {
        code: 'ACCOUNT_INACTIVE',
      });
    }

    // 4. Comparar contraseñas: verificar PBKDF2 + Pepper KMS (asíncrono) o fallback a bcrypt
    let passwordValido = false;
    if (user.password_hash.startsWith('$2')) {
      passwordValido = await bcrypt.compare(password, user.password_hash);
    } else {
      passwordValido = await verifyPasswordAsync(password, user.password_salt, user.password_hash, emailNormalizado);
    }

    if (!passwordValido) {
      recordFailedAttempt();
    }

    // 5. Credenciales válidas: resetear contador de bloqueos
    db.prepare('DELETE FROM login_lockouts WHERE email = ?').run(emailNormalizado);

    // 6. Generar token JWT
    const tokenPayload = {
      id: user.id,
      email: user.email,
      rol: user.rol,
      organizacionId: user.organizacionId || null,
    };
    const token = signToken(tokenPayload);

    // 7. Retornar datos seguros
    return {
      token,
      usuario: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        organizacionId: user.organizacionId || null,
        activo: Boolean(user.activo),
      },
    };
  },
};

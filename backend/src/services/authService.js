import crypto from 'node:crypto';
import { db, hashPasswordAsync, verificarPasswordUsuario, migrarHashUsuario, HASH_VERSION_ACTUAL } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { signToken } from '../utils/jwt.js';
import { ROLES, ROLES_REGISTRO_PUBLICO, normalizarRol } from '../utils/roles.js';
import { buscarPorCodigo, crearOrganizacion, formatearCodigo } from '../utils/organizaciones.js';

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
 * Servicio de Autenticación para U-Pad (SQLite + PBKDF2 con salt y pepper de entorno + JWT).
 */
export const authService = {
  /**
   * Registra un nuevo usuario con hashing seguro PBKDF2 + salt + pepper (variable de entorno).
   */
  async register({ nombre, email, password, rol = 'empresario', codigoOrganizacion = null, googleSub = null }) {
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

    // 2. Organización: el cliente NUNCA envía un organizacionId.
    //    - empresario: recibe una organización propia (se crea más abajo, junto con su cuenta).
    //    - tutor: puede ingresar el código de la organización de su institución (validado contra las
    //      organizaciones existentes) o quedar sin organización.
    const hayCodigo = !(
      codigoOrganizacion === undefined ||
      codigoOrganizacion === null ||
      (typeof codigoOrganizacion === 'string' && codigoOrganizacion.trim() === '')
    );
    let organizacionUnida = null;

    if (hayCodigo) {
      if (rolNormalizado !== ROLES.TUTOR) {
        throw new AppError('El código de organización solo aplica al registro de tutores.', 400, {
          field: 'codigoOrganizacion',
          code: 'ORGANIZACION_CODIGO_NO_APLICA',
        });
      }

      organizacionUnida = buscarPorCodigo(db, codigoOrganizacion);
      if (!organizacionUnida) {
        // Mensaje único: no revela si el código tiene formato válido o simplemente no existe
        throw new AppError(
          'El código de organización no es válido. Verifica el código que te entregó tu institución o déjalo vacío.',
          400,
          { field: 'codigoOrganizacion', code: 'ORGANIZACION_CODIGO_INVALIDO' }
        );
      }
    }

    // 3. Verificar si el correo ya existe
    const existing = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(emailNormalizado);
    if (existing) {
      throw new AppError('El correo electrónico ya se encuentra registrado.', 409, {
        field: 'email',
        code: 'EMAIL_ALREADY_EXISTS',
      });
    }

    // 4. Hashear la contraseña con PBKDF2 + salt + pepper de entorno (asíncrono para alto rendimiento)
    const { hash, salt } = await hashPasswordAsync(password);
    const userId = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const creadoEn = new Date().toISOString();

    // 5. Crear la cuenta (y la organización del empresario) en una sola transacción
    let organizacionId = organizacionUnida ? organizacionUnida.id : null;
    let organizacionPropia = null;

    db.exec('BEGIN');
    try {
      if (rolNormalizado === ROLES.EMPRESARIO) {
        organizacionPropia = crearOrganizacion(db, { nombre: nombre.trim(), propietarioId: userId });
        organizacionId = organizacionPropia.id;
      }

      db.prepare(`
        INSERT INTO usuarios (id, nombre, email, password_hash, password_salt, rol, organizacionId, activo, creadoEn, google_sub, hash_version)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      `).run(userId, nombre.trim(), emailNormalizado, hash, salt, rolNormalizado, organizacionId, creadoEn, googleSub, HASH_VERSION_ACTUAL);

      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }


    // 6. Generar token JWT
    const tokenPayload = {
      id: userId,
      email: emailNormalizado,
      rol: rolNormalizado,
      organizacionId,
    };
    const token = signToken(tokenPayload);

    // 7. Retornar datos limpios (sin password). El código de la organización solo se devuelve a su propietario.
    const organizacion = organizacionPropia
      ? { id: organizacionPropia.id, nombre: organizacionPropia.nombre, codigo: formatearCodigo(organizacionPropia.codigo) }
      : (organizacionUnida ? { id: organizacionUnida.id, nombre: organizacionUnida.nombre } : null);

    return {
      token,
      usuario: {
        id: userId,
        nombre: nombre.trim(),
        email: emailNormalizado,
        rol: rolNormalizado,
        organizacionId,
        activo: true,
        creadoEn,
      },
      organizacion,
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

    // 4. Comparar contraseñas (versión actual o heredada; ver verificarPasswordUsuario)
    const { valido: passwordValido, requiereMigracion } = await verificarPasswordUsuario(user, password);

    if (!passwordValido) {
      recordFailedAttempt();
    }

    // Rotación del pepper / fin del hash débil: una cuenta heredada se vuelve a cifrar en la versión actual
    if (requiereMigracion) {
      try {
        await migrarHashUsuario(db, user.id, password);
      } catch (e) {
        console.warn(`[U-Pad] No se pudo migrar el hash de la cuenta ${user.id}: ${e.message}`);
      }
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

  /**
   * Inicio de sesión con una cuenta de Google ya verificada ({ sub, email }).
   * Busca la cuenta por su Google enlazado o por correo; si no existe devuelve null (hay que registrarse).
   * Una cuenta ya enlazada a OTRO Google no se puede usar con este.
   */
  async loginGoogle({ sub, email }) {
    const user =
      db.prepare('SELECT * FROM usuarios WHERE google_sub = ?').get(sub) ||
      db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
    if (!user) return null;

    if (user.google_sub && user.google_sub !== sub) {
      throw new AppError('Este correo ya está enlazado a otra cuenta de Google.', 401, { code: 'GOOGLE_CUENTA_DISTINTA' });
    }
    if (Number(user.activo) === 0) {
      throw new AppError('Tu cuenta se encuentra desactivada. Contacta al administrador.', 403, { code: 'ACCOUNT_INACTIVE' });
    }
    if (!user.google_sub) {
      db.prepare('UPDATE usuarios SET google_sub = ? WHERE id = ?').run(sub, user.id);
    }

    const token = signToken({ id: user.id, email: user.email, rol: user.rol, organizacionId: user.organizacionId || null });
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

  /**
   * Primer ingreso con Google: crea la cuenta con las mismas reglas que el registro normal
   * (roles públicos, organización propia del empresario, código opcional del tutor).
   * La contraseña es aleatoria y nadie la conoce: la cuenta solo entra con Google.
   */
  async registroGoogle({ sub, email, nombre }, { rol, nombreInstitucion, codigoOrganizacion } = {}) {
    const rolNormalizado = rol === undefined || rol === null ? ROLES.EMPRESARIO : normalizarRol(rol);
    let nombreCuenta = nombre;
    if (rolNormalizado === ROLES.EMPRESARIO) {
      const institucion = typeof nombreInstitucion === 'string' ? nombreInstitucion.trim().slice(0, 100) : '';
      if (!institucion) {
        throw new AppError('El nombre de la institución es obligatorio.', 400, {
          field: 'nombreInstitucion',
          code: 'NOMBRE_INSTITUCION_REQUERIDO',
        });
      }
      nombreCuenta = institucion;
    }

    if (db.prepare('SELECT id FROM usuarios WHERE google_sub = ?').get(sub)) {
      throw new AppError('Esta cuenta de Google ya está registrada.', 409, { code: 'GOOGLE_YA_REGISTRADO' });
    }

    return this.register({
      nombre: nombreCuenta,
      email,
      password: crypto.randomBytes(32).toString('base64url'),
      rol,
      codigoOrganizacion,
      googleSub: sub,
    });
  },
};

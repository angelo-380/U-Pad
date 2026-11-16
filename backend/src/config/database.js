import dotenv from 'dotenv';
import { exigirSecretosAlArrancar, leerSecreto } from './secretos.js';
dotenv.config();

// Sin JWT_SECRET ni GCP_KMS_PEPPER_SECRET el backend no arranca (y no se abre ni crea la base)
exigirSecretosAlArrancar();

import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { validarPassword } from '../utils/passwordPolicy.js';
import { crearOrganizacion } from '../utils/organizaciones.js';

// Ruta de la base de datos SQLite: DB_PATH o, si no se define, upad_relational.db en la carpeta actual.
// En el contenedor es /data/upad_relational.db y Litestream la replica a Cloud Storage (scripts/arranque.sh).
export const DB_PATH = process.env.DB_PATH || path.resolve(process.cwd(), 'upad_relational.db');

const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new DatabaseSync(DB_PATH);

// Optimizaciones de concurrencia y estrés masivo para Cloud Run (WAL, busy_timeout y cache)
try {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 10000;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA cache_size = -64000;');
} catch (e) {}

// Pepper de las contraseñas: se lee del entorno (GCP_KMS_PEPPER_SECRET). Hoy es una variable de entorno,
// no Cloud KMS (ver CLAUDE.md, 9d). Sin valor por defecto en el código.
const pepper = () => leerSecreto('GCP_KMS_PEPPER_SECRET');

/**
 * Hashing de contraseñas de alta seguridad:
 * PBKDF2 (100,000 rondas, sha512) + salt criptográfico + pepper (variable de entorno GCP_KMS_PEPPER_SECRET)
 */
export function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const combined = `${password}${salt}${pepper()}`;
  const hash = crypto.pbkdf2Sync(combined, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, salt, storedHash) {
  if (!storedHash) return false;
  const combined = `${password}${salt}${pepper()}`;
  const calculated = crypto.pbkdf2Sync(combined, salt, 100000, 64, 'sha512').toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(calculated, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch (e) {
    return false;
  }
}

// Versión actual del hash: 2 = PBKDF2 (100 000 rondas, sha512) + salt + pepper ACTUAL.
// Las filas sin versión (NULL) son heredadas: se verifican con el pepper anterior/actual y las rondas
// antiguas, y se vuelven a cifrar en la versión 2 al iniciar sesión (verificarPasswordUsuario).
export const HASH_VERSION_ACTUAL = 2;
const RONDAS = 100000;
const RONDAS_K6_HEREDADAS = 1000; // solo para VERIFICAR cuentas antiguas de las pruebas de carga

const pbkdf2Async = (password, salt, pepperValor, rondas) =>
  new Promise((resolve, reject) => {
    crypto.pbkdf2(`${password}${salt}${pepperValor}`, salt, rondas, 64, 'sha512', (err, clave) =>
      err ? reject(err) : resolve(clave)
    );
  });

const coincide = (calculado, hashHex) => {
  try {
    const guardado = Buffer.from(hashHex, 'hex');
    return guardado.length === calculado.length && crypto.timingSafeEqual(calculado, guardado);
  } catch (e) {
    return false;
  }
};

/** Hash asíncrono (no bloquea el event loop). Siempre 100 000 rondas y el pepper actual. */
export async function hashPasswordAsync(password, salt = null) {
  const saltFinal = salt || crypto.randomBytes(16).toString('hex');
  const clave = await pbkdf2Async(password, saltFinal, pepper(), RONDAS);
  return { hash: clave.toString('hex'), salt: saltFinal };
}

export async function verifyPasswordAsync(password, salt, storedHash) {
  if (!storedHash) return false;
  try {
    return coincide(await pbkdf2Async(password, salt, pepper(), RONDAS), storedHash);
  } catch (e) {
    return false;
  }
}

/**
 * Verifica la contraseña de una fila de `usuarios`. Devuelve { valido, requiereMigracion }.
 * - Versión 2: solo el pepper actual y 100 000 rondas.
 * - Heredadas (sin versión): PEPPER_ANTERIOR (si existe) y el actual; 1000 rondas solo para las cuentas
 *   de pruebas de carga (correo con test_k6_ o contraseña K6Pass…), como hacía el código anterior.
 * - bcrypt heredado ($2…).
 * Si una heredada es válida, requiereMigracion = true (ver migrarHashUsuario).
 */
export async function verificarPasswordUsuario(usuario, password) {
  const hash = usuario?.password_hash;
  if (!hash || typeof password !== 'string') return { valido: false, requiereMigracion: false };

  if (hash.startsWith('$2')) {
    const valido = await bcrypt.compare(password, hash);
    return { valido, requiereMigracion: valido };
  }

  if (Number(usuario.hash_version) === HASH_VERSION_ACTUAL) {
    return { valido: await verifyPasswordAsync(password, usuario.password_salt, hash), requiereMigracion: false };
  }

  const anterior = (process.env.PEPPER_ANTERIOR || '').trim();
  const peppers = [...new Set([anterior, pepper()].filter(Boolean))];
  const email = usuario.email || '';
  const rondas = [RONDAS];
  if (email.includes('test_k6_') || password.startsWith('K6Pass')) rondas.push(RONDAS_K6_HEREDADAS);

  for (const pepperValor of peppers) {
    for (const r of rondas) {
      if (coincide(await pbkdf2Async(password, usuario.password_salt, pepperValor, r), hash)) {
        return { valido: true, requiereMigracion: true };
      }
    }
  }
  return { valido: false, requiereMigracion: false };
}

/** Vuelve a cifrar la contraseña (ya verificada) en la versión actual, con un salt nuevo. */
export async function migrarHashUsuario(conexion, usuarioId, password) {
  const { hash, salt } = await hashPasswordAsync(password);
  conexion
    .prepare('UPDATE usuarios SET password_hash = ?, password_salt = ?, hash_version = ? WHERE id = ?')
    .run(hash, salt, HASH_VERSION_ACTUAL, usuarioId);
}

// Inicializar esquemas requeridos por la plataforma web y la nube si no existen
export function inicializarEsquema(conexion) {
  conexion.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'empresario',
    organizacionId TEXT,
    activo INTEGER NOT NULL DEFAULT 1,
    creadoEn TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rutinas (
    id TEXT PRIMARY KEY,
    titulo TEXT NOT NULL,
    turno TEXT NOT NULL,
    ninoId TEXT,
    organizacionId TEXT,
    pasos TEXT NOT NULL DEFAULT '[]',
    activa INTEGER NOT NULL DEFAULT 1,
    creadoPor TEXT NOT NULL,
    creadoEn TEXT NOT NULL,
    actualizadoEn TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS login_lockouts (
    email TEXT PRIMARY KEY,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until INTEGER NOT NULL DEFAULT 0,
    last_attempt INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS pairing_codes (
    code VARCHAR(16) PRIMARY KEY,
    device_id VARCHAR(128) NOT NULL,
    parent_id VARCHAR(64) DEFAULT NULL,
    organization_id VARCHAR(64) DEFAULT NULL,
    pairing_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS child_devices (
    device_id VARCHAR(128) PRIMARY KEY,
    parent_id VARCHAR(64),
    child_name VARCHAR(128),
    device_model VARCHAR(128) NOT NULL DEFAULT '',
    is_kiosk_active INTEGER NOT NULL DEFAULT 0,
    last_latitude REAL,
    last_longitude REAL,
    ubicacion_actualizada_en TEXT,
    zona_lat REAL,
    zona_lng REAL,
    zona_radio INTEGER,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS backups_history (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    size_formatted TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'MANUAL',
    creado_por TEXT NOT NULL,
    creado_en TEXT NOT NULL
  );

  -- Organizaciones (colegios y centros). Un empresario es propietario de una; los tutores se unen con su código.
  CREATE TABLE IF NOT EXISTS organizaciones (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    codigo TEXT NOT NULL UNIQUE,
    propietarioId TEXT,
    creadoEn TEXT NOT NULL
  );

  -- Avisos del teléfono del niño para su padre (p. ej. «completó la rutina»). El padre lo decide el servidor.
  CREATE TABLE IF NOT EXISTS notificaciones (
    id TEXT PRIMARY KEY,
    padreId TEXT NOT NULL,
    deviceId TEXT NOT NULL,
    tipo TEXT NOT NULL,
    titulo TEXT NOT NULL,
    descripcion TEXT NOT NULL DEFAULT '',
    creadoEn TEXT NOT NULL,
    leida INTEGER NOT NULL DEFAULT 0
  );

  -- Cumplimiento real: cada actividad que el niño completa en su teléfono (una vez por día, actividad y turno).
  -- Padre y organización los decide el servidor; la fecha es el día local del teléfono (YYYY-MM-DD).
  CREATE TABLE IF NOT EXISTS cumplimientos (
    id TEXT PRIMARY KEY,
    padreId TEXT NOT NULL,
    deviceId TEXT NOT NULL,
    rutinaId TEXT,
    actividad TEXT NOT NULL,
    turno TEXT NOT NULL,
    fecha TEXT NOT NULL,
    completadoEn TEXT NOT NULL,
    organizacionId TEXT,
    UNIQUE(deviceId, actividad, turno, fecha)
  );

  CREATE INDEX IF NOT EXISTS idx_notificaciones_padre ON notificaciones(padreId, creadoEn);
  CREATE INDEX IF NOT EXISTS idx_cumplimientos_padre ON cumplimientos(padreId, fecha);
  CREATE INDEX IF NOT EXISTS idx_cumplimientos_organizacion ON cumplimientos(organizacionId, fecha);
  CREATE INDEX IF NOT EXISTS idx_usuarios_organizacion ON usuarios(organizacionId);
  CREATE INDEX IF NOT EXISTS idx_rutinas_organizacion ON rutinas(organizacionId);
`);
  asegurarColumnasChildDevices(conexion);
  asegurarColumnasUsuarios(conexion);
}

/**
 * Añade a usuarios las columnas nuevas en bases creadas antes (google_sub: id de la cuenta de Google
 * enlazada, único cuando existe; hash_version: versión del hash de la contraseña). Idempotente.
 */
export function asegurarColumnasUsuarios(conexion) {
  const existentes = new Set(conexion.prepare('PRAGMA table_info(usuarios)').all().map((c) => c.name));
  if (!existentes.has('google_sub')) {
    conexion.exec('ALTER TABLE usuarios ADD COLUMN google_sub TEXT');
  }
  if (!existentes.has('hash_version')) {
    conexion.exec('ALTER TABLE usuarios ADD COLUMN hash_version INTEGER');
  }
  conexion.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_google_sub ON usuarios(google_sub) WHERE google_sub IS NOT NULL');
}

/**
 * Añade a child_devices las columnas que faltan en bases creadas con versiones anteriores
 * (nombre del niño, hora de la última ubicación, zona segura y si está fuera de ella). Idempotente.
 */
export function asegurarColumnasChildDevices(conexion) {
  const existentes = new Set(conexion.prepare('PRAGMA table_info(child_devices)').all().map((c) => c.name));
  const columnas = [
    ['child_name', 'VARCHAR(128)'],
    ['ubicacion_actualizada_en', 'TEXT'],
    ['zona_lat', 'REAL'],
    ['zona_lng', 'REAL'],
    ['zona_radio', 'INTEGER'],
    // Estado respecto a la zona segura para avisar al padre solo en los cambios: 1 fuera, 0 dentro, NULL sin calcular
    ['fuera_de_zona', 'INTEGER'],
  ];
  for (const [nombre, tipo] of columnas) {
    if (!existentes.has(nombre)) {
      conexion.exec(`ALTER TABLE child_devices ADD COLUMN ${nombre} ${tipo}`);
    }
  }
}

inicializarEsquema(db);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Migración idempotente: el rol 'admin' fue eliminado del sistema.
 * Las cuentas que aún lo tengan pasan a 'developer' (conservan los mismos permisos que ya tenían).
 * Devuelve la cantidad de usuarios migrados.
 */
export function migrarRolAdmin(conexion, consola = console) {
  const afectados = conexion.prepare("SELECT email FROM usuarios WHERE rol = 'admin'").all();
  if (afectados.length === 0) return 0;

  conexion.prepare("UPDATE usuarios SET rol = 'developer' WHERE rol = 'admin'").run();
  consola.warn(
    `[U-Pad] El rol 'admin' ya no existe: ${afectados.length} usuario(s) migrado(s) a 'developer': ` +
    afectados.map((u) => u.email).join(', ')
  );
  return afectados.length;
}

/**
 * Migración de organizaciones (una sola vez, controlada con PRAGMA user_version):
 * antes `organizacionId` era un texto libre enviado por el cliente. Ahora cada empresario es
 * propietario de UNA organización registrada y los demás usuarios solo pueden pertenecer a una existente.
 *
 * 1. Cada organizacionId usado por empresarios pasa a ser una organización (se conserva el id);
 *    el empresario más antiguo es el propietario.
 * 2. Los demás empresarios que compartían ese id reciben una organización propia (regla 1:1).
 * 3. Los empresarios sin organización reciben una.
 * 4. Tutores y demás usuarios cuya organización no existe quedan sin organización (NULL).
 * 5. Cada rutina toma la organización de su creador; las que apuntan a una organización inexistente quedan en NULL.
 * Todo ocurre en una transacción. Devuelve el resumen, o null si la migración ya estaba aplicada.
 */
export function migrarOrganizaciones(conexion, consola = console) {
  const { user_version: version } = conexion.prepare('PRAGMA user_version').get();
  if (version >= 1) return null;

  const resumen = { organizacionesCreadas: 0, empresariosMovidos: 0, membresiasLimpiadas: 0, rutinasNormalizadas: 0 };
  const emailsMovidos = [];

  conexion.exec('BEGIN');
  try {
    const existentes = new Map(
      conexion.prepare('SELECT id, propietarioId FROM organizaciones').all().map((o) => [o.id, o.propietarioId])
    );
    const empresarios = conexion.prepare(
      "SELECT id, nombre, email, organizacionId FROM usuarios WHERE rol = 'empresario' ORDER BY creadoEn ASC, id ASC"
    ).all();

    for (const empresario of empresarios) {
      const orgActual = empresario.organizacionId;

      if (orgActual && !existentes.has(orgActual)) {
        // Primer (más antiguo) empresario de ese id: conserva el id como propietario
        crearOrganizacion(conexion, { id: orgActual, nombre: empresario.nombre, propietarioId: empresario.id });
        existentes.set(orgActual, empresario.id);
        resumen.organizacionesCreadas += 1;
        continue;
      }

      if (orgActual && existentes.get(orgActual) === empresario.id) continue; // ya es propietario

      // Sin organización, o comparte una con otro propietario: recibe una propia
      const nueva = crearOrganizacion(conexion, { nombre: empresario.nombre, propietarioId: empresario.id });
      existentes.set(nueva.id, empresario.id);
      conexion.prepare('UPDATE usuarios SET organizacionId = ? WHERE id = ?').run(nueva.id, empresario.id);
      resumen.organizacionesCreadas += 1;
      if (orgActual) {
        resumen.empresariosMovidos += 1;
        emailsMovidos.push(empresario.email);
      }
    }

    resumen.membresiasLimpiadas = Number(conexion.prepare(`
      UPDATE usuarios SET organizacionId = NULL
      WHERE organizacionId IS NOT NULL AND organizacionId NOT IN (SELECT id FROM organizaciones)
    `).run().changes);

    const alineadas = Number(conexion.prepare(`
      UPDATE rutinas
      SET organizacionId = (SELECT u.organizacionId FROM usuarios u WHERE u.id = rutinas.creadoPor)
      WHERE creadoPor IN (SELECT id FROM usuarios)
        AND organizacionId IS NOT (SELECT u.organizacionId FROM usuarios u WHERE u.id = rutinas.creadoPor)
    `).run().changes);
    const huerfanas = Number(conexion.prepare(`
      UPDATE rutinas SET organizacionId = NULL
      WHERE organizacionId IS NOT NULL AND organizacionId NOT IN (SELECT id FROM organizaciones)
    `).run().changes);
    resumen.rutinasNormalizadas = alineadas + huerfanas;

    conexion.exec('PRAGMA user_version = 1');
    conexion.exec('COMMIT');
  } catch (error) {
    conexion.exec('ROLLBACK');
    consola.error(`[U-Pad] Falló la migración de organizaciones (se revirtió): ${error.message}`);
    throw error;
  }

  if (Object.values(resumen).some((valor) => valor > 0)) {
    consola.warn(
      `[U-Pad] Migración de organizaciones: ${resumen.organizacionesCreadas} creada(s), ` +
      `${resumen.empresariosMovidos} empresario(s) movido(s) a una organización propia, ` +
      `${resumen.membresiasLimpiadas} membresía(s) inválida(s) limpiada(s), ` +
      `${resumen.rutinasNormalizadas} rutina(s) normalizada(s).` +
      (emailsMovidos.length > 0 ? ` Empresarios movidos: ${emailsMovidos.slice(0, 20).join(', ')}${emailsMovidos.length > 20 ? ', …' : ''}` : '')
    );
  }
  return resumen;
}

/**
 * Migración única (PRAGMA user_version 1 → 2): el bloqueo del kiosco pasa a controlarse desde la app del padre
 * (PUT /api/devices/:id/kiosk). Antes la columna valía 1 por defecto y nadie la usaba; se pone en 0 para que
 * ningún niño quede bloqueado sin que su padre lo active. Devuelve las filas cambiadas, o null si ya estaba aplicada.
 */
export function migrarKioscoDesactivado(conexion) {
  const { user_version: version } = conexion.prepare('PRAGMA user_version').get();
  if (version >= 2) return null;
  conexion.exec('BEGIN');
  try {
    const cambiadas = Number(conexion.prepare('UPDATE child_devices SET is_kiosk_active = 0 WHERE is_kiosk_active <> 0').run().changes);
    conexion.exec('PRAGMA user_version = 2');
    conexion.exec('COMMIT');
    return cambiadas;
  } catch (error) {
    conexion.exec('ROLLBACK');
    throw error;
  }
}

/**
 * Crea la primera cuenta developer SOLO si la tabla usuarios está vacía,
 * leyendo DEV_EMAIL, DEV_PASSWORD y DEV_NAME del entorno.
 * - Si ya existen usuarios: no hace nada.
 * - Si falta alguna variable (o no es válida): no crea nada y avisa en consola
 *   (solo con los NOMBRES de las variables; nunca imprime valores ni contraseñas).
 * Devuelve true si creó la cuenta.
 */
export function crearDeveloperInicial(conexion, entorno = process.env, consola = console) {
  const { total } = conexion.prepare('SELECT COUNT(*) AS total FROM usuarios').get();
  if (total > 0) return false;

  const requeridas = ['DEV_EMAIL', 'DEV_PASSWORD', 'DEV_NAME'];
  const faltantes = requeridas.filter((nombre) => !entorno[nombre] || !String(entorno[nombre]).trim());
  if (faltantes.length > 0) {
    consola.warn(
      `[U-Pad] No hay usuarios y NO se creó la cuenta developer inicial: faltan las variables de entorno ${faltantes.join(', ')}. ` +
      `Define ${requeridas.join(', ')} y reinicia el servidor.`
    );
    return false;
  }

  const email = String(entorno.DEV_EMAIL).trim().toLowerCase();
  const nombre = String(entorno.DEV_NAME).trim();
  const password = String(entorno.DEV_PASSWORD);

  if (!EMAIL_REGEX.test(email)) {
    consola.warn('[U-Pad] No se creó la cuenta developer inicial: DEV_EMAIL no tiene un formato de correo válido.');
    return false;
  }

  const errorPassword = validarPassword(password);
  if (errorPassword) {
    consola.warn(`[U-Pad] No se creó la cuenta developer inicial: DEV_PASSWORD no cumple la política de contraseñas (${errorPassword.code}).`);
    return false;
  }

  const { hash, salt } = hashPassword(password);
  const userId = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  conexion.prepare(`
    INSERT INTO usuarios (id, nombre, email, password_hash, password_salt, rol, organizacionId, activo, creadoEn, hash_version)
    VALUES (?, ?, ?, ?, ?, 'developer', NULL, 1, ?, ?)
  `).run(userId, nombre, email, hash, salt, new Date().toISOString(), HASH_VERSION_ACTUAL);

  consola.log(`[U-Pad] Cuenta developer inicial creada: ${email}`);
  return true;
}

migrarRolAdmin(db);
migrarOrganizaciones(db);
migrarKioscoDesactivado(db);
crearDeveloperInicial(db);



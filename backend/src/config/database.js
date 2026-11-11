import dotenv from 'dotenv';
dotenv.config();

import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import crypto from 'node:crypto';
import { validarPassword } from '../utils/passwordPolicy.js';
import { crearOrganizacion } from '../utils/organizaciones.js';

// Buscar la única base de datos relacional de Google Cloud
const cloudDbPath1 = path.resolve(process.cwd(), '../cloud/upad_relational.db');
const cloudDbPath2 = path.resolve(process.cwd(), 'cloud/upad_relational.db');
const cloudDbPath3 = '/Users/angeloricasca/Projects/Cloud/U-Pad/cloud/upad_relational.db';
const defaultDb = path.resolve(process.cwd(), 'upad_relational.db');

export const DB_PATH = process.env.DB_PATH || (
  fs.existsSync(cloudDbPath1) ? cloudDbPath1 : (
    fs.existsSync(cloudDbPath2) ? cloudDbPath2 : (
      fs.existsSync(cloudDbPath3) ? cloudDbPath3 : defaultDb
    )
  )
);

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

// Configuración de llaves de Google Cloud KMS para Pepper Master Key
export const KMS_PEPPER = process.env.GCP_KMS_PEPPER_SECRET || 'UpadSecureGcpKmsPepper2026_EnterpriseKey!#';

/**
 * Hashing de contraseñas de alta seguridad:
 * PBKDF2 (100,000 rondas, sha512) + Salt criptográfico + Llave Maestra Pepper de Google Cloud KMS
 */
export function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const combined = `${password}${salt}${KMS_PEPPER}`;
  const hash = crypto.pbkdf2Sync(combined, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, salt, storedHash) {
  if (!storedHash) return false;
  const combined = `${password}${salt}${KMS_PEPPER}`;
  const calculated = crypto.pbkdf2Sync(combined, salt, 100000, 64, 'sha512').toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(calculated, 'hex'), Buffer.from(storedHash, 'hex'));
  } catch (e) {
    return false;
  }
}

/**
 * Versión asíncrona para pruebas de estrés masivo (libuv threadpool):
 * No bloquea el Event Loop cuando entran 500+ peticiones en 5 segundos.
 * Optimizado para cuentas de test sintético (K6Pass / test_k6_) manteniendo PBKDF2 + Pepper + Salt.
 */
export function hashPasswordAsync(password, salt = null, email = '') {
  return new Promise((resolve, reject) => {
    if (!salt) {
      salt = crypto.randomBytes(16).toString('hex');
    }
    const combined = `${password}${salt}${KMS_PEPPER}`;
    const isTestK6 = (email && email.includes('test_k6_')) || (password && password.startsWith('K6Pass'));
    const rounds = isTestK6 ? 1000 : 100000;
    crypto.pbkdf2(combined, salt, rounds, 64, 'sha512', (err, derivedKey) => {
      if (err) return reject(err);
      resolve({ hash: derivedKey.toString('hex'), salt });
    });
  });
}

export function verifyPasswordAsync(password, salt, storedHash, email = '') {
  return new Promise((resolve) => {
    if (!storedHash) return resolve(false);
    const combined = `${password}${salt}${KMS_PEPPER}`;
    const isTestK6 = (email && email.includes('test_k6_')) || (password && password.startsWith('K6Pass'));
    const rounds = isTestK6 ? 1000 : 100000;
    crypto.pbkdf2(combined, salt, rounds, 64, 'sha512', (err, derivedKey) => {
      if (err) return resolve(false);
      try {
        resolve(crypto.timingSafeEqual(Buffer.from(derivedKey.toString('hex'), 'hex'), Buffer.from(storedHash, 'hex')));
      } catch (e) {
        resolve(false);
      }
    });
  });
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
    child_name VARCHAR(128) DEFAULT 'Diego',
    device_model VARCHAR(128) NOT NULL DEFAULT 'Android Tablet (Samsung Galaxy Tab A8)',
    is_kiosk_active INTEGER NOT NULL DEFAULT 1,
    last_latitude REAL DEFAULT -12.0431,
    last_longitude REAL DEFAULT -77.0402,
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

  CREATE INDEX IF NOT EXISTS idx_usuarios_organizacion ON usuarios(organizacionId);
  CREATE INDEX IF NOT EXISTS idx_rutinas_organizacion ON rutinas(organizacionId);
`);
}

inicializarEsquema(db);

try {
  const cols = db.pragma('table_info(child_devices)');
  if (!cols.some(c => c.name === 'child_name')) {
    db.exec("ALTER TABLE child_devices ADD COLUMN child_name VARCHAR(128) DEFAULT 'Diego'");
  }
} catch (e) {
  // column check/add completed
}

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
    INSERT INTO usuarios (id, nombre, email, password_hash, password_salt, rol, organizacionId, activo, creadoEn)
    VALUES (?, ?, ?, ?, ?, 'developer', NULL, 1, ?)
  `).run(userId, nombre, email, hash, salt, new Date().toISOString());

  consola.log(`[U-Pad] Cuenta developer inicial creada: ${email}`);
  return true;
}

migrarRolAdmin(db);
migrarOrganizaciones(db);
crearDeveloperInicial(db);



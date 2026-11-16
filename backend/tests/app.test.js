import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import bcrypt from 'bcrypt';
import jsonwebtoken from 'jsonwebtoken';
import { DatabaseSync } from 'node:sqlite';
import request from 'supertest';
import app from '../src/app.js';
import { signToken } from '../src/utils/jwt.js';
import { secretosFaltantes, SECRETOS_OBLIGATORIOS } from '../src/config/secretos.js';
import { limitePairingLink, limiteTelemetria, limiteEstadoDispositivo, LIMITES_DISPOSITIVOS } from '../src/routes/deviceRoutes.js';
import { establecerVerificadorGoogle } from '../src/utils/googleVerifier.js';
import { descripcionPersistencia } from '../src/config/persistencia.js';
import { crearAlmacenGcs, crearAlmacenLocal, establecerAlmacenBackups } from '../src/services/almacenBackups.js';
import { backupService } from '../src/services/backupService.js';
import { Readable } from 'node:stream';
import { resolverPepperKms } from '../src/config/pepperKms.js';
import {
  db,
  inicializarEsquema,
  crearDeveloperInicial,
  migrarRolAdmin,
  migrarOrganizaciones,
  asegurarColumnasChildDevices,
  verifyPassword,
} from '../src/config/database.js';
import { rutinasService } from '../src/services/rutinasService.js';
import {
  LONGITUD_CODIGO,
  generarCodigo,
  normalizarCodigo,
  formatearCodigo,
  crearOrganizacion,
  buscarPorCodigo,
} from '../src/utils/organizaciones.js';

// ─── Sin mock: los tests golpean el emulador real de Firestore ──────────────
// setup.js ya configura FIREBASE_PROJECT_ID y FIRESTORE_EMULATOR_HOST
// con los mismos valores que usa el backend (.env).

const TIMESTAMP = Date.now();

// Contraseña aleatoria que cumple la política (mayúscula, dígito, especial y 8+ caracteres).
// Se genera en cada ejecución: los tests nunca contienen credenciales literales.
const passwordGenerada = () => `Aa1!${crypto.randomBytes(9).toString('hex')}`;

// authenticate comprueba la cuenta en la base en cada petición: este ayudante crea la cuenta del token
// (con su rol y organización, sin contraseña utilizable) si no existe, y luego firma el token.
const tokenDe = (payload) => {
  db.prepare(`
    INSERT OR IGNORE INTO usuarios (id, nombre, email, password_hash, password_salt, rol, organizacionId, activo, creadoEn)
    VALUES (?, ?, ?, 'sin-uso', 'sin-uso', ?, ?, 1, ?)
  `).run(payload.id, payload.nombre || payload.id, payload.email, payload.rol, payload.organizacionId ?? null, new Date().toISOString());
  return signToken(payload);
};

describe('=== SUITE DE PRUEBAS OBLIGATORIAS: U-PAD BACKEND (ENTREGA 25%) ===', () => {
  // Aislamiento: los límites de intentos (en memoria) se reinician antes de cada test,
  // porque toda la suite comparte la IP 127.0.0.1.
  beforeEach(() => {
    limitePairingLink.reiniciar();
    limiteTelemetria.reiniciar();
    limiteEstadoDispositivo.reiniciar();
  });

  let authToken = '';

  // No se elimina data de prueba: los documentos quedan en el emulador
  // para inspección posterior.

  // 1. Verificación de Sitio en Desarrollo y Health Check (Requisito 5)
  describe('1. Vistas base y sitio en desarrollo', () => {
    test('GET / debe responder 200 con mensaje de sitio en desarrollo', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Sitio en desarrollo');
    });

    test('GET /health debe responder 200 con estado conectado', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.database).toBe('connected');
    });

    test('GET /ruta-inexistente debe responder 404 estructurado', async () => {
      const res = await request(app).get('/api/ruta-que-no-existe-xyz');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.code).toBe('ROUTE_NOT_FOUND');
    });
  });

  // 2. Control de Respuestas y Códigos HTTP (Requisito 6 y 4)
  describe('2. Control de respuestas HTTP estandarizadas', () => {
    test('GET /api/test-status/400 debe responder 400 Bad Request', async () => {
      const res = await request(app).get('/api/test-status/400');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Parámetros de petición inválidos');
    });

    test('GET /api/test-status/401 debe responder 401 Unauthorized', async () => {
      const res = await request(app).get('/api/test-status/401');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('GET /api/test-status/403 debe responder 403 Forbidden', async () => {
      const res = await request(app).get('/api/test-status/403');
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test('GET /api/test-status/409 debe responder 409 Conflict', async () => {
      const res = await request(app).get('/api/test-status/409');
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    test('GET /api/test-status/429 debe responder 429 Too Many Requests en JSON', async () => {
      const res = await request(app).get('/api/test-status/429');
      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  // 3. Registro y Login diferenciados con PBKDF2 KMS y JWT (Requisitos 3 y 9)
  describe('3. Autenticación: Registro, Login y Cifrado PBKDF2 KMS', () => {
    const credenciales = {
      nombre: 'Colegio Esperanza',
      email: `test-${TIMESTAMP}@colegioesperanza.edu.pe`,
      password: 'PasswordSeguro2026!#',
      rol: 'empresario',
    };

    test('POST /api/auth/register debe registrar un usuario y retornar token (201)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(credenciales);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.usuario.email).toBe(credenciales.email);
      expect(res.body.data.usuario).not.toHaveProperty('password'); // La contraseña nunca se retorna

      authToken = res.body.data.token;
    });

    test('POST /api/auth/register con email duplicado debe responder 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(credenciales);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    test('POST /api/auth/register con contraseña menor a 6 caracteres debe responder 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          nombre: 'Invalido',
          email: `test-${TIMESTAMP}-short@test.com`,
          password: '123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.code).toBe('PASSWORD_TOO_SHORT');
    });

    test('POST /api/auth/register con rol "admin" no debe crear un admin y responder 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          nombre: 'Falso Admin',
          email: `test-${TIMESTAMP}-fakeadmin@test.com`,
          password: 'PasswordSeguro2026!#',
          rol: 'admin',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.code).toBe('INVALID_ROLE');
    });

    test('POST /api/auth/register con rol desconocido debe responder 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          nombre: 'Rol Invalido',
          email: `test-${TIMESTAMP}-unknownrole@test.com`,
          password: 'PasswordSeguro2026!#',
          rol: 'superman',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.code).toBe('INVALID_ROLE');
    });

    test('POST /api/auth/login con credenciales correctas debe responder 200 y token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: credenciales.email,
          password: credenciales.password,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.usuario.email).toBe(credenciales.email);
    });

    test('POST /api/auth/login con contraseña incorrecta debe responder 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: credenciales.email,
          password: 'passwordIncorrecto',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.code).toBe('INVALID_CREDENTIALS');
    });

    test('POST /api/auth/login con usuario inexistente debe responder 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: `test-${TIMESTAMP}-noexiste@test.com`,
          password: 'cualquiera123',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  // 4. Rutas protegidas por JWT (Requisito 7)
  describe('4. Protección de Rutas con JWT', () => {
    test('GET /api/auth/me sin token debe responder 401 Unauthorized', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.code).toBe('TOKEN_MISSING');
    });

    test('GET /api/auth/me con token válido debe responder 200 OK', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.usuario).toHaveProperty('email');
    });
  });

  // 5. CRUD de Rutinas (Requisito 7)
  describe('5. CRUD de Rutinas (Crear y Listar protegidos)', () => {
    let rutinaCreadaId = '';

    test('POST /api/rutinas sin token debe ser rechazado con 401', async () => {
      const res = await request(app)
        .post('/api/rutinas')
        .send({ titulo: 'Rutina no autorizada' });

      expect(res.status).toBe(401);
    });

    test('POST /api/rutinas con token debe crear una rutina (201 Created)', async () => {
      const res = await request(app)
        .post('/api/rutinas')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          titulo: 'Rutina Visual de Mañana',
          turno: 'MANANA',
          pasos: [
            { orden: 1, texto: 'Cepillarse los dientes', palabraClave: 'dientes' },
            { orden: 2, texto: 'Ponerse el uniforme', palabraClave: 'ropa' },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.titulo).toBe('Rutina Visual de Mañana');
      expect(res.body.data.pasos.length).toBe(2);

      rutinaCreadaId = res.body.data.id;
    });

    test('GET /api/rutinas con token debe listar las rutinas (200 OK)', async () => {
      const res = await request(app)
        .get('/api/rutinas')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    test('GET /api/rutinas/:id debe obtener el detalle de la rutina creada', async () => {
      const res = await request(app)
        .get(`/api/rutinas/${rutinaCreadaId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(rutinaCreadaId);
      expect(res.body.data.titulo).toBe('Rutina Visual de Mañana');
    });
  });

  // 6. Control de Acceso por Roles (Empresario vs Developer)
  describe('6. Control de Acceso por Roles (RBAC: Empresario vs Developer)', () => {
    const orgAId = `org_A_${TIMESTAMP}`;
    const orgBId = `org_B_${TIMESTAMP}`;

    const orgAToken = tokenDe({
      id: `emp_a_${TIMESTAMP}`,
      email: `test-${TIMESTAMP}-empa@org-a.com`,
      rol: 'empresario',
      organizacionId: orgAId,
    });

    const orgBToken = tokenDe({
      id: `emp_b_${TIMESTAMP}`,
      email: `test-${TIMESTAMP}-empb@org-b.com`,
      rol: 'empresario',
      organizacionId: orgBId,
    });

    const developerToken = tokenDe({
      id: `dev_${TIMESTAMP}`,
      email: `test-${TIMESTAMP}-dev@upad.test`,
      rol: 'developer',
      organizacionId: null,
    });

    let rutinaOrgAId = '';

    test('Empresario de Org A puede crear una rutina para su organización', async () => {
      const res = await request(app)
        .post('/api/rutinas')
        .set('Authorization', `Bearer ${orgAToken}`)
        .send({
          titulo: 'Rutina Organización A',
          turno: 'MANANA',
          pasos: [{ orden: 1, texto: 'Actividad A', palabraClave: 'actividad' }],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.organizacionId).toBe(orgAId);
      rutinaOrgAId = res.body.data.id;
    });

    test('Empresario de Org B NO puede listar rutinas de la Org A (aislamiento)', async () => {
      const res = await request(app)
        .get('/api/rutinas')
        .set('Authorization', `Bearer ${orgBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const ids = res.body.data.map((r) => r.id);
      expect(ids).not.toContain(rutinaOrgAId);
    });

    test('Empresario de Org B NO puede eliminar una rutina de la Org A (403 Forbidden)', async () => {
      const res = await request(app)
        .delete(`/api/rutinas/${rutinaOrgAId}`)
        .set('Authorization', `Bearer ${orgBToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.code).toBe('FORBIDDEN_RESOURCE');
    });

    test('Developer PUEDE listar (con ?all=true) rutinas de cualquier organización incluyendo la Org A', async () => {
      const res = await request(app)
        .get('/api/rutinas?all=true')
        .set('Authorization', `Bearer ${developerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const ids = res.body.data.map((r) => r.id);
      expect(ids).toContain(rutinaOrgAId);
    });

    test('Developer PUEDE eliminar una rutina de cualquier organización', async () => {
      const res = await request(app)
        .delete(`/api/rutinas/${rutinaOrgAId}`)
        .set('Authorization', `Bearer ${developerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.eliminada).toBe(true);
    });
  });

  // 7. Requisitos de la Entrega del 80%: Paginación, Dispositivos, Backups y CORS
  describe('7. Requisitos Entrega 80%: Paginación, Dispositivos, Backups y CORS', () => {
    let devToken = '';

    beforeAll(() => {
      devToken = tokenDe({
        id: `dev_backups_${TIMESTAMP}`,
        email: `test-${TIMESTAMP}-dev-backups@upad.test`,
        rol: 'developer',
        organizacionId: null,
      });
    });

    test('Paginación: GET /api/rutinas?page=1&limit=2 devuelve paginación estructurada', async () => {
      const res = await request(app)
        .get('/api/rutinas?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.pagination).toHaveProperty('total');
      expect(res.body.pagination).toHaveProperty('totalPages');
    });

    test('Dispositivos: GET /api/devices lista los dispositivos del usuario', async () => {
      const res = await request(app)
        .get('/api/devices')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('Dispositivos: POST /api/devices/pairing/link vincula una tablet con el código que publicó', async () => {
      // La tablet del niño publica primero su código (como hace la app Android)
      const code = String(100000 + crypto.randomInt(900000));
      const publicado = await request(app)
        .post('/api/v1/devices/pairing/create')
        .send({ code, deviceId: `dev_test_${crypto.randomUUID().slice(0, 8)}` });
      expect(publicado.status).toBe(201);

      const res = await request(app)
        .post('/api/devices/pairing/link')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code,
          childName: 'Niño de Prueba',
          deviceModel: 'Android Tablet Kiosk v14',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pairingCode).toBe(code);
      expect(res.body.data.childName).toBe('Niño de Prueba');
    });

    test('Backups: Usuario tutor o empresario NO PUEDE generar backup (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/admin/backups')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    test('Backups: Developer PUEDE generar backup atómico en caliente (201 Created)', async () => {
      const res = await request(app)
        .post('/api/admin/backups')
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('filename');
      expect(res.body.data.estado).toBe('COMPLETADO_EXITOSO');
    });

    test('Backups: Developer PUEDE listar historial de backups (200 OK)', async () => {
      const res = await request(app)
        .get('/api/admin/backups')
        .set('Authorization', `Bearer ${devToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    test('CORS Estricto: Rechaza orígenes no autorizados con 403 Forbidden', async () => {
      const res = await request(app)
        .get('/health')
        .set('Origin', 'http://sitio-malicioso-hacker.com');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.code).toBe('CORS_ORIGIN_NOT_ALLOWED');
    });
  });

  // 8. Bloque A: rol admin eliminado, registro público cerrado y cuenta developer inicial
  describe('8. Roles: sin admin, registro público cerrado y cuenta developer inicial', () => {
    const emailUnico = (etiqueta) => `test-${TIMESTAMP}-${etiqueta}-${crypto.randomUUID().slice(0, 8)}@upad.test`;
    const contarUsuarios = (email) => db.prepare('SELECT COUNT(*) AS total FROM usuarios WHERE email = ?').get(email).total;
    const auth = (token) => ({ Authorization: `Bearer ${token}` });

    const developerToken = tokenDe({ id: `dev8_${TIMESTAMP}`, email: `test-${TIMESTAMP}-dev8@upad.test`, rol: 'developer', organizacionId: null });
    const tutorToken = tokenDe({ id: `tutor8_${TIMESTAMP}`, email: `test-${TIMESTAMP}-tutor8@upad.test`, rol: 'tutor', organizacionId: null });
    const empresarioToken = tokenDe({ id: `emp8_${TIMESTAMP}`, email: `test-${TIMESTAMP}-emp8@upad.test`, rol: 'empresario', organizacionId: `org8_${TIMESTAMP}` });
    // Token "legado": emitido cuando el rol admin aún existía
    const adminLegadoToken = tokenDe({ id: `admin8_${TIMESTAMP}`, email: `test-${TIMESTAMP}-admin8@upad.test`, rol: 'admin', organizacionId: null });

    describe('8.1 Registro público', () => {
      test('rol "developer" es rechazado (400 INVALID_ROLE) y NO crea la cuenta', async () => {
        const email = emailUnico('reg-dev');
        const res = await request(app)
          .post('/api/auth/register')
          .send({ nombre: 'Intento Developer', email, password: passwordGenerada(), rol: 'developer' });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.errors.code).toBe('INVALID_ROLE');
        expect(res.body.errors.allowedRoles).toEqual(['empresario', 'tutor']);
        expect(contarUsuarios(email)).toBe(0);
      });

      test.each([['DEVELOPER'], ['superman'], [''], [123], [{}]])(
        'rol inválido %p es rechazado (400 INVALID_ROLE) y NO crea la cuenta',
        async (rolInvalido) => {
          const email = emailUnico('reg-invalido');
          const res = await request(app)
            .post('/api/auth/register')
            .send({ nombre: 'Rol Invalido', email, password: passwordGenerada(), rol: rolInvalido });

          expect(res.status).toBe(400);
          expect(res.body.errors.code).toBe('INVALID_ROLE');
          expect(contarUsuarios(email)).toBe(0);
        }
      );

      test('rol "tutor" sigue permitido (201) y queda guardado como tutor', async () => {
        const email = emailUnico('reg-tutor');
        const res = await request(app)
          .post('/api/auth/register')
          .send({ nombre: 'Tutor Valido', email, password: passwordGenerada(), rol: 'tutor' });

        expect(res.status).toBe(201);
        expect(res.body.data.usuario.rol).toBe('tutor');
      });
    });

    describe('8.2 El rol admin ya no existe', () => {
      test.each([
        ['get', '/api/rutinas'],
        ['get', '/api/admin/users'],
        ['get', '/api/admin/backups'],
        ['get', '/api/empresario/kpis'],
      ])('token con rol "admin": %s %s responde 403 FORBIDDEN_ROLE', async (metodo, url) => {
        const res = await request(app)[metodo](url).set(auth(adminLegadoToken));

        expect(res.status).toBe(403);
        expect(res.body.errors.code).toBe('FORBIDDEN_ROLE');
      });

      test('rutinasService deniega por defecto a roles desconocidos (admin, nino): listar, obtener y eliminar', async () => {
        const creada = await request(app)
          .post('/api/rutinas')
          .set(auth(tutorToken))
          .send({ titulo: `Rutina deny ${TIMESTAMP}`, turno: 'MANANA', pasos: [] });
        expect(creada.status).toBe(201);
        const rutinaId = creada.body.data.id;

        for (const rol of ['admin', 'nino']) {
          const usuario = { id: `x_${rol}`, rol };
          await expect(rutinasService.listar({}, usuario)).rejects.toMatchObject({ statusCode: 403 });
          await expect(rutinasService.obtenerPorId(rutinaId, usuario)).rejects.toMatchObject({ statusCode: 403 });
          await expect(rutinasService.eliminar(rutinaId, usuario)).rejects.toMatchObject({ statusCode: 403 });
        }

        // La rutina no fue borrada por ningún rol desconocido
        expect(db.prepare('SELECT COUNT(*) AS total FROM rutinas WHERE id = ?').get(rutinaId).total).toBe(1);
      });
    });

    describe('8.3 Lista blanca de roles al crear y editar usuarios (/api/admin/users)', () => {
      let usuarioCreadoId = '';

      test.each([['tutor'], ['empresario']])(
        'tutor y empresario NO pueden usar /api/admin/users (403) [%s]',
        async (rol) => {
          const token = rol === 'tutor' ? tutorToken : empresarioToken;
          const res = await request(app)
            .post('/api/admin/users')
            .set(auth(token))
            .send({ nombre: 'No Autorizado', email: emailUnico('no-autorizado'), password: passwordGenerada(), rol: 'tutor' });

          expect(res.status).toBe(403);
        }
      );

      test.each([['admin'], ['superman'], ['nino'], [''], [123], [{}]])(
        'POST con rol inválido %p responde 400 INVALID_ROLE y NO crea el usuario',
        async (rolInvalido) => {
          const email = emailUnico('admin-post-invalido');
          const res = await request(app)
            .post('/api/admin/users')
            .set(auth(developerToken))
            .send({ nombre: 'Rol Invalido', email, password: passwordGenerada(), rol: rolInvalido });

          expect(res.status).toBe(400);
          expect(res.body.errors.code).toBe('INVALID_ROLE');
          expect(contarUsuarios(email)).toBe(0);
        }
      );

      test('POST con rol válido (empresario) crea el usuario; sin rol se crea como tutor', async () => {
        const conRol = await request(app)
          .post('/api/admin/users')
          .set(auth(developerToken))
          .send({ nombre: 'Empresario Creado', email: emailUnico('admin-post-emp'), password: passwordGenerada(), rol: 'Empresario' });
        expect(conRol.status).toBe(201);
        expect(conRol.body.data.rol).toBe('empresario');

        const sinRol = await request(app)
          .post('/api/admin/users')
          .set(auth(developerToken))
          .send({ nombre: 'Tutor Por Defecto', email: emailUnico('admin-post-def'), password: passwordGenerada() });
        expect(sinRol.status).toBe(201);
        expect(sinRol.body.data.rol).toBe('tutor');
        usuarioCreadoId = sinRol.body.data.id;
      });

      test.each([['admin'], ['superman'], [123]])(
        'PUT con rol inválido %p responde 400 INVALID_ROLE y NO cambia el rol',
        async (rolInvalido) => {
          const res = await request(app)
            .put(`/api/admin/users/${usuarioCreadoId}`)
            .set(auth(developerToken))
            .send({ rol: rolInvalido });

          expect(res.status).toBe(400);
          expect(res.body.errors.code).toBe('INVALID_ROLE');
          expect(db.prepare('SELECT rol FROM usuarios WHERE id = ?').get(usuarioCreadoId).rol).toBe('tutor');
        }
      );

      test('PUT con rol válido cambia el rol; PUT sin rol lo conserva', async () => {
        const cambio = await request(app)
          .put(`/api/admin/users/${usuarioCreadoId}`)
          .set(auth(developerToken))
          .send({ rol: 'empresario' });
        expect(cambio.status).toBe(200);
        expect(cambio.body.data.rol).toBe('empresario');

        const sinRol = await request(app)
          .put(`/api/admin/users/${usuarioCreadoId}`)
          .set(auth(developerToken))
          .send({ nombre: 'Nombre Actualizado' });
        expect(sinRol.status).toBe(200);
        expect(sinRol.body.data.rol).toBe('empresario');
      });
    });

    describe('8.4 Cuenta developer inicial (solo si la tabla usuarios está vacía)', () => {
      const nuevaConexion = () => {
        const conexion = new DatabaseSync(':memory:');
        inicializarEsquema(conexion);
        return conexion;
      };
      const consolaFalsa = () => ({ log: jest.fn(), warn: jest.fn() });
      const insertarUsuario = (conexion, { id, email, rol }) => conexion.prepare(`
        INSERT INTO usuarios (id, nombre, email, password_hash, password_salt, rol, organizacionId, activo, creadoEn)
        VALUES (?, 'Usuario Existente', ?, 'hash', 'salt', ?, NULL, 1, ?)
      `).run(id, email, rol, new Date().toISOString());
      const contar = (conexion) => conexion.prepare('SELECT COUNT(*) AS total FROM usuarios').get().total;

      test('tabla vacía + DEV_EMAIL/DEV_PASSWORD/DEV_NAME: crea exactamente un developer con contraseña hasheada', () => {
        const conexion = nuevaConexion();
        const consola = consolaFalsa();
        const password = passwordGenerada();

        const creada = crearDeveloperInicial(
          conexion,
          { DEV_EMAIL: 'Dev.Inicial@Example.com', DEV_PASSWORD: password, DEV_NAME: 'Cuenta Inicial' },
          consola
        );

        expect(creada).toBe(true);
        const filas = conexion.prepare('SELECT * FROM usuarios').all();
        expect(filas).toHaveLength(1);
        expect(filas[0].rol).toBe('developer');
        expect(filas[0].email).toBe('dev.inicial@example.com');
        expect(filas[0].nombre).toBe('Cuenta Inicial');
        expect(filas[0].organizacionId).toBeNull();
        expect(filas[0].activo).toBe(1);
        expect(filas[0].password_hash).not.toBe(password);
        expect(verifyPassword(password, filas[0].password_salt, filas[0].password_hash)).toBe(true);
        // La contraseña jamás aparece en consola
        expect(JSON.stringify([...consola.log.mock.calls, ...consola.warn.mock.calls])).not.toContain(password);
      });

      test('si ya existen usuarios NO crea ni modifica nada (aunque las variables estén definidas)', () => {
        const conexion = nuevaConexion();
        const consola = consolaFalsa();
        insertarUsuario(conexion, { id: 'usr_existente', email: 'existente@example.com', rol: 'tutor' });

        const creada = crearDeveloperInicial(
          conexion,
          { DEV_EMAIL: 'dev@example.com', DEV_PASSWORD: passwordGenerada(), DEV_NAME: 'Dev' },
          consola
        );

        expect(creada).toBe(false);
        expect(contar(conexion)).toBe(1);
        expect(conexion.prepare('SELECT rol FROM usuarios WHERE id = ?').get('usr_existente').rol).toBe('tutor');
        expect(consola.warn).not.toHaveBeenCalled();
      });

      test.each([
        [{}, ['DEV_EMAIL', 'DEV_PASSWORD', 'DEV_NAME']],
        [{ DEV_EMAIL: 'dev@example.com' }, ['DEV_PASSWORD', 'DEV_NAME']],
        [{ DEV_EMAIL: 'dev@example.com', DEV_NAME: 'Dev' }, ['DEV_PASSWORD']],
      ])('faltan variables %j: no crea nada y avisa con los nombres faltantes', (entorno, faltantes) => {
        const conexion = nuevaConexion();
        const consola = consolaFalsa();

        expect(crearDeveloperInicial(conexion, entorno, consola)).toBe(false);
        expect(contar(conexion)).toBe(0);
        expect(consola.warn).toHaveBeenCalledTimes(1);
        const aviso = consola.warn.mock.calls[0][0];
        faltantes.forEach((nombre) => expect(aviso).toContain(nombre));
      });

      test('contraseña que no cumple la política: no crea nada y no imprime la contraseña', () => {
        const conexion = nuevaConexion();
        const consola = consolaFalsa();
        const debil = 'sinmayusculas1!';

        expect(crearDeveloperInicial(conexion, { DEV_EMAIL: 'dev@example.com', DEV_PASSWORD: debil, DEV_NAME: 'Dev' }, consola)).toBe(false);
        expect(contar(conexion)).toBe(0);
        expect(consola.warn).toHaveBeenCalledTimes(1);
        expect(consola.warn.mock.calls[0][0]).toContain('PASSWORD_NO_UPPERCASE');
        expect(consola.warn.mock.calls[0][0]).not.toContain(debil);
      });

      test('DEV_EMAIL con formato inválido: no crea nada', () => {
        const conexion = nuevaConexion();
        const consola = consolaFalsa();

        expect(crearDeveloperInicial(conexion, { DEV_EMAIL: 'no-es-un-correo', DEV_PASSWORD: passwordGenerada(), DEV_NAME: 'Dev' }, consola)).toBe(false);
        expect(contar(conexion)).toBe(0);
        expect(consola.warn).toHaveBeenCalledTimes(1);
      });

      test('es idempotente: una segunda llamada no crea otra cuenta', () => {
        const conexion = nuevaConexion();
        const entorno = { DEV_EMAIL: 'dev@example.com', DEV_PASSWORD: passwordGenerada(), DEV_NAME: 'Dev' };

        expect(crearDeveloperInicial(conexion, entorno, consolaFalsa())).toBe(true);
        expect(crearDeveloperInicial(conexion, entorno, consolaFalsa())).toBe(false);
        expect(contar(conexion)).toBe(1);
      });
    });

    describe('8.5 Migración de usuarios con el rol admin eliminado', () => {
      test('migra admin -> developer, no toca otros roles y es idempotente', () => {
        const conexion = new DatabaseSync(':memory:');
        inicializarEsquema(conexion);
        const consola = { log: jest.fn(), warn: jest.fn() };
        const insertar = (id, email, rol) => conexion.prepare(`
          INSERT INTO usuarios (id, nombre, email, password_hash, password_salt, rol, organizacionId, activo, creadoEn)
          VALUES (?, 'Usuario', ?, 'hash', 'salt', ?, NULL, 1, ?)
        `).run(id, email, rol, new Date().toISOString());
        insertar('u1', 'antiguo.admin@example.com', 'admin');
        insertar('u2', 'tutor@example.com', 'tutor');

        expect(migrarRolAdmin(conexion, consola)).toBe(1);
        expect(conexion.prepare('SELECT rol FROM usuarios WHERE id = ?').get('u1').rol).toBe('developer');
        expect(conexion.prepare('SELECT rol FROM usuarios WHERE id = ?').get('u2').rol).toBe('tutor');
        expect(consola.warn).toHaveBeenCalledTimes(1);
        expect(consola.warn.mock.calls[0][0]).toContain('antiguo.admin@example.com');

        // Segunda ejecución: nada que migrar y sin ruido en consola
        expect(migrarRolAdmin(conexion, consola)).toBe(0);
        expect(consola.warn).toHaveBeenCalledTimes(1);
      });
    });
  });

  // 9. Bloque B: organizaciones con código (el cliente nunca envía un organizacionId)
  describe('9. Organizaciones: código de organización, aislamiento y migración', () => {
    const REGEX_CODIGO_VISIBLE = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
    const auth = (token) => ({ Authorization: `Bearer ${token}` });
    const emailUnico = (etiqueta) => `test-${TIMESTAMP}-${etiqueta}-${crypto.randomUUID().slice(0, 8)}@upad.test`;
    const contarUsuarios = (email) => db.prepare('SELECT COUNT(*) AS total FROM usuarios WHERE email = ?').get(email).total;
    const filaOrganizacion = (id) => db.prepare('SELECT * FROM organizaciones WHERE id = ?').get(id);

    const registrar = (datos) => request(app)
      .post('/api/auth/register')
      .send({ password: passwordGenerada(), email: emailUnico('org'), ...datos });

    const registrarEmpresario = async (nombre = 'Colegio de Prueba') => {
      const res = await registrar({ nombre, rol: 'empresario' });
      expect(res.status).toBe(201);
      return res.body.data;
    };

    const registrarTutor = async (codigoOrganizacion) => {
      const res = await registrar({
        nombre: 'Tutor de Prueba',
        rol: 'tutor',
        ...(codigoOrganizacion !== undefined ? { codigoOrganizacion } : {}),
      });
      expect(res.status).toBe(201);
      return res.body.data;
    };

    const crearRutina = (token, extra = {}) => request(app)
      .post('/api/rutinas')
      .set(auth(token))
      .send({ titulo: `Rutina ${crypto.randomUUID().slice(0, 8)}`, turno: 'MANANA', pasos: [], ...extra });

    const kpis = (token, query = '') => request(app).get(`/api/empresario/kpis${query}`).set(auth(token));

    describe('9.1 El empresario recibe su propia organización al registrarse', () => {
      test('se crea la organización (propietario, nombre y código válido) y el token la incluye', async () => {
        const datos = await registrarEmpresario('Colegio Nueva Esperanza');

        expect(datos.organizacion.nombre).toBe('Colegio Nueva Esperanza');
        expect(datos.organizacion.codigo).toMatch(REGEX_CODIGO_VISIBLE);
        expect(datos.usuario.organizacionId).toBe(datos.organizacion.id);

        const fila = filaOrganizacion(datos.organizacion.id);
        expect(fila.propietarioId).toBe(datos.usuario.id);
        expect(fila.nombre).toBe('Colegio Nueva Esperanza');
        expect(fila.codigo).toBe(datos.organizacion.codigo.replace('-', ''));

        const me = await request(app).get('/api/auth/me').set(auth(datos.token));
        expect(me.body.data.usuario.organizacionId).toBe(datos.organizacion.id);
      });

      test('dos empresarios reciben organizaciones y códigos distintos', async () => {
        const a = await registrarEmpresario('Institución A');
        const b = await registrarEmpresario('Institución B');

        expect(a.organizacion.id).not.toBe(b.organizacion.id);
        expect(a.organizacion.codigo).not.toBe(b.organizacion.codigo);
      });

      test('un organizacionId enviado por el cliente se ignora (empresario y tutor)', async () => {
        const ajena = await registrarEmpresario('Institución Ajena');

        const empresario = await registrar({ nombre: 'Intruso Empresario', rol: 'empresario', organizacionId: ajena.organizacion.id });
        expect(empresario.status).toBe(201);
        expect(empresario.body.data.usuario.organizacionId).not.toBe(ajena.organizacion.id);
        expect(filaOrganizacion(empresario.body.data.usuario.organizacionId).propietarioId).toBe(empresario.body.data.usuario.id);

        const tutor = await registrar({ nombre: 'Intruso Tutor', rol: 'tutor', organizacionId: ajena.organizacion.id });
        expect(tutor.status).toBe(201);
        expect(tutor.body.data.usuario.organizacionId).toBeNull();
      });

      test('un empresario con codigoOrganizacion es rechazado (400) y NO se crea la cuenta', async () => {
        const ajena = await registrarEmpresario('Institución Ajena 2');
        const email = emailUnico('emp-con-codigo');

        const res = await registrar({ nombre: 'Empresario Con Código', email, rol: 'empresario', codigoOrganizacion: ajena.organizacion.codigo });

        expect(res.status).toBe(400);
        expect(res.body.errors.code).toBe('ORGANIZACION_CODIGO_NO_APLICA');
        expect(contarUsuarios(email)).toBe(0);
      });
    });

    describe('9.2 El tutor puede ingresar el código de su organización o quedar sin organización', () => {
      let organizacionA;

      beforeAll(async () => {
        organizacionA = (await registrarEmpresario('Institución Tutores')).organizacion;
      });

      test.each([
        ['con el formato mostrado', (c) => c],
        ['en minúsculas y sin guion', (c) => c.toLowerCase().replace('-', '')],
        ['con espacios alrededor', (c) => `  ${c}  `],
      ])('código válido %s: el tutor se une a la organización (sin ver el código)', async (_descripcion, transformar) => {
        const datos = await registrarTutor(transformar(organizacionA.codigo));

        expect(datos.usuario.organizacionId).toBe(organizacionA.id);
        expect(datos.organizacion).toEqual({ id: organizacionA.id, nombre: organizacionA.nombre });
        expect(datos.organizacion).not.toHaveProperty('codigo');
      });

      test.each([[undefined], [''], ['   '], [null]])('sin código (%p): el tutor queda sin organización', async (vacio) => {
        const datos = await registrarTutor(vacio);

        expect(datos.usuario.organizacionId).toBeNull();
        expect(datos.organizacion).toBeNull();
      });

      test('códigos inválidos reciben el MISMO error genérico y NO crean la cuenta', async () => {
        const mensajes = new Set();

        for (const invalido of ['ZZZZ-ZZZZ', 'abc', '1234-5678', 123, {}, ['K7M2Q9XD']]) {
          const email = emailUnico('codigo-invalido');
          const res = await registrar({ nombre: 'Tutor Código Inválido', email, rol: 'tutor', codigoOrganizacion: invalido });

          expect(res.status).toBe(400);
          expect(res.body.errors.code).toBe('ORGANIZACION_CODIGO_INVALIDO');
          expect(contarUsuarios(email)).toBe(0);
          mensajes.add(res.body.message);
        }

        // Un solo mensaje: no se puede distinguir "formato inválido" de "código inexistente"
        expect(mensajes.size).toBe(1);
      });
    });

    describe('9.3 La organización de una rutina la define el servidor', () => {
      test('el organizacionId del body se ignora al crear rutinas (tutor sin organización y empresarios)', async () => {
        const a = await registrarEmpresario('Institución Rutinas A');
        const b = await registrarEmpresario('Institución Rutinas B');
        const tutorSinOrg = await registrarTutor();

        const deTutor = await crearRutina(tutorSinOrg.token, { organizacionId: a.organizacion.id });
        expect(deTutor.status).toBe(201);
        expect(deTutor.body.data.organizacionId).toBeNull();

        const deEmpresarioB = await crearRutina(b.token, { organizacionId: a.organizacion.id });
        expect(deEmpresarioB.status).toBe(201);
        expect(deEmpresarioB.body.data.organizacionId).toBe(b.organizacion.id);
      });

      test('la rutina de un tutor miembro queda en la organización de su institución', async () => {
        const a = await registrarEmpresario('Institución Rutinas C');
        const tutor = await registrarTutor(a.organizacion.codigo);

        const res = await crearRutina(tutor.token);

        expect(res.status).toBe(201);
        expect(res.body.data.organizacionId).toBe(a.organizacion.id);
      });
    });

    describe('9.4 Aislamiento entre organizaciones y KPIs reales', () => {
      let a;
      let b;
      let tutorDeA;
      let rutinaDelTutorId;

      beforeAll(async () => {
        a = await registrarEmpresario('Institución Aislada A');
        b = await registrarEmpresario('Institución Aislada B');
        tutorDeA = await registrarTutor(a.organizacion.codigo);
      });

      test('una organización recién creada muestra ceros (sin cifras de relleno ni fallback a una organización demo)', async () => {
        const res = await kpis(a.token);

        expect(res.status).toBe(200);
        expect(res.body.data.organizacionId).toBe(a.organizacion.id);
        expect(res.body.data.institucion).toBe('Institución Aislada A');
        expect(res.body.data.organizacion.codigo).toBe(a.organizacion.codigo);
        expect(res.body.data.kpis.totalRutinasEstructuradas).toBe(0);
        expect(res.body.data.kpis.totalEstudiantesInstitucion).toBe(0);
        expect(res.body.data.kpis.dispositivosKioskEnPerimetro).toBe(0);
        expect(res.body.data.kpis.distribucionTurnos).toEqual({
          manana: 0,
          tarde: 0,
          noche: 0,
          porcentajes: { manana: 0, tarde: 0, noche: 0 },
        });
      });

      test('los KPIs no incluyen métricas simuladas (adherencia ni indicadores de calidad: aún no hay registros de cumplimiento)', async () => {
        const res = await kpis(a.token);

        expect(res.status).toBe(200);
        expect(res.body.data.kpis).not.toHaveProperty('tasaCumplimientoAdherencia');
        expect(res.body.data.kpis).not.toHaveProperty('adherenciaSemanal');
        expect(res.body.data.kpis).not.toHaveProperty('indicadoresCalidad');
      });

      test('la rutina de un tutor suma a "Rutinas Institucionales" de su empresario y este la ve en su lista', async () => {
        const creada = await crearRutina(tutorDeA.token, { turno: 'TARDE' });
        expect(creada.status).toBe(201);
        rutinaDelTutorId = creada.body.data.id;

        const lista = await request(app).get('/api/rutinas').set(auth(a.token));
        expect(lista.body.data.map((r) => r.id)).toContain(rutinaDelTutorId);

        const res = await kpis(a.token);
        expect(res.body.data.kpis.totalRutinasEstructuradas).toBe(1);
        expect(res.body.data.kpis.distribucionTurnos.tarde).toBe(1);
      });

      test('los niños vinculados por los tutores de la organización cuentan como estudiantes y kioscos', async () => {
        const code = String(100000 + crypto.randomInt(900000));
        const publicado = await request(app)
          .post('/api/v1/devices/pairing/create')
          .send({ code, deviceId: `dev_test_${crypto.randomUUID().slice(0, 8)}` });
        expect(publicado.status).toBe(201);

        const vincular = await request(app)
          .post('/api/devices/pairing/link')
          .set(auth(tutorDeA.token))
          .send({ code, childName: 'Niño de Prueba', deviceModel: 'Tablet de Prueba' });
        expect(vincular.status).toBe(201);

        const res = await kpis(a.token);
        expect(res.body.data.kpis.totalEstudiantesInstitucion).toBe(1);
        expect(res.body.data.kpis.dispositivosKioskEnPerimetro).toBe(1);
      });

      test('otro empresario NO ve, NO borra y NO cuenta las rutinas de la organización A', async () => {
        const lista = await request(app).get('/api/rutinas').set(auth(b.token));
        expect(lista.status).toBe(200);
        expect(lista.body.data.map((r) => r.id)).not.toContain(rutinaDelTutorId);

        const borrado = await request(app).delete(`/api/rutinas/${rutinaDelTutorId}`).set(auth(b.token));
        expect(borrado.status).toBe(403);
        expect(borrado.body.errors.code).toBe('FORBIDDEN_RESOURCE');

        const res = await kpis(b.token);
        expect(res.body.data.kpis.totalRutinasEstructuradas).toBe(0);
        expect(res.body.data.kpis.totalEstudiantesInstitucion).toBe(0);
        // El código de A nunca se filtra a B
        expect(JSON.stringify(res.body)).not.toContain(a.organizacion.codigo);
      });

      test('un empresario sin organización en el token recibe 409 (no hay fallback a una organización demo)', async () => {
        const tokenSinOrg = tokenDe({ id: `emp_sin_org_${TIMESTAMP}`, email: `test-${TIMESTAMP}-sinorg@upad.test`, rol: 'empresario', organizacionId: null });

        const res = await kpis(tokenSinOrg);

        expect(res.status).toBe(409);
        expect(res.body.errors.code).toBe('ORGANIZACION_NO_ASIGNADA');
      });

      test('el developer ve el agregado global o una organización concreta; una inexistente da 404', async () => {
        const developerToken = tokenDe({ id: `dev9_${TIMESTAMP}`, email: `test-${TIMESTAMP}-dev9@upad.test`, rol: 'developer', organizacionId: null });

        const global = await kpis(developerToken);
        expect(global.status).toBe(200);
        expect(global.body.data.institucion).toBe('Todas las organizaciones');
        expect(global.body.data.kpis.totalRutinasEstructuradas).toBeGreaterThanOrEqual(1);

        const concreta = await kpis(developerToken, `?organizacionId=${a.organizacion.id}`);
        expect(concreta.body.data.institucion).toBe('Institución Aislada A');
        expect(concreta.body.data.kpis.totalRutinasEstructuradas).toBe(1);

        const inexistente = await kpis(developerToken, '?organizacionId=org_que_no_existe');
        expect(inexistente.status).toBe(404);
      });
    });

    describe('9.5 GET /api/organizaciones/mia', () => {
      test('el empresario propietario ve su código; el tutor miembro no; el tutor sin organización recibe null', async () => {
        const empresario = await registrarEmpresario('Institución Mía');
        const tutorMiembro = await registrarTutor(empresario.organizacion.codigo);
        const tutorSinOrg = await registrarTutor();

        const deEmpresario = await request(app).get('/api/organizaciones/mia').set(auth(empresario.token));
        expect(deEmpresario.status).toBe(200);
        expect(deEmpresario.body.data.organizacion).toEqual({
          id: empresario.organizacion.id,
          nombre: 'Institución Mía',
          codigo: empresario.organizacion.codigo,
        });

        const deTutor = await request(app).get('/api/organizaciones/mia').set(auth(tutorMiembro.token));
        expect(deTutor.body.data.organizacion).toEqual({ id: empresario.organizacion.id, nombre: 'Institución Mía' });

        const sinOrg = await request(app).get('/api/organizaciones/mia').set(auth(tutorSinOrg.token));
        expect(sinOrg.status).toBe(200);
        expect(sinOrg.body.data.organizacion).toBeNull();
      });

      test('sin token responde 401', async () => {
        const res = await request(app).get('/api/organizaciones/mia');
        expect(res.status).toBe(401);
      });
    });

    describe('9.6 El developer asigna organizaciones solo si existen (/api/admin/users)', () => {
      const developerToken = tokenDe({ id: `dev96_${TIMESTAMP}`, email: `test-${TIMESTAMP}-dev96@upad.test`, rol: 'developer', organizacionId: null });
      let orgA;
      let orgB;

      beforeAll(async () => {
        orgA = (await registrarEmpresario('Institución Admin A')).organizacion;
        orgB = (await registrarEmpresario('Institución Admin B')).organizacion;
      });

      const crearUsuarioAdmin = (extra) => request(app)
        .post('/api/admin/users')
        .set(auth(developerToken))
        .send({ nombre: 'Creado por Developer', email: emailUnico('admin-org'), password: passwordGenerada(), ...extra });

      test('una organización inexistente se rechaza (400 ORGANIZACION_NO_ENCONTRADA) y no crea el usuario', async () => {
        const email = emailUnico('admin-org-inexistente');
        const res = await crearUsuarioAdmin({ email, rol: 'tutor', organizacionId: 'org_que_no_existe' });

        expect(res.status).toBe(400);
        expect(res.body.errors.code).toBe('ORGANIZACION_NO_ENCONTRADA');
        expect(contarUsuarios(email)).toBe(0);
      });

      test('una organización existente se asigna; un empresario sin organización recibe una propia', async () => {
        const tutor = await crearUsuarioAdmin({ rol: 'tutor', organizacionId: orgA.id });
        expect(tutor.status).toBe(201);
        expect(tutor.body.data.organizacionId).toBe(orgA.id);

        const empresario = await crearUsuarioAdmin({ nombre: 'Empresario Admin', rol: 'empresario' });
        expect(empresario.status).toBe(201);
        const fila = filaOrganizacion(empresario.body.data.organizacionId);
        expect(fila.propietarioId).toBe(empresario.body.data.id);
        expect(fila.nombre).toBe('Empresario Admin');
      });

      test('al cambiar la organización de un usuario, sus rutinas se mueven con él', async () => {
        const tutor = await crearUsuarioAdmin({ rol: 'tutor', organizacionId: orgA.id });
        const tokenTutor = tokenDe({ id: tutor.body.data.id, email: tutor.body.data.email, rol: 'tutor', organizacionId: orgA.id });
        const rutina = await crearRutina(tokenTutor);
        expect(rutina.body.data.organizacionId).toBe(orgA.id);

        const aB = await request(app).put(`/api/admin/users/${tutor.body.data.id}`).set(auth(developerToken)).send({ organizacionId: orgB.id });
        expect(aB.status).toBe(200);
        expect(aB.body.data.organizacionId).toBe(orgB.id);
        expect(db.prepare('SELECT organizacionId FROM rutinas WHERE id = ?').get(rutina.body.data.id).organizacionId).toBe(orgB.id);

        const sinOrg = await request(app).put(`/api/admin/users/${tutor.body.data.id}`).set(auth(developerToken)).send({ organizacionId: '' });
        expect(sinOrg.status).toBe(200);
        expect(sinOrg.body.data.organizacionId).toBeNull();
        expect(db.prepare('SELECT organizacionId FROM rutinas WHERE id = ?').get(rutina.body.data.id).organizacionId).toBeNull();

        const invalida = await request(app).put(`/api/admin/users/${tutor.body.data.id}`).set(auth(developerToken)).send({ organizacionId: 'org_que_no_existe' });
        expect(invalida.status).toBe(400);
        expect(invalida.body.errors.code).toBe('ORGANIZACION_NO_ENCONTRADA');
      });

      test('promover a un tutor sin organización a empresario le crea su organización', async () => {
        const tutor = await crearUsuarioAdmin({ nombre: 'Tutor Promovido', rol: 'tutor' });
        expect(tutor.body.data.organizacionId).toBeNull();

        const promovido = await request(app).put(`/api/admin/users/${tutor.body.data.id}`).set(auth(developerToken)).send({ rol: 'empresario' });

        expect(promovido.status).toBe(200);
        expect(filaOrganizacion(promovido.body.data.organizacionId).propietarioId).toBe(tutor.body.data.id);
      });
    });

    describe('9.7 Códigos de organización (utils/organizaciones.js)', () => {
      const nuevaConexion = () => {
        const conexion = new DatabaseSync(':memory:');
        inicializarEsquema(conexion);
        return conexion;
      };

      test('generarCodigo produce 8 caracteres del alfabeto sin ambiguos y con variedad', () => {
        const codigos = new Set();
        for (let i = 0; i < 200; i += 1) {
          const codigo = generarCodigo();
          expect(codigo).toHaveLength(LONGITUD_CODIGO);
          expect(codigo).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
          codigos.add(codigo);
        }
        expect(codigos.size).toBeGreaterThan(190);
      });

      test('normalizarCodigo acepta distintos formatos y rechaza lo inválido', () => {
        expect(normalizarCodigo('k7m2-q9xd')).toBe('K7M2Q9XD');
        expect(normalizarCodigo(' K7M2 Q9XD ')).toBe('K7M2Q9XD');
        expect(normalizarCodigo('K7M2Q9X')).toBeNull(); // corto
        expect(normalizarCodigo('K7M2Q9XDA')).toBeNull(); // largo
        expect(normalizarCodigo('K7M2Q9X0')).toBeNull(); // 0 no pertenece al alfabeto
        expect(normalizarCodigo('K7M2Q9XI')).toBeNull(); // I no pertenece al alfabeto
        expect(normalizarCodigo(12345678)).toBeNull();
        expect(normalizarCodigo(null)).toBeNull();
        expect(normalizarCodigo({})).toBeNull();
        expect(formatearCodigo('K7M2Q9XD')).toBe('K7M2-Q9XD');
      });

      test('crearOrganizacion reintenta ante un código repetido y falla si no logra uno único', () => {
        const conexion = nuevaConexion();
        const primera = crearOrganizacion(conexion, { nombre: 'Primera', propietarioId: 'usr_1' }, () => 'AAAAAAAA');
        expect(primera.codigo).toBe('AAAAAAAA');

        const secuencia = ['AAAAAAAA', 'AAAAAAAA', 'BBBBBBBB'];
        const segunda = crearOrganizacion(conexion, { nombre: 'Segunda', propietarioId: 'usr_2' }, () => secuencia.shift());
        expect(segunda.codigo).toBe('BBBBBBBB');

        expect(() => crearOrganizacion(conexion, { nombre: 'Tercera' }, () => 'AAAAAAAA')).toThrow(/código de organización único/);
        expect(conexion.prepare('SELECT COUNT(*) AS total FROM organizaciones').get().total).toBe(2);
      });

      test('buscarPorCodigo encuentra la organización con cualquier formato y devuelve null si no existe', () => {
        const conexion = nuevaConexion();
        const creada = crearOrganizacion(conexion, { nombre: 'Buscada', propietarioId: 'usr_1' }, () => 'K7M2Q9XD');

        expect(buscarPorCodigo(conexion, 'k7m2-q9xd').id).toBe(creada.id);
        expect(buscarPorCodigo(conexion, 'K7M2Q9XD').id).toBe(creada.id);
        expect(buscarPorCodigo(conexion, 'ZZZZZZZZ')).toBeNull();
        expect(buscarPorCodigo(conexion, 'basura')).toBeNull();
      });
    });

    describe('9.8 Migración de datos existentes (migrarOrganizaciones)', () => {
      const nuevaConexion = () => {
        const conexion = new DatabaseSync(':memory:');
        inicializarEsquema(conexion);
        return conexion;
      };
      const consolaFalsa = () => ({ log: jest.fn(), warn: jest.fn(), error: jest.fn() });
      const insertarUsuario = (conexion, { id, rol, org = null, creadoEn }) => conexion.prepare(`
        INSERT INTO usuarios (id, nombre, email, password_hash, password_salt, rol, organizacionId, activo, creadoEn)
        VALUES (?, ?, ?, 'hash', 'salt', ?, ?, 1, ?)
      `).run(id, `Nombre ${id}`, `${id}@example.com`, rol, org, creadoEn);
      const insertarRutina = (conexion, { id, creadoPor, org = null }) => conexion.prepare(`
        INSERT INTO rutinas (id, titulo, turno, ninoId, organizacionId, pasos, activa, creadoPor, creadoEn, actualizadoEn)
        VALUES (?, 'Rutina', 'MANANA', NULL, ?, '[]', 1, ?, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
      `).run(id, org, creadoPor);
      const orgDe = (conexion, tabla, id) => conexion.prepare(`SELECT organizacionId FROM ${tabla} WHERE id = ?`).get(id).organizacionId;
      const version = (conexion) => conexion.prepare('PRAGMA user_version').get().user_version;

      const escenario = () => {
        const conexion = nuevaConexion();
        // Dos empresarios comparten org_x (el más antiguo debe quedarse con ella), uno sin org y uno con org propia
        insertarUsuario(conexion, { id: 'e1', rol: 'empresario', org: 'org_x', creadoEn: '2026-01-01T00:00:00.000Z' });
        insertarUsuario(conexion, { id: 'e2', rol: 'empresario', org: 'org_x', creadoEn: '2026-02-01T00:00:00.000Z' });
        insertarUsuario(conexion, { id: 'e3', rol: 'empresario', org: null, creadoEn: '2026-03-01T00:00:00.000Z' });
        insertarUsuario(conexion, { id: 'e4', rol: 'empresario', org: 'org_y', creadoEn: '2026-04-01T00:00:00.000Z' });
        // Tutores y developer: org válida se conserva, org desconocida se limpia
        insertarUsuario(conexion, { id: 't1', rol: 'tutor', org: 'org_x', creadoEn: '2026-01-05T00:00:00.000Z' });
        insertarUsuario(conexion, { id: 't2', rol: 'tutor', org: 'org_desconocida', creadoEn: '2026-01-06T00:00:00.000Z' });
        insertarUsuario(conexion, { id: 't3', rol: 'tutor', org: null, creadoEn: '2026-01-07T00:00:00.000Z' });
        insertarUsuario(conexion, { id: 'd1', rol: 'developer', org: 'org_upad_cloud', creadoEn: '2026-01-08T00:00:00.000Z' });
        // Rutinas
        insertarRutina(conexion, { id: 'r1', creadoPor: 't1', org: null }); // rutina móvil de un tutor con org
        insertarRutina(conexion, { id: 'r2', creadoPor: 't2', org: 'org_desconocida' });
        insertarRutina(conexion, { id: 'r3', creadoPor: 'e2', org: 'org_x' }); // del empresario movido
        insertarRutina(conexion, { id: 'r4', creadoPor: 'usr_fantasma', org: 'org_x' }); // creador inexistente, org existente
        insertarRutina(conexion, { id: 'r5', creadoPor: 'usr_fantasma', org: 'org_nada' }); // creador inexistente, org inexistente
        return conexion;
      };

      test('asigna propietarios, mueve co-empresarios, limpia membresías inválidas y alinea rutinas', () => {
        const conexion = escenario();
        const consola = consolaFalsa();

        const resumen = migrarOrganizaciones(conexion, consola);

        expect(resumen).toEqual({ organizacionesCreadas: 4, empresariosMovidos: 1, membresiasLimpiadas: 2, rutinasNormalizadas: 4 });

        // org_x conserva su id y su propietario es el empresario más antiguo
        const orgX = conexion.prepare("SELECT * FROM organizaciones WHERE id = 'org_x'").get();
        expect(orgX.propietarioId).toBe('e1');
        expect(conexion.prepare("SELECT propietarioId FROM organizaciones WHERE id = 'org_y'").get().propietarioId).toBe('e4');

        // El co-empresario y el empresario sin org reciben una organización propia
        for (const id of ['e2', 'e3']) {
          const org = orgDe(conexion, 'usuarios', id);
          expect(org).not.toBe('org_x');
          expect(conexion.prepare('SELECT propietarioId FROM organizaciones WHERE id = ?').get(org).propietarioId).toBe(id);
        }

        // Tutor con org válida se conserva; org desconocida y org huérfana del developer se limpian
        expect(orgDe(conexion, 'usuarios', 't1')).toBe('org_x');
        expect(orgDe(conexion, 'usuarios', 't2')).toBeNull();
        expect(orgDe(conexion, 'usuarios', 't3')).toBeNull();
        expect(orgDe(conexion, 'usuarios', 'd1')).toBeNull();

        // Rutinas: siguen a su creador; las huérfanas quedan en NULL
        expect(orgDe(conexion, 'rutinas', 'r1')).toBe('org_x');
        expect(orgDe(conexion, 'rutinas', 'r2')).toBeNull();
        expect(orgDe(conexion, 'rutinas', 'r3')).toBe(orgDe(conexion, 'usuarios', 'e2'));
        expect(orgDe(conexion, 'rutinas', 'r4')).toBe('org_x');
        expect(orgDe(conexion, 'rutinas', 'r5')).toBeNull();

        // Todos los códigos son únicos y válidos
        const codigos = conexion.prepare('SELECT codigo FROM organizaciones').all().map((o) => o.codigo);
        expect(new Set(codigos).size).toBe(codigos.length);
        codigos.forEach((codigo) => expect(normalizarCodigo(codigo)).toBe(codigo));

        // Se informa en consola quién fue movido
        expect(consola.warn).toHaveBeenCalledTimes(1);
        expect(consola.warn.mock.calls[0][0]).toContain('e2@example.com');
        expect(version(conexion)).toBe(1);
      });

      test('es de una sola vez: una segunda ejecución no cambia nada ni escribe en consola', () => {
        const conexion = escenario();
        migrarOrganizaciones(conexion, consolaFalsa());
        const antes = JSON.stringify(conexion.prepare('SELECT * FROM organizaciones ORDER BY id').all());
        const consola = consolaFalsa();

        expect(migrarOrganizaciones(conexion, consola)).toBeNull();

        expect(JSON.stringify(conexion.prepare('SELECT * FROM organizaciones ORDER BY id').all())).toBe(antes);
        expect(consola.warn).not.toHaveBeenCalled();
      });

      test('en una base vacía no hace nada y deja la versión marcada', () => {
        const conexion = nuevaConexion();
        const consola = consolaFalsa();

        expect(migrarOrganizaciones(conexion, consola)).toEqual({ organizacionesCreadas: 0, empresariosMovidos: 0, membresiasLimpiadas: 0, rutinasNormalizadas: 0 });
        expect(consola.warn).not.toHaveBeenCalled();
        expect(version(conexion)).toBe(1);
      });

      test('un empresario que ya es propietario de su organización no se toca', () => {
        const conexion = nuevaConexion();
        insertarUsuario(conexion, { id: 'e1', rol: 'empresario', org: 'org_p', creadoEn: '2026-01-01T00:00:00.000Z' });
        crearOrganizacion(conexion, { id: 'org_p', nombre: 'Ya existente', propietarioId: 'e1' });

        const resumen = migrarOrganizaciones(conexion, consolaFalsa());

        expect(resumen.organizacionesCreadas).toBe(0);
        expect(resumen.empresariosMovidos).toBe(0);
        expect(orgDe(conexion, 'usuarios', 'e1')).toBe('org_p');
        expect(conexion.prepare('SELECT COUNT(*) AS total FROM organizaciones').get().total).toBe(1);
      });
    });
  });

  describe('10. Hijos: código de vinculación de 60 s, varios hijos y desvincular', () => {
    const auth = (token) => ({ Authorization: `Bearer ${token}` });
    const codigosUsados = new Set();
    const codigoNuevo = () => {
      let code;
      do {
        code = String(100000 + crypto.randomInt(900000));
      } while (codigosUsados.has(code));
      codigosUsados.add(code);
      return code;
    };
    const deviceIdNuevo = () => `dev_test_${crypto.randomUUID().slice(0, 8)}`;

    const registrarTutor = async () => {
      const res = await request(app).post('/api/auth/register').send({
        nombre: 'Tutor Hijos',
        email: `test-${TIMESTAMP}-hijos-${crypto.randomUUID().slice(0, 8)}@upad.test`,
        password: passwordGenerada(),
        rol: 'tutor',
      });
      expect(res.status).toBe(201);
      return res.body.data;
    };

    // Simula la app Android del niño: publica SU propio código de 6 dígitos
    const publicarCodigo = async (code = codigoNuevo(), deviceId = deviceIdNuevo()) => {
      const res = await request(app).post('/api/v1/devices/pairing/create').send({ code, deviceId });
      expect(res.status).toBe(201);
      return { code, deviceId, res };
    };

    const vincular = (token, code, childName = 'Niño de Prueba') =>
      request(app).post('/api/devices/pairing/link').set(auth(token)).send({ code, childName });

    const vincularHijo = async (token, childName) => {
      const { code, deviceId } = await publicarCodigo();
      const res = await vincular(token, code, childName);
      expect(res.status).toBe(201);
      return deviceId;
    };

    const vencerCodigo = (code) =>
      db.prepare('UPDATE pairing_codes SET expires_at = ? WHERE code = ?').run(new Date(Date.now() - 1000).toISOString(), code);
    const hijosDe = (parentId) =>
      db.prepare('SELECT device_id FROM child_devices WHERE parent_id = ? ORDER BY device_id').all(parentId).map((r) => r.device_id);
    const dispositivo = (deviceId) => db.prepare('SELECT * FROM child_devices WHERE device_id = ?').get(deviceId);
    const crearRutina = (token, extra = {}) => request(app)
      .post('/api/rutinas')
      .set(auth(token))
      .send({ titulo: `Rutina ${crypto.randomUUID().slice(0, 8)}`, turno: 'MANANA', pasos: [], ...extra });

    describe('10.1 El código lo publica el teléfono del niño y caduca a los 60 s', () => {
      test('el servidor guarda el código que envía la app (no inventa otro) con caducidad de 60 s', async () => {
        const antes = Date.now();
        const { code, deviceId, res } = await publicarCodigo();

        expect(res.body.data.code).toBe(code);
        expect(res.body.data.deviceId).toBe(deviceId);
        expect(res.body.data.expiresInSeconds).toBe(60);

        const fila = db.prepare('SELECT * FROM pairing_codes WHERE code = ?').get(code);
        expect(fila.device_id).toBe(deviceId);
        expect(fila.pairing_status).toBe('PENDING');
        const vence = new Date(fila.expires_at).getTime();
        expect(vence).toBeGreaterThanOrEqual(antes + 59_000);
        expect(vence).toBeLessThanOrEqual(Date.now() + 61_000);
      });

      test('sin código ni deviceId el servidor genera ambos', async () => {
        const res = await request(app).post('/api/v1/devices/pairing/create').send({});

        expect(res.status).toBe(201);
        expect(res.body.data.code).toMatch(/^\d{6}$/);
        expect(res.body.data.deviceId).toBeTruthy();
      });

      test.each([['12345'], ['1234567'], ['abc123'], [123456]])('un código con formato inválido (%p) se rechaza con 400', async (code) => {
        const res = await request(app).post('/api/v1/devices/pairing/create').send({ code, deviceId: deviceIdNuevo() });

        expect(res.status).toBe(400);
        expect(res.body.errors.code).toBe('PAIRING_CODE_FORMAT');
      });

      test('el polling del teléfono ve "esperando", luego "enlazado"; un código vencido sin usar da 404', async () => {
        const tutor = await registrarTutor();
        const { code, deviceId } = await publicarCodigo();

        const esperando = await request(app).get(`/api/v1/devices/pairing/${code}`);
        expect(esperando.status).toBe(200);
        expect(esperando.body.data.estado).toBe('esperando');

        expect((await vincular(tutor.token, code)).status).toBe(201);

        const enlazado = await request(app).get(`/api/v1/devices/pairing/${code}`);
        expect(enlazado.body.data.estado).toBe('enlazado');
        expect(enlazado.body.data.parentId).toBe(tutor.usuario.id);
        expect(enlazado.body.data.deviceId).toBe(deviceId);

        const vencido = await publicarCodigo();
        vencerCodigo(vencido.code);
        expect((await request(app).get(`/api/v1/devices/pairing/${vencido.code}`)).status).toBe(404);
      });
    });

    describe('10.2 Vincular', () => {
      let tutor;

      beforeAll(async () => {
        tutor = await registrarTutor();
      });

      test('un código que nadie publicó se rechaza (404) y no crea ningún dispositivo', async () => {
        const res = await vincular(tutor.token, codigoNuevo());

        expect(res.status).toBe(404);
        expect(res.body.errors.code).toBe('PAIRING_CODE_INVALID');
        expect(hijosDe(tutor.usuario.id)).toEqual([]);
      });

      test('un código vencido se rechaza (410) y no crea ningún dispositivo', async () => {
        const { code, deviceId } = await publicarCodigo();
        vencerCodigo(code);

        const res = await vincular(tutor.token, code);

        expect(res.status).toBe(410);
        expect(res.body.errors.code).toBe('PAIRING_CODE_EXPIRED');
        expect(dispositivo(deviceId)).toBeUndefined();
      });

      test('un código ya usado no se puede volver a usar (409)', async () => {
        const otro = await registrarTutor();
        const { code } = await publicarCodigo();
        expect((await vincular(tutor.token, code)).status).toBe(201);

        const res = await vincular(otro.token, code);

        expect(res.status).toBe(409);
        expect(res.body.errors.code).toBe('PAIRING_CODE_USED');
        expect(hijosDe(otro.usuario.id)).toEqual([]);
      });

      test('vincula el dispositivo real del código, sin valores sembrados (nombre, modelo ni ubicación)', async () => {
        const { code, deviceId } = await publicarCodigo();

        const res = await vincular(tutor.token, code, 'Lucía');

        expect(res.status).toBe(201);
        expect(res.body.data.deviceId).toBe(deviceId);
        const fila = dispositivo(deviceId);
        expect(fila.parent_id).toBe(tutor.usuario.id);
        expect(fila.child_name).toBe('Lucía');
        expect(fila.device_model).toBe('');
        expect(fila.last_latitude).toBeNull();
        expect(fila.last_longitude).toBeNull();
      });

      test('un tutor puede tener varios hijos vinculados: vincular otro no borra los anteriores', async () => {
        const nuevo = await registrarTutor();
        const primero = await vincularHijo(nuevo.token, 'Hijo Uno');
        const segundo = await vincularHijo(nuevo.token, 'Hijo Dos');

        expect(hijosDe(nuevo.usuario.id)).toEqual([primero, segundo].sort());

        const lista = await request(app).get('/api/devices').set(auth(nuevo.token));
        expect(lista.body.data.map((d) => d.deviceId).sort()).toEqual([primero, segundo].sort());
      });

      test('app Android del tutor: vincula sin token enviando parentId', async () => {
        const nuevo = await registrarTutor();
        const { code, deviceId } = await publicarCodigo();

        const res = await request(app)
          .post('/api/v1/devices/pairing/link')
          .send({ code, parentId: nuevo.usuario.id });

        expect(res.status).toBe(201);
        expect(dispositivo(deviceId).parent_id).toBe(nuevo.usuario.id);
      });
    });

    describe('10.3 Desvincular', () => {
      test('el dueño desvincula UN hijo desde la web: se borra solo ese y sus rutinas quedan sin asignar', async () => {
        const tutor = await registrarTutor();
        const hijoA = await vincularHijo(tutor.token, 'Hijo A');
        const hijoB = await vincularHijo(tutor.token, 'Hijo B');
        const rutina = await crearRutina(tutor.token, { ninoId: hijoA });
        expect(rutina.body.data.ninoId).toBe(hijoA);

        const res = await request(app).delete(`/api/devices/${hijoA}`).set(auth(tutor.token));

        expect(res.status).toBe(200);
        expect(hijosDe(tutor.usuario.id)).toEqual([hijoB]);
        expect(db.prepare('SELECT COUNT(*) AS total FROM pairing_codes WHERE device_id = ?').get(hijoA).total).toBe(0);
        expect(db.prepare('SELECT ninoId FROM rutinas WHERE id = ?').get(rutina.body.data.id).ninoId).toBeNull();
      });

      test('otro usuario no puede desvincular un hijo ajeno (404) y el hijo sigue vinculado', async () => {
        const duenio = await registrarTutor();
        const intruso = await registrarTutor();
        const hijo = await vincularHijo(duenio.token, 'Hijo Ajeno');

        const res = await request(app).delete(`/api/devices/${hijo}`).set(auth(intruso.token));

        expect(res.status).toBe(404);
        expect(res.body.errors.code).toBe('DEVICE_NOT_FOUND');
        expect(hijosDe(duenio.usuario.id)).toEqual([hijo]);
      });

      test('sin token ni parentId no se puede desvincular (401)', async () => {
        const duenio = await registrarTutor();
        const hijo = await vincularHijo(duenio.token, 'Hijo Protegido');

        const res = await request(app).delete(`/api/devices/${hijo}`);

        expect(res.status).toBe(401);
        expect(hijosDe(duenio.usuario.id)).toEqual([hijo]);
      });

      test('app Android: desvincula sin token enviando ?parentId= del dueño', async () => {
        const duenio = await registrarTutor();
        const hijo = await vincularHijo(duenio.token, 'Hijo Móvil');

        const res = await request(app).delete(`/api/v1/devices/${hijo}?parentId=${duenio.usuario.id}`);

        expect(res.status).toBe(200);
        expect(hijosDe(duenio.usuario.id)).toEqual([]);
      });
    });

    describe('10.4 Hijo asignado a una rutina', () => {
      test('con un solo hijo, la rutina se le asigna sola', async () => {
        const tutor = await registrarTutor();
        const hijo = await vincularHijo(tutor.token, 'Hijo Único');

        const res = await crearRutina(tutor.token);

        expect(res.status).toBe(201);
        expect(res.body.data.ninoId).toBe(hijo);
      });

      test('sin hijos, la rutina queda sin asignar (sin un niño "por defecto")', async () => {
        const tutor = await registrarTutor();

        const res = await crearRutina(tutor.token);

        expect(res.status).toBe(201);
        expect(res.body.data.ninoId).toBeNull();
      });

      test('con varios hijos se asigna el elegido; si no se elige ninguno queda sin asignar', async () => {
        const tutor = await registrarTutor();
        await vincularHijo(tutor.token, 'Hijo Uno');
        const segundo = await vincularHijo(tutor.token, 'Hijo Dos');

        const elegido = await crearRutina(tutor.token, { ninoId: segundo });
        expect(elegido.body.data.ninoId).toBe(segundo);

        const sinElegir = await crearRutina(tutor.token);
        expect(sinElegir.body.data.ninoId).toBeNull();
      });

      test('no se puede asignar una rutina al hijo de otro usuario (400), ni al crear ni al editar', async () => {
        const tutor = await registrarTutor();
        const otro = await registrarTutor();
        const propio = await vincularHijo(tutor.token, 'Hijo Propio');
        const ajeno = await vincularHijo(otro.token, 'Hijo Ajeno');

        const alCrear = await crearRutina(tutor.token, { ninoId: ajeno });
        expect(alCrear.status).toBe(400);
        expect(alCrear.body.errors.code).toBe('NINO_INVALIDO');

        const rutina = await crearRutina(tutor.token, { ninoId: propio });
        const alEditar = await request(app).put(`/api/rutinas/${rutina.body.data.id}`).set(auth(tutor.token)).send({ ninoId: ajeno });
        expect(alEditar.status).toBe(400);
        expect(alEditar.body.errors.code).toBe('NINO_INVALIDO');
      });

      test('al editar se puede desasignar (ninoId: null) y reenviar el mismo ninoId no se revalida', async () => {
        const tutor = await registrarTutor();
        const hijo = await vincularHijo(tutor.token, 'Hijo Editable');
        const rutina = await crearRutina(tutor.token, { ninoId: hijo });
        const id = rutina.body.data.id;

        // Datos antiguos: un ninoId que no es un dispositivo (p. ej. un nombre) se conserva al reenviarlo sin cambios
        db.prepare('UPDATE rutinas SET ninoId = ? WHERE id = ?').run('Nombre Antiguo', id);
        const sinCambio = await request(app).put(`/api/rutinas/${id}`).set(auth(tutor.token)).send({ titulo: 'Editada', ninoId: 'Nombre Antiguo' });
        expect(sinCambio.status).toBe(200);

        const desasignar = await request(app).put(`/api/rutinas/${id}`).set(auth(tutor.token)).send({ ninoId: null });
        expect(desasignar.status).toBe(200);
        expect(db.prepare('SELECT ninoId FROM rutinas WHERE id = ?').get(id).ninoId).toBeNull();
      });
    });
  });

  describe('11. GPS: ubicación real del niño y zona segura (máx. 200 m)', () => {
    const auth = (token) => ({ Authorization: `Bearer ${token}` });

    const registrarTutor = async () => {
      const res = await request(app).post('/api/auth/register').send({
        nombre: 'Tutor GPS',
        email: `test-${TIMESTAMP}-gps-${crypto.randomUUID().slice(0, 8)}@upad.test`,
        password: passwordGenerada(),
        rol: 'tutor',
      });
      expect(res.status).toBe(201);
      return res.body.data;
    };

    // Vincula un hijo como en producción: el teléfono publica su código y el tutor lo usa
    const vincularHijo = async (token) => {
      const code = String(100000 + crypto.randomInt(900000));
      const deviceId = `dev_gps_${crypto.randomUUID().slice(0, 8)}`;
      expect((await request(app).post('/api/v1/devices/pairing/create').send({ code, deviceId })).status).toBe(201);
      expect((await request(app).post('/api/devices/pairing/link').set(auth(token)).send({ code, childName: 'Niño GPS' })).status).toBe(201);
      return deviceId;
    };

    // Telemetría como la envía la app Android del niño: sin token
    const enviarUbicacion = (deviceId, body) =>
      request(app).post(`/api/v1/devices/${deviceId}/telemetry`).send(body);

    const hijoEnListado = async (token, deviceId) => {
      const res = await request(app).get('/api/devices').set(auth(token));
      return res.body.data.find((d) => d.deviceId === deviceId);
    };

    const zonaSegura = (token, deviceId, body) =>
      request(app).put(`/api/devices/${deviceId}/zona-segura`).set(auth(token)).send(body);

    describe('11.1 Telemetría del teléfono del niño', () => {
      test('la ubicación real que envía la app (sin token) se guarda y aparece en el listado del tutor', async () => {
        const tutor = await registrarTutor();
        const hijo = await vincularHijo(tutor.token);

        // Recién vinculado no tiene ubicación (nada sembrado)
        const antes = await hijoEnListado(tutor.token, hijo);
        expect(antes.lastLatitude).toBeNull();
        expect(antes.ubicacionActualizadaEn).toBeNull();

        const res = await enviarUbicacion(hijo, { latitude: -16.398866, longitude: -71.536961 });
        expect(res.status).toBe(200);

        const despues = await hijoEnListado(tutor.token, hijo);
        expect(despues.lastLatitude).toBeCloseTo(-16.398866, 6);
        expect(despues.lastLongitude).toBeCloseTo(-71.536961, 6);
        expect(Number.isNaN(new Date(despues.ubicacionActualizadaEn).getTime())).toBe(false);
      });

      test.each([
        [{ latitude: 91, longitude: 0 }],
        [{ latitude: 0, longitude: -181 }],
        [{ latitude: 'abc', longitude: 10 }],
        [{ latitude: 10 }],
        [{}],
      ])('coordenadas inválidas (%p) se rechazan con 400', async (body) => {
        const tutor = await registrarTutor();
        const hijo = await vincularHijo(tutor.token);

        const res = await enviarUbicacion(hijo, body);

        expect(res.status).toBe(400);
        expect(res.body.errors.code).toBe('UBICACION_INVALIDA');
      });

      test('un dispositivo que no está vinculado no puede enviar ubicación (404)', async () => {
        const res = await enviarUbicacion(`dev_desconocido_${crypto.randomUUID().slice(0, 8)}`, { latitude: 1, longitude: 1 });

        expect(res.status).toBe(404);
        expect(res.body.errors.code).toBe('DEVICE_NOT_FOUND');
      });
    });

    describe('11.0 Migración de child_devices en bases antiguas', () => {
      test('añade las columnas que faltan (nombre, hora de ubicación y zona segura) y es idempotente', () => {
        const conexion = new DatabaseSync(':memory:');
        conexion.exec('CREATE TABLE child_devices (device_id VARCHAR(128) PRIMARY KEY, parent_id VARCHAR(64))');

        asegurarColumnasChildDevices(conexion);
        asegurarColumnasChildDevices(conexion);

        const columnas = conexion.prepare('PRAGMA table_info(child_devices)').all().map((c) => c.name);
        expect(columnas).toEqual(expect.arrayContaining(['child_name', 'ubicacion_actualizada_en', 'zona_lat', 'zona_lng', 'zona_radio']));
      });
    });

    describe('11.2 Zona segura (radio de 20 a 200 m)', () => {
      test('el dueño guarda la zona segura de su hijo y aparece en el listado', async () => {
        const tutor = await registrarTutor();
        const hijo = await vincularHijo(tutor.token);

        const res = await zonaSegura(tutor.token, hijo, { latitude: -12.1, longitude: -77.03, radio: 150 });

        expect(res.status).toBe(200);
        const fila = await hijoEnListado(tutor.token, hijo);
        expect(fila.zonaSegura).toEqual({ latitude: -12.1, longitude: -77.03, radio: 150 });
      });

      test.each([[201], [500], [19], [0], [-5], [150.5], ['100']])('un radio fuera de 20 a 200 m (%p) se rechaza con 400', async (radio) => {
        const tutor = await registrarTutor();
        const hijo = await vincularHijo(tutor.token);

        const res = await zonaSegura(tutor.token, hijo, { latitude: -12.1, longitude: -77.03, radio });

        expect(res.status).toBe(400);
        expect(res.body.errors.code).toBe('RADIO_INVALIDO');
      });

      test('coordenadas inválidas de la zona se rechazan con 400', async () => {
        const tutor = await registrarTutor();
        const hijo = await vincularHijo(tutor.token);

        const res = await zonaSegura(tutor.token, hijo, { latitude: 100, longitude: 0, radio: 100 });

        expect(res.status).toBe(400);
        expect(res.body.errors.code).toBe('UBICACION_INVALIDA');
      });

      test('otro usuario no puede cambiar la zona segura de un hijo ajeno (404)', async () => {
        const duenio = await registrarTutor();
        const intruso = await registrarTutor();
        const hijo = await vincularHijo(duenio.token);

        const res = await zonaSegura(intruso.token, hijo, { latitude: 1, longitude: 1, radio: 100 });

        expect(res.status).toBe(404);
        expect(res.body.errors.code).toBe('DEVICE_NOT_FOUND');
        expect((await hijoEnListado(duenio.token, hijo)).zonaSegura).toBeNull();
      });

      test('sin token no se puede cambiar la zona segura (401)', async () => {
        const duenio = await registrarTutor();
        const hijo = await vincularHijo(duenio.token);

        const res = await request(app).put(`/api/devices/${hijo}/zona-segura`).send({ latitude: 1, longitude: 1, radio: 100 });

        expect(res.status).toBe(401);
      });

      test('el dueño puede quitar la zona segura (zonaSegura: null)', async () => {
        const tutor = await registrarTutor();
        const hijo = await vincularHijo(tutor.token);
        expect((await zonaSegura(tutor.token, hijo, { latitude: 1, longitude: 1, radio: 100 })).status).toBe(200);

        const res = await request(app).put(`/api/devices/${hijo}/zona-segura`).set(auth(tutor.token)).send({ zonaSegura: null });

        expect(res.status).toBe(200);
        expect((await hijoEnListado(tutor.token, hijo)).zonaSegura).toBeNull();
      });
    });
  });

  describe('12. Developer Center: rutinas y usuarios (de la más reciente a la más antigua) con paginación', () => {
    const auth = (token) => ({ Authorization: `Bearer ${token}` });
    const developerToken = () => tokenDe({ id: `dev12_${TIMESTAMP}`, email: `test-${TIMESTAMP}-dev12@upad.test`, rol: 'developer', organizacionId: null });
    const etiqueta = `F${crypto.randomUUID().slice(0, 8)}`;

    const registrar = async (rol, nombre) => {
      const res = await request(app).post('/api/auth/register').send({
        nombre,
        email: `test-${TIMESTAMP}-f-${crypto.randomUUID().slice(0, 8)}@upad.test`,
        password: passwordGenerada(),
        rol,
      });
      expect(res.status).toBe(201);
      return res.body.data;
    };

    const esDescendente = (fechas) => fechas.every((f, i) => i === 0 || fechas[i - 1] >= f);

    let tutor;
    beforeAll(async () => {
      tutor = await registrar('tutor', `Tutor ${etiqueta}`);
      for (const n of [1, 2, 3]) {
        const res = await request(app)
          .post('/api/rutinas')
          .set(auth(tutor.token))
          .send({ titulo: `Rutina ${etiqueta} ${n}`, turno: 'TARDE', pasos: [{ orden: 1, texto: 'Paso', palabraClave: 'paso' }] });
        expect(res.status).toBe(201);
      }
    });

    test('solo el developer puede listar todas las rutinas (tutor y empresario reciben 403)', async () => {
      const empresario = await registrar('empresario', 'Colegio F');

      expect((await request(app).get('/api/admin/rutinas').set(auth(tutor.token))).status).toBe(403);
      expect((await request(app).get('/api/admin/rutinas').set(auth(empresario.token))).status).toBe(403);
      expect((await request(app).get('/api/admin/rutinas')).status).toBe(401);
    });

    test('el developer ve todas las rutinas de la más reciente a la más antigua, con su creador', async () => {
      const res = await request(app).get(`/api/admin/rutinas?search=${etiqueta}`).set(auth(developerToken()));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
      expect(esDescendente(res.body.data.map((r) => r.creadoEn))).toBe(true);
      expect(res.body.data[0].titulo).toBe(`Rutina ${etiqueta} 3`);
      const rutina = res.body.data[0];
      expect(rutina.creadorNombre).toBe(`Tutor ${etiqueta}`);
      expect(rutina.creadorEmail).toBe(tutor.usuario.email);
      expect(rutina.pasosCount).toBe(1);
      expect(rutina.turno).toBe('TARDE');
      expect(res.body.pagination).toMatchObject({ page: 1, total: 3, totalPages: 1, hasNext: false, hasPrev: false });
    });

    test('la búsqueda también encuentra por correo del creador', async () => {
      const res = await request(app).get(`/api/admin/rutinas?search=${encodeURIComponent(tutor.usuario.email)}`).set(auth(developerToken()));

      expect(res.status).toBe(200);
      expect(res.body.data.map((r) => r.creadorEmail)).toEqual([tutor.usuario.email, tutor.usuario.email, tutor.usuario.email]);
    });

    test('pagina correctamente (límite 2: página 2 trae la rutina más antigua)', async () => {
      const pagina2 = await request(app).get(`/api/admin/rutinas?search=${etiqueta}&page=2&limit=2`).set(auth(developerToken()));

      expect(pagina2.status).toBe(200);
      expect(pagina2.body.data.map((r) => r.titulo)).toEqual([`Rutina ${etiqueta} 1`]);
      expect(pagina2.body.pagination).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2, hasNext: false, hasPrev: true });
    });

    test('el límite de página se acota a 100 (rutinas del developer y del tutor)', async () => {
      const admin = await request(app).get('/api/admin/rutinas?limit=5000').set(auth(developerToken()));
      expect(admin.body.pagination.limit).toBe(100);

      const propias = await request(app).get('/api/rutinas?page=1&limit=5000').set(auth(tutor.token));
      expect(propias.body.pagination.limit).toBe(100);
    });

    test('la lista de usuarios va de la más reciente a la más antigua y no expone el salt de la contraseña', async () => {
      const res = await request(app).get('/api/admin/users?limit=100').set(auth(developerToken()));

      expect(res.status).toBe(200);
      expect(esDescendente(res.body.data.map((u) => u.creadoEn))).toBe(true);
      for (const usuario of res.body.data) {
        expect(usuario).not.toHaveProperty('saltPreview');
        expect(usuario).not.toHaveProperty('password_salt');
        expect(usuario).not.toHaveProperty('password_hash');
      }
    });
  });

  describe('13. Secretos obligatorios (sin valores de respaldo en el código)', () => {
    const SRC = path.resolve(process.cwd(), 'src');

    test('se exigen JWT_SECRET y GCP_KMS_PEPPER_SECRET; vacíos o en blanco cuentan como faltantes', () => {
      expect(SECRETOS_OBLIGATORIOS).toEqual(['JWT_SECRET', 'GCP_KMS_PEPPER_SECRET']);
      expect(secretosFaltantes({})).toEqual(['JWT_SECRET', 'GCP_KMS_PEPPER_SECRET']);
      expect(secretosFaltantes({ JWT_SECRET: '   ', GCP_KMS_PEPPER_SECRET: 'x' })).toEqual(['JWT_SECRET']);
      expect(secretosFaltantes({ JWT_SECRET: 'a', GCP_KMS_PEPPER_SECRET: 'b' })).toEqual([]);
    });

    test('el código ya no contiene valores de respaldo para los secretos', () => {
      const jwtSrc = fs.readFileSync(path.join(SRC, 'utils/jwt.js'), 'utf8');
      const dbSrc = fs.readFileSync(path.join(SRC, 'config/database.js'), 'utf8');
      expect(jwtSrc).not.toMatch(/JWT_SECRET\s*\|\|/);
      expect(dbSrc).not.toMatch(/GCP_KMS_PEPPER_SECRET\s*\|\|/);
    });

    test('el backend no arranca sin los secretos y avisa con sus nombres (sin crear la base)', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'upad-sin-secretos-'));
      const dbPath = path.join(dir, 'upad_relational.db');
      const modulo = path.join(SRC, 'config/database.js');
      // cwd en una carpeta vacía: dotenv no encuentra ningún .env que rellene los valores
      const env = { PATH: process.env.PATH, DB_PATH: dbPath, JWT_SECRET: '', GCP_KMS_PEPPER_SECRET: '' };
      const r = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '-e', `await import(${JSON.stringify(modulo)});`], { cwd: dir, env, encoding: 'utf8' });

      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain('JWT_SECRET');
      expect(r.stderr).toContain('GCP_KMS_PEPPER_SECRET');
      expect(fs.existsSync(dbPath)).toBe(false);
    });

    test('un token firmado con otra clave se rechaza (401)', async () => {
      const falso = jsonwebtoken.sign(
        { id: `falso_${TIMESTAMP}`, email: 'falso@upad.test', rol: 'developer', organizacionId: null },
        crypto.randomBytes(32).toString('hex'),
        { expiresIn: '1h' }
      );
      const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${falso}`);
      expect(res.status).toBe(401);
    });
  });

  describe('14. Sincronización móvil (/api/v1/mobile/sync-routines): token o compatibilidad endurecida', () => {
    const URL = '/api/v1/mobile/sync-routines';
    const auth = (token) => ({ Authorization: `Bearer ${token}` });
    const lector = () => new DatabaseSync(process.env.DB_PATH);
    const rutinasDe = (userId) => lector().prepare('SELECT id, titulo, turno, creadoPor, organizacionId FROM rutinas WHERE creadoPor = ?').all(userId);

    const registrar = async (rol = 'tutor', extra = {}) => {
      const res = await request(app).post('/api/auth/register').send({
        nombre: rol === 'empresario' ? 'Colegio Movil' : 'Tutor Movil',
        email: `test-${TIMESTAMP}-m-${crypto.randomUUID().slice(0, 8)}@upad.test`,
        password: passwordGenerada(),
        rol,
        ...extra,
      });
      expect(res.status).toBe(201);
      return res.body.data;
    };

    afterEach(() => {
      delete process.env.MOBILE_SIN_TOKEN;
    });

    test('con token: la rutina se guarda a nombre del usuario del token y con su organización', async () => {
      const empresario = await registrar('empresario');
      const tutor = await registrar('tutor', { codigoOrganizacion: empresario.organizacion.codigo });
      const titulo = `LAVAR MANOS ${crypto.randomUUID().slice(0, 6)}`;

      const res = await request(app).post(URL).set(auth(tutor.token)).send({ actividad: titulo, palabraClave: 'lavar', turno: 'MAÑANA' });

      expect(res.status).toBe(201);
      const guardadas = rutinasDe(tutor.usuario.id);
      expect(guardadas).toHaveLength(1);
      expect(guardadas[0]).toMatchObject({ titulo, turno: 'MANANA', organizacionId: empresario.usuario.organizacionId });
    });

    test('con token y un userId ajeno: 403 y no se guarda nada', async () => {
      const tutor = await registrar();
      const otro = await registrar();

      const res = await request(app).post(URL).set(auth(tutor.token)).send({ actividad: 'AJENA', turno: 'TARDE', userId: otro.usuario.id });

      expect(res.status).toBe(403);
      expect(rutinasDe(otro.usuario.id)).toHaveLength(0);
      expect(rutinasDe(tutor.usuario.id)).toHaveLength(0);
    });

    test('token inválido: 401', async () => {
      const res = await request(app).post(URL).set(auth('no-es-un-token')).send({ actividad: 'X', turno: 'TARDE' });
      expect(res.status).toBe(401);
    });

    test('sin token (compatibilidad con el APK actual): exige un userId existente y nunca usa la cuenta semilla', async () => {
      const tutor = await registrar();

      const ok = await request(app).post(URL).send({ actividad: 'PEINARSE', turno: 'NOCHE', userId: tutor.usuario.id });
      expect(ok.status).toBe(201);
      expect(rutinasDe(tutor.usuario.id).map((r) => r.titulo)).toEqual(['PEINARSE']);

      expect((await request(app).post(URL).send({ actividad: 'SIN USUARIO', turno: 'NOCHE' })).status).toBe(401);
      expect((await request(app).post(URL).send({ actividad: 'INVENTADO', turno: 'NOCHE', userId: 'usr_no_existe_123' })).status).toBe(401);
      expect((await request(app).post(URL).send({ actividad: 'LOCAL', turno: 'NOCHE', userId: 'padre_local_1' })).status).toBe(401);
      expect(rutinasDe('usr_director_sol')).toHaveLength(0);
    });

    test('con MOBILE_SIN_TOKEN=false, sin token se rechaza aunque el userId exista', async () => {
      const tutor = await registrar();
      process.env.MOBILE_SIN_TOKEN = 'false';

      const res = await request(app).post(URL).send({ actividad: 'BLOQUEADA', turno: 'TARDE', userId: tutor.usuario.id });

      expect(res.status).toBe(401);
      expect(res.body.errors.code).toBe('TOKEN_REQUERIDO');
      expect(rutinasDe(tutor.usuario.id)).toHaveLength(0);
    });

    test('GET devuelve solo las rutinas del usuario; un userId desconocido sin token recibe una lista vacía', async () => {
      const tutor = await registrar();
      const otro = await registrar();
      await request(app).post(URL).set(auth(tutor.token)).send({ actividad: 'MIA', turno: 'TARDE' });
      await request(app).post(URL).set(auth(otro.token)).send({ actividad: 'DEL OTRO', turno: 'TARDE' });

      const conToken = await request(app).get(URL).set(auth(tutor.token));
      expect(conToken.status).toBe(200);
      expect(conToken.body.data.map((r) => r.actividad)).toEqual(['MIA']);

      const compat = await request(app).get(`${URL}?userId=${tutor.usuario.id}`);
      expect(compat.body.data.map((r) => r.actividad)).toEqual(['MIA']);

      const desconocido = await request(app).get(`${URL}?userId=usr_no_existe_123`);
      expect(desconocido.status).toBe(200);
      expect(desconocido.body.data).toEqual([]);
    });

    test('DELETE por actividad borra solo la rutina exacta del propio usuario (ni ajenas ni parecidas)', async () => {
      const tutor = await registrar();
      const otro = await registrar();
      await request(app).post(URL).set(auth(tutor.token)).send({ actividad: 'COMER', turno: 'TARDE' });
      await request(app).post(URL).set(auth(tutor.token)).send({ actividad: 'COMER FRUTA', turno: 'TARDE' });
      await request(app).post(URL).set(auth(otro.token)).send({ actividad: 'COMER', turno: 'TARDE' });

      const res = await request(app).delete(`${URL}?userId=${tutor.usuario.id}&actividad=COMER&turno=TARDE`);

      expect(res.status).toBe(200);
      expect(rutinasDe(tutor.usuario.id).map((r) => r.titulo)).toEqual(['COMER FRUTA']);
      expect(rutinasDe(otro.usuario.id).map((r) => r.titulo)).toEqual(['COMER']);
    });

    test('DELETE por id no borra rutinas ajenas, y sin token ni userId responde 401', async () => {
      const tutor = await registrar();
      const otro = await registrar();
      await request(app).post(URL).set(auth(otro.token)).send({ actividad: 'AJENA POR ID', turno: 'TARDE' });
      const idAjena = rutinasDe(otro.usuario.id)[0].id;

      await request(app).delete(`${URL}?id=${idAjena}`).set(auth(tutor.token));
      expect(rutinasDe(otro.usuario.id)).toHaveLength(1);

      expect((await request(app).delete(`${URL}?id=${idAjena}`)).status).toBe(401);
      expect((await request(app).delete(`${URL}?actividad=AJENA%20POR%20ID`)).status).toBe(401);
      expect(rutinasDe(otro.usuario.id)).toHaveLength(1);
    });

    test('PUT exige token siempre (la app no lo usa) y solo modifica las rutinas propias', async () => {
      const tutor = await registrar();
      await request(app).post(URL).set(auth(tutor.token)).send({ actividad: 'VESTIRSE', turno: 'TARDE' });
      const id = rutinasDe(tutor.usuario.id)[0].id;

      const sinToken = await request(app).put(URL).send({ id, actividad: 'HACKEADA', turno: 'TARDE', userId: tutor.usuario.id });
      expect(sinToken.status).toBe(401);

      const conToken = await request(app).put(URL).set(auth(tutor.token)).send({ id, actividad: 'VESTIRSE RAPIDO', turno: 'TARDE' });
      expect(conToken.status).toBe(200);
      expect(rutinasDe(tutor.usuario.id)[0].titulo).toBe('VESTIRSE RAPIDO');
    });
  });

  describe('15. Límites de intentos en vinculación y telemetría; modo sin token', () => {
    const auth = (token) => ({ Authorization: `Bearer ${token}` });
    const codigoAleatorio = () => String(crypto.randomInt(100000, 1000000));

    const registrarTutor = async () => {
      const res = await request(app).post('/api/auth/register').send({
        nombre: 'Tutor Limites',
        email: `test-${TIMESTAMP}-l-${crypto.randomUUID().slice(0, 8)}@upad.test`,
        password: passwordGenerada(),
        rol: 'tutor',
      });
      expect(res.status).toBe(201);
      return res.body.data;
    };

    const vincularHijo = async (tutor) => {
      const code = codigoAleatorio();
      const deviceId = `dev_lim_${crypto.randomUUID().slice(0, 8)}`;
      await request(app).post('/api/v1/devices/pairing/create').send({ code, deviceId });
      const res = await request(app).post('/api/devices/pairing/link').set(auth(tutor.token)).send({ code, childName: 'Limite' });
      expect(res.status).toBe(201);
      return deviceId;
    };

    beforeEach(() => {
      limitePairingLink.reiniciar();
      limiteTelemetria.reiniciar();
    });

    afterEach(() => {
      delete process.env.MOBILE_SIN_TOKEN;
    });

    test(`vincular: máximo ${LIMITES_DISPOSITIVOS.PAIRING_POR_CUENTA} intentos por minuto por cuenta (luego 429); otra cuenta sigue pudiendo`, async () => {
      const tutor = await registrarTutor();
      const otro = await registrarTutor();

      for (let i = 0; i < LIMITES_DISPOSITIVOS.PAIRING_POR_CUENTA; i += 1) {
        const r = await request(app).post('/api/devices/pairing/link').set(auth(tutor.token)).send({ code: codigoAleatorio(), childName: 'X' });
        expect(r.status).toBe(404);
      }
      const bloqueado = await request(app).post('/api/devices/pairing/link').set(auth(tutor.token)).send({ code: codigoAleatorio(), childName: 'X' });
      expect(bloqueado.status).toBe(429);
      expect(bloqueado.body.errors.code).toBe('PAIRING_RATE_LIMIT');

      const otroIntento = await request(app).post('/api/devices/pairing/link').set(auth(otro.token)).send({ code: codigoAleatorio(), childName: 'X' });
      expect(otroIntento.status).toBe(404);
    });

    test(`vincular: máximo ${LIMITES_DISPOSITIVOS.PAIRING_POR_IP} intentos por minuto por IP aunque cambie la cuenta (detrás del proxy de Cloud Run)`, async () => {
      const ip = '203.0.113.77';
      for (let i = 0; i < LIMITES_DISPOSITIVOS.PAIRING_POR_IP; i += 1) {
        await request(app).post('/api/v1/devices/pairing/link').set('X-Forwarded-For', ip).send({ code: codigoAleatorio(), parentId: `usr_falso_${i}` });
      }
      const bloqueado = await request(app).post('/api/v1/devices/pairing/link').set('X-Forwarded-For', ip).send({ code: codigoAleatorio(), parentId: 'usr_falso_otro' });
      expect(bloqueado.status).toBe(429);

      const otraIp = await request(app).post('/api/v1/devices/pairing/link').set('X-Forwarded-For', '203.0.113.78').send({ code: codigoAleatorio(), parentId: 'usr_falso_otro' });
      expect(otraIp.status).not.toBe(429);
    });

    test('el polling del teléfono (GET /pairing/:code) no tiene límite', async () => {
      const code = codigoAleatorio();
      await request(app).post('/api/v1/devices/pairing/create').send({ code, deviceId: `dev_poll_${crypto.randomUUID().slice(0, 8)}` });
      for (let i = 0; i < LIMITES_DISPOSITIVOS.PAIRING_POR_IP + 5; i += 1) {
        expect((await request(app).get(`/api/v1/devices/pairing/${code}`)).status).toBe(200);
      }
    });

    test(`telemetría: máximo ${LIMITES_DISPOSITIVOS.TELEMETRIA_POR_DISPOSITIVO} envíos por minuto por dispositivo; otro dispositivo no se ve afectado`, async () => {
      const tutor = await registrarTutor();
      const hijo = await vincularHijo(tutor);
      const hermano = await vincularHijo(tutor);
      const ubicacion = { latitude: -16.4, longitude: -71.5 };

      for (let i = 0; i < LIMITES_DISPOSITIVOS.TELEMETRIA_POR_DISPOSITIVO; i += 1) {
        expect((await request(app).post(`/api/v1/devices/${hijo}/telemetry`).send(ubicacion)).status).toBe(200);
      }
      const bloqueado = await request(app).post(`/api/v1/devices/${hijo}/telemetry`).send(ubicacion);
      expect(bloqueado.status).toBe(429);
      expect(bloqueado.body.errors.code).toBe('TELEMETRIA_RATE_LIMIT');

      expect((await request(app).post(`/api/v1/devices/${hermano}/telemetry`).send(ubicacion)).status).toBe(200);
    });

    test('telemetría: un deviceId con formato inválido se rechaza (400)', async () => {
      const res = await request(app).post(`/api/v1/devices/${'x'.repeat(200)}/telemetry`).send({ latitude: 1, longitude: 1 });
      expect(res.status).toBe(400);
      expect(res.body.errors.code).toBe('DEVICE_ID_INVALIDO');
    });

    test('con MOBILE_SIN_TOKEN=false, vincular y desvincular con parentId (sin token) dan 401; con token siguen funcionando', async () => {
      const tutor = await registrarTutor();
      const hijo = await vincularHijo(tutor);
      process.env.MOBILE_SIN_TOKEN = 'false';

      const code = codigoAleatorio();
      await request(app).post('/api/v1/devices/pairing/create').send({ code, deviceId: `dev_nt_${crypto.randomUUID().slice(0, 8)}` });
      const link = await request(app).post('/api/v1/devices/pairing/link').send({ code, parentId: tutor.usuario.id });
      expect(link.status).toBe(401);
      expect(link.body.errors.code).toBe('TOKEN_REQUERIDO');

      const unlink = await request(app).delete(`/api/v1/devices/${hijo}?parentId=${tutor.usuario.id}`);
      expect(unlink.status).toBe(401);

      const conToken = await request(app).delete(`/api/devices/${hijo}`).set(auth(tutor.token));
      expect(conToken.status).toBe(200);
    });
  });

  describe('16. Sin afirmaciones falsas sobre Google Cloud / KMS en las respuestas del backend', () => {
    const FALSAS = /Google Cloud|GCP|KMS/i;
    const developer = () => tokenDe({ id: `dev16_${TIMESTAMP}`, email: `test-${TIMESTAMP}-dev16@upad.test`, rol: 'developer', organizacionId: null });

    test.each(['/', '/health', '/api/v1/health'])('%s no menciona Google Cloud, GCP ni KMS', async (ruta) => {
      const res = await request(app).get(ruta).set('Accept', 'application/json');
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toMatch(FALSAS);
    });

    test('la consola SQL de backups responde sin mencionar Google Cloud, GCP ni KMS (ni al aceptar ni al rechazar)', async () => {
      const ok = await request(app).post('/api/admin/backups/sql-query').set('Authorization', `Bearer ${developer()}`).send({ query: 'SELECT 1 AS uno' });
      expect(ok.status).toBe(200);
      expect(JSON.stringify(ok.body)).not.toMatch(FALSAS);

      const rechazo = await request(app).post('/api/admin/backups/sql-query').set('Authorization', `Bearer ${developer()}`).send({ query: 'DELETE FROM usuarios' });
      expect(rechazo.status).toBe(400);
      expect(JSON.stringify(rechazo.body)).not.toMatch(FALSAS);
    });
  });

  describe('17. Inicio de sesión con Google (verificador simulado)', () => {
    const CLIENT_ID = `test-${TIMESTAMP}.apps.googleusercontent.com`;
    const credenciales = new Map();
    const lector = () => new DatabaseSync(process.env.DB_PATH);

    /** Crea una credencial simulada de Google con el perfil indicado. */
    const credencialGoogle = ({ email, sub = `g_${crypto.randomUUID()}`, name = 'Persona Google', emailVerified = true } = {}) => {
      const credential = `cred_${crypto.randomUUID()}`;
      credenciales.set(credential, { sub, email, name, email_verified: emailVerified, aud: CLIENT_ID });
      return credential;
    };
    const correo = () => `test-${TIMESTAMP}-g-${crypto.randomUUID().slice(0, 8)}@gmail.test`;

    beforeAll(() => {
      establecerVerificadorGoogle(async (credential, audiencia) => {
        const payload = credenciales.get(credential);
        if (!payload || payload.aud !== audiencia) throw new Error('token de Google inválido');
        return payload;
      });
    });
    beforeEach(() => {
      process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
    });
    afterAll(() => {
      establecerVerificadorGoogle(null);
      delete process.env.GOOGLE_CLIENT_ID;
    });

    test('GET /api/auth/config entrega el client ID público (o null si no está configurado)', async () => {
      expect((await request(app).get('/api/auth/config')).body.data).toEqual({ googleClientId: CLIENT_ID });
      delete process.env.GOOGLE_CLIENT_ID;
      expect((await request(app).get('/api/auth/config')).body.data).toEqual({ googleClientId: null });
    });

    test('sin GOOGLE_CLIENT_ID el login con Google responde 503', async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      const res = await request(app).post('/api/auth/google').send({ credential: credencialGoogle({ email: correo() }) });
      expect(res.status).toBe(503);
      expect(res.body.errors.code).toBe('GOOGLE_NO_CONFIGURADO');
    });

    test('credencial inválida o correo sin verificar: 401', async () => {
      const invalida = await request(app).post('/api/auth/google').send({ credential: 'no-es-de-google' });
      expect(invalida.status).toBe(401);
      expect(invalida.body.errors.code).toBe('GOOGLE_TOKEN_INVALIDO');

      const sinVerificar = await request(app).post('/api/auth/google').send({ credential: credencialGoogle({ email: correo(), emailVerified: false }) });
      expect(sinVerificar.status).toBe(401);
      expect(sinVerificar.body.errors.code).toBe('GOOGLE_EMAIL_NO_VERIFICADO');
    });

    test('correo nuevo: pide completar el registro y no crea ninguna cuenta', async () => {
      const email = correo();
      const res = await request(app).post('/api/auth/google').send({ credential: credencialGoogle({ email, name: 'Ana Google' }) });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ requiereRegistro: true, perfil: { nombre: 'Ana Google', email } });
      expect(lector().prepare('SELECT COUNT(*) AS n FROM usuarios WHERE email = ?').get(email).n).toBe(0);
    });

    test('registro de empresario: exige el nombre de la institución y crea su organización', async () => {
      const email = correo();
      const sub = `g_${crypto.randomUUID()}`;

      const sinNombre = await request(app).post('/api/auth/google/registro').send({ credential: credencialGoogle({ email, sub }), rol: 'empresario' });
      expect(sinNombre.status).toBe(400);
      expect(sinNombre.body.errors.code).toBe('NOMBRE_INSTITUCION_REQUERIDO');

      const res = await request(app).post('/api/auth/google/registro').send({ credential: credencialGoogle({ email, sub }), rol: 'empresario', nombreInstitucion: 'Colegio Google' });
      expect(res.status).toBe(201);
      expect(res.body.data.token).toEqual(expect.any(String));
      expect(res.body.data.usuario).toMatchObject({ email, rol: 'empresario', nombre: 'Colegio Google' });
      expect(res.body.data.organizacion).toMatchObject({ nombre: 'Colegio Google', codigo: expect.any(String) });
      expect(lector().prepare('SELECT google_sub FROM usuarios WHERE email = ?').get(email).google_sub).toBe(sub);
    });

    test('registro de tutor: con código válido se une a la organización; con código inválido no se crea la cuenta', async () => {
      const empresario = await request(app).post('/api/auth/google/registro').send({ credential: credencialGoogle({ email: correo() }), rol: 'empresario', nombreInstitucion: 'Colegio Codigo' });
      const codigo = empresario.body.data.organizacion.codigo;

      const emailMal = correo();
      const mal = await request(app).post('/api/auth/google/registro').send({ credential: credencialGoogle({ email: emailMal }), rol: 'tutor', codigoOrganizacion: 'ZZZZ-ZZZZ' });
      expect(mal.status).toBe(400);
      expect(mal.body.errors.code).toBe('ORGANIZACION_CODIGO_INVALIDO');
      expect(lector().prepare('SELECT COUNT(*) AS n FROM usuarios WHERE email = ?').get(emailMal).n).toBe(0);

      const ok = await request(app).post('/api/auth/google/registro').send({ credential: credencialGoogle({ email: correo(), name: 'Tutor G' }), rol: 'tutor', codigoOrganizacion: codigo });
      expect(ok.status).toBe(201);
      expect(ok.body.data.usuario).toMatchObject({ rol: 'tutor', nombre: 'Tutor G', organizacionId: empresario.body.data.usuario.organizacionId });
    });

    test('no se puede registrar un developer con Google, ni un correo que ya existe', async () => {
      const dev = await request(app).post('/api/auth/google/registro').send({ credential: credencialGoogle({ email: correo() }), rol: 'developer' });
      expect(dev.status).toBe(400);
      expect(dev.body.errors.code).toBe('INVALID_ROLE');

      const email = correo();
      await request(app).post('/api/auth/register').send({ nombre: 'Ya Existe', email, password: passwordGenerada(), rol: 'tutor' });
      const repetido = await request(app).post('/api/auth/google/registro').send({ credential: credencialGoogle({ email }), rol: 'tutor' });
      expect(repetido.status).toBe(409);
      expect(repetido.body.errors.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    test('una cuenta existente (registrada con contraseña) entra con Google y queda enlazada a ese Google', async () => {
      const email = correo();
      const password = passwordGenerada();
      await request(app).post('/api/auth/register').send({ nombre: 'Con Password', email, password, rol: 'tutor' });
      const sub = `g_${crypto.randomUUID()}`;

      const res = await request(app).post('/api/auth/google').send({ credential: credencialGoogle({ email, sub }) });
      expect(res.status).toBe(200);
      expect(res.body.data.token).toEqual(expect.any(String));
      expect(res.body.data.usuario).toMatchObject({ email, rol: 'tutor' });
      expect(lector().prepare('SELECT google_sub FROM usuarios WHERE email = ?').get(email).google_sub).toBe(sub);

      // Sigue pudiendo entrar con su contraseña
      expect((await request(app).post('/api/auth/login').send({ email, password })).status).toBe(200);

      // Otra cuenta de Google con el mismo correo (otro sub) no puede apropiarse de ella
      const otroSub = await request(app).post('/api/auth/google').send({ credential: credencialGoogle({ email, sub: `g_${crypto.randomUUID()}` }) });
      expect(otroSub.status).toBe(401);
      expect(otroSub.body.errors.code).toBe('GOOGLE_CUENTA_DISTINTA');
    });

    test('una cuenta creada con Google no tiene contraseña utilizable y una cuenta desactivada no entra (403)', async () => {
      const email = correo();
      const sub = `g_${crypto.randomUUID()}`;
      await request(app).post('/api/auth/google/registro').send({ credential: credencialGoogle({ email, sub }), rol: 'tutor' });

      expect((await request(app).post('/api/auth/login').send({ email, password: passwordGenerada() })).status).toBe(401);

      db.prepare('UPDATE usuarios SET activo = 0 WHERE email = ?').run(email);
      const desactivada = await request(app).post('/api/auth/google').send({ credential: credencialGoogle({ email, sub }) });
      expect(desactivada.status).toBe(403);
      expect(desactivada.body.errors.code).toBe('ACCOUNT_INACTIVE');
    });
  });

  describe('18. Persistencia de la base (Litestream) y despliegue sin datos locales', () => {
    const leer = (relativa) => fs.readFileSync(path.resolve(process.cwd(), relativa), 'utf8');

    test('descripcionPersistencia: Litestream activo, Cloud Run sin réplica (temporal) o local', () => {
      expect(descripcionPersistencia({ LITESTREAM_ACTIVO: '1', K_SERVICE: 'upad' })).toBe('Cloud Storage (Litestream)');
      expect(descripcionPersistencia({ K_SERVICE: 'upad' })).toBe('disco temporal');
      expect(descripcionPersistencia({})).toBe('local');
    });

    test.each(['/health', '/api/v1/health'])('%s informa dónde vive la base (persistencia)', async (ruta) => {
      const res = await request(app).get(ruta);
      expect(res.status).toBe(200);
      expect(res.body.data.persistencia).toBe('local');
    });

    test('el Dockerfile no copia ninguna base local y arranca con scripts/arranque.sh (Litestream con checksum)', () => {
      const dockerfile = leer('Dockerfile');
      expect(dockerfile).not.toMatch(/COPY[^\n]*\.db/);
      expect(dockerfile).toMatch(/sha256sum -c/);
      expect(dockerfile).toMatch(/scripts\/arranque\.sh/);
      expect(dockerfile).toMatch(/DB_PATH=\/data\//);
    });

    test('.dockerignore y .gcloudignore excluyen las bases, los backups y los .env', () => {
      for (const archivo of ['.dockerignore', '.gcloudignore']) {
        const lineas = leer(archivo).split('\n').map((l) => l.trim());
        for (const patron of ['*.db', '*.db-wal', '*.db-shm', 'backups', '.env', '.env.*']) {
          expect([archivo, lineas.includes(patron)]).toEqual([archivo, true]);
        }
      }
    });

    test('arranque.sh: sintaxis válida, restaura antes de arrancar y avisa si no hay bucket', () => {
      const script = leer('scripts/arranque.sh');
      expect(spawnSync('sh', ['-n', 'scripts/arranque.sh'], { cwd: process.cwd() }).status).toBe(0);
      expect(script.indexOf('litestream restore')).toBeGreaterThan(-1);
      expect(script.indexOf('litestream restore')).toBeLessThan(script.indexOf('litestream replicate'));
      expect(script).toMatch(/-if-replica-exists/);
      expect(script).toMatch(/LITESTREAM_ACTIVO=1/);
      // Litestream reconoce Cloud Storage con el esquema gs:// (no gcs://)
      expect(script).toMatch(/gs:\/\/\$\{UPAD_BUCKET\}\/db/);
      expect(script).not.toMatch(/gcs:\/\//);
    });

    test('database.js ya no busca la base en rutas heredadas ni personales', () => {
      const fuente = leer('src/config/database.js');
      expect(fuente).not.toMatch(/angeloricasca/);
      expect(fuente).not.toMatch(/cloud\/upad_relational\.db/);
    });
  });

  describe('19. Backups en Cloud Storage (almacén simulado en memoria)', () => {
    const BUCKET = 'upad-pruebas';
    const objetos = new Map();
    const storageSimulado = {
      bucket: (nombre) => {
        expect(nombre).toBe(BUCKET);
        return {
          upload: async (origen, { destination }) => {
            objetos.set(destination, { datos: fs.readFileSync(origen), actualizado: new Date().toISOString() });
          },
          getFiles: async ({ prefix }) => [
            [...objetos.entries()]
              .filter(([clave]) => clave.startsWith(prefix))
              .map(([clave, o]) => ({ name: clave, metadata: { size: String(o.datos.length), updated: o.actualizado } })),
          ],
          file: (clave) => ({
            exists: async () => [objetos.has(clave)],
            getMetadata: async () => [{ size: String(objetos.get(clave).datos.length) }],
            createReadStream: () => Readable.from([objetos.get(clave).datos]),
          }),
        };
      },
    };
    const developer = () => tokenDe({ id: `dev19_${TIMESTAMP}`, email: `test-${TIMESTAMP}-dev19@upad.test`, rol: 'developer', organizacionId: null });
    const tutor = () => tokenDe({ id: `tut19_${TIMESTAMP}`, email: `test-${TIMESTAMP}-tut19@upad.test`, rol: 'tutor', organizacionId: null });
    const auth = (token) => ({ Authorization: `Bearer ${token}` });

    beforeEach(() => {
      objetos.clear();
      establecerAlmacenBackups(crearAlmacenGcs(BUCKET, storageSimulado));
    });
    afterAll(() => establecerAlmacenBackups(null));

    test('GET /api/admin/backups/info dice dónde se guardan (solo developer)', async () => {
      const res = await request(app).get('/api/admin/backups/info').set(auth(developer()));
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ almacenamiento: 'cloud-storage', ubicacion: `gs://${BUCKET}/backups/` });
      expect((await request(app).get('/api/admin/backups/info').set(auth(tutor()))).status).toBe(403);
    });

    test('crear un backup lo sube al bucket (backups/) y no deja copias en el disco', async () => {
      const res = await request(app).post('/api/admin/backups').set(auth(developer()));
      expect(res.status).toBe(201);
      const { filename } = res.body.data;
      expect(res.body.data.filePath).toBe(`gs://${BUCKET}/backups/${filename}`);
      expect(objetos.has(`backups/${filename}`)).toBe(true);
      expect(objetos.get(`backups/${filename}`).datos.subarray(0, 15).toString()).toBe('SQLite format 3');
      const enDisco = fs.readdirSync(os.tmpdir()).filter((f) => f.includes(filename));
      expect(enDisco).toEqual([]);
    });

    test('listar y descargar leen del bucket', async () => {
      const creado = await request(app).post('/api/admin/backups').set(auth(developer()));
      const { filename } = creado.body.data;

      const lista = await request(app).get('/api/admin/backups').set(auth(developer()));
      expect(lista.status).toBe(200);
      expect(lista.body.data).toEqual([
        expect.objectContaining({ filename, sizeBytes: expect.any(Number), sizeFormatted: expect.any(String), fechaModificacion: expect.any(String) }),
      ]);

      const descarga = await request(app)
        .get(`/api/admin/backups/${filename}`)
        .set(auth(developer()))
        .buffer(true)
        .parse((res, cb) => {
          const partes = [];
          res.on('data', (c) => partes.push(c));
          res.on('end', () => cb(null, Buffer.concat(partes)));
        });
      expect(descarga.status).toBe(200);
      expect(descarga.headers['content-disposition']).toContain(filename);
      expect(descarga.body.subarray(0, 15).toString()).toBe('SQLite format 3');
    });

    test('dos backups seguidos (mismo milisegundo) tienen nombre e id distintos', async () => {
      const [a, b] = await Promise.all([
        backupService.crearBackup({ rol: 'developer', email: 'dev@upad.test' }),
        backupService.crearBackup({ rol: 'developer', email: 'dev@upad.test' }),
      ]);
      expect(a.filename).not.toBe(b.filename);
      expect(a.id).not.toBe(b.id);
      expect(objetos.size).toBe(2);
    });

    test('descargar un backup inexistente da 404 y no se puede salir de backups/', async () => {
      expect((await request(app).get('/api/admin/backups/no_existe.db').set(auth(developer()))).status).toBe(404);
      expect((await request(app).get('/api/admin/backups/..%2F..%2Fdb').set(auth(developer()))).status).toBe(404);
    });

    test('backup automático: se crea si no hay ninguno o el último tiene más de 12 h; si no, no', async () => {
      const ahora = Date.now();
      const primero = await backupService.backupAutomaticoSiCorresponde({ ahora });
      expect(primero).toEqual(expect.objectContaining({ tipo: 'AUTOMATICO' }));
      expect(objetos.size).toBe(1);

      expect(await backupService.backupAutomaticoSiCorresponde({ ahora: ahora + 60 * 60 * 1000 })).toBeNull();
      expect(objetos.size).toBe(1);

      const tarde = await backupService.backupAutomaticoSiCorresponde({ ahora: ahora + 13 * 60 * 60 * 1000 });
      expect(tarde).toEqual(expect.objectContaining({ tipo: 'AUTOMATICO' }));
    });

    test('sin bucket, el almacén local guarda en la carpeta de backups e informa «disco»', async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'upad-bkp-'));
      establecerAlmacenBackups(crearAlmacenLocal(dir));
      const info = await request(app).get('/api/admin/backups/info').set(auth(developer()));
      expect(info.body.data).toEqual({ almacenamiento: 'disco', ubicacion: dir });

      const creado = await request(app).post('/api/admin/backups').set(auth(developer()));
      expect(fs.existsSync(path.join(dir, creado.body.data.filename))).toBe(true);
      fs.rmSync(dir, { recursive: true, force: true });
    });
  });

  describe('20. Pepper cifrado con Cloud KMS (descifrador simulado)', () => {
    const CLAVE = 'projects/p/locations/us-central1/keyRings/upad/cryptoKeys/pepper';
    const pepperClaro = () => crypto.randomBytes(32).toString('hex');

    test('sin variables de KMS usa GCP_KMS_PEPPER_SECRET como hasta ahora (no llama a KMS)', async () => {
      const env = { GCP_KMS_PEPPER_SECRET: 'valor-local' };
      const descifrar = jest.fn();
      expect(await resolverPepperKms(env, { descifrar })).toEqual({ origen: 'entorno' });
      expect(descifrar).not.toHaveBeenCalled();
      expect(env.GCP_KMS_PEPPER_SECRET).toBe('valor-local');
    });

    test('con PEPPER_KMS_CIFRADO y PEPPER_KMS_CLAVE descifra con esa clave y deja el pepper solo en memoria', async () => {
      const claro = pepperClaro();
      const cifrado = Buffer.from(`cifrado:${claro}`);
      const env = { PEPPER_KMS_CIFRADO: cifrado.toString('base64'), PEPPER_KMS_CLAVE: CLAVE, GCP_KMS_PEPPER_SECRET: 'texto-plano-viejo' };
      const descifrar = jest.fn(async ({ nombreClave, cifrado: recibido }) => {
        expect(nombreClave).toBe(CLAVE);
        expect(Buffer.compare(recibido, cifrado)).toBe(0);
        return Buffer.from(claro);
      });
      const consola = jest.spyOn(console, 'log').mockImplementation(() => {});
      const aviso = jest.spyOn(console, 'warn').mockImplementation(() => {});

      expect(await resolverPepperKms(env, { descifrar })).toEqual({ origen: 'kms' });
      expect(env.GCP_KMS_PEPPER_SECRET).toBe(claro);
      const impreso = [...consola.mock.calls, ...aviso.mock.calls].flat().join(' ');
      expect(impreso).not.toContain(claro);
      consola.mockRestore();
      aviso.mockRestore();
    });

    test.each([
      [{ PEPPER_KMS_CIFRADO: 'YWJj' }, 'PEPPER_KMS_CLAVE'],
      [{ PEPPER_KMS_CLAVE: CLAVE }, 'PEPPER_KMS_CIFRADO'],
    ])('si falta una de las dos variables de KMS, falla nombrando la que falta (%o)', async (env, falta) => {
      await expect(resolverPepperKms(env, { descifrar: jest.fn() })).rejects.toThrow(falta);
    });

    test('si KMS falla o devuelve un pepper vacío, falla (el backend no arranca) y no deja pepper', async () => {
      const env = { PEPPER_KMS_CIFRADO: 'YWJj', PEPPER_KMS_CLAVE: CLAVE };
      await expect(resolverPepperKms(env, { descifrar: async () => { throw new Error('PERMISSION_DENIED'); } })).rejects.toThrow('PERMISSION_DENIED');
      await expect(resolverPepperKms(env, { descifrar: async () => Buffer.from('   ') })).rejects.toThrow(/vac/);
      expect(env.GCP_KMS_PEPPER_SECRET).toBeUndefined();
    });

    test('server.js no arranca si la configuración de KMS está incompleta (proceso hijo)', () => {
      const dbPath = path.join(os.tmpdir(), `upad-kms-${crypto.randomUUID()}.db`);
      const r = spawnSync(process.execPath, ['src/server.js'], {
        cwd: process.cwd(),
        env: { PATH: process.env.PATH, DB_PATH: dbPath, PORT: '0', JWT_SECRET: 'x'.repeat(32), PEPPER_KMS_CIFRADO: 'YWJj', PEPPER_KMS_CLAVE: '' },
        encoding: 'utf8',
        timeout: 20000,
      });
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('PEPPER_KMS_CLAVE');
      expect(r.stdout).not.toContain('Servidor Express');
      expect(fs.existsSync(dbPath)).toBe(false);
    });

    test('el script cifrarPepper.js existe, es válido y nunca imprime el pepper en claro', () => {
      expect(spawnSync(process.execPath, ['--check', 'scripts/cifrarPepper.js'], { cwd: process.cwd() }).status).toBe(0);
      const fuente = fs.readFileSync(path.resolve(process.cwd(), 'scripts/cifrarPepper.js'), 'utf8');
      expect(fuente).not.toMatch(/console\.log\([^)]*pepper\b/i);
      expect(fuente).not.toMatch(/writeFile/);
    });
  });

  describe('21. Rotación del pepper con migración al iniciar sesión y fin del hash débil K6', () => {
    const hashHeredado = (password, salt, pepperValor, rondas) =>
      crypto.pbkdf2Sync(`${password}${salt}${pepperValor}`, salt, rondas, 64, 'sha512').toString('hex');
    const fila = (email) => db.prepare('SELECT id, password_hash, password_salt, hash_version FROM usuarios WHERE email = ?').get(email);
    const insertarHeredada = ({ email, password, pepperValor, rondas = 100000, hashVersion = null }) => {
      const salt = crypto.randomBytes(16).toString('hex');
      const id = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      db.prepare(`
        INSERT INTO usuarios (id, nombre, email, password_hash, password_salt, rol, organizacionId, activo, creadoEn, hash_version)
        VALUES (?, 'Heredada', ?, ?, ?, 'tutor', NULL, 1, ?, ?)
      `).run(id, email, hashHeredado(password, salt, pepperValor, rondas), salt, new Date().toISOString(), hashVersion);
      return id;
    };
    const correo = (prefijo = 'rot') => `test-${TIMESTAMP}-${prefijo}-${crypto.randomUUID().slice(0, 8)}@upad.test`;
    const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });

    afterEach(() => {
      delete process.env.PEPPER_ANTERIOR;
    });

    test('las cuentas nuevas quedan en la versión 2 (pepper actual, 100 000 rondas), aunque la contraseña empiece por K6Pass', async () => {
      const email = correo('k6nueva');
      const password = `K6Pass${passwordGenerada()}`;
      const res = await request(app).post('/api/auth/register').send({ nombre: 'Nueva', email, password, rol: 'tutor' });
      expect(res.status).toBe(201);
      const f = fila(email);
      expect(f.hash_version).toBe(2);
      expect(verifyPassword(password, f.password_salt, f.password_hash)).toBe(true);
    });

    test('una cuenta con el pepper ANTERIOR entra y se vuelve a cifrar con el actual (nuevo salt, versión 2)', async () => {
      const viejo = crypto.randomBytes(32).toString('hex');
      process.env.PEPPER_ANTERIOR = viejo;
      const email = correo();
      const password = passwordGenerada();
      insertarHeredada({ email, password, pepperValor: viejo });
      const antes = fila(email);

      expect((await login(email, password)).status).toBe(200);
      const despues = fila(email);
      expect(despues.hash_version).toBe(2);
      expect(despues.password_salt).not.toBe(antes.password_salt);
      expect(verifyPassword(password, despues.password_salt, despues.password_hash)).toBe(true);

      // Ya migrada: sigue entrando aunque el pepper anterior desaparezca
      delete process.env.PEPPER_ANTERIOR;
      expect((await login(email, password)).status).toBe(200);
    });

    test('una contraseña incorrecta en una cuenta heredada da 401 y no migra nada', async () => {
      const viejo = crypto.randomBytes(32).toString('hex');
      process.env.PEPPER_ANTERIOR = viejo;
      const email = correo();
      insertarHeredada({ email, password: passwordGenerada(), pepperValor: viejo });
      const antes = fila(email);

      expect((await login(email, passwordGenerada())).status).toBe(401);
      expect(fila(email)).toEqual(antes);
    });

    test('las cuentas antiguas con el pepper actual (sin PEPPER_ANTERIOR) también entran y se migran', async () => {
      const email = correo();
      const password = passwordGenerada();
      insertarHeredada({ email, password, pepperValor: process.env.GCP_KMS_PEPPER_SECRET });
      expect((await login(email, password)).status).toBe(200);
      expect(fila(email).hash_version).toBe(2);
    });

    test('una cuenta K6 antigua (1000 rondas) entra una vez y pasa a 100 000 rondas', async () => {
      const email = `test_k6_${crypto.randomUUID().slice(0, 8)}@upad.test`;
      const password = passwordGenerada();
      insertarHeredada({ email, password, pepperValor: process.env.GCP_KMS_PEPPER_SECRET, rondas: 1000 });

      expect((await login(email, password)).status).toBe(200);
      const f = fila(email);
      expect(f.hash_version).toBe(2);
      expect(verifyPassword(password, f.password_salt, f.password_hash)).toBe(true);
    });

    test('una cuenta en versión 2 no acepta el pepper anterior ni las 1000 rondas', async () => {
      const viejo = crypto.randomBytes(32).toString('hex');
      process.env.PEPPER_ANTERIOR = viejo;
      const email = correo();
      const password = passwordGenerada();
      insertarHeredada({ email, password, pepperValor: viejo, hashVersion: 2 });
      expect((await login(email, password)).status).toBe(401);
    });

    test('una cuenta bcrypt heredada entra y se migra a la versión 2', async () => {
      const email = correo('bcrypt');
      const password = passwordGenerada();
      const id = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      db.prepare(`
        INSERT INTO usuarios (id, nombre, email, password_hash, password_salt, rol, organizacionId, activo, creadoEn)
        VALUES (?, 'Bcrypt', ?, ?, '', 'tutor', NULL, 1, ?)
      `).run(id, email, await bcrypt.hash(password, 4), new Date().toISOString());

      expect((await login(email, password)).status).toBe(200);
      const f = fila(email);
      expect(f.hash_version).toBe(2);
      expect(verifyPassword(password, f.password_salt, f.password_hash)).toBe(true);
    });

    test('el developer al crear una cuenta o cambiar su contraseña la deja en la versión 2', async () => {
      const dev = tokenDe({ id: `dev21_${TIMESTAMP}`, email: `test-${TIMESTAMP}-dev21@upad.test`, rol: 'developer', organizacionId: null });
      const email = correo('admin');
      const creado = await request(app).post('/api/admin/users').set('Authorization', `Bearer ${dev}`)
        .send({ nombre: 'Desde Admin', email, password: passwordGenerada(), rol: 'tutor' });
      expect(creado.status).toBe(201);
      expect(fila(email).hash_version).toBe(2);

      const viejo = crypto.randomBytes(32).toString('hex');
      const otroEmail = correo('admin2');
      const id = insertarHeredada({ email: otroEmail, password: passwordGenerada(), pepperValor: viejo });
      const nueva = passwordGenerada();
      const editado = await request(app).put(`/api/admin/users/${id}`).set('Authorization', `Bearer ${dev}`)
        .send({ nombre: 'Heredada', email: otroEmail, rol: 'tutor', activo: true, password: nueva });
      expect(editado.status).toBe(200);
      const f = fila(otroEmail);
      expect(f.hash_version).toBe(2);
      expect(verifyPassword(nueva, f.password_salt, f.password_hash)).toBe(true);
    });

    test('el registro ya no copia el hash a la tabla heredada users', () => {
      const fuente = fs.readFileSync(path.resolve(process.cwd(), 'src/services/authService.js'), 'utf8');
      expect(fuente).not.toMatch(/INSERT INTO users/);
    });
  });

  describe('22. Integración con la app Android: estado del dispositivo y cuenta comprobada en cada petición', () => {
    const auth = (token) => ({ Authorization: `Bearer ${token}` });
    const correo = (etiqueta) => `test-${TIMESTAMP}-j-${etiqueta}-${crypto.randomUUID().slice(0, 8)}@upad.test`;

    const registrar = async (rol = 'tutor', extra = {}) => {
      const res = await request(app).post('/api/auth/register').send({
        nombre: `Cuenta ${rol}`,
        email: correo(rol),
        password: passwordGenerada(),
        rol,
        ...extra,
      });
      expect(res.status).toBe(201);
      return res.body.data;
    };

    const vincularHijo = async (tutor) => {
      const code = String(crypto.randomInt(100000, 1000000));
      const deviceId = `dev_j_${crypto.randomUUID().slice(0, 8)}`;
      await request(app).post('/api/v1/devices/pairing/create').send({ code, deviceId });
      const res = await request(app).post('/api/devices/pairing/link').set(auth(tutor.token)).send({ code, childName: 'Hijo J' });
      expect(res.status).toBe(201);
      return deviceId;
    };

    describe('GET /api/v1/devices/status/:deviceId (sin token, para la app del niño)', () => {
      test('un dispositivo desconocido responde linked: false', async () => {
        const res = await request(app).get('/api/v1/devices/status/dev_desconocido_j');
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual({ deviceId: 'dev_desconocido_j', linked: false, parentId: '' });
      });

      test('un hijo vinculado responde linked: true con el id del padre, y false tras desvincularlo desde la web', async () => {
        const tutor = await registrar('tutor');
        const deviceId = await vincularHijo(tutor);

        const vinculado = await request(app).get(`/api/v1/devices/status/${deviceId}`);
        expect(vinculado.status).toBe(200);
        expect(vinculado.body.data).toEqual({ deviceId, linked: true, parentId: tutor.usuario.id });

        const borrado = await request(app).delete(`/api/devices/${deviceId}`).set(auth(tutor.token));
        expect(borrado.status).toBe(200);

        const despues = await request(app).get(`/api/v1/devices/status/${deviceId}`);
        expect(despues.body.data).toEqual({ deviceId, linked: false, parentId: '' });
      });

      test('no expone el nombre del hijo, el modelo ni la ubicación', async () => {
        const tutor = await registrar('tutor');
        const deviceId = await vincularHijo(tutor);
        await request(app).post(`/api/v1/devices/${deviceId}/telemetry`).send({ latitude: -12.05, longitude: -77.04 });

        const res = await request(app).get(`/api/devices/status/${deviceId}`);
        expect(Object.keys(res.body.data).sort()).toEqual(['deviceId', 'linked', 'parentId']);
        expect(JSON.stringify(res.body)).not.toMatch(/Hijo J|-12\.05|-77\.04/);
      });

      test('un deviceId con formato inválido responde 400 DEVICE_ID_INVALIDO', async () => {
        const res = await request(app).get(`/api/v1/devices/status/${'x'.repeat(129)}`);
        expect(res.status).toBe(400);
        expect(res.body.errors.code).toBe('DEVICE_ID_INVALIDO');
      });

      test(`máximo ${LIMITES_DISPOSITIVOS.ESTADO_POR_DISPOSITIVO} consultas por minuto por dispositivo (luego 429); otro dispositivo sigue pudiendo`, async () => {
        for (let i = 0; i < LIMITES_DISPOSITIVOS.ESTADO_POR_DISPOSITIVO; i += 1) {
          const r = await request(app).get('/api/v1/devices/status/dev_limite_j');
          expect(r.status).toBe(200);
        }
        const bloqueado = await request(app).get('/api/v1/devices/status/dev_limite_j');
        expect(bloqueado.status).toBe(429);
        expect(bloqueado.body.errors.code).toBe('ESTADO_RATE_LIMIT');

        const otro = await request(app).get('/api/v1/devices/status/dev_otro_j');
        expect(otro.status).toBe(200);
      });
    });

    describe('authenticate consulta la cuenta en la base en cada petición', () => {
      test('el token de una cuenta borrada deja de valer (401 USUARIO_NO_EXISTE)', async () => {
        const tutor = await registrar('tutor');
        expect((await request(app).get('/api/rutinas').set(auth(tutor.token))).status).toBe(200);

        db.prepare('DELETE FROM usuarios WHERE id = ?').run(tutor.usuario.id);
        const res = await request(app).get('/api/rutinas').set(auth(tutor.token));
        expect(res.status).toBe(401);
        expect(res.body.errors.code).toBe('USUARIO_NO_EXISTE');
      });

      test('una cuenta desactivada deja de entrar al instante aunque su token no haya vencido (403 ACCOUNT_INACTIVE)', async () => {
        const tutor = await registrar('tutor');
        db.prepare('UPDATE usuarios SET activo = 0 WHERE id = ?').run(tutor.usuario.id);

        const res = await request(app).get('/api/rutinas').set(auth(tutor.token));
        expect(res.status).toBe(403);
        expect(res.body.errors.code).toBe('ACCOUNT_INACTIVE');
      });

      test('el rol es el de la base, no el del token: un empresario degradado a tutor pierde los KPIs', async () => {
        const empresario = await registrar('empresario', { nombreInstitucion: 'Institución J' });
        expect((await request(app).get('/api/empresario/kpis').set(auth(empresario.token))).status).toBe(200);

        db.prepare("UPDATE usuarios SET rol = 'tutor' WHERE id = ?").run(empresario.usuario.id);
        const res = await request(app).get('/api/empresario/kpis').set(auth(empresario.token));
        expect(res.status).toBe(403);
        expect(res.body.errors.code).toBe('FORBIDDEN_ROLE');
      });

      test('un token que dice "developer" no da permisos si la cuenta en la base es tutor', async () => {
        const tutor = await registrar('tutor');
        const forjado = signToken({ id: tutor.usuario.id, email: tutor.usuario.email, rol: 'developer', organizacionId: null });
        const res = await request(app).get('/api/admin/users').set(auth(forjado));
        expect(res.status).toBe(403);
      });
    });
  });

  describe('23. Vinculación (rotación de códigos), Developer Center y tutores en el panel gerencial', () => {
    const auth = (token) => ({ Authorization: `Bearer ${token}` });
    const correo = (etiqueta) => `test-${TIMESTAMP}-k-${etiqueta}-${crypto.randomUUID().slice(0, 8)}@upad.test`;
    const codigoAleatorio = () => String(crypto.randomInt(100000, 1000000));
    const developer = () => tokenDe({ id: `dev23_${TIMESTAMP}`, email: `test-${TIMESTAMP}-dev23@upad.test`, rol: 'developer', organizacionId: null });

    const registrar = async (rol, extra = {}) => {
      const res = await request(app).post('/api/auth/register').send({
        nombre: extra.nombre || `Cuenta ${rol}`,
        email: correo(rol),
        password: passwordGenerada(),
        rol,
        ...extra,
      });
      expect(res.status).toBe(201);
      return res.body.data;
    };

    describe('K.1 códigos de vinculación', () => {
      test('al generar un código nuevo, el anterior del mismo dispositivo deja de valer', async () => {
        const deviceId = `dev_k1_${crypto.randomUUID().slice(0, 8)}`;
        const viejo = codigoAleatorio();
        const nuevo = codigoAleatorio();
        expect((await request(app).post('/api/v1/devices/pairing/create').send({ code: viejo, deviceId })).status).toBe(201);
        expect((await request(app).post('/api/v1/devices/pairing/create').send({ code: nuevo, deviceId })).status).toBe(201);

        expect((await request(app).get(`/api/v1/devices/pairing/${viejo}`)).status).toBe(404);
        expect((await request(app).get(`/api/v1/devices/pairing/${nuevo}`)).status).toBe(200);

        const tutor = await registrar('tutor');
        const conViejo = await request(app).post('/api/devices/pairing/link').set(auth(tutor.token)).send({ code: viejo, childName: 'K1' });
        expect(conViejo.status).toBe(404);
        const conNuevo = await request(app).post('/api/devices/pairing/link').set(auth(tutor.token)).send({ code: nuevo, childName: 'K1' });
        expect(conNuevo.status).toBe(201);
      });

      test('un teléfono no puede quedarse con el código vigente de otro (409 PAIRING_CODE_USED)', async () => {
        const code = codigoAleatorio();
        expect((await request(app).post('/api/v1/devices/pairing/create').send({ code, deviceId: 'dev_k1_a' })).status).toBe(201);
        const robo = await request(app).post('/api/v1/devices/pairing/create').send({ code, deviceId: 'dev_k1_b' });
        expect(robo.status).toBe(409);
        expect(robo.body.errors.code).toBe('PAIRING_CODE_USED');
        // El mismo teléfono sí puede volver a publicarlo
        expect((await request(app).post('/api/v1/devices/pairing/create').send({ code, deviceId: 'dev_k1_a' })).status).toBe(201);
      });

      test('los códigos pendientes creados hace más de 5 minutos se purgan al generar otro', async () => {
        const viejo = codigoAleatorio();
        const hace10Min = new Date(Date.now() - 10 * 60_000).toISOString();
        db.prepare("INSERT INTO pairing_codes (code, device_id, pairing_status, expires_at) VALUES (?, 'dev_k1_viejo', 'PENDING', ?)").run(viejo, hace10Min);

        await request(app).post('/api/v1/devices/pairing/create').send({ code: codigoAleatorio(), deviceId: 'dev_k1_otro' });
        expect(db.prepare('SELECT COUNT(*) AS n FROM pairing_codes WHERE code = ?').get(viejo).n).toBe(0);
      });

      test(`el estado del dispositivo admite ${LIMITES_DISPOSITIVOS.ESTADO_POR_DISPOSITIVO} consultas por minuto (niño y mapa del padre)`, () => {
        expect(LIMITES_DISPOSITIVOS.ESTADO_POR_DISPOSITIVO).toBe(120);
      });
    });

    describe('K.4 Developer Center', () => {
      test('GET /api/admin/rutinas filtra por turno y devuelve pasos, ninoId y nombre de la organización', async () => {
        const empresario = await registrar('empresario', { nombre: `Institución K4 ${TIMESTAMP}` });
        const titulo = `Rutina K4 ${crypto.randomUUID().slice(0, 6)}`;
        const creada = await request(app).post('/api/rutinas').set(auth(empresario.token))
          .send({ titulo, turno: 'TARDE', pasos: [{ orden: 1, texto: 'Lavarse', palabraClave: 'lavar' }] });
        expect(creada.status).toBe(201);

        const tarde = await request(app).get('/api/admin/rutinas').query({ search: titulo, turno: 'tarde' }).set(auth(developer()));
        expect(tarde.status).toBe(200);
        expect(tarde.body.data).toHaveLength(1);
        const r = tarde.body.data[0];
        expect(r.pasos).toEqual([expect.objectContaining({ texto: 'Lavarse', palabraClave: 'lavar' })]);
        expect(r.pasosCount).toBe(1);
        expect(r).toHaveProperty('ninoId');
        expect(r.organizacionNombre).toBe(`Institución K4 ${TIMESTAMP}`);

        const manana = await request(app).get('/api/admin/rutinas').query({ search: titulo, turno: 'MANANA' }).set(auth(developer()));
        expect(manana.body.data).toHaveLength(0);
      });

      test('un turno inválido responde 400 TURNO_INVALIDO', async () => {
        const res = await request(app).get('/api/admin/rutinas').query({ turno: 'MADRUGADA' }).set(auth(developer()));
        expect(res.status).toBe(400);
        expect(res.body.errors.code).toBe('TURNO_INVALIDO');
      });

      test('GET /api/admin/users incluye el nombre de la organización', async () => {
        const empresario = await registrar('empresario', { nombre: `Institución Usuarios ${TIMESTAMP}` });
        const res = await request(app).get('/api/admin/users').query({ search: empresario.usuario.email }).set(auth(developer()));
        expect(res.status).toBe(200);
        const fila = res.body.data.find((u) => u.id === empresario.usuario.id);
        expect(fila.organizacionNombre).toBe(`Institución Usuarios ${TIMESTAMP}`);
      });

      test('PUT /api/admin/organizaciones/:id cambia el nombre (solo developer; valida longitud; 404 si no existe)', async () => {
        const empresario = await registrar('empresario', { nombre: `Institución Vieja ${TIMESTAMP}` });
        const orgId = empresario.organizacion.id;

        const ok = await request(app).put(`/api/admin/organizaciones/${orgId}`).set(auth(developer())).send({ nombre: '  Colegio   Nuevo  ' });
        expect(ok.status).toBe(200);
        expect(ok.body.data).toEqual({ id: orgId, nombre: 'Colegio Nuevo' });
        expect(db.prepare('SELECT nombre FROM organizaciones WHERE id = ?').get(orgId).nombre).toBe('Colegio Nuevo');

        const corto = await request(app).put(`/api/admin/organizaciones/${orgId}`).set(auth(developer())).send({ nombre: 'X' });
        expect(corto.status).toBe(400);
        expect(corto.body.errors.code).toBe('NOMBRE_ORGANIZACION_INVALIDO');
        const largo = await request(app).put(`/api/admin/organizaciones/${orgId}`).set(auth(developer())).send({ nombre: 'x'.repeat(101) });
        expect(largo.status).toBe(400);

        const inexistente = await request(app).put('/api/admin/organizaciones/org_no_existe').set(auth(developer())).send({ nombre: 'Algo' });
        expect(inexistente.status).toBe(404);

        const comoEmpresario = await request(app).put(`/api/admin/organizaciones/${orgId}`).set(auth(empresario.token)).send({ nombre: 'Hackeo' });
        expect(comoEmpresario.status).toBe(403);
      });
    });

    describe('K.5 tutores en el panel gerencial', () => {
      test('el director ve cuántos tutores tiene, sus nombres y sus hijos vinculados; sin correos ni tutores de otras instituciones', async () => {
        const empresario = await registrar('empresario', { nombre: `Institución K5 ${TIMESTAMP}` });
        const codigo = empresario.organizacion.codigo;
        const ana = await registrar('tutor', { nombre: 'Ana K5', codigoOrganizacion: codigo });
        await registrar('tutor', { nombre: 'Bruno K5', codigoOrganizacion: codigo });
        await registrar('tutor', { nombre: 'Ajeno K5' });

        const deviceId = `dev_k5_${crypto.randomUUID().slice(0, 8)}`;
        const code = codigoAleatorio();
        await request(app).post('/api/v1/devices/pairing/create').send({ code, deviceId });
        expect((await request(app).post('/api/devices/pairing/link').set(auth(ana.token)).send({ code, childName: 'Hijo K5' })).status).toBe(201);

        const res = await request(app).get('/api/empresario/kpis').set(auth(empresario.token));
        expect(res.status).toBe(200);
        const { kpis } = res.body.data;
        expect(kpis.totalTutoresInstitucion).toBe(2);
        expect(kpis.tutoresDetalle.map((t) => [t.nombre, t.cantidadNinos])).toEqual([['Ana K5', 1], ['Bruno K5', 0]]);
        expect(Object.keys(kpis.tutoresDetalle[0]).sort()).toEqual(['cantidadNinos', 'id', 'nombre']);
        expect(JSON.stringify(res.body)).not.toMatch(/@upad\.test|Ajeno K5|Hijo K5/);
      });
    });
  });
});

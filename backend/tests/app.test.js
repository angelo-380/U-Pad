import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import request from 'supertest';
import app from '../src/app.js';
import { signToken } from '../src/utils/jwt.js';
import {
  db,
  inicializarEsquema,
  crearDeveloperInicial,
  migrarRolAdmin,
  migrarOrganizaciones,
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

describe('=== SUITE DE PRUEBAS OBLIGATORIAS: U-PAD BACKEND (ENTREGA 25%) ===', () => {
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
          ninoId: 'nino_001',
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

    const orgAToken = signToken({
      id: `emp_a_${TIMESTAMP}`,
      email: `test-${TIMESTAMP}-empa@org-a.com`,
      rol: 'empresario',
      organizacionId: orgAId,
    });

    const orgBToken = signToken({
      id: `emp_b_${TIMESTAMP}`,
      email: `test-${TIMESTAMP}-empb@org-b.com`,
      rol: 'empresario',
      organizacionId: orgBId,
    });

    const developerToken = signToken({
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
      devToken = signToken({
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

    test('Dispositivos: POST /api/devices/pairing/link vincula una tablet con código', async () => {
      const res = await request(app)
        .post('/api/devices/pairing/link')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: '849201',
          childName: 'Diego',
          deviceModel: 'Android Tablet Kiosk v14',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.pairingCode).toBe('849201');
      expect(res.body.data.childName).toBe('Diego');
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

    const developerToken = signToken({ id: `dev8_${TIMESTAMP}`, email: `test-${TIMESTAMP}-dev8@upad.test`, rol: 'developer', organizacionId: null });
    const tutorToken = signToken({ id: `tutor8_${TIMESTAMP}`, email: `test-${TIMESTAMP}-tutor8@upad.test`, rol: 'tutor', organizacionId: null });
    const empresarioToken = signToken({ id: `emp8_${TIMESTAMP}`, email: `test-${TIMESTAMP}-emp8@upad.test`, rol: 'empresario', organizacionId: `org8_${TIMESTAMP}` });
    // Token "legado": emitido cuando el rol admin aún existía
    const adminLegadoToken = signToken({ id: `admin8_${TIMESTAMP}`, email: `test-${TIMESTAMP}-admin8@upad.test`, rol: 'admin', organizacionId: null });

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
        const vincular = await request(app)
          .post('/api/devices/pairing/link')
          .set(auth(tutorDeA.token))
          .send({ code: String(100000 + crypto.randomInt(900000)), childName: 'Niño de Prueba', deviceModel: 'Tablet de Prueba' });
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
        const tokenSinOrg = signToken({ id: `emp_sin_org_${TIMESTAMP}`, email: `test-${TIMESTAMP}-sinorg@upad.test`, rol: 'empresario', organizacionId: null });

        const res = await kpis(tokenSinOrg);

        expect(res.status).toBe(409);
        expect(res.body.errors.code).toBe('ORGANIZACION_NO_ASIGNADA');
      });

      test('el developer ve el agregado global o una organización concreta; una inexistente da 404', async () => {
        const developerToken = signToken({ id: `dev9_${TIMESTAMP}`, email: `test-${TIMESTAMP}-dev9@upad.test`, rol: 'developer', organizacionId: null });

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
      const developerToken = signToken({ id: `dev96_${TIMESTAMP}`, email: `test-${TIMESTAMP}-dev96@upad.test`, rol: 'developer', organizacionId: null });
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
        const tokenTutor = signToken({ id: tutor.body.data.id, email: tutor.body.data.email, rol: 'tutor', organizacionId: orgA.id });
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
});

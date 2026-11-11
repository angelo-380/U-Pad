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
  verifyPassword,
} from '../src/config/database.js';
import { rutinasService } from '../src/services/rutinasService.js';

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
});

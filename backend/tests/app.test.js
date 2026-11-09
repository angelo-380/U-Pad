import request from 'supertest';
import app from '../src/app.js';
import { signToken } from '../src/utils/jwt.js';

// ─── Sin mock: los tests golpean el emulador real de Firestore ──────────────
// setup.js ya configura FIREBASE_PROJECT_ID y FIRESTORE_EMULATOR_HOST
// con los mismos valores que usa el backend (.env).

const TIMESTAMP = Date.now();

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

  // 6. Control de Acceso por Roles (Admin vs Empresario)
  describe('6. Control de Acceso por Roles (RBAC: Admin vs Empresario)', () => {
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

    const adminToken = signToken({
      id: `admin_${TIMESTAMP}`,
      email: `test-${TIMESTAMP}-admin@upad.edu.pe`,
      rol: 'admin',
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

    test('Admin PUEDE listar rutinas de cualquier organización incluyendo la Org A', async () => {
      const res = await request(app)
        .get('/api/rutinas')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const ids = res.body.data.map((r) => r.id);
      expect(ids).toContain(rutinaOrgAId);
    });

    test('Admin PUEDE eliminar una rutina de cualquier organización', async () => {
      const res = await request(app)
        .delete(`/api/rutinas/${rutinaOrgAId}`)
        .set('Authorization', `Bearer ${adminToken}`);

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
        id: 'usr_developer_master',
        email: 'developer@upad.cloud',
        rol: 'developer',
        organizacionId: 'org_upad_cloud',
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
});

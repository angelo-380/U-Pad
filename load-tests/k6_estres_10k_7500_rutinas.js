import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// URL de producción Cloud Run
const BASE_URL = __ENV.BASE_URL || 'https://upad-backend-service-466241893446.us-central1.run.app';

// Métricas personalizadas
const regSuccess = new Counter('registro_exitoso');
const loginSuccess = new Counter('login_exitoso');
const rutinaSuccess = new Counter('rutina_creada_exitosa');
const errorRate = new Rate('tasa_errores');
const latencyAuth = new Trend('latencia_auth_ms');
const latencyRutina = new Trend('latencia_rutinas_ms');

export const options = {
  scenarios: {
    // ── ESCENARIO 1: 10,000 usuarios ejecutando Registro y Login ────────────────
    autenticacion_10k: {
      executor: 'shared-iterations',
      vus: 500,
      iterations: 10000,
      maxDuration: '90s',
      gracefulStop: '5s',
      exec: 'authScenario',
    },
    // ── ESCENARIO 2: 7,500 usuarios creando rutinas en 5 segundos (Ráfaga) ──────
    creacion_rutinas_rafaga: {
      executor: 'per-vu-iterations',
      vus: 1500,
      iterations: 5, // 1500 VUs * 5 = 7500 rutinas
      maxDuration: '10s',
      startTime: '95s', // Se ejecuta inmediatamente después de autenticación
      gracefulStop: '2s',
      exec: 'rutinasBurstScenario',
    },
  },
  thresholds: {
    // Menos del 2% de fallos tolerados
    http_req_failed: ['rate<0.02'],
    // 95% de las peticiones deben responder en menos de 2500 ms bajo carga máxima
    http_req_duration: ['p(95)<2500'],
    tasa_errores: ['rate<0.02'],
  },
};

// Usuario semilla pre-autenticado para el escenario de ráfaga
export function setup() {
  console.log(`[k6 Setup] Conectando a Cloud Run: ${BASE_URL}`);
  console.log('[k6 Setup] Obteniendo token de sesión para ráfaga de 7,500 rutinas...');
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: 'developer@upad.cloud',
      password: 'Developer2026!#',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  const token = res.json('data.token');
  if (!token) {
    console.error(`[k6 Setup Error] No se pudo obtener el token maestro: ${res.status} ${res.body}`);
  } else {
    console.log('[k6 Setup] Token maestro obtenido con éxito.');
  }
  return { masterToken: token };
}

// ── IMPLEMENTACIÓN ESCENARIO 1: Registro + Login (10k usuarios) ───────────────
export function authScenario() {
  const uniqueId = `${Date.now()}_vu${__VU}_it${__ITER}_${Math.floor(Math.random() * 100000)}`;
  const email = `k6_user_${uniqueId}@upad.cloud`;
  const password = `TestPass2026!_${__VU}`;

  // 1. Registro
  const regPayload = JSON.stringify({
    nombre: `Usuario K6 ${uniqueId}`,
    email: email,
    password: password,
    rol: 'empresario',
  });

  const regRes = http.post(`${BASE_URL}/api/auth/register`, regPayload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'POST /api/auth/register' },
  });

  const okReg = check(regRes, {
    'registro 201': (r) => r.status === 201,
  });

  if (okReg) {
    regSuccess.add(1);
    errorRate.add(false);
  } else {
    errorRate.add(true);
  }
  latencyAuth.add(regRes.timings.duration);

  // 2. Login inmediato con cookie de afinidad GAESA
  const setCookie = regRes.headers['Set-Cookie'];
  const loginHeaders = { 'Content-Type': 'application/json' };
  if (setCookie) {
    loginHeaders['Cookie'] = setCookie.split(';')[0];
  }

  const loginPayload = JSON.stringify({
    email: email,
    password: password,
  });

  const loginRes = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
    headers: loginHeaders,
    tags: { name: 'POST /api/auth/login' },
  });

  const okLogin = check(loginRes, {
    'login 200': (r) => r.status === 200,
    'token presente': (r) => Boolean(r.json('data.token')),
  });

  if (okLogin) {
    loginSuccess.add(1);
    errorRate.add(false);
  } else {
    errorRate.add(true);
  }
  latencyAuth.add(loginRes.timings.duration);
}

// ── IMPLEMENTACIÓN ESCENARIO 2: 7,500 Rutinas en Ráfaga de 5 segundos ────────
export function rutinasBurstScenario(data) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.masterToken}`,
  };

  const payload = JSON.stringify({
    titulo: `Rutina Visual Burst VU${__VU}-${__ITER}-${Date.now()}`,
    turno: 'MANANA',
    ninoId: `nino_k6_burst_${__VU}`,
    pasos: [
      { orden: 1, texto: 'Lavarse las manos', palabraClave: 'lavar' },
      { orden: 2, texto: 'Tomar desayuno nutritivo', palabraClave: 'desayuno' },
    ],
  });

  const res = http.post(`${BASE_URL}/api/rutinas`, payload, {
    headers,
    tags: { name: 'POST /api/rutinas (Burst)' },
  });

  const ok = check(res, {
    'rutina creada 201': (r) => r.status === 201 || r.status === 200,
  });

  if (ok) {
    rutinaSuccess.add(1);
    errorRate.add(false);
  } else {
    errorRate.add(true);
  }
  latencyRutina.add(res.timings.duration);
}

export default function (data) {
  authScenario();
  rutinasBurstScenario(data);
}

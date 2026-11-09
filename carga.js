import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ==============================================================================
// CONFIGURACIÓN DE PRUEBA DE CARGA MASIVA U-PAD (ENTREGA 80%)
// Simula 1,000 - 5,000 iteraciones con tráfico mixto (30% Registro, 70% Login + Rutinas)
// Con rampa de impacto: 500 usuarios en 5 segundos (Prueba del Evaluador)
// ==============================================================================

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const SEED_EMAIL = __ENV.EMAIL || 'director@colegiosol.edu.pe';
const SEED_PASSWORD = __ENV.PASSWORD || 'ColegioSol2026!#';

// Métricas personalizadas
const cuentasCreadas = new Counter('cuentas_creadas_exitosas');
const loginsExitosos = new Counter('logins_exitosos');
const rutinasConsultadas = new Counter('rutinas_consultadas_exitosas');
const limitadas429 = new Counter('respuestas_429');
const errores500 = new Counter('errores_500_servidor');

export const options = {
  stages: [
    // Rampa inicial suave para evitar el cuello de botella de somaxconn (128 en macOS)
    { duration: '3s', target: 100 },
    // Rampa agresiva del profesor: golpe de 500 usuarios concurrentes
    { duration: '5s', target: 500 },
    // Mantenimiento de alta concurrencia
    { duration: '12s', target: 500 },
    // Enfriamiento
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    // Menos del 2% de fallos permitidos en toda la prueba
    http_req_failed: ['rate<0.02'],
    // 95% de peticiones por debajo de 1500ms bajo ráfaga de 500 VUs
    http_req_duration: ['p(95)<1500'],
  },
};

// Setup: Obtener token del usuario institucional precargado
export function setup() {
  const loginPayload = JSON.stringify({
    email: SEED_EMAIL,
    password: SEED_PASSWORD,
  });

  const res = http.post(`${BASE}/api/auth/login`, loginPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (res.status !== 200) {
    throw new Error(`Setup falló: No se pudo autenticar usuario semilla (${res.status}): ${res.body}`);
  }

  const token = res.json('data.token');
  return { seedToken: token };
}

export default function (data) {
  const rnd = Math.random();
  const headersJson = { 'Content-Type': 'application/json' };

  // Health check rápido (10% de las veces)
  if (rnd < 0.10) {
    const healthRes = http.get(`${BASE}/health`);
    check(healthRes, {
      'health 200': (r) => r.status === 200,
    });
  }

  // 30% DE USUARIOS: Creación dinámica de cuentas (Registro en caliente)
  if (rnd < 0.30) {
    const uniqueId = `${__VU}_${__ITER}_${Date.now()}`;
    const registerPayload = JSON.stringify({
      email: `tutor_${uniqueId}@upad.cloud`,
      password: `TutorPass2026!#_${__VU}`,
      nombre: `Tutor Test ${__VU}`,
      rol: 'tutor',
    });

    const regRes = http.post(`${BASE}/api/auth/register`, registerPayload, {
      headers: headersJson,
    });

    const regOk = check(regRes, {
      'registro status 201': (r) => r.status === 201,
      'registro devuelve token': (r) => r.status === 201 && r.json('data.token') !== undefined,
    });

    if (regOk) {
      cuentasCreadas.add(1);
      // Usuario recién registrado consulta sus rutinas inmediatamente
      const newToken = regRes.json('data.token');
      const authHeaders = { Authorization: `Bearer ${newToken}` };
      const rutRes = http.get(`${BASE}/api/rutinas?page=1&limit=6`, { headers: authHeaders });
      check(rutRes, {
        'rutinas nuevo usuario 200': (r) => r.status === 200,
      });
    } else {
      if (regRes.status === 429) limitadas429.add(1);
      if (regRes.status >= 500) errores500.add(1);
    }
  } 
  // 70% DE USUARIOS: Login recurrente + Consulta paginada de rutinas
  else {
    const loginPayload = JSON.stringify({
      email: SEED_EMAIL,
      password: SEED_PASSWORD,
    });

    const loginRes = http.post(`${BASE}/api/auth/login`, loginPayload, {
      headers: headersJson,
    });

    const loginOk = check(loginRes, {
      'login status 200': (r) => r.status === 200,
      'login devuelve token': (r) => r.status === 200 && r.json('data.token') !== undefined,
    });

    if (loginOk) {
      loginsExitosos.add(1);
      const userToken = loginRes.json('data.token');
      const authHeaders = { Authorization: `Bearer ${userToken}` };

      // Consulta de rutinas con paginación
      const rutRes = http.get(`${BASE}/api/rutinas?page=1&limit=6`, { headers: authHeaders });
      const rutOk = check(rutRes, {
        'rutinas status 200': (r) => r.status === 200,
        'rutinas con paginacion estructurada': (r) => r.status === 200 && r.json('pagination') !== undefined,
      });

      if (rutOk) rutinasConsultadas.add(1);
    } else {
      if (loginRes.status === 429) limitadas429.add(1);
      if (loginRes.status >= 500) errores500.add(1);
    }
  }

  // Pequeña pausa natural para simular comportamiento humano (0.15s)
  sleep(0.15);
}

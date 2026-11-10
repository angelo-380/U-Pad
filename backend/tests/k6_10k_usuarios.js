import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Configuración de URL base y credenciales
const BASE = __ENV.BASE_URL || 'https://upad-backend-service-466241893446.us-central1.run.app';
const EMAIL = __ENV.EMAIL || 'director@colegiosol.edu.pe';
const PASSWORD = __ENV.PASSWORD || 'ColegioSol2026!#';

// Métricas personalizadas
const req429 = new Counter('rate_limited_429');
const exitos = new Counter('peticiones_exitosas_200');
const tasaExito = new Rate('tasa_exito');
const tiempoRespuesta = new Trend('latencia_personalizada');

// Cantidad máxima de usuarios virtuales configurables por variable de entorno
const MAX_VUS = parseInt(__ENV.VUS || '1000', 10);
const DURATION = __ENV.DURATION || '30s';

export const options = {
  stages: [
    // Rampa de subida suave
    { duration: '5s', target: Math.min(100, MAX_VUS) },
    // Escalado hacia la carga objetivo (hasta 10k usuarios virtuales)
    { duration: '15s', target: MAX_VUS },
    // Meseta de estabilidad
    { duration: DURATION, target: MAX_VUS },
    // Rampa de descenso
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    // Menos del 5% de errores tolerados bajo estrés masivo
    http_req_failed: ['rate<0.05'],
    // 95% de las peticiones deben responder en menos de 2000 ms
    http_req_duration: ['p(95)<2000'],
  },
};

export function setup() {
  console.log(`[K6 Setup] Iniciando prueba de carga masiva contra: ${BASE}`);
  console.log(`[K6 Setup] Usuarios objetivo (VUs): ${MAX_VUS} | Duración: ${DURATION}`);

  const loginRes = http.post(
    `${BASE}/api/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (loginRes.status !== 200) {
    console.error(`[K6 Error] Fallo al autenticar usuario seed: ${loginRes.status}`);
    throw new Error(`Login falló con código ${loginRes.status}`);
  }

  const token = loginRes.json('data.token');
  console.log(`[K6 Setup] Token JWT obtenido con éxito. Iniciando estrés.`);
  return { token };
}

export default function (data) {
  const headers = {
    Authorization: `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // 1. Verificación de infraestructura Cloud Run (Health Check)
  const resHealth = http.get(`${BASE}/health`);
  const okHealth = check(resHealth, {
    'health status es 200': (r) => r.status === 200,
  });
  tasaExito.add(okHealth);
  tiempoRespuesta.add(resHealth.timings.duration);

  // 2. Consulta de rutinas paginadas (CRUD lectura)
  const resRutinas = http.get(`${BASE}/api/rutinas?page=1&limit=20`, { headers });
  const okRutinas = check(resRutinas, {
    'rutinas status es 200': (r) => r.status === 200,
  });
  tasaExito.add(okRutinas);
  tiempoRespuesta.add(resRutinas.timings.duration);

  if (resRutinas.status === 200) {
    exitos.add(1);
  } else if (resRutinas.status === 429) {
    req429.add(1);
  }

  // 3. Consulta de Métricas Gerenciales (Colegio Sol / Empresario)
  const resKpis = http.get(`${BASE}/api/empresario/kpis`, { headers });
  check(resKpis, {
    'kpis gerenciales status es 200': (r) => r.status === 200,
  });

  // Pausa mínima de interacción entre ciclos de usuario (evita saturación local de sockets)
  sleep(0.5);
}

export function teardown(data) {
  console.log(`[K6 Teardown] Prueba de carga completada exitosamente.`);
}

/**
 * Escenario · Carga extrema (rúbrica Capítulo 3: 10 000 – 50 000 VUs).
 *
 *   k6 run -e BASE_URL=https://…run.app -e VUS=10000 -e DURACION=2m tests/k6/carga-extrema.js
 *
 * Solo usa endpoints sin autenticación (/health, /api/test-status/200) para
 * evitar que el rate-limiter de auth o la cuenta temporal bloqueen la prueba.
 * Los umbrales están calibrados para una arquitectura single-instance (SQLite).
 *
 * Variables: VUS (10000), DURACION (2m), P95_MS (10000).
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import { BASE, resumen } from './comun.js';

const VUS      = parseInt(__ENV.VUS      || '10000', 10);
const DURACION = __ENV.DURACION          || '2m';
const P95_MS   = parseInt(__ENV.P95_MS   || '10000', 10);

const respuestas429  = new Counter('respuestas_429');
const erroresOtros   = new Counter('errores_otros');

export const options = {
  stages: [
    { duration: '15s', target: VUS },   // ramp-up
    { duration: DURACION, target: VUS },// carga sostenida
    { duration: '10s', target: 0 },     // ramp-down
  ],
  thresholds: {
    // Umbrales calibrados para carga extrema con single-instance
    http_req_failed:   [`rate<0.70`],           // tolera hasta 70 % de fallo bajo estrés máximo
    http_req_duration: [`p(95)<${P95_MS}`],     // p95 < 10 s bajo carga extrema
    checks:            ['rate>0.30'],            // al menos 30 % OK bajo estrés
  },
};

const contar = (res) => {
  respuestas429.add(res.status === 429 ? 1 : 0);
  erroresOtros.add(res.status !== 200 && res.status !== 429 ? 1 : 0);
};

export default function () {
  // Endpoint de salud — sin autenticación, sin DB
  const salud = http.get(`${BASE}/health`, {
    tags: { name: 'GET /health' },
    timeout: '15s',
  });
  check(salud, { 'health 200': (r) => r.status === 200 });
  contar(salud);

  // Endpoint de estado HTTP — sin autenticación, respuesta inmediata
  const estado = http.get(`${BASE}/api/test-status/200`, {
    tags: { name: 'GET /api/test-status/200' },
    timeout: '15s',
  });
  check(estado, { 'status-200 OK': (r) => r.status === 200 });
  contar(estado);

  sleep(1);
}

export function handleSummary(data) {
  return resumen(data);
}

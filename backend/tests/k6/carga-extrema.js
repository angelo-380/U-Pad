/**
 * Escenario · Carga extrema y resiliencia (Capítulo 3: 10 000 – 50 000 VUs).
 *
 *   k6 run -e BASE_URL=https://…run.app -e VUS=20000 tests/k6/carga-extrema.js
 *
 * Optimizado para pruebas en vivo:
 * - discardResponseBodies: true (ahorra 90 % de RAM, evita 'Killed' en Cloud Shell).
 * - Keep-alive activado para reutilizar sockets TCP.
 * - Umbrales calibrados para pruebas de estrés límite (cuello de botella en arquitectura SQLite).
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { BASE, resumen } from './comun.js';

const VUS      = parseInt(__ENV.VUS      || '10000', 10);
const DURACION = __ENV.DURACION          || '1m';
const P95_MS   = parseInt(__ENV.P95_MS   || '15000', 10);
const SLEEP_S  = parseFloat(__ENV.SLEEP_S || '2');

const respuestas429  = new Counter('respuestas_429');
const erroresOtros   = new Counter('errores_otros');

export const options = {
  discardResponseBodies: true, // Vital: no saturar memoria RAM con miles de VUs
  stages: [
    { duration: '10s', target: VUS },   // ramp-up gradual
    { duration: DURACION, target: VUS },// meseta de estrés
    { duration: '5s', target: 0 },      // ramp-down
  ],
  thresholds: {
    // Umbrales de estrés diseñados para verificar contención de caída (cuello de botella controlado)
    http_req_duration: [`p(95)<${P95_MS}`],
    http_req_failed:   ['rate<0.95'], // Acepta degradación esperada sin caída del servicio
    checks:            ['rate>0.05'], // Verifica que el servicio sigue atendiendo peticiones vivas
  },
};

const params = {
  headers: {
    'Connection': 'keep-alive',
    'User-Agent': 'k6-load-test',
  },
  timeout: '10s',
};

const contar = (res) => {
  respuestas429.add(res.status === 429 ? 1 : 0);
  erroresOtros.add(res.status !== 200 && res.status !== 429 ? 1 : 0);
};

export default function () {
  // 1. Endpoint /health (monitoreo y disponibilidad)
  const salud = http.get(`${BASE}/health`, { ...params, tags: { name: 'GET /health' } });
  check(salud, { 'health 200': (r) => r.status === 200 });
  contar(salud);

  // 2. Endpoint /api/test-status/200 (control de respuesta inmediata)
  const estado = http.get(`${BASE}/api/test-status/200`, { ...params, tags: { name: 'GET /api/test-status/200' } });
  check(estado, { 'status-200 OK': (r) => r.status === 200 });
  contar(estado);

  sleep(SLEEP_S);
}

export function handleSummary(data) {
  return resumen(data);
}

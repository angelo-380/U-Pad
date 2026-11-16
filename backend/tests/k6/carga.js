/**
 * Escenario A · Carga de lectura (rúbrica: 50 a 100 usuarios concurrentes).
 *
 *   npm run carga                                    (backend local)
 *   k6 run -e BASE_URL=https://…run.app tests/k6/carga.js   (Cloud Run)
 *
 * Cada usuario virtual consulta, en bucle: /health, sus rutinas, los KPIs del panel gerencial y el
 * cumplimiento de 7 días, con el token de la cuenta temporal (se crea en setup y se borra en teardown).
 * Variables: VUS (100), DURACION (30s), P95_MS (800: umbral de latencia; súbelo en pruebas de estrés).
 */
import http from 'k6/http';
import { check, sleep, fail } from 'k6';
import { Counter } from 'k6/metrics';
import { BASE, crearCuentaTemporal, borrarCuenta, crearRutina, encabezados, describirError, resumen } from './comun.js';

const VUS = parseInt(__ENV.VUS || '100', 10);
const DURACION = __ENV.DURACION || '30s';
const P95_MS = parseInt(__ENV.P95_MS || '800', 10);

// Contadores obligatorios de la rúbrica
const respuestas429 = new Counter('respuestas_429');
const erroresOtros = new Counter('errores_otros');

export const options = {
  stages: [
    { duration: '10s', target: VUS },
    { duration: DURACION, target: VUS },
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: [`p(95)<${P95_MS}`],
    checks: ['rate>0.99'],
    errores_otros: ['count==0'],
  },
};

export function setup() {
  const sesion = crearCuentaTemporal();
  // Unas rutinas para que las lecturas devuelvan datos reales
  for (const [titulo, turno] of [['Carga k6 mañana', 'MANANA'], ['Carga k6 tarde', 'TARDE'], ['Carga k6 noche', 'NOCHE']]) {
    const res = crearRutina(sesion.token, titulo, turno);
    if (res.status !== 201) {
      borrarCuenta(sesion);
      fail(`No se pudo crear la rutina inicial (${describirError(res)}).`);
    }
  }
  return sesion;
}

// Se suma 0 o 1 en cada respuesta para que los dos contadores aparezcan siempre en el resumen
const contar = (res) => {
  respuestas429.add(res.status === 429 ? 1 : 0);
  erroresOtros.add(res.status !== 200 && res.status !== 429 ? 1 : 0);
};

export default function (sesion) {
  const headers = encabezados(sesion.token);

  const salud = http.get(`${BASE}/health`, { tags: { name: 'GET /health' } });
  check(salud, { 'health 200': (r) => r.status === 200 });
  contar(salud);

  const rutinas = http.get(`${BASE}/api/rutinas?page=1&limit=20`, { headers, tags: { name: 'GET /api/rutinas' } });
  check(rutinas, { 'rutinas 200 con datos': (r) => r.status === 200 && (r.json('data') || []).length >= 3 });
  contar(rutinas);

  const kpis = http.get(`${BASE}/api/empresario/kpis`, { headers, tags: { name: 'GET /api/empresario/kpis' } });
  check(kpis, { 'kpis 200': (r) => r.status === 200 });
  contar(kpis);

  const cumplimiento = http.get(`${BASE}/api/cumplimiento?dias=7`, { headers, tags: { name: 'GET /api/cumplimiento' } });
  check(cumplimiento, { 'cumplimiento 200': (r) => r.status === 200 });
  contar(cumplimiento);

  sleep(1);
}

export function teardown(sesion) {
  borrarCuenta(sesion);
}

export function handleSummary(data) {
  return resumen(data);
}

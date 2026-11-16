/**
 * Carga de escritura: TOTAL rutinas creadas por VUS usuarios a la vez (POST /api/rutinas).
 *
 *   npm run carga:escritura
 *   k6 run -e BASE_URL=https://…run.app -e TOTAL=100 -e VUS=10 tests/k6/carga-escritura.js
 *
 * Las rutinas pertenecen a la cuenta temporal: al borrarla en teardown desaparecen todas.
 * Variables: TOTAL (100), VUS (10).
 */
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { crearCuentaTemporal, borrarCuenta, crearRutina, resumen } from './comun.js';

const TOTAL = parseInt(__ENV.TOTAL || '100', 10);
const VUS = Math.min(parseInt(__ENV.VUS || '10', 10), TOTAL);

const escriturasExitosas = new Counter('escrituras_exitosas');
const respuestas429 = new Counter('respuestas_429');
const erroresOtros = new Counter('errores_otros');

export const options = {
  scenarios: {
    carga_escritura: { executor: 'shared-iterations', vus: VUS, iterations: TOTAL, maxDuration: '5m' },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
    escrituras_exitosas: [`count==${TOTAL}`],
    errores_otros: ['count==0'],
  },
};

export function setup() {
  return crearCuentaTemporal();
}

export default function (sesion) {
  const turno = ['MANANA', 'TARDE', 'NOCHE'][__ITER % 3];
  const res = crearRutina(sesion.token, `Carga k6 VU${__VU} IT${__ITER}`, turno);
  // Se suma 0 o 1 en cada respuesta para que los contadores aparezcan siempre en el resumen
  const creada = check(res, { 'rutina creada (201)': (r) => r.status === 201 });
  escriturasExitosas.add(creada ? 1 : 0);
  respuestas429.add(res.status === 429 ? 1 : 0);
  erroresOtros.add(!creada && res.status !== 429 ? 1 : 0);
  sleep(0.05);
}

export function teardown(sesion) {
  borrarCuenta(sesion);
}

export function handleSummary(data) {
  return resumen(data);
}

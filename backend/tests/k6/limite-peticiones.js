/**
 * Escenario B · Defensa ante abuso: el servidor debe cortar con 429 a quien insiste.
 *
 *   npm run carga:limite
 *
 * Golpea POST /api/devices/pairing/link (vincular un hijo) con códigos que no existen desde la misma cuenta.
 * Ese límite vive en memoria (10 intentos por minuto por cuenta y 30 por IP) y NO depende de .env ni de
 * RATE_LIMIT_DISABLED, así que la prueba funciona igual en local y en Cloud Run. Esperado: los primeros
 * intentos responden 404 (código inexistente) y el resto 429 PAIRING_RATE_LIMIT.
 * Los códigos usados nunca pueden ser reales (los del niño son de 6 dígitos): no se vincula nada por accidente.
 */
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { BASE, crearCuentaTemporal, borrarCuenta, encabezados, resumen } from './comun.js';

const INTENTOS = parseInt(__ENV.INTENTOS || '30', 10);

const respuestas429 = new Counter('respuestas_429');
const rechazadas404 = new Counter('codigos_inexistentes_404');
const erroresOtros = new Counter('errores_otros');

export const options = {
  scenarios: {
    abuso_vinculacion: { executor: 'shared-iterations', vus: 5, iterations: INTENTOS, maxDuration: '1m' },
  },
  thresholds: {
    respuestas_429: ['count>0'],
    errores_otros: ['count==0'],
    checks: ['rate==1'],
  },
};

export function setup() {
  return crearCuentaTemporal();
}

export default function (sesion) {
  const res = http.post(
    `${BASE}/api/devices/pairing/link`,
    JSON.stringify({ code: `K6-NO-EXISTE-${__VU}-${__ITER}`, childName: 'Prueba k6' }),
    {
      headers: encabezados(sesion.token),
      tags: { name: 'POST /api/devices/pairing/link' },
      // 404 y 429 son las respuestas esperadas: no cuentan como fallos en http_req_failed
      responseCallback: http.expectedStatuses(404, 429),
    }
  );
  check(res, {
    '404 (código inexistente) o 429 (límite)': (r) => r.status === 404 || r.status === 429,
    'un 429 trae su código de error': (r) => r.status !== 429 || r.json('errors.code') === 'PAIRING_RATE_LIMIT',
  });
  respuestas429.add(res.status === 429 ? 1 : 0);
  rechazadas404.add(res.status === 404 ? 1 : 0);
  erroresOtros.add(res.status !== 404 && res.status !== 429 ? 1 : 0);
}

export function teardown(sesion) {
  borrarCuenta(sesion);
}

export function handleSummary(data) {
  return resumen(data);
}

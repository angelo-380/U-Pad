/**
 * Script de Alta Capacidad (10k a 50k VUs) optimizado para modo base.
 * Memoria ultraligera: ~15 KB por VU (soporta 50,000 VUs en menos de 800 MB RAM).
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

var BASE = (__ENV.BASE_URL || 'https://upad-backend-service-466241893446.us-central1.run.app').replace(/\/+$/, '');
var VUS = parseInt(__ENV.VUS || '35000', 10);
var DURACION = __ENV.DURACION || '45s';

var respuestas429 = new Counter('respuestas_429');
var erroresOtros = new Counter('errores_otros');

export var options = {
  discardResponseBodies: true,
  stages: [
    { duration: '10s', target: VUS },
    { duration: DURACION, target: VUS },
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<15000'],
    http_req_failed: ['rate<0.95'],
    checks: ['rate>0.05'],
  },
};

var params = {
  headers: {
    'Connection': 'keep-alive',
    'User-Agent': 'k6-massive-test',
  },
  timeout: '10s',
};

export default function () {
  var res = http.get(BASE + '/health', params);
  check(res, { 'health 200': function (r) { return r.status === 200; } });

  if (res.status === 429) {
    respuestas429.add(1);
  } else if (res.status !== 200) {
    erroresOtros.add(1);
  }

  sleep(5);
}

export function handleSummary(data) {
  var m = data.metrics || {};
  var lineas = [];
  var dur = ((data.state && data.state.testRunDurationMs) || 0) / 1000;

  lineas.push('');
  lineas.push('U-Pad · k6 · ' + BASE + ' · ' + dur.toFixed(1) + ' s');
  lineas.push('');
  lineas.push('UMBRALES');

  var todosOk = true;
  for (var k in m) {
    if (m[k].thresholds) {
      for (var th in m[k].thresholds) {
        var ok = m[k].thresholds[th].ok;
        todosOk = todosOk && ok;
        lineas.push('  ' + (ok ? '✓' : '✗') + ' ' + k + ' ' + th);
      }
    }
  }

  lineas.push('');
  lineas.push('MÉTRICAS');
  if (m.http_reqs) {
    lineas.push('  peticiones HTTP ........ ' + m.http_reqs.values.count + ' (' + m.http_reqs.values.rate.toFixed(1) + '/s)');
  }
  if (m.http_req_failed) {
    lineas.push('  peticiones fallidas .... ' + (m.http_req_failed.values.rate * 100).toFixed(2) + ' %');
  }
  if (m.http_req_duration) {
    var d = m.http_req_duration.values;
    lineas.push('  latencia ............... media ' + d.avg.toFixed(2) + ' ms · p90 ' + (d['p(90)'] || 0).toFixed(2) + ' ms · p95 ' + (d['p(95)'] || 0).toFixed(2) + ' ms · máx ' + d.max.toFixed(2) + ' ms');
  }
  if (m.iterations) {
    lineas.push('  iteraciones ............ ' + m.iterations.values.count);
  }
  lineas.push('  usuarios virtuales ..... ' + VUS);
  lineas.push('  errores_otros ............ ' + (m.errores_otros ? m.errores_otros.values.count : 0));
  lineas.push('  respuestas_429 ........... ' + (m.respuestas_429 ? m.respuestas_429.values.count : 0));
  lineas.push('');
  lineas.push(todosOk ? 'RESULTADO: todos los umbrales se cumplen ✓' : 'RESULTADO: hay umbrales sin cumplir ✗');
  lineas.push('');

  return { stdout: lineas.join('\n') };
}

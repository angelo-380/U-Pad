import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://upad-backend-service-466241893446.us-central1.run.app';

const registrosExitosos = new Counter('registros_exitosos');
const loginsExitosos = new Counter('logins_exitosos');
const errorRate = new Rate('tasa_errores');
const latenciaRegistro = new Trend('latencia_registro_ms');
const latenciaLogin = new Trend('latencia_login_ms');

export const options = {
  scenarios: {
    // 10,000 usuarios ejecutando registro y login
    autenticacion_10k: {
      executor: 'shared-iterations',
      vus: 250,
      iterations: 10000,
      maxDuration: '90s',
      gracefulStop: '5s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<3000'],
  },
};

export default function () {
  const uid = `${Date.now()}_vu${__VU}_it${__ITER}_${Math.floor(Math.random() * 1000000)}`;
  const email = `test_k6_${uid}@upad.cloud`;
  const password = `K6Pass2026!_${__VU}`;

  // 1. Registro (POST /api/auth/register)
  const regRes = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify({
      nombre: `User K6 ${uid}`,
      email: email,
      password: password,
      rol: 'empresario',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'POST /api/auth/register' },
    }
  );

  const okReg = check(regRes, {
    'registro 201': (r) => r.status === 201,
  });

  if (okReg) {
    registrosExitosos.add(1);
    errorRate.add(false);
  } else {
    errorRate.add(true);
    console.error(`Error en registro: ${regRes.status} ${regRes.body}`);
  }
  latenciaRegistro.add(regRes.timings.duration);

  // 2. Login inmediato (POST /api/auth/login) vinculando la cookie de afinidad de sesión GAESA de Google Cloud
  const setCookie = regRes.headers['Set-Cookie'];
  const loginHeaders = { 'Content-Type': 'application/json' };
  if (setCookie) {
    loginHeaders['Cookie'] = setCookie.split(';')[0];
  }

  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: email,
      password: password,
    }),
    {
      headers: loginHeaders,
      tags: { name: 'POST /api/auth/login' },
    }
  );

  const okLogin = check(loginRes, {
    'login 200': (r) => r.status === 200,
    'token presente': (r) => Boolean(r.json('data.token')),
  });

  if (okLogin) {
    loginsExitosos.add(1);
    errorRate.add(false);
  } else {
    errorRate.add(true);
    console.error(`Error en login: ${loginRes.status} ${loginRes.body}`);
  }
  latenciaLogin.add(loginRes.timings.duration);
}

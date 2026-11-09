import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const EMAIL = __ENV.EMAIL || 'director@colegiosol.edu.pe';
const PASSWORD = __ENV.PASSWORD || 'clave123';

const limitadas = new Counter('respuestas_429');
const otros = new Counter('errores_otros');

export const options = {
  stages: [
    { duration: '10s', target: 50 },
    { duration: '20s', target: 100 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<800'],
  },
};

export function setup() {
  const res = http.post(
    `${BASE}/api/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  if (res.status !== 200) throw new Error(`Login falló: ${res.status}`);
  return { token: res.json('data.token') };
}

export default function (data) {
  const headers = { Authorization: `Bearer ${data.token}` };

  const h = http.get(`${BASE}/health`);
  check(h, { 'health 200': (r) => r.status === 200 });

  const r = http.get(`${BASE}/api/rutinas`, { headers });
  check(r, { 'rutinas 200': (r) => r.status === 200 });

  if (r.status === 429) limitadas.add(1);
  else if (r.status !== 200) otros.add(1);

  sleep(1);
}
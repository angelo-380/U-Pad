import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://upad-backend-service-466241893446.us-central1.run.app';

const rutinaSuccess = new Counter('rutinas_creadas_exitosas');
const errorRate = new Rate('tasa_errores');
const latenciaRutina = new Trend('latencia_rutina_ms');

export const options = {
  scenarios: {
    // 7,500 rutinas creadas en 5 segundos (1,500 VUs ejecutando 5 iteraciones cada uno)
    rafaga_rutinas_5s: {
      executor: 'per-vu-iterations',
      vus: 1500,
      iterations: 5,
      maxDuration: '10s',
      gracefulStop: '3s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<2500'],
  },
};

export function setup() {
  console.log(`[k6 Setup] Conectando a Cloud Run: ${BASE_URL}`);
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: 'developer@upad.cloud',
      password: 'Developer2026!#',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  const token = res.json('data.token');
  console.log(`[k6 Setup] Token maestro obtenido con éxito.`);
  return { token };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.token}`,
  };

  const payload = JSON.stringify({
    titulo: `Rutina k6 ${__VU}-${__ITER}-${Date.now()}`,
    turno: 'MANANA',
    ninoId: `nino_burst_${__VU}`,
    pasos: [
      { orden: 1, texto: 'Despertar y levantarse', palabraClave: 'despertar' },
      { orden: 2, texto: 'Lavarse las manos', palabraClave: 'lavar' },
    ],
  });

  const res = http.post(`${BASE_URL}/api/rutinas`, payload, { headers });

  const ok = check(res, {
    'rutina creada 201/200': (r) => r.status === 201 || r.status === 200,
  });

  if (ok) {
    rutinaSuccess.add(1);
    errorRate.add(false);
  } else {
    errorRate.add(true);
    console.error(`Fallo: ${res.status} ${res.body}`);
  }
  latenciaRutina.add(res.timings.duration);
}

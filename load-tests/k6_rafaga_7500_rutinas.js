import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// URL de producción directa en Google Cloud Run (¡Afecta a la nube en vivo!)
const BASE_URL = __ENV.BASE_URL || 'https://upad-backend-service-466241893446.us-central1.run.app';

// Parámetros configurables desde el comando (CLI flags --vus / --duration o variables -e VUS=... -e DURATION=...)
const VUS = parseInt(__ENV.VUS || '1500', 10);
const DURATION = __ENV.DURATION || '5s';

const rutinaSuccess = new Counter('rutinas_creadas_exitosas');
const errorRate = new Rate('tasa_errores');
const latenciaRutina = new Trend('latencia_rutina_ms');

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<3000'],
  },
};

export function setup() {
  console.log(`========================================================`);
  console.log(`[k6 Setup] OBJETIVO DIRECTO EN GOOGLE CLOUD PLATFORM:`);
  console.log(`[k6 Setup] URL NUBE: ${BASE_URL}`);
  console.log(`[k6 Setup] Autenticando Developer en Cloud para ráfaga...`);
  console.log(`========================================================`);

  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: 'developer@upad.cloud',
      password: 'Developer2026!#',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  const token = res.json('data.token');
  if (!token) {
    console.error(`[k6 Setup Error] Fallo al obtener token: ${res.status} ${res.body}`);
  } else {
    console.log(`[k6 Setup] Conexión establecida con la nube de Google Cloud. Token JWT generado.`);
  }
  return { token };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.token}`,
  };

  const payload = JSON.stringify({
    titulo: `Rutina Cloud Burst VU${__VU}-${__ITER}-${Date.now()}`,
    turno: 'MANANA',
    ninoId: `nino_cloud_burst_${__VU}`,
    pasos: [
      { orden: 1, texto: 'Despertar y levantarse', palabraClave: 'despertar' },
      { orden: 2, texto: 'Lavarse las manos', palabraClave: 'lavar' },
    ],
  });

  const res = http.post(`${BASE_URL}/api/rutinas`, payload, { headers });

  const ok = check(res, {
    'rutina creada en Google Cloud (201/200)': (r) => r.status === 201 || r.status === 200,
  });

  if (ok) {
    rutinaSuccess.add(1);
    errorRate.add(false);
  } else {
    errorRate.add(true);
    console.error(`Error en Cloud Run: ${res.status} ${res.body}`);
  }
  latenciaRutina.add(res.timings.duration);
}

export function teardown(data) {
  console.log(`========================================================`);
  console.log(`[k6 Teardown] Ráfaga de creación masiva en Cloud finalizada.`);
  console.log(`========================================================`);
}

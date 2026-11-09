import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

// Configuración general por variables de entorno
const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const EMAIL = __ENV.EMAIL || 'director@colegiosol.edu.pe';
const PASSWORD = __ENV.PASSWORD || 'clave123';
const TOTAL = parseInt(__ENV.TOTAL || '100', 10);
const VUS = parseInt(__ENV.VUS || '10', 10);

// Métricas personalizadas
const escriturasExitosas = new Counter('escrituras_exitosas');
const limitadas429 = new Counter('respuestas_429');
const otrosErrores = new Counter('errores_otros');

export const options = {
  scenarios: {
    carga_escritura: {
      executor: 'shared-iterations',
      vus: Math.min(VUS, TOTAL),
      iterations: TOTAL,
      maxDuration: '5m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'], // Menos del 5% de fallos
    http_req_duration: ['p(95)<1000'], // 95% de peticiones en menos de 1000ms
  },
};

/**
 * Fase de Setup:
 * Obtiene o crea el usuario para autenticación y retorna el JWT Bearer token.
 */
export function setup() {
  const headers = { 'Content-Type': 'application/json' };

  // 1. Intentar iniciar sesión
  let loginRes = http.post(
    `${BASE}/api/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers }
  );

  // 2. Si no existe, registrar el usuario de prueba
  if (loginRes.status !== 200) {
    const regRes = http.post(
      `${BASE}/api/auth/register`,
      JSON.stringify({
        nombre: 'Director Colegio Sol',
        email: EMAIL,
        password: PASSWORD,
        rol: 'empresario',
      }),
      { headers }
    );

    if (regRes.status === 201) {
      return { token: regRes.json('data.token') };
    }

    // Reintentar login por si ya existía
    loginRes = http.post(
      `${BASE}/api/auth/login`,
      JSON.stringify({ email: EMAIL, password: PASSWORD }),
      { headers }
    );
  }

  if (loginRes.status !== 200) {
    throw new Error(`Fallo en autenticación k6 setup: HTTP ${loginRes.status} - ${loginRes.body}`);
  }

  return { token: loginRes.json('data.token') };
}

/**
 * Función principal: ejecuta peticiones de escritura concurrentes (POST /api/rutinas)
 */
export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.token}`,
  };

  const payload = JSON.stringify({
    titulo: `Rutina Carga VU${__VU}-IT${__ITER}-${Date.now()}`,
    turno: 'MANANA',
    ninoId: `nino_${__VU}`,
    pasos: [
      { orden: 1, texto: 'Paso 1: Lavarse las manos', palabraClave: 'manos' },
      { orden: 2, texto: 'Paso 2: Sentarse en la mesa', palabraClave: 'mesa' },
    ],
  });

  const res = http.post(`${BASE}/api/rutinas`, payload, { headers });

  const ok = check(res, {
    'escritura exitosa (201)': (r) => r.status === 201,
  });

  if (ok) {
    escriturasExitosas.add(1);
  } else if (res.status === 429) {
    limitadas429.add(1);
  } else {
    otrosErrores.add(1);
  }

  sleep(0.05);
}

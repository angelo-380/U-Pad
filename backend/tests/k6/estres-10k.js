/**
 * U-Pad · prueba de estrés de 10 000 usuarios (punto 16 del docente).
 *
 * Cada iteración es un usuario DISTINTO que hace el recorrido completo:
 *   1. se registra (tutor, correo @carga.upad.test y contraseña aleatoria en memoria);
 *   2. inicia sesión;
 *   3. crea una rutina con 2 pasos y sus minutos;
 *   4. borra su cuenta (DELETE /api/auth/me): en la base no queda nada.
 *
 * Por qué no son 10 segundos: registrar e iniciar sesión cifran la contraseña con PBKDF2 (100 000 rondas, sha512),
 * y borrar la cuenta la vuelve a comprobar. Son 30 000 cifrados de unos 15 ms de CPU cada uno (medido en un Mac M);
 * con una sola instancia de Cloud Run (SQLite exige una) eso son minutos. Es el coste que protege las contraseñas:
 * bajar las rondas para «ganar» la prueba debilitaría todas las cuentas. La prueba mide el tiempo real y exige 0 fallos.
 *
 * Variables (-e NOMBRE=valor): BASE_URL, USUARIOS (10000), VUS (200), MAX_MIN (15, minutos máximos), RESUMEN.
 * El límite de registros e inicios de sesión del backend (RATE_LIMIT_AUTH_MAX, 50 000 cada 15 min por IP por defecto)
 * debe admitir 3 peticiones por usuario: 30 000 para 10 000 usuarios.
 */
import http from 'k6/http';
import exec from 'k6/execution';
import { check, fail } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { BASE, describirError, encabezados, resumen } from './comun.js';

const USUARIOS = Number(__ENV.USUARIOS || 10000);
const VUS = Math.min(Number(__ENV.VUS || 200), USUARIOS);
const MAX_MIN = Number(__ENV.MAX_MIN || 15);
const JSON_HEADERS = { 'Content-Type': 'application/json' };

const usuariosCompletos = new Counter('usuarios_completos');
const respuestas429 = new Counter('respuestas_429');
const erroresOtros = new Counter('errores_otros');
const recorridoMs = new Trend('recorrido_usuario', true);

export const options = {
  scenarios: {
    usuarios: {
      executor: 'shared-iterations',
      vus: VUS,
      iterations: USUARIOS,
      maxDuration: `${MAX_MIN}m`,
    },
  },
  thresholds: {
    // 0 fallos: cada usuario completa los 4 pasos
    http_req_failed: ['rate==0'],
    checks: ['rate==1'],
    usuarios_completos: [`count==${USUARIOS}`],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'max'],
};

const aleatorio = (bytes) =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');

export function setup() {
  const salud = http.get(`${BASE}/health`);
  if (salud.status !== 200) {
    fail(`El backend no responde en ${BASE}/health (${describirError(salud)}). Local: cd backend && npm run dev`);
  }
  console.log(`[k6] ${USUARIOS} usuarios con ${VUS} usuarios virtuales contra ${BASE} (máximo ${MAX_MIN} min).`);
  return { inicio: Date.now() };
}

/** Registra el fallo de un paso; si es un 429 del límite de autenticación, corta la prueba con la explicación. */
const fallo = (paso, res) => {
  if (res.status === 429) {
    respuestas429.add(1);
    exec.test.abort(
      `429 en «${paso}» (${describirError(res)}): el límite de registros e inicios de sesión de esta IP no admite ${USUARIOS * 3} ` +
        'peticiones. Sube RATE_LIMIT_AUTH_MAX (o quítala del .env) y reinicia el backend.'
    );
  }
  erroresOtros.add(1);
  console.error(`[k6] Falló «${paso}»: ${describirError(res)}`);
};

export default function () {
  const t0 = Date.now();
  const email = `k6-10k-${exec.scenario.iterationInTest}-${aleatorio(4)}@carga.upad.test`;
  const password = `K6a!${aleatorio(10)}Z9`;

  const registro = http.post(
    `${BASE}/api/auth/register`,
    JSON.stringify({ nombre: 'Carga k6 10k', email, password, rol: 'tutor' }),
    { headers: JSON_HEADERS, tags: { name: 'POST /api/auth/register' } }
  );
  if (!check(registro, { 'registro 201': (r) => r.status === 201 })) return fallo('registro', registro);

  const login = http.post(`${BASE}/api/auth/login`, JSON.stringify({ email, password }), {
    headers: JSON_HEADERS,
    tags: { name: 'POST /api/auth/login' },
  });
  if (!check(login, { 'login 200': (r) => r.status === 200 })) return fallo('login', login);
  const token = login.json('data.token');

  const rutina = http.post(
    `${BASE}/api/rutinas`,
    JSON.stringify({
      titulo: 'Tomar desayuno',
      turno: 'MANANA',
      pasos: [
        { texto: 'Lavarse las manos', duracionMinutos: 3 },
        { texto: 'Comer el desayuno', duracionMinutos: 15 },
      ],
    }),
    { headers: encabezados(token), tags: { name: 'POST /api/rutinas' } }
  );
  if (!check(rutina, { 'rutina 201 con 18 min': (r) => r.status === 201 && r.json('data.duracionTotalMinutos') === 18 })) {
    return fallo('crear rutina', rutina);
  }

  const borrado = http.del(`${BASE}/api/auth/me`, JSON.stringify({ password }), {
    headers: encabezados(token),
    tags: { name: 'DELETE /api/auth/me' },
  });
  if (!check(borrado, { 'cuenta borrada 200': (r) => r.status === 200 })) return fallo('borrar cuenta', borrado);

  usuariosCompletos.add(1);
  recorridoMs.add(Date.now() - t0);
}

export function teardown(data) {
  const segundos = (Date.now() - data.inicio) / 1000;
  console.log(`[k6] Tiempo total de los ${USUARIOS} usuarios: ${segundos.toFixed(1)} s (${(USUARIOS / segundos).toFixed(1)} usuarios/s).`);
}

export function handleSummary(data) {
  return resumen(data);
}

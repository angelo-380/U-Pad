/**
 * Utilidades compartidas por las pruebas de k6 de U-Pad.
 *
 * Las pruebas son AUTOSUFICIENTES: cada ejecución registra su propia cuenta temporal (empresario
 * «Carga k6», correo @carga.upad.test y contraseña aleatoria generada en memoria) y la borra al terminar
 * con DELETE /api/auth/me. Ningún script contiene credenciales.
 *
 * Variables (-e NOMBRE=valor):
 *   BASE_URL   destino (por defecto el backend local, http://localhost:3000)
 *   EMAIL y PASSWORD   opcional: usar una cuenta existente (empresario) en vez de crear una; no se borra.
 */
import http from 'k6/http';
import { check, fail } from 'k6';

export const BASE = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** Texto aleatorio en hexadecimal (crypto.getRandomValues de k6). */
const aleatorio = (bytes) =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');

/** Contraseña aleatoria que cumple la política del backend (mayúscula, minúscula, número y símbolo). */
const passwordAleatoria = () => `K6a!${aleatorio(12)}Z9`;

export const encabezados = (token) => ({ ...JSON_HEADERS, Authorization: `Bearer ${token}` });

/** Código y mensaje de error de una respuesta del backend, para que los fallos se entiendan. */
export const describirError = (res) => {
  let codigo = '';
  try {
    codigo = res.json('errors.code') || res.json('error.code') || '';
  } catch (e) {
    codigo = '';
  }
  return `HTTP ${res.status}${codigo ? ` ${codigo}` : ''}${res.error ? ` (${res.error})` : ''}`;
};

/**
 * Prepara la sesión de la prueba: crea la cuenta temporal (o inicia sesión con EMAIL/PASSWORD).
 * Devuelve { token, password, borrarAlTerminar }.
 */
export function crearCuentaTemporal() {
  const salud = http.get(`${BASE}/health`);
  if (salud.status !== 200) {
    fail(`El backend no responde en ${BASE}/health (${describirError(salud)}). ¿Está encendido? Local: cd backend && npm run dev`);
  }

  if (__ENV.EMAIL || __ENV.PASSWORD) {
    if (!__ENV.EMAIL || !__ENV.PASSWORD) fail('Para usar una cuenta existente indica EMAIL y PASSWORD (las dos).');
    const login = http.post(`${BASE}/api/auth/login`, JSON.stringify({ email: __ENV.EMAIL, password: __ENV.PASSWORD }), {
      headers: JSON_HEADERS,
    });
    if (login.status !== 200) fail(`No se pudo iniciar sesión con EMAIL (${describirError(login)}).`);
    return { token: login.json('data.token'), password: null, borrarAlTerminar: false };
  }

  const password = passwordAleatoria();
  const email = `k6-${Date.now()}-${aleatorio(4)}@carga.upad.test`;
  const registro = http.post(
    `${BASE}/api/auth/register`,
    JSON.stringify({ nombre: 'Carga k6', email, password, rol: 'empresario' }),
    { headers: JSON_HEADERS }
  );
  if (registro.status === 429) {
    const espera = registro.headers['Retry-After'] || '?';
    fail(
      `El backend limita los registros e inicios de sesión de esta IP (${describirError(registro)}); se libera en ${espera} s. ` +
        'Cada prueba de k6 usa un cupo. Si en backend/.env pusiste RATE_LIMIT_AUTH_MAX (p. ej. 10), quítala o súbela y reinicia el backend.'
    );
  }
  if (registro.status !== 201) fail(`No se pudo crear la cuenta temporal de k6 (${describirError(registro)}).`);
  console.log(`[k6] Cuenta temporal creada contra ${BASE}; se borrará al terminar.`);
  return { token: registro.json('data.token'), password, borrarAlTerminar: true };
}

/** Borra la cuenta temporal (y con ella sus rutinas y su organización). */
export function borrarCuenta(sesion) {
  if (!sesion || !sesion.borrarAlTerminar) return;
  const res = http.del(`${BASE}/api/auth/me`, JSON.stringify({ password: sesion.password }), {
    headers: encabezados(sesion.token),
  });
  const ok = check(res, { 'cuenta temporal borrada': (r) => r.status === 200 });
  if (ok) {
    console.log('[k6] Cuenta temporal borrada.');
  } else {
    fail(`No se pudo borrar la cuenta temporal (${describirError(res)}). Si el backend es antiguo, despliega la versión con DELETE /api/auth/me.`);
  }
}

/** Crea una rutina (sin niño asignado) y devuelve la respuesta. */
export function crearRutina(token, titulo, turno = 'MANANA') {
  return http.post(
    `${BASE}/api/rutinas`,
    JSON.stringify({
      titulo,
      turno,
      pasos: [
        { orden: 1, texto: 'Lavarse las manos', palabraClave: 'manos' },
        { orden: 2, texto: 'Sentarse a la mesa', palabraClave: 'mesa' },
      ],
    }),
    { headers: encabezados(token), tags: { name: 'POST /api/rutinas' } }
  );
}

/**
 * Resumen final (handleSummary) sin dependencias externas, para que funcione también sin Internet.
 * - Quita setup_data: contiene el token y la contraseña de la cuenta temporal y NO debe quedar en archivos.
 * - Imprime los umbrales (✓/✗), los checks y las métricas clave.
 * - Con -e RESUMEN=reports/archivo.json guarda además el resumen en JSON (sin setup_data).
 * k6 sigue terminando con error si algún umbral no se cumple.
 */
export function resumen(data) {
  delete data.setup_data;
  const m = data.metrics || {};
  const lineas = [];
  const num = (v, dec = 2) => (typeof v === 'number' ? Number(v.toFixed(dec)).toString() : '—');
  const pct = (v) => (typeof v === 'number' ? `${num(v * 100)} %` : '—');
  const ms = (v) => (typeof v === 'number' ? `${num(v)} ms` : '—');

  const valorDe = (metrica, expresion) => {
    const v = metrica.values || {};
    const estadistica = (expresion.match(/^\s*([a-z]+\(\d+(?:\.\d+)?\)|avg|min|med|max|rate|count)/) || [])[1];
    if (metrica.type === 'rate') return pct(v.rate);
    if (metrica.type === 'counter') return num(v.count, 0);
    if (metrica.type === 'trend') return metrica.contains === 'time' ? ms(v[estadistica]) : num(v[estadistica]);
    return num(v[estadistica] ?? v.value);
  };

  lineas.push('', `U-Pad · k6 · ${BASE} · ${num((data.state?.testRunDurationMs || 0) / 1000, 1)} s`, '');

  lineas.push('UMBRALES');
  let todosOk = true;
  for (const [nombre, metrica] of Object.entries(m)) {
    for (const [expresion, estado] of Object.entries(metrica.thresholds || {})) {
      todosOk = todosOk && estado.ok;
      lineas.push(`  ${estado.ok ? '✓' : '✗'} ${nombre} ${expresion}  (${valorDe(metrica, expresion)})`);
    }
  }

  const checks = [];
  const recorrer = (grupo) => {
    (grupo.checks || []).forEach((c) => checks.push(c));
    (grupo.groups || []).forEach(recorrer);
  };
  recorrer(data.root_group || {});
  if (checks.length) {
    lineas.push('', 'CHECKS');
    checks.forEach((c) => lineas.push(`  ${c.fails === 0 ? '✓' : '✗'} ${c.name}  (${c.passes} bien, ${c.fails} mal)`));
  }

  lineas.push('', 'MÉTRICAS');
  if (m.http_reqs) lineas.push(`  peticiones HTTP ........ ${num(m.http_reqs.values.count, 0)} (${num(m.http_reqs.values.rate, 1)}/s)`);
  if (m.http_req_failed) lineas.push(`  peticiones fallidas .... ${pct(m.http_req_failed.values.rate)}`);
  if (m.http_req_duration) {
    const d = m.http_req_duration.values;
    lineas.push(`  latencia ............... media ${ms(d.avg)} · p90 ${ms(d['p(90)'])} · p95 ${ms(d['p(95)'])} · máx ${ms(d.max)}`);
  }
  if (m.iterations) lineas.push(`  iteraciones ............ ${num(m.iterations.values.count, 0)}`);
  if (m.vus_max) lineas.push(`  usuarios virtuales ..... ${num(m.vus_max.values.max ?? m.vus_max.values.value, 0)}`);
  const internas = new Set(['http_reqs', 'iterations', 'data_sent', 'data_received']);
  for (const [nombre, metrica] of Object.entries(m)) {
    if (metrica.type === 'counter' && !internas.has(nombre)) {
      lineas.push(`  ${`${nombre} `.padEnd(26, '.')} ${num(metrica.values.count, 0)}`);
    }
  }
  lineas.push('', todosOk ? 'RESULTADO: todos los umbrales se cumplen ✓' : 'RESULTADO: hay umbrales sin cumplir ✗', '');

  const salida = { stdout: lineas.join('\n') };
  if (__ENV.RESUMEN) salida[__ENV.RESUMEN] = JSON.stringify(data, null, 2);
  return salida;
}

# U-Pad Backend API (Entrega del 25%)

Backend REST desarrollado en Node.js, Express y Firebase Firestore para la plataforma U-Pad (apoyo y gestión de agendas visuales para personas con TEA).

---

## 1. Requisitos Previos y Configuración

- **Node.js** v18+ o v20+
- **Firebase CLI** y **Java JDK** (para el Firestore Emulator Suite local)
- **k6** (para las pruebas de carga y estrés)

### Variables de Entorno (`.env`)
Copiar la plantilla `.env.example` a `.env`:
```powershell
cp .env.example .env
```

| Variable | Descripción | Valor por Defecto |
|---|---|---|
| `PORT` | Puerto HTTP del servidor Express | `3000` |
| `NODE_ENV` | Entorno de ejecución (`development`, `production`, `test`) | `development` |
| `JWT_SECRET` | Secreto criptográfico simétrico para firma de tokens JWT | *(Clave segura de 32+ caracteres)* |
| `JWT_EXPIRES_IN` | Duración del token de sesión | `24h` |
| `DEV_EMAIL` | Correo de la cuenta `developer` inicial (solo se usa si la tabla `usuarios` está vacía) | *(sin valor: no se crea la cuenta)* |
| `DEV_PASSWORD` | Contraseña de la cuenta `developer` inicial (mín. 8 caracteres, con mayúscula, número y carácter especial) | *(sin valor: no se crea la cuenta)* |
| `DEV_NAME` | Nombre de la cuenta `developer` inicial | *(sin valor: no se crea la cuenta)* |
| `FIRESTORE_EMULATOR_HOST` | Host y puerto del emulador local de Firestore | `127.0.0.1:8080` |
| `RATE_LIMIT_WINDOW_MIN` | Ventana de tiempo en minutos para el conteo de peticiones | `15` |
| `RATE_LIMIT_MAX` | Límite de peticiones permitidas en la ventana para toda la API | `100` |
| `RATE_LIMIT_AUTH_MAX` | Límite estricto de intentos de login y registro por IP | `10` |

---

## 2. Puesta en Marcha

### Terminal 1: Iniciar Emulador de Firestore (Recomendado para evitar costos en Cloud)
```powershell
cd c:\UPAD\U-Pad\backend
npm run emulators:start
```
La interfaz web del emulador estará disponible en `http://localhost:4000/firestore`.

### Terminal 2: Iniciar Servidor Express en Desarrollo
```powershell
cd c:\UPAD\U-Pad\backend
npm run dev
```
El servidor escuchará en `http://localhost:3000`.

---

## 3. Pruebas Unitarias y de Integración (Jest + Supertest)

Ejecuta las 20 pruebas que verifican:
- Ruta raíz (Sitio en desarrollo 200).
- Ruta inexistente (404 estructurado).
- Respuestas HTTP estandarizadas (400, 401, 403, 409, 429).
- Registro y login con contraseñas cifradas en **bcrypt**.
- Rutas protegidas por **JWT**.
- CRUD de Rutinas.

```powershell
npm test
```

---

## 4. Pruebas de Carga con k6

Las pruebas están en `tests/k6/` y son **autosuficientes**: cada ejecución crea su propia cuenta temporal (empresario «Carga k6», correo `@carga.upad.test` y contraseña aleatoria generada en memoria) y la **borra al terminar** con `DELETE /api/auth/me`. No hace falta ninguna cuenta previa ni tocar `.env`, la base queda como estaba y ningún script contiene credenciales.

Instalar k6: `brew install k6` (macOS) o `winget install k6 --source winget` (Windows).

| Comando (desde `backend/`) | Qué hace | Se considera correcto si |
|---|---|---|
| `npm run carga` | Escenario A: 100 usuarios durante 30 s consultando `/health`, rutinas, KPIs y cumplimiento | `http_req_failed < 1 %`, `p(95) < 800 ms`, `checks > 99 %`, `errores_otros = 0` |
| `npm run carga:escritura` | 10 usuarios crean 100 rutinas a la vez | las 100 se crean, `errores_otros = 0` |
| `npm run carga:limite` | Escenario B: 30 intentos de vincular un hijo con códigos falsos | el servidor corta con `429 PAIRING_RATE_LIMIT` (`respuestas_429 > 0`) |
| `npm run carga:humo` | Las tres, cortas | lo mismo; es lo que ejecuta GitHub Actions en cada push |
| `npm run carga:10k` | Estrés: 10 000 usuarios distintos, cada uno se registra, inicia sesión, crea una rutina de 2 pasos y borra su cuenta | 0 fallos, los 10 000 completos y la base queda vacía; informa el tiempo total |

**Sobre los 10 000 usuarios en 10 segundos.** Registrar, iniciar sesión y borrar la cuenta cifran o comprueban la contraseña con PBKDF2 (100 000 rondas, sha512): son 30 000 operaciones de unos 15 ms de CPU cada una. Medido el 16-nov-2026 en un Mac M (backend local, `UV_THREADPOOL_SIZE=16`): **10 000 usuarios en 53,4 s (187 usuarios/s), 40 001 peticiones, 0 fallos, p95 400 ms**, y la base quedó con 0 cuentas. Bajar a 10 s exigiría debilitar el cifrado de todas las contraseñas (OWASP recomienda más rondas, no menos) o varias instancias, que SQLite no admite. Variables: `USUARIOS` (10000), `VUS` (200), `MAX_MIN` (15). Necesita que el límite de autenticación admita 30 000 peticiones cada 15 min (por defecto 50 000).

- Contadores de la rúbrica: `respuestas_429` y `errores_otros` (aparecen siempre en el resumen).
- Resultados en `reports/*.json` (`-e RESUMEN=reports/archivo.json`; sin el token ni la contraseña de la cuenta temporal).
- Variables (`-e NOMBRE=valor`): `BASE_URL` (por defecto `http://localhost:3000`), `VUS`, `DURACION`, `TOTAL`, `P95_MS`. Opcional: `EMAIL` y `PASSWORD` para usar una cuenta empresario existente (no se borra).
- Contra Cloud Run:
  ```bash
  k6 run -e BASE_URL=https://upad-backend-service-466241893446.us-central1.run.app tests/k6/carga.js
  ```
- Estrés con más usuarios: `ulimit -n 65536 && k6 run -e BASE_URL=<URL> -e VUS=1000 -e P95_MS=2000 tests/k6/carga.js`.
- El escenario B usa un límite en memoria (10 intentos por minuto por cuenta y 30 por IP) que no depende de `.env`: funciona igual en local y en Cloud Run.
- Si en `.env` pusiste `RATE_LIMIT_AUTH_MAX` con un valor bajo (p. ej. 10), el backend solo admite ese número de registros e inicios de sesión cada 15 min por IP, y cada prueba usa uno. Quita la variable (por defecto 50 000) y reinicia el backend.

---

## 5. Tabla de Endpoints de la API

| Método | Endpoint | Descripción | Acceso | Códigos de Estado |
|---|---|---|---|---|
| `GET` | `/` | Sitio en desarrollo (Estado operacional) | Público | `200` |
| `GET` | `/health` | Health Check y conexión a Firestore | Público | `200`, `503` |
| `POST` | `/api/auth/register` | Registro de usuario (bcrypt + JWT) | Público (Rate limited) | `201`, `400`, `409`, `429` |
| `POST` | `/api/auth/login` | Inicio de sesión con JWT | Público (Rate limited) | `200`, `400`, `401`, `429` |
| `GET` | `/api/auth/me` | Sesión del usuario autenticado | `Bearer <token>` | `200`, `401` |
| `DELETE` | `/api/auth/me` | Borrar la propia cuenta (body `{password}`; no para developer) | `Bearer <token>` | `200`, `400`, `401`, `403`, `429` |
| `GET` | `/api/rutinas` | Listado de rutinas (filtradas por rol) | `Bearer <token>` | `200`, `401` |
| `POST` | `/api/rutinas` | Crear rutina visual | `Bearer <token>` | `201`, `400`, `401` |
| `GET` | `/api/rutinas/:id` | Detalle de rutina | `Bearer <token>` | `200`, `401`, `403`, `404` |
| `PUT` | `/api/rutinas/:id` | Actualizar rutina | `Bearer <token>` | `200`, `400`, `401`, `404` |
| `DELETE` | `/api/rutinas/:id` | Eliminar rutina | `Bearer <token>` | `200`, `401`, `404` |
| `GET` | `/api/test-status/:code` | Simulación controlada de respuestas | Público | `200, 201, 400, 401, 403, 409, 429, 500` |

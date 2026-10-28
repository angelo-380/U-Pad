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

## 4. Pruebas de Carga con k6 (50 a 100 Usuarios Concurrentes)

La prueba de carga (`tests/carga.js`) simula entre 50 y 100 usuarios concurrentes realizando peticiones a `/health`, inicio de sesión y consulta autenticada a `GET /api/rutinas`.

El script cuenta con dos contadores personalizados obligatorios:
- `respuestas_429`: Número de peticiones bloqueadas por el Rate Limiter.
- `errores_otros`: Número de errores diferentes a 200 y 429.

### Escenario A: Prueba con Rate Limit Relajado (Demostración de Alto Rendimiento)
Para evaluar la capacidad del servidor sin que el limitador de seguridad bloquee por IP local:

1. Configurar en tu archivo `.env`:
   ```properties
   RATE_LIMIT_MAX=100000
   RATE_LIMIT_AUTH_MAX=100000
   ```
2. Reiniciar el servidor:
   ```powershell
   npm run dev
   ```
3. Ejecutar la prueba de carga:
   ```powershell
   npm run carga
   ```
   *Resultado esperado:* 100% de peticiones exitosas (HTTP 200), `http_req_failed < 5%`, `p(95) < 800 ms` y `respuestas_429 = 0`.  
   *Reporte generado:* `reports/reporte-carga.json` (o HTML si usas el reporter de k6).

---

### Escenario B: Prueba con Rate Limit Estricto (Demostración de Defensa ante Ataques)
Para demostrar al evaluador que la protección contra ataques de saturación o denegación de servicio funciona exactamente como se diseñó:

1. Restaurar en tu archivo `.env` los valores por defecto:
   ```properties
   RATE_LIMIT_MAX=100
   RATE_LIMIT_AUTH_MAX=10
   ```
2. Reiniciar el servidor:
   ```powershell
   npm run dev
   ```
3. Ejecutar la prueba de carga:
   ```powershell
   npm run carga:ratelimit
   ```
   *Resultado esperado:* Se evidenciará en la consola de k6 que el contador `respuestas_429` registra las peticiones bloqueadas (aprox. 2,200), demostrando que la API responde con **HTTP 429 Too Many Requests** en formato JSON estructurado y rechaza el tráfico abusivo.  
   *Reporte generado:* `reports/reporte-rate-limit.json`.

---

## 5. Tabla de Endpoints de la API

| Método | Endpoint | Descripción | Acceso | Códigos de Estado |
|---|---|---|---|---|
| `GET` | `/` | Sitio en desarrollo (Estado operacional) | Público | `200` |
| `GET` | `/health` | Health Check y conexión a Firestore | Público | `200`, `503` |
| `POST` | `/api/auth/register` | Registro de usuario (bcrypt + JWT) | Público (Rate limited) | `201`, `400`, `409`, `429` |
| `POST` | `/api/auth/login` | Inicio de sesión con JWT | Público (Rate limited) | `200`, `400`, `401`, `429` |
| `GET` | `/api/auth/me` | Sesión del usuario autenticado | `Bearer <token>` | `200`, `401` |
| `GET` | `/api/rutinas` | Listado de rutinas (filtradas por rol) | `Bearer <token>` | `200`, `401` |
| `POST` | `/api/rutinas` | Crear rutina visual | `Bearer <token>` | `201`, `400`, `401` |
| `GET` | `/api/rutinas/:id` | Detalle de rutina | `Bearer <token>` | `200`, `401`, `403`, `404` |
| `PUT` | `/api/rutinas/:id` | Actualizar rutina | `Bearer <token>` | `200`, `400`, `401`, `404` |
| `DELETE` | `/api/rutinas/:id` | Eliminar rutina | `Bearer <token>` | `200`, `401`, `404` |
| `GET` | `/api/test-status/:code` | Simulación controlada de respuestas | Público | `200, 201, 400, 401, 403, 409, 429, 500` |

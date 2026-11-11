# CLAUDE.md

## 1. Arquitectura
- `backend/` es la ÚNICA fuente de verdad: Express + SQLite (`node:sqlite`), desplegado en Cloud Run. Sirve la API (`/api/...` y alias `/api/v1/...`) y la web compilada (`backend/public_html`).
- `cloud/` y `server/` son LEGADO. NO se modifican, ni se usan como referencia para código nuevo.
- `frontend/` es React + Vite + Tailwind. Su build se copia a `backend/public_html` (ver sección 9e).
- Android (`app/`) está fuera de alcance (ver sección 7).
- Base de datos: SQLite, archivo `upad_relational.db` (ruta resuelta en `backend/src/config/database.js`). Está en `.gitignore`. En Cloud Run vive dentro del contenedor y es efímera (se corregirá, ver 9d).
- `backend/src/config/firebase.js` y `backend/scripts/seedAdmin.js` (Firestore) son restos heredados y no se usan en runtime. No los uses ni los ejecutes.

## 2. Prohibiciones
- NUNCA ejecutes `cloud/deploy_gcp.sh` (ni `.ps1`), ni `gcloud`, ni `firebase` (incluye `npm run emulators:start`), ni `npm run seed:admin`.
- NUNCA leas archivos `.env` (`backend/.env`, `frontend/.env`). Los nombres de variables se sacan del código con `grep process.env` o `grep import.meta.env`.
- El despliegue lo hace solo el usuario, manualmente.

## 3. Cómo levantar en local
- Backend: `cd backend && npm install && npm run dev` → http://localhost:3000. Requiere Node 22 o superior (por `node:sqlite`).
- Frontend: `cd frontend && npm install && VITE_API_URL=http://localhost:3000 npm run dev` → http://localhost:5173. Pasa la variable en la línea de comandos y no edites `.env`.
- Modo unificado (web servida por el backend): `./start.sh`.
- No se necesitan credenciales de Google para web ni backend.

## 4. Tests
- Backend: `cd backend && npm test` (Jest + Supertest, `NODE_ENV=test`).
- 34/34 pruebas pasan (verificado 11-nov-2026); las menciones a Firestore en `tests/setup.js` y `app.test.js` son texto obsoleto.

## 5. Roles (estado actual del código)
Valores en minúscula, guardados en `usuarios.rol` y en el JWT (`rol`):
- `developer`: administrador del sistema (backups, consola SQL, CRUD de usuarios).
- `admin`: alias funcional de `developer`. SE ELIMINARÁ por completo (ver 9a). Mientras tanto aparece junto a `developer` en casi todas las validaciones.
- `empresario`: director de colegio o clínica. KPIs agregados y rutinas de su organización. Rol por defecto del registro.
- `tutor`: familiar o docente. Solo ve sus propias rutinas.
- `niño`: rol objetivo (ver 9a). Aún no existe como rol en el backend web.

Dónde se validan (el backend es la autoridad; el frontend solo oculta menús y no tiene guardas por rol):
- `backend/src/middlewares/authMiddleware.js` → `authenticate` y `authorizeRoles(...)`.
- Rutas: `routes/adminRoutes.js` y `routes/backupRoutes.js` (developer, admin), `routes/rutinasRoutes.js` (developer, admin, empresario, tutor), `routes/kpiRoutes.js` (empresario, developer, admin).
- Lógica por rol: `services/rutinasService.js` (listar, editar, borrar) y `services/backupService.js`.
- Registro público: allowlist en `services/authService.js`. Hoy acepta `developer`: se corregirá en el bloque A (cerrar el registro con developer); no lo toques fuera de ese bloque.
- Frontend: `App.jsx` (HomeRedirect), `components/layout/AppLayout.jsx`, `components/common/ProtectedRoute.jsx`, `components/common/RoleBadge.jsx`, `pages/auth/*`, `pages/admin/DeveloperUsersPage.jsx`.

## 6. Reglas de trabajo
- Rama de trabajo: `feature/mejoras-feedback-docente`.
- Planifica antes de editar y espera aprobación del plan.
- Trabaja un bloque a la vez. No mezcles cambios no relacionados.
- Todo cambio de backend lleva tests (nuevos o actualizados) y debe pasar `npm test`.
- Todos los textos de UI van en español. Los textos nuevos pasan por `frontend/src/context/LanguageContext.jsx`, con español como idioma base.
- NO hagas commit ni push hasta que el usuario lo pida explícitamente.
- NO toques `backend/public_html` (es el build compilado) salvo indicación expresa del usuario (ver 9e).

## 7. Android
- NO modificar nada del proyecto Android: `app/`, `build.gradle.kts`, `settings.gradle.kts`, `gradle/`, `gradle.properties`, `gradlew*` y los `.apk` de la raíz.
- Solo se puede leer para entender contratos de API.

## 8. Credenciales
- No escribas contraseñas, tokens, claves ni peppers en ningún archivo (código, docs, tests, scripts, este CLAUDE.md).
- En tests usa valores generados o variables de entorno, nunca credenciales reales.
- No imprimas secretos en la salida ni en los logs.

## 9. Decisiones del proyecto
a) Se elimina por completo el rol `admin`. Se conservan `developer`, `empresario`, `tutor` y `niño`. Hay que quitarlo de backend (rutas, servicios, allowlists), frontend (guardas, badges, selects, traducciones) y de los tests.
b) Se eliminan los seeders y los datos demo (incluye las cuentas sembradas y la auto-reparación de credenciales en `backend/src/config/database.js`, y `backend/scripts/seedAdmin.js`). La primera cuenta `developer` se crea mediante variables de entorno, solo si no existen usuarios. Los nombres de esas variables se definen en el bloque correspondiente; sus valores nunca se escriben en archivos.
c) Solo se trabaja la web. La app Android no se toca (ver sección 7).
d) El informe del proyecto es la referencia. Más adelante se implementará lo que dice: pepper con Cloud KMS, backups a Cloud Storage y persistencia de la base de datos. Hoy NADA de eso existe (el pepper es una variable de entorno, los backups viven en el disco efímero del contenedor). No lo des por hecho en el código ni en la documentación.
e) El build del frontend se copia a `backend/public_html` solo cuando el usuario lo pida, al final del trabajo. Mientras tanto, no se regenera ni se modifica.

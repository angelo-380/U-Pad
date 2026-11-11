# CLAUDE.md

## 1. Arquitectura
- `backend/` es la ÚNICA fuente de verdad: Express + SQLite (`node:sqlite`), desplegado en Cloud Run. Sirve la API (`/api/...` y alias `/api/v1/...`) y la web compilada (`backend/public_html`).
- `cloud/` y `server/` son LEGADO. NO se modifican, ni se usan como referencia para código nuevo.
- `frontend/` es React + Vite + Tailwind. Su build se copia a `backend/public_html` (ver sección 9e).
- Android (`app/`) está fuera de alcance (ver sección 7).
- Base de datos: SQLite, archivo `upad_relational.db` (ruta resuelta en `backend/src/config/database.js`). Está en `.gitignore`. En Cloud Run vive dentro del contenedor y es efímera (se corregirá, ver 9d).
- `backend/src/config/firebase.js` (Firestore) es un resto heredado y no se usa en runtime. No lo uses.

## 2. Prohibiciones
- NUNCA ejecutes `cloud/deploy_gcp.sh` (ni `.ps1`), ni `gcloud`, ni `firebase` (incluye `npm run emulators:start`).
- NUNCA leas archivos `.env` (`backend/.env`, `frontend/.env`). Los nombres de variables se sacan del código con `grep process.env` o `grep import.meta.env`.
- El despliegue lo hace solo el usuario, manualmente.

## 3. Cómo levantar en local
- Backend: `cd backend && npm install && npm run dev` → http://localhost:3000. Requiere Node 22 o superior (por `node:sqlite`).
- Frontend: `cd frontend && npm install && VITE_API_URL=http://localhost:3000 npm run dev` → http://localhost:5173. Pasa la variable en la línea de comandos y no edites `.env`.
- Modo unificado (web servida por el backend): `./start.sh`.
- No se necesitan credenciales de Google para web ni backend.

## 4. Tests
- Backend: `cd backend && npm test` (Jest + Supertest, `NODE_ENV=test`).
- 102/102 pruebas pasan (verificado 11-nov-2026, tras el bloque B); las menciones a Firestore en `tests/setup.js` y `app.test.js` son texto obsoleto.
- `tests/setup.js` fuerza una base SQLite temporal por corrida (y su carpeta `backups/`): los tests nunca tocan una base real ni crean `.db` en el repo.

## 5. Roles (estado actual del código)
Valores en minúscula, guardados en `usuarios.rol` y en el JWT (`rol`):
- `developer`: administrador del sistema (backups, consola SQL, CRUD de usuarios).
- `empresario`: director de colegio o clínica. KPIs agregados y rutinas de su organización. Rol por defecto del registro.
- `tutor`: familiar o docente. Solo ve sus propias rutinas.
- `nino` (sin tilde): rol objetivo (ver 9a). Solo existe como constante en `backend/src/utils/roles.js`; NO es registrable ni asignable y ninguna ruta lo autoriza. Hoy el niño es solo un dispositivo vinculado (`child_devices`, `rutinas.ninoId`).
- El rol `admin` ya NO existe (eliminado en el bloque A). Las cuentas antiguas con ese rol se migran a `developer` al arrancar (`migrarRolAdmin` en `database.js`).

Dónde se validan (el backend es la autoridad; el frontend solo oculta menús y no tiene guardas por rol):
- `backend/src/utils/roles.js`: catálogo de roles, `ROLES_REGISTRO_PUBLICO` (empresario, tutor), `ROLES_ASIGNABLES` (developer, empresario, tutor) y `normalizarRol`.
- `backend/src/middlewares/authMiddleware.js` → `authenticate` y `authorizeRoles(...)`.
- Rutas: `routes/adminRoutes.js` y `routes/backupRoutes.js` (developer), `routes/rutinasRoutes.js` (developer, empresario, tutor), `routes/kpiRoutes.js` (empresario, developer).
- Lógica por rol: `services/rutinasService.js` (listar, obtener, editar, borrar; deniega por defecto a roles desconocidos) y `services/backupService.js`.
- Registro público: `services/authService.js` solo acepta `empresario` y `tutor` (`developer` se rechaza con `INVALID_ROLE`). Al crear/editar usuarios, `routes/adminRoutes.js` valida el rol con lista blanca (`ROLES_ASIGNABLES`).
- Frontend: `App.jsx` (HomeRedirect), `components/layout/AppLayout.jsx`, `components/common/ProtectedRoute.jsx`, `components/common/RoleBadge.jsx`, `pages/auth/*`, `pages/admin/DeveloperUsersPage.jsx`.

### Organizaciones (bloque B)
- REGLA: el cliente NUNCA envía un `organizacionId` (ni al registrarse ni al crear rutinas). La organización siempre la define el servidor.
- Tabla `organizaciones` (`id`, `nombre`, `codigo` único, `propietarioId`, `creadoEn`). 1 empresario = 1 organización propia, creada al registrarse (su `nombre` es el nombre de la institución). Los tutores son miembros.
- Código: 8 caracteres sin ambiguos (`K7M2-Q9XD`), generado en `backend/src/utils/organizaciones.js`. Un tutor puede enviar `codigoOrganizacion` al registrarse (inválido → 400 `ORGANIZACION_CODIGO_INVALIDO`, sin crear la cuenta) o quedar sin organización. Solo el empresario propietario ve el código (`GET /api/organizaciones/mia`, KPIs).
- La rutina toma la organización del usuario autenticado (token); así las rutinas de los tutores miembros suman a "Rutinas Institucionales" del empresario (`routes/kpiRoutes.js`, datos reales por organización; solo adherencia semanal e indicadores de calidad siguen simulados).
- El developer asigna organizaciones solo por id existente (`routes/adminRoutes.js`); todo empresario creado o promovido recibe una organización propia.
- Migración única al arrancar (`migrarOrganizaciones` en `database.js`, controlada con `PRAGMA user_version`): propietario = empresario más antiguo; co-empresarios pasan a una organización propia; membresías inválidas → NULL; las rutinas siguen a su creador.
- Pendiente: rotar el código, unirse/salir de una organización después del registro, y código en la app Android (hoy los tutores móviles quedan sin organización).

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
a) Se elimina por completo el rol `admin`. Se conservan `developer`, `empresario`, `tutor` y `niño`. Hecho en el bloque A para backend, frontend y tests (el identificador técnico de niño será `nino`, aún sin implementar).
b) Se eliminan los seeders y los datos demo. Hecho en `backend/src/config/database.js` (sin cuentas sembradas ni auto-reparación de credenciales). La primera cuenta `developer` se crea SOLO si la tabla `usuarios` está vacía, leyendo `DEV_EMAIL`, `DEV_PASSWORD` y `DEV_NAME` del entorno (las tres son obligatorias; si falta alguna no se crea nada y se avisa en consola con los nombres faltantes). Sus valores nunca se escriben en archivos. `backend/scripts/seedAdmin.js` y el script `seed:admin` ya fueron eliminados. Pendiente: rotar/eliminar las cuentas sembradas que ya existan en bases de datos creadas antes (p. ej. la de Cloud Run).
c) Solo se trabaja la web. La app Android no se toca (ver sección 7).
d) El informe del proyecto es la referencia. Más adelante se implementará lo que dice: pepper con Cloud KMS, backups a Cloud Storage y persistencia de la base de datos. Hoy NADA de eso existe (el pepper es una variable de entorno, los backups viven en el disco efímero del contenedor). No lo des por hecho en el código ni en la documentación.
e) El build del frontend se copia a `backend/public_html` solo cuando el usuario lo pida, al final del trabajo. Mientras tanto, no se regenera ni se modifica.

## 10. Estado de avance (actualizado 11-nov-2026)

### Hecho
- **A. Roles y seeders:** rol `admin` eliminado (backend, frontend y tests); registro público cerrado a `developer`; lista blanca de roles al crear/editar usuarios; sin cuentas sembradas; `seedAdmin.js` y `seed:admin` eliminados; primera cuenta `developer` creada solo por entorno (`DEV_EMAIL`, `DEV_PASSWORD`, `DEV_NAME`) si no hay usuarios.
- **A2. Organizaciones y KPIs reales:** tabla `organizaciones` con código de unión para tutores; el cliente nunca envía `organizacionId`; `GET /api/organizaciones/mia`; migración única de datos existentes; KPIs de rutinas institucionales y estudiantes (niños vinculados) con datos reales por organización.

### Pendiente
Referencia: el listado completo de 22 puntos del docente está en `docs/FEEDBACK_DOCENTE.md` (los números de abajo son los de ese listado).
- **B. Limpieza de UI:** puntos 2, 7, 11, 14, 15, 17, 20 y 21.
  - 2: renombrar botones y etiquetas con claves crudas o poco claras (p. ej. `btn_register` debe decir «Registrarse»).
  - 7: quitar del menú principal todo el módulo de sugerencias de IA.
  - 11: quitar el texto en inglés «Structure activities with keywords to automatically bind ARASAAC pictograms.» del módulo de rutinas.
  - 14: quitar los KPIs «Tablets en Perímetro» y «Tasa de Adherencia TEA» del panel gerencial.
  - 15: quitar del panel gerencial la leyenda del colegio con «Supervisión ejecutiva…» y el banner de «Privacidad Protegida… PII Blindado».
  - 17: quitar del Developer Center el bloque «Persistencia Cloud Run · Google Cloud KMS Activo · Poder de Administrador CRUD Completo Habilitado».
  - 20: renombrar «Gestión de Cuentas (CRUD DEVELOPER)» a «Gestión de Cuentas».
  - 21: eliminar la vista «SELECT * FROM usuarios (Raw Database View)», renombrar «Developer Center: Poder Absoluto de Base de Datos» a «Developer Center» y quitar la opción «Refrescar».
- **C. Análisis de desempeño con datos reales:** la adherencia semanal y los indicadores de calidad siguen simulados.
- **D. Hijos:** vinculación de 60 s y desvincular en la web.
- **E. GPS.**
- **F. Developer Center:** rutinas y paginación.
- **G. Login con Google.**
- **H. Coherencia con el informe:** Cloud KMS, backups a Cloud Storage y persistencia de la base de datos.

### Recordatorios
- Rotar o eliminar en producción las cuentas semilla antiguas (siguen en las bases creadas antes, p. ej. la de Cloud Run).
- Regenerar `backend/public_html` al final del trabajo (hoy contiene un build viejo).
- Las traducciones nuevas están solo en español; los demás idiomas caen a español hasta que se traduzcan.
- En el primer arranque en producción, la migración creará una organización por cada empresario existente (incluidas las cuentas de las pruebas de carga).

# U-Pad 📱✨
### Apoyo Visual, Rutinas Inteligentes y Seguimiento en Tiempo Real para Niños con TEA

U-Pad es una aplicación Android nativa diseñada para mejorar la autonomía de niños con Trastorno del Espectro Autista (TEA) y proporcionar tranquilidad a sus padres o tutores. Utiliza agendas visuales basadas en pictogramas de la base de datos de ARASAAC, asistencia por inteligencia artificial para la generación de rutinas adaptadas, y rastreo satelital en tiempo real.

---

## 🚀 Características Clave

1. **Agendas Visuales Dinámicas**: Organización estructurada de tareas y actividades en tres bloques principales (Mañana, Tarde y Noche).
2. **Generador de Rutinas Asistido por IA (Groq)**: Integración segura con Groq AI (`llama-3.3-70b-versatile`) para sugerir automáticamente rutinas optimizadas por psicopedagogos expertos en TEA.
3. **Buscador de Pictogramas (ARASAAC)**: Integración con la API oficial de ARASAAC mediante Retrofit para buscar y descargar representaciones visuales.
4. **Seguimiento GPS en Tiempo Real**: Visualización de la ubicación geográfica del menor en un mapa integrado mediante Google Maps.
5. **Modo Kiosco y Bloqueo Biométrico**: Restricciones de seguridad avanzadas controladas remotamente por el tutor para asegurar que el menor no abandone la pantalla de tareas.
6. **Manejo de Errores y Estados**: Indicadores visuales interactivos y manejo de errores asíncrono para llamadas de red (IA y APIs de imágenes) que previenen bloqueos.

---

## 🛠️ Arquitectura y Tecnologías

El proyecto sigue una arquitectura **MVVM (Model-View-ViewModel)** estricta que asegura una separación clara entre la interfaz de usuario y la lógica de negocio/infraestructura:

* **UI (Vistas)**: Jetpack Compose utilizando Material Design 3 con un sistema de temas y modo oscuro persistente.
* **Lógica de Presentación**: ViewModels (`RoutineViewModel`, `TrackingViewModel`) que exponen estados observables mediante `StateFlow` de Kotlin Coroutines.
* **Capa de Datos**: Repositorios desacoplados (`FirebaseRepository`, `ArasaacRepository`, `AiRepository`) que encapsulan el acceso a Firestore, Firebase Storage y APIs REST externas.
* **Persistencia Local**: Preferences DataStore para el almacenamiento de preferencias de usuario como el idioma y el estado de la suscripción.
* **Servicios de Red**:
  * **Retrofit**: Cliente HTTP optimizado para la consulta de pictogramas en ARASAAC.
  * **OkHttp**: Solicitudes asíncronas estructuradas para el motor de Inteligencia Artificial Groq.

---

## 🔒 Configuración de Credenciales Seguras

Para proteger las credenciales expuestas, la aplicación utiliza `BuildConfig` para inyectar claves de API de forma segura en tiempo de compilación.

### Paso 1: Configurar local.properties
Crea o edita el archivo `local.properties` en la raíz del proyecto y agrega tus claves:
```properties
GROQ_API_KEY=tu_clave_de_groq_aqui
GOOGLE_CLIENT_ID=tu_client_id_de_google_sign_in_aqui
```

### Paso 2: Generación en Gradle
`app/build.gradle.kts` lee estas claves automáticamente y expone los campos para el código en tiempo de ejecución:
```kotlin
buildConfigField("String", "GROQ_API_KEY", "\"$groqApiKey\"")
buildConfigField("String", "GOOGLE_CLIENT_ID", "\"$googleClientId\"")
```

---

## 📁 Entregables del Proyecto

* **APK de Depuración**: Compilado y ubicado en la raíz del proyecto con el nombre [UPad_debug.apk](file:///C:/Users/TUF/AndroidStudioProjects/U-Pad/UPad_debug.apk).
* **Documentación Técnica PDF**: Estructura de 5 páginas con la propuesta pedagógica, diagramas de arquitectura e instrucciones de uso.
* **Video/Script Demostrativo**: Guía de uso rápido del flujo principal (creación de rutina, vinculación de dispositivo y rastreo de ubicación).

---

## 💻 Ejecución del Proyecto

1. Clona el repositorio.
2. Abre el proyecto en **Android Studio (Ladybug o superior)**.
3. Asegúrate de configurar el archivo `local.properties` tal como se describe en la sección de seguridad.
4. Sincroniza Gradle.
5. Ejecuta la aplicación en un dispositivo físico o emulador con **API 24 (Android 7.0) o superior**.

# U-Pad 📱✨
### Apoyo Visual, Rutinas Inteligentes y Seguimiento en Tiempo Real para Niños con TEA

U-Pad es una aplicación Android nativa diseñada para mejorar la autonomía diaria de niños con Trastorno del Espectro Autista (TEA) mediante agendas visuales basadas en pictogramas. Facilita la tranquilidad de los padres y tutores al permitirles supervisar en tiempo real el progreso de las rutinas y realizar un rastreo GPS satelital de la ubicación del menor. Asimismo, integra un asistente inteligente de IA que sugiere actividades personalizadas adaptadas a las necesidades específicas de cada niño.

---

## 🛠️ Stack Tecnológico

El proyecto está desarrollado nativamente para la plataforma Android utilizando las siguientes tecnologías:

* **Lenguaje principal**: Kotlin
* **Diseño y UI**: Jetpack Compose (Material Design 3) con soporte para temas dinámicos y persistencia de modo oscuro
* **Consumo de Servicios REST (Pictogramas)**: Retrofit (para búsqueda y consulta de imágenes desde la API oficial de ARASAAC)
* **Cliente HTTP (IA)**: OkHttp (para llamadas asíncronas estructuradas)
* **Persistencia y Backend**: Firebase Firestore y Firebase Storage
* **Autenticación**: Firebase Authentication con soporte de Google Sign-In integrado
* **Servicio de Ubicación y Mapas**: Google Maps SDK, Fused Location Provider Client
* **Persistencia Local**: Preferences DataStore (gestión de idioma y suscripción)

---

## 🤖 Componente de IA y Funcionamiento

U-Pad integra de forma segura la API de **Groq AI** mediante el uso del modelo de procesamiento de lenguaje natural `llama-3.3-70b-versatile`. 

### ¿Cómo funciona en la aplicación?
1. **Instrucciones de Contexto (System Prompt)**: Se entrena conceptualmente al modelo como un psicopedagogo experto en autismo, indicándole que retorne exactamente 3 sugerencias cortas (máximo 4 palabras cada una) por línea para garantizar la comprensión del menor.
2. **Petición del Tutor**: Desde la vista de creación de rutinas, al hacer clic en "Sugerir con IA", el ViewModel invoca de forma asíncrona al `AiRepository.kt` para consultar el modelo con el turno de la rutina correspondiente.
3. **Manejo de Errores Reactivo**: El sistema monitoriza los estados de red a través de flujos observables (`isAiLoading` y `aiError`). Si la API de Groq falla o hay problemas de conexión, la aplicación interrumpe la carga de inmediato y despliega un `AlertDialog` informativo al tutor, previniendo pantallas congeladas.

---

## 📸 Evidencias Visuales (Capturas de Pantalla)

*[Las siguientes capturas de pantalla serán insertadas en los correspondientes marcadores de posición]*

* `[Captura de pantalla: Pantalla de Bienvenida de U-Pad (WelcomeScreen) y Selector de Roles]`
* `[Captura de pantalla: Panel de Edición de Rutinas por Bloques Temporales (CreateRoutineScreen)]`
* `[Captura de pantalla: Mapa de Seguimiento GPS Activo del Niño (HijoTrackingScreen)]`

---

## 📂 Entregables del Proyecto

* **Documento de Evidencias**: `[Documento de Evidencias de Curso en formato Word (.docx): UPad_evidencias.docx]`
* **APK de Depuración**: `[Ejecutable Compilado APK de depuración: UPad_debug.apk]`
* **Demostración Práctica**: `[Video Demostrativo del funcionamiento y flujo de U-Pad: Insertar enlace del video aquí]`

---

## 👥 Integrantes del Proyecto

* Mamani Puma, Anyelina Yolit
* Mansilla Tovar, Maria Fernanda
* Ricasca Montes, Angelo Joseph
* Vargas Jucharo, Angelo Rodrigo

---

## 🔒 Configuración e Instrucciones de Credenciales

Para compilar y desplegar el proyecto con éxito, se requieren las siguientes API Keys y configuraciones de servicios:

1. **Archivo local.properties**: Crea este archivo en la raíz del proyecto y define las llaves sensibles que leerá `build.gradle.kts` para inyectar en `BuildConfig`:
   ```properties
   GROQ_API_KEY=tu_clave_de_api_de_groq_aqui
   GOOGLE_CLIENT_ID=tu_client_id_de_google_sign_in_aqui
   ```
2. **Archivo AndroidManifest.xml**: Aloja la llave del SDK de Google Maps necesaria para renderizar los mapas satelitales en tiempo real (`com.google.android.geo.API_KEY`).
3. **Archivo google-services.json**: Descárgalo desde tu consola de Firebase Console y ubícalo en la carpeta `/app` para conectar los servicios de Firestore y Auth.

---

## 💻 Instrucciones de Ejecución

1. Clona el repositorio e introduce las credenciales detalladas en el paso anterior.
2. Abre el proyecto en **Android Studio**.
3. Sincroniza los archivos de Gradle.
4. Despliega la aplicación en un dispositivo emulador o físico con **API level 24 (Android 7.0) o superior**.

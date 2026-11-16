package com.example.upad.data

import android.content.Context
import android.content.SharedPreferences
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.example.upad.UPadApplication
import com.example.upad.viewmodel.TaskItem
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.security.SecureRandom
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

data class LocalUser(
    val uid: String,
    val email: String,
    val name: String,
    val isPremium: Boolean = false,
    val language: String = "es"
)

data class LocalChildDevice(
    val deviceId: String,
    val padreId: String = "",
    val modelo: String = "Android Device",
    val latitud: Double = 0.0,
    val longitud: Double = 0.0,
    val kioscoActivo: Boolean = false,
    val ultimaActualizacion: Long = System.currentTimeMillis(),
    // Datos que llegan del servidor (GET /api/v1/devices). Nullables: las copias guardadas antes no los tienen.
    val nombre: String? = null,
    val tieneUbicacion: Boolean = false,
    val ubicacionActualizadaEn: String? = null
)

data class LocalPairingCode(
    val code: String,
    val deviceId: String,
    val estado: String = "esperando",
    val padreId: String = ""
)

data class LocalNotification(
    val id: String = UUID.randomUUID().toString(),
    val title: String,
    val description: String,
    val type: String = "INFO",
    val timestamp: Long = System.currentTimeMillis()
)

data class LocalEmotionRecord(
    val id: String = UUID.randomUUID().toString(),
    val actividad: String,
    val emocion: String,
    val turn: String,
    val dia: String,
    val timestamp: Long = System.currentTimeMillis()
)

/** Aviso del teléfono del niño para su padre, tal como lo guarda el servidor. */
data class AvisoPadre(
    val id: String,
    val tipo: String,
    val titulo: String,
    val descripcion: String,
    val creadoEnMs: Long,
    val leida: Boolean,
    val nombreHijo: String?
)

/** Una fila del resumen de cumplimiento (un día, un turno o un hijo). porcentaje null = no se esperaba nada. */
data class FilaCumplimiento(val etiqueta: String, val completadas: Int, val esperadas: Int, val porcentaje: Int?)

/** Resumen real de GET /api/v1/cumplimiento (lo que los hijos completaron en su teléfono). */
data class ResumenCumplimiento(
    val hayRegistros: Boolean,
    val total: FilaCumplimiento,
    val dias: List<FilaCumplimiento>,
    val porTurno: List<FilaCumplimiento>,
    val porHijo: List<FilaCumplimiento>
)

/**
 * Respuesta HTTP del backend. null en las llamadas significa «sin conexión»; cualquier respuesta del servidor
 * (incluidos 4xx y 5xx) llega aquí, para que la app no confunda un rechazo con un éxito.
 */
data class RespuestaHttp(val codigo: Int, val cuerpo: String) {
    val ok: Boolean get() = codigo in 200..299

    fun json(): Map<*, *>? = try {
        Gson().fromJson(cuerpo, Map::class.java)
    } catch (e: Exception) {
        null
    }

    fun data(): Any? = json()?.get("data")

    /** Código de error del backend: { errors: { code } } o { error: { code } }. */
    fun codigoError(): String? {
        val j = json() ?: return null
        return ((j["errors"] as? Map<*, *>)?.get("code") ?: (j["error"] as? Map<*, *>)?.get("code")) as? String
    }

    fun mensaje(porDefecto: String): String {
        val j = json() ?: return porDefecto
        return (j["message"] as? String)?.takeIf { it.isNotBlank() }
            ?: ((j["error"] as? Map<*, *>)?.get("message") as? String)?.takeIf { it.isNotBlank() }
            ?: porDefecto
    }
}

/**
 * Datos de U-Pad en el teléfono y comunicación con el backend (la única fuente de verdad).
 * Firebase ya no se usa: la sesión, los hijos, el bloqueo kiosco y los avisos van por la API.
 */
object LocalDataManager {
    private const val TAG = "LocalDataManager"
    private const val PREFS_NAME = "UPAD_LOCAL_STORAGE"
    private const val KEY_CURRENT_USER_UID = "CURRENT_USER_UID"
    private const val KEY_USERS_MAP = "USERS_MAP"
    private const val KEY_ROUTINES_PREFIX = "ROUTINE_"
    private const val KEY_REINFORCEMENTS_PREFIX = "REINFORCE_"
    private const val KEY_DEVICES_MAP = "DEVICES_MAP"
    private const val KEY_PAIRING_CODES = "PAIRING_CODES"
    private const val KEY_OFFLINE_HASH_PREFIX = "OFFLINE_HASH_"
    private const val KEY_SERVER_IP = "SERVER_IP"

    /** Id que se usa cuando no hay sesión (nunca existe en el servidor). */
    const val SIN_SESION = "padre_local_1"

    const val MENSAJE_SIN_CONEXION = "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo."

    private const val CLOUD_RUN_URL = "https://upad-backend-service-466241893446.us-central1.run.app"

    private val gson = Gson()
    private val mainHandler = Handler(Looper.getMainLooper())

    private val prefs: SharedPreferences by lazy {
        UPadApplication.appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    private val upadPrefs: SharedPreferences
        get() = UPadApplication.appContext.getSharedPreferences("UPAD_PREFS", Context.MODE_PRIVATE)

    // Oyentes en memoria (las pantallas se actualizan al cambiar los datos)
    private val routineListeners = ConcurrentHashMap<String, CopyOnWriteArrayList<(List<TaskItem>) -> Unit>>()
    private val languageListeners = ConcurrentHashMap<String, CopyOnWriteArrayList<(String) -> Unit>>()
    private val premiumListeners = ConcurrentHashMap<String, CopyOnWriteArrayList<(Boolean) -> Unit>>()
    private val deviceListeners = ConcurrentHashMap<String, CopyOnWriteArrayList<(LocalChildDevice?) -> Unit>>()
    private val pairingListeners = ConcurrentHashMap<String, CopyOnWriteArrayList<(LocalPairingCode?) -> Unit>>()
    private val parentDeviceListListeners = ConcurrentHashMap<String, CopyOnWriteArrayList<(List<LocalChildDevice>) -> Unit>>()
    private val lastSyncSignatureMap = ConcurrentHashMap<String, Long>()

    /** true cuando el servidor rechazó el token de la sesión (cuenta borrada, desactivada o token vencido). */
    private val _sesionCaducada = MutableStateFlow(false)
    val sesionCaducada: StateFlow<Boolean> = _sesionCaducada

    /** Bloqueo kiosco que el padre fijó para ESTE teléfono (lo actualiza la consulta de estado). */
    private val _kioscoEsteDispositivo = MutableStateFlow(
        try {
            getAllDevices()[idEsteDispositivo()]?.kioscoActivo ?: false
        } catch (e: Exception) {
            false
        }
    )
    val kioscoEsteDispositivo: StateFlow<Boolean> = _kioscoEsteDispositivo

    private fun enc(valor: String): String = URLEncoder.encode(valor, "UTF-8")

    // ==========================================
    // RED: una sola URL base y respuestas reales
    // ==========================================

    /** Servidor elegido en Ajustes (IP o URL). Vacío = Cloud Run. */
    fun getServerIp(): String = prefs.getString(KEY_SERVER_IP, "") ?: ""

    /** Guarda el servidor de pruebas; vacío vuelve a Cloud Run. */
    fun setServerIp(ip: String) {
        val limpio = ip.trim()
        if (limpio.isEmpty()) prefs.edit().remove(KEY_SERVER_IP).apply()
        else prefs.edit().putString(KEY_SERVER_IP, limpio).apply()
    }

    /** URL base: Cloud Run, o el servidor fijado en Ajustes (para probar contra el backend local). Nunca se mezclan. */
    fun baseUrl(): String {
        val ip = getServerIp()
        return when {
            ip.isBlank() -> CLOUD_RUN_URL
            ip.startsWith("http://") || ip.startsWith("https://") -> ip.trimEnd('/')
            ip.contains(":") -> "http://$ip"
            else -> "http://$ip:3000"
        }
    }

    /**
     * Petición al backend. Devuelve null SOLO si no hubo respuesta (sin red, servidor caído, tiempo agotado).
     * Debe llamarse fuera del hilo principal.
     */
    private fun httpRequest(
        method: String,
        path: String,
        body: JSONObject? = null,
        token: String? = null,
        readTimeoutMs: Int = 15000
    ): RespuestaHttp? {
        val base = baseUrl()
        var conn: HttpURLConnection? = null
        return try {
            conn = (URL("$base$path").openConnection() as HttpURLConnection).apply {
                requestMethod = method
                connectTimeout = 6000
                readTimeout = readTimeoutMs
                setRequestProperty("Accept", "application/json")
                setRequestProperty("User-Agent", "UPad-Android-Client/2.0")
                if (!token.isNullOrBlank()) setRequestProperty("Authorization", "Bearer $token")
                if (body != null) {
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json; charset=utf-8")
                }
            }
            if (body != null) {
                conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            val codigo = conn.responseCode
            val stream = if (codigo in 200..299) conn.inputStream else conn.errorStream
            val texto = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
            if (codigo == 401 && !token.isNullOrBlank() && token == tokenSesion()) {
                Log.w(TAG, "El servidor rechazó el token de la sesión ($method $path): se cierra la sesión")
                logout()
                _sesionCaducada.value = true
            }
            RespuestaHttp(codigo, texto)
        } catch (e: Exception) {
            Log.w(TAG, "Sin respuesta de $base$path: ${e.message}")
            null
        } finally {
            conn?.disconnect()
        }
    }

    // ==========================================
    // SESIÓN
    // ==========================================

    fun getAllUsers(): Map<String, LocalUser> {
        val json = prefs.getString(KEY_USERS_MAP, null) ?: return emptyMap()
        val type = object : TypeToken<Map<String, LocalUser>>() {}.type
        return try {
            gson.fromJson(json, type) ?: emptyMap()
        } catch (e: Exception) {
            emptyMap()
        }
    }

    private fun saveUsersMap(users: Map<String, LocalUser>) {
        prefs.edit().putString(KEY_USERS_MAP, gson.toJson(users)).apply()
    }

    fun getCurrentUser(): LocalUser? {
        val uid = prefs.getString(KEY_CURRENT_USER_UID, null) ?: return null
        return getAllUsers().values.find { it.uid == uid }
    }

    /** Id del usuario en el backend; SIN_SESION si no hay sesión. */
    fun getCurrentUserId(): String {
        return getCurrentUser()?.uid ?: SIN_SESION
    }

    fun isLoggedIn(): Boolean {
        return prefs.getString(KEY_CURRENT_USER_UID, null) != null
    }

    /** Token JWT de la sesión (null si no hay o se entró sin conexión). */
    fun tokenSesion(): String? = upadPrefs.getString("AUTH_TOKEN", null)?.takeIf { it.isNotBlank() }

    /** El token solo se envía si la petición es de la propia cuenta (el niño usa el id de su padre sin token). */
    private fun tokenPara(userId: String): String? =
        if (isLoggedIn() && userId == getCurrentUserId()) tokenSesion() else null

    /** Guarda la sesión que devuelve el backend ({ token, usuario }). */
    private fun guardarSesion(data: Map<*, *>?, emailRespaldo: String): LocalUser? {
        val token = data?.get("token") as? String
        val usuario = data?.get("usuario") as? Map<*, *>
        val id = usuario?.get("id") as? String
        if (token.isNullOrBlank() || id.isNullOrBlank()) return null

        val email = ((usuario["email"] as? String) ?: emailRespaldo).trim().lowercase()
        val nombre = (usuario["nombre"] as? String)?.takeIf { it.isNotBlank() } ?: email.substringBefore("@").uppercase()

        val users = getAllUsers().toMutableMap()
        val anterior = users[email]?.takeIf { it.uid == id }
        // El plan (premium o básico) solo existe en el teléfono: se respeta el que el usuario ya eligió
        val user = LocalUser(
            uid = id,
            email = email,
            name = nombre,
            isPremium = anterior?.isPremium ?: true,
            language = anterior?.language ?: "es"
        )
        users[email] = user
        saveUsersMap(users)

        prefs.edit().putString(KEY_CURRENT_USER_UID, id).apply()
        upadPrefs.edit()
            .putString("PARENT_NAME", nombre)
            .putString("LOCAL_USER_EMAIL", email)
            .putString("LOCAL_USER_UID", id)
            .putString("AUTH_TOKEN", token)
            .apply()
        _sesionCaducada.value = false
        return user
    }

    // Contraseña para entrar sin conexión: PBKDF2 con sal, guardado tras el último login correcto en el servidor
    private fun hashOffline(pass: String, sal: ByteArray): ByteArray {
        val spec = PBEKeySpec(pass.toCharArray(), sal, 20000, 256)
        return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA1").generateSecret(spec).encoded
    }

    private fun guardarHashOffline(email: String, pass: String) {
        val sal = ByteArray(16).also { SecureRandom().nextBytes(it) }
        val b64 = { b: ByteArray -> android.util.Base64.encodeToString(b, android.util.Base64.NO_WRAP) }
        prefs.edit().putString(KEY_OFFLINE_HASH_PREFIX + email, b64(sal) + ":" + b64(hashOffline(pass, sal))).apply()
    }

    private fun verificarHashOffline(email: String, pass: String): Boolean {
        val guardado = prefs.getString(KEY_OFFLINE_HASH_PREFIX + email, null) ?: return false
        val partes = guardado.split(":")
        if (partes.size != 2) return false
        return try {
            val sal = android.util.Base64.decode(partes[0], android.util.Base64.NO_WRAP)
            val esperado = android.util.Base64.decode(partes[1], android.util.Base64.NO_WRAP)
            java.security.MessageDigest.isEqual(esperado, hashOffline(pass, sal))
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Inicia sesión en el backend. Si el servidor responde con un error (contraseña incorrecta, cuenta bloqueada,
     * límite de intentos), se muestra su mensaje. Solo sin conexión se permite entrar con la última contraseña
     * correcta usada en este teléfono.
     */
    fun login(email: String, pass: String): Result<LocalUser> {
        val cleanEmail = email.trim().lowercase()
        val r = httpRequest("POST", "/api/auth/login", JSONObject().put("email", cleanEmail).put("password", pass))

        if (r != null) {
            if (!r.ok) {
                return Result.failure(Exception(r.mensaje("No se pudo iniciar sesión. Revisa tu correo y contraseña.")))
            }
            val user = guardarSesion(r.data() as? Map<*, *>, cleanEmail)
                ?: return Result.failure(Exception("Respuesta inesperada del servidor."))
            guardarHashOffline(cleanEmail, pass)
            return Result.success(user)
        }

        // Sin conexión: solo con la contraseña correcta del último inicio de sesión en este teléfono
        val localUser = getAllUsers()[cleanEmail]
        if (localUser != null && verificarHashOffline(cleanEmail, pass)) {
            prefs.edit().putString(KEY_CURRENT_USER_UID, localUser.uid).apply()
            upadPrefs.edit()
                .putString("PARENT_NAME", localUser.name)
                .putString("LOCAL_USER_EMAIL", localUser.email)
                .putString("LOCAL_USER_UID", localUser.uid)
                .apply()
            Log.d(TAG, "Inicio de sesión sin conexión (contraseña verificada en el teléfono)")
            return Result.success(localUser)
        }
        return Result.failure(Exception(MENSAJE_SIN_CONEXION))
    }

    fun register(name: String, email: String, pass: String, codigoInstitucion: String = ""): Result<LocalUser> {
        val cleanEmail = email.trim().lowercase()
        val cleanName = name.trim().ifEmpty { cleanEmail.substringBefore("@").uppercase() }
        val cuerpo = JSONObject().put("nombre", cleanName).put("email", cleanEmail).put("password", pass).put("rol", "tutor")
        // Código de la institución (opcional): un código inválido rechaza el registro sin crear la cuenta
        if (codigoInstitucion.isNotBlank()) cuerpo.put("codigoOrganizacion", codigoInstitucion.trim())
        val r = httpRequest("POST", "/api/auth/register", cuerpo)
            ?: return Result.failure(Exception(MENSAJE_SIN_CONEXION))
        if (!r.ok) return Result.failure(Exception(r.mensaje("No se pudo crear la cuenta.")))
        val user = guardarSesion(r.data() as? Map<*, *>, cleanEmail)
            ?: return Result.failure(Exception("Respuesta inesperada del servidor."))
        guardarHashOffline(cleanEmail, pass)
        return Result.success(user)
    }

    /**
     * Entrar con Google: el token de Google se valida en el backend (POST /api/auth/google). Si la cuenta
     * no existe, se registra como tutor (sin organización) con POST /api/auth/google/registro.
     */
    fun loginWithGoogle(idToken: String): Result<LocalUser> {
        val r = httpRequest("POST", "/api/auth/google", JSONObject().put("credential", idToken))
            ?: return Result.failure(Exception(MENSAJE_SIN_CONEXION))
        if (!r.ok) return Result.failure(Exception(r.mensaje("No se pudo iniciar sesión con Google.")))

        val data = r.data() as? Map<*, *>
        if (data?.get("requiereRegistro") == true) {
            val cuerpo = JSONObject().put("credential", idToken).put("rol", "tutor")
            val registro = httpRequest("POST", "/api/auth/google/registro", cuerpo)
                ?: return Result.failure(Exception(MENSAJE_SIN_CONEXION))
            if (!registro.ok) return Result.failure(Exception(registro.mensaje("No se pudo crear la cuenta con Google.")))
            val user = guardarSesion(registro.data() as? Map<*, *>, "")
                ?: return Result.failure(Exception("Respuesta inesperada del servidor."))
            return Result.success(user)
        }
        val user = guardarSesion(data, "") ?: return Result.failure(Exception("Respuesta inesperada del servidor."))
        return Result.success(user)
    }

    fun logout() {
        prefs.edit().remove(KEY_CURRENT_USER_UID).apply()
        upadPrefs.edit()
            .remove("LOCAL_USER_UID")
            .remove("AUTH_TOKEN")
            .apply()
        Log.d(TAG, "Sesión cerrada")
    }

    fun saveUserData(userId: String, name: String) {
        val users = getAllUsers().toMutableMap()
        val entry = users.entries.find { it.value.uid == userId }
        if (entry != null) {
            val updated = entry.value.copy(name = name)
            users[entry.key] = updated
            saveUsersMap(users)
        }
    }

    fun setPremiumStatus(userId: String, isPremium: Boolean) {
        val users = getAllUsers().toMutableMap()
        val entry = users.entries.find { it.value.uid == userId }
        if (entry != null) {
            val updated = entry.value.copy(isPremium = isPremium)
            users[entry.key] = updated
            saveUsersMap(users)
        }
        mainHandler.post {
            premiumListeners[userId]?.forEach { it.invoke(isPremium) }
        }
    }

    fun listenUserPremium(userId: String, onPremiumChanged: (Boolean) -> Unit): ListenerRegistration {
        val user = getAllUsers().values.find { it.uid == userId }
        val current = user?.isPremium ?: true
        onPremiumChanged(current)

        val list = premiumListeners.getOrPut(userId) { CopyOnWriteArrayList() }
        list.add(onPremiumChanged)
        return ListenerRegistration { list.remove(onPremiumChanged) }
    }

    fun saveUserLanguage(userId: String, languageCode: String) {
        val users = getAllUsers().toMutableMap()
        val entry = users.entries.find { it.value.uid == userId }
        if (entry != null) {
            val updated = entry.value.copy(language = languageCode)
            users[entry.key] = updated
            saveUsersMap(users)
        }
        mainHandler.post {
            languageListeners[userId]?.forEach { it.invoke(languageCode) }
        }
    }

    fun listenUserLanguage(userId: String, onLanguageChanged: (String) -> Unit): ListenerRegistration {
        val user = getAllUsers().values.find { it.uid == userId }
        val current = user?.language ?: "es"
        onLanguageChanged(current)

        val list = languageListeners.getOrPut(userId) { CopyOnWriteArrayList() }
        list.add(onLanguageChanged)
        return ListenerRegistration { list.remove(onLanguageChanged) }
    }

    // ==========================================
    // GESTIÓN DE RUTINAS LOCALES
    // ==========================================

    private fun routineKey(userId: String, turn: String, dia: String): String {
        val u = if (userId.isEmpty() || userId == "PADRE_TEST") getCurrentUserId() else userId
        return "$KEY_ROUTINES_PREFIX${u.uppercase()}_${turn.uppercase().trim()}_${dia.uppercase().trim()}"
    }

    fun saveRoutinePorDia(userId: String, turn: String, dia: String, tasks: List<TaskItem>) {
        val u = if (userId.isEmpty() || userId == "PADRE_TEST") getCurrentUserId() else userId
        val key = routineKey(u, turn, dia)
        prefs.edit().putString(key, gson.toJson(tasks)).apply()

        // Disparar listeners reactivos
        mainHandler.post {
            routineListeners[key]?.forEach { listener ->
                listener.invoke(tasks)
            }
        }
        Log.d(TAG, "Rutina guardada localmente [$key]: ${tasks.size} tareas")

        // Sincronizar en caliente hacia el backend / base de datos de la nube con el ID del usuario (evitando peticiones duplicadas)
        kotlin.concurrent.thread {
            try {
                tasks.lastOrNull()?.let { ultima ->
                    val turnEnvio = when (turn.uppercase().trim()) {
                        "MAÑANA" -> "MANANA"
                        else -> turn.uppercase().trim()
                    }
                    val syncSignature = "${u}_${turnEnvio}_${ultima.actividad.trim().uppercase()}"
                    val now = System.currentTimeMillis()
                    val lastSync = lastSyncSignatureMap[syncSignature] ?: 0L
                    if (now - lastSync > 2000L) {
                        lastSyncSignatureMap[syncSignature] = now
                        val body = JSONObject()
                            .put("actividad", ultima.actividad)
                            .put("palabraClave", ultima.palabraClave)
                            .put("turno", turnEnvio)
                            .put("userId", u)
                        // Pasos con sus minutos y pictograma (puntos 12-14) e hijo asignado (punto 5; sin él, todos)
                        val pasosEnvio = org.json.JSONArray()
                        ultima.pasosEfectivos().forEach { paso ->
                            val p = JSONObject()
                                .put("texto", paso.texto)
                                .put("palabraClave", paso.palabraClave.ifBlank { paso.texto })
                                .put("duracionMinutos", paso.duracionMinutos.coerceIn(1, 120))
                            paso.pictogramaId?.let { p.put("pictogramaId", it) }
                            pasosEnvio.put(p)
                        }
                        body.put("pasos", pasosEnvio)
                        ultima.ninoId?.takeIf { it.isNotBlank() }?.let { body.put("ninoId", it) }
                        val r = httpRequest("POST", "/api/v1/mobile/sync-routines", body, tokenPara(u))
                        if (r != null && !r.ok) Log.w(TAG, "El servidor rechazó la rutina (HTTP ${r.codigo} ${r.codigoError() ?: ""})")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error enviando rutina a la nube: ${e.message}")
            }
        }
    }

    fun deleteRoutineTask(userId: String, turn: String, actividad: String) {
        val u = if (userId.isEmpty() || userId == "PADRE_TEST") getCurrentUserId() else userId
        val turnEnvio = when (turn.uppercase().trim()) {
            "MAÑANA" -> "MANANA"
            else -> turn.uppercase().trim()
        }
        val cleanAct = actividad.trim().uppercase()
        val todosLosDias = listOf("LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO")
        for (d in todosLosDias) {
            val key = routineKey(u, turnEnvio, d)
            val current = getRoutinePorDia(u, turnEnvio, d).toMutableList()
            val removed = current.removeAll { it.actividad.trim().equals(cleanAct, ignoreCase = true) }
            if (removed) {
                prefs.edit().putString(key, gson.toJson(current)).apply()
                routineListeners[key]?.forEach { it.invoke(current) }
            }
        }
        kotlin.concurrent.thread {
            httpRequest(
                "DELETE",
                "/api/v1/mobile/sync-routines?userId=${enc(u)}&actividad=${enc(actividad)}&turno=${enc(turnEnvio)}",
                token = tokenPara(u)
            )
        }
    }

    fun getRoutinePorDia(userId: String, turn: String, dia: String): List<TaskItem> {
        val u = if (userId.isEmpty() || userId == "PADRE_TEST") getCurrentUserId() else userId
        val key = routineKey(u, turn, dia)
        val json = prefs.getString(key, null)
        if (json.isNullOrEmpty()) {
            return emptyList()
        }
        val type = object : TypeToken<List<TaskItem>>() {}.type
        return try {
            gson.fromJson(json, type) ?: emptyList()
        } catch (e: Exception) {
            emptyList()
        }
    }

    /**
     * Rutinas de un turno. Con deviceIdHijo (lo pasa SOLO la pantalla del niño), se piden las de ese hijo y se marca
     * lo que ya completó hoy; sin él (pantallas del padre), todas las del padre.
     */
    fun listenRoutinePorDia(
        userId: String,
        turn: String,
        dia: String,
        deviceIdHijo: String? = null,
        onDataChanged: (List<TaskItem>) -> Unit
    ): ListenerRegistration {
        val u = if (userId.isEmpty() || userId == "PADRE_TEST") getCurrentUserId() else userId
        val key = routineKey(u, turn, dia)
        val initial = getRoutinePorDia(u, turn, dia)
        onDataChanged(initial)

        val list = routineListeners.getOrPut(key) { CopyOnWriteArrayList() }
        list.add(onDataChanged)

        // Sincronización en vivo con el backend para ESTE usuario. En el teléfono del niño se piden solo sus rutinas
        // (?deviceId=) y se marca lo que ya completó hoy (se guarda en el teléfono y en el servidor): recargar la lista
        // ya no borra el avance, así que la siguiente actividad se habilita (puntos 10 y 11).
        var isPolling = true
        kotlin.concurrent.thread {
            while (isPolling) {
                try {
                    val hijo = deviceIdHijo?.takeIf { it.isNotBlank() }
                    val ruta = "/api/v1/mobile/sync-routines?userId=${enc(u)}" + (hijo?.let { "&deviceId=${enc(it)}" } ?: "")
                    val jsonStr = httpRequest("GET", ruta, token = tokenPara(u))?.takeIf { it.ok }?.cuerpo
                    if (!jsonStr.isNullOrEmpty()) {
                        val tareas = tareasDelServidor(jsonStr, turn, hijo)
                        if (tareas != null && isPolling) {
                            mainHandler.post { onDataChanged(tareas) }
                        }
                    }
                    Thread.sleep(3000)
                } catch (e: Exception) {
                    Thread.sleep(5000)
                }
            }
        }

        return ListenerRegistration {
            isPolling = false
            list.remove(onDataChanged)
        }
    }

    private fun turnoServidor(turn: String): String = when (turn.uppercase().trim()) {
        "MAÑANA" -> "MANANA"
        else -> turn.uppercase().trim()
    }

    /** Convierte la respuesta de GET /mobile/sync-routines en las tareas de un turno (en orden de creación). */
    private fun tareasDelServidor(jsonStr: String, turn: String, deviceIdHijo: String?): List<TaskItem>? {
        val root = JSONObject(jsonStr)
        val data = root.optJSONArray("data") ?: return null
        val turnNormalizado = turnoServidor(turn)
        val completadas = if (deviceIdHijo != null) completadasHoy(deviceIdHijo) else emptySet()
        val diaKey = com.example.upad.utils.RoutineProgressCalculator.obtenerPrefijoDia(
            com.example.upad.utils.RoutineProgressCalculator.obtenerDiaDeHoy()
        )
        val tareas = mutableListOf<TaskItem>()
        for (i in 0 until data.length()) {
            val r = data.optJSONObject(i) ?: continue
            if (r.optString("turno").uppercase() != turnNormalizado) continue
            val act = r.optString("actividad", "ACTIVIDAD")
            val pasosJson = r.optJSONArray("pasos")
            val pasos = mutableListOf<com.example.upad.viewmodel.PasoTarea>()
            if (pasosJson != null) {
                for (k in 0 until pasosJson.length()) {
                    val p = pasosJson.optJSONObject(k) ?: continue
                    val texto = p.optString("texto").trim()
                    if (texto.isEmpty()) continue
                    val clave = p.optString("palabraClave").ifBlank { texto }
                    val pictogramaId = p.optInt("pictogramaId", 0).takeIf { it > 0 }
                    pasos.add(
                        com.example.upad.viewmodel.PasoTarea(
                            texto = texto,
                            palabraClave = clave,
                            duracionMinutos = p.optInt("duracionMinutos", 5).coerceIn(1, 120),
                            pictogramaId = pictogramaId,
                            imageUrl = pictogramaId?.let { PictogramasArasaac.urlImagen(it) } ?: PictogramasArasaac.urlPara(clave)
                        )
                    )
                }
            }
            val kw = r.optString("palabraClave").ifBlank { act.lowercase() }
            // Imagen de la actividad: la de su primer paso o, si no hay, la del título
            // La tarjeta muestra el pictograma del TÍTULO («Tomar desayuno» → desayuno); el de cada paso se ve al ejecutarla
            val imagen = PictogramasArasaac.urlPara(act.lowercase()).ifEmpty { pasos.firstOrNull()?.imageUrl.orEmpty() }
            val hecha = deviceIdHijo != null && claveActividad(turnNormalizado, act) in completadas
            tareas.add(
                TaskItem(
                    actividad = act,
                    palabraClave = kw,
                    imageUrl = imagen,
                    dias = listOf("LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"),
                    duration = r.optInt("duracionTotalMinutos", pasos.sumOf { it.duracionMinutos }.takeIf { it > 0 } ?: 5),
                    estadosPorDia = if (hecha) mapOf(diaKey to true) else emptyMap(),
                    id = r.optString("id").ifBlank { null },
                    ninoId = r.optString("ninoId").takeIf { it.isNotBlank() && it != "null" },
                    pasos = pasos
                )
            )
        }
        return tareas
    }

    // ==========================================
    // AVANCE DEL NIÑO (actividades completadas hoy)
    // ==========================================

    private val ultimaConsultaCompletadas = ConcurrentHashMap<String, Long>()

    private fun fechaLocalHoy(): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(System.currentTimeMillis())

    private fun claveActividad(turno: String, actividad: String): String =
        "${turnoServidor(turno)}|${actividad.trim().replace(Regex("\\s+"), " ").uppercase()}"

    private fun claveCompletadas(deviceId: String, fecha: String) = "COMPLETADAS_${deviceId}_$fecha"

    private fun leerCompletadas(deviceId: String, fecha: String): Set<String> =
        prefs.getStringSet(claveCompletadas(deviceId, fecha), emptySet())?.toSet() ?: emptySet()

    /**
     * Actividades que este teléfono completó hoy («TURNO|ACTIVIDAD»): las guardadas en el teléfono más las que tiene el
     * servidor (consultado como mucho cada 15 s). Fuera del hilo principal.
     */
    fun completadasHoy(deviceId: String): Set<String> {
        val fecha = fechaLocalHoy()
        val local = leerCompletadas(deviceId, fecha)
        val ahora = System.currentTimeMillis()
        if (ahora - (ultimaConsultaCompletadas[deviceId] ?: 0L) < 15_000L) return local
        ultimaConsultaCompletadas[deviceId] = ahora
        val r = httpRequest("GET", "/api/v1/devices/${enc(deviceId)}/cumplimiento?fecha=${enc(fecha)}") ?: return local
        if (!r.ok) return local
        val lista = (r.data() as? Map<*, *>)?.get("completadas") as? List<*> ?: return local
        val delServidor = lista.mapNotNull { item ->
            val m = item as? Map<*, *> ?: return@mapNotNull null
            val actividad = m["actividad"] as? String ?: return@mapNotNull null
            claveActividad(m["turno"] as? String ?: "", actividad)
        }
        val union = local + delServidor
        if (union.size != local.size) {
            prefs.edit().putStringSet(claveCompletadas(deviceId, fecha), union).apply()
        }
        return union
    }

    /**
     * Cumplimiento real de los últimos `dias` días (hasta hoy, fecha local) del padre con sesión: por día, por turno y
     * por hijo (punto 8). null si no hay sesión o no hubo respuesta. Fuera del hilo principal.
     */
    fun obtenerCumplimiento(dias: Int = 7): ResumenCumplimiento? {
        val token = tokenSesion() ?: return null
        val r = httpRequest("GET", "/api/v1/cumplimiento?dias=$dias&hasta=${enc(fechaLocalHoy())}", token = token) ?: return null
        if (!r.ok) return null
        val data = (r.data() as? Map<*, *>) ?: return null
        fun entero(v: Any?): Int = (v as? Number)?.toInt() ?: 0
        fun fila(m: Any?, etiqueta: String): FilaCumplimiento {
            val mapa = m as? Map<*, *> ?: emptyMap<Any, Any>()
            return FilaCumplimiento(etiqueta, entero(mapa["completadas"]), entero(mapa["esperadas"]), (mapa["porcentaje"] as? Number)?.toInt())
        }
        fun lista(clave: String, etiqueta: (Map<*, *>) -> String): List<FilaCumplimiento> =
            (data[clave] as? List<*>)?.mapNotNull { item -> (item as? Map<*, *>)?.let { fila(it, etiqueta(it)) } } ?: emptyList()
        return ResumenCumplimiento(
            hayRegistros = data["hayRegistros"] == true,
            total = fila(data["total"], "total"),
            dias = lista("dias") { it["fecha"] as? String ?: "" },
            porTurno = lista("porTurno") { it["turno"] as? String ?: "" },
            porHijo = lista("porHijo") { (it["nombre"] as? String)?.takeIf { n -> n.isNotBlank() } ?: "—" }
        )
    }

    /** Institución del padre con sesión: nombre, o null si no pertenece a ninguna (o no hubo respuesta). */
    fun obtenerMiInstitucion(): Result<String?> {
        val token = tokenSesion() ?: return Result.failure(Exception("Inicia sesión para ver tu institución."))
        val r = httpRequest("GET", "/api/v1/organizaciones/mia", token = token) ?: return Result.failure(Exception(MENSAJE_SIN_CONEXION))
        if (!r.ok) return Result.failure(Exception(r.mensaje("No se pudo consultar tu institución.")))
        val org = (r.data() as? Map<*, *>)?.get("organizacion") as? Map<*, *>
        return Result.success(org?.get("nombre") as? String)
    }

    /** El tutor se une (o cambia) a la institución del código. Devuelve el nombre de la institución. */
    fun unirseAInstitucion(codigo: String): Result<String> {
        val token = tokenSesion() ?: return Result.failure(Exception("Inicia sesión para unirte a una institución."))
        val r = httpRequest("POST", "/api/v1/organizaciones/unirse", JSONObject().put("codigo", codigo.trim()), token)
            ?: return Result.failure(Exception(MENSAJE_SIN_CONEXION))
        if (!r.ok) {
            val mensaje = if (r.codigoError() == "ORGANIZACION_CODIGO_INVALIDO") "El código de la institución no es válido." else r.mensaje("No se pudo unir a la institución.")
            return Result.failure(Exception(mensaje))
        }
        val org = (r.data() as? Map<*, *>)?.get("organizacion") as? Map<*, *>
        return Result.success(org?.get("nombre") as? String ?: "")
    }

    /** Marca en el teléfono una actividad completada hoy (la lista la mantiene completada aunque se recargue). */
    fun marcarCompletadaLocal(deviceId: String, turno: String, actividad: String) {
        if (deviceId.isBlank() || actividad.isBlank()) return
        val fecha = fechaLocalHoy()
        val actual = leerCompletadas(deviceId, fecha)
        prefs.edit().putStringSet(claveCompletadas(deviceId, fecha), actual + claveActividad(turno, actividad)).apply()
    }

    // ==========================================
    // MENSAJES DE REFUERZO
    // ==========================================

    fun saveReinforcementMessages(userId: String, turn: String, messages: List<String>) {
        val u = if (userId.isEmpty() || userId == "PADRE_TEST") getCurrentUserId() else userId
        val key = "$KEY_REINFORCEMENTS_PREFIX${u.uppercase()}_${turn.uppercase().trim()}"
        prefs.edit().putString(key, gson.toJson(messages)).apply()
    }

    fun getReinforcementMessages(userId: String, turn: String): List<String> {
        val u = if (userId.isEmpty() || userId == "PADRE_TEST") getCurrentUserId() else userId
        val key = "$KEY_REINFORCEMENTS_PREFIX${u.uppercase()}_${turn.uppercase().trim()}"
        val json = prefs.getString(key, null)
        if (json.isNullOrEmpty()) {
            return listOf("¡Muy bien hecho! 🌟", "¡Sigue así, campeón! 🚀", "¡Completaste tu rutina con éxito! 🎉")
        }
        val type = object : TypeToken<List<String>>() {}.type
        return try {
            gson.fromJson(json, type) ?: emptyList()
        } catch (e: Exception) {
            emptyList()
        }
    }

    // ==========================================
    // HIJOS (DISPOSITIVOS), VINCULACIÓN Y ESTADO
    // ==========================================

    /** ANDROID_ID de este teléfono (el id con el que el niño se vincula). */
    fun idEsteDispositivo(): String = try {
        android.provider.Settings.Secure.getString(
            UPadApplication.appContext.contentResolver,
            android.provider.Settings.Secure.ANDROID_ID
        ) ?: ""
    } catch (e: Exception) {
        ""
    }

    fun getAllDevices(): Map<String, LocalChildDevice> {
        val json = prefs.getString(KEY_DEVICES_MAP, null) ?: return emptyMap()
        val type = object : TypeToken<Map<String, LocalChildDevice>>() {}.type
        return try {
            gson.fromJson(json, type) ?: emptyMap()
        } catch (e: Exception) {
            emptyMap()
        }
    }

    private fun saveDevicesMap(map: Map<String, LocalChildDevice>) {
        prefs.edit().putString(KEY_DEVICES_MAP, gson.toJson(map)).apply()
    }

    private fun guardarDispositivo(dispositivo: LocalChildDevice) {
        val devices = getAllDevices().toMutableMap()
        devices[dispositivo.deviceId] = dispositivo
        saveDevicesMap(devices)
    }

    // Sondeos compartidos: uno por clave aunque haya varias pantallas escuchando; se detiene sin oyentes
    private class Sondeo {
        @Volatile var activo = true
    }

    private val sondeosEstado = ConcurrentHashMap<String, Sondeo>()
    private val sondeosPadre = ConcurrentHashMap<String, Sondeo>()

    private fun iniciarSondeo(mapa: ConcurrentHashMap<String, Sondeo>, clave: String, intervaloMs: Long, tarea: () -> Unit) {
        synchronized(mapa) {
            if (mapa.containsKey(clave)) return
            val sondeo = Sondeo()
            mapa[clave] = sondeo
            kotlin.concurrent.thread(isDaemon = true, name = "upad-sondeo-$clave") {
                while (sondeo.activo) {
                    try {
                        tarea()
                    } catch (e: Exception) {
                        Log.w(TAG, "Error en el sondeo $clave: ${e.message}")
                    }
                    try {
                        Thread.sleep(intervaloMs)
                    } catch (e: InterruptedException) {
                        break
                    }
                }
            }
        }
    }

    private fun detenerSondeoSiNoHayOyentes(mapa: ConcurrentHashMap<String, Sondeo>, clave: String, oyentes: List<*>?) {
        synchronized(mapa) {
            if (oyentes.isNullOrEmpty()) mapa.remove(clave)?.activo = false
        }
    }

    fun createPairingCode(code: String, deviceId: String, onEffectiveCodeResolved: ((String) -> Unit)? = null): Boolean {
        val r = httpRequest("POST", "/api/v1/devices/pairing/create", JSONObject().put("code", code).put("deviceId", deviceId))
        if (r == null || !r.ok) {
            Log.e(TAG, "El servidor no registró el código de vinculación (HTTP ${r?.codigo ?: "sin conexión"})")
            return false
        }

        var effectiveCode = code
        val returnedCode = (r.data() as? Map<*, *>)?.get("code") as? String
        if (!returnedCode.isNullOrEmpty() && returnedCode != effectiveCode) {
            effectiveCode = returnedCode
            onEffectiveCodeResolved?.invoke(effectiveCode)
        }

        val map = getPairingCodes().toMutableMap()
        val entry = LocalPairingCode(code = effectiveCode, deviceId = deviceId, estado = "esperando", padreId = "")
        map[effectiveCode] = entry
        prefs.edit().putString(KEY_PAIRING_CODES, gson.toJson(map)).apply()

        mainHandler.post {
            pairingListeners[effectiveCode]?.forEach { it.invoke(entry) }
        }
        return true
    }

    fun getPairingCodes(): Map<String, LocalPairingCode> {
        val json = prefs.getString(KEY_PAIRING_CODES, null) ?: return emptyMap()
        val type = object : TypeToken<Map<String, LocalPairingCode>>() {}.type
        return try {
            gson.fromJson(json, type) ?: emptyMap()
        } catch (e: Exception) {
            emptyMap()
        }
    }

    private fun mensajeVinculacion(r: RespuestaHttp): String = when (r.codigo) {
        404 -> "Ese código no existe. Revisa los 6 números que muestra el teléfono del niño."
        410 -> "El código venció (dura 60 segundos). Usa el código nuevo que muestra el teléfono del niño."
        409 -> "Ese código ya se usó. Usa el código nuevo que muestra el teléfono del niño."
        429 -> r.mensaje("Demasiados intentos. Espera un minuto y vuelve a intentarlo.")
        else -> r.mensaje("No se pudo vincular el dispositivo.")
    }

    /**
     * El padre vincula el teléfono del niño con su código de 6 dígitos. Éxito SOLO si el servidor lo acepta;
     * si no, devuelve (false, mensaje para mostrar). En caso de éxito devuelve (true, deviceId). Fuera del hilo principal.
     */
    fun linkDeviceToParent(code: String, parentId: String): Pair<Boolean, String> {
        val codigo = code.trim()
        val cuerpo = JSONObject().put("code", codigo)
        val token = tokenSesion()
        if (token == null) cuerpo.put("parentId", parentId) // modo de compatibilidad del servidor (sin token)

        val r = httpRequest("POST", "/api/v1/devices/pairing/link", cuerpo, token)
            ?: return Pair(false, MENSAJE_SIN_CONEXION)
        if (!r.ok) return Pair(false, mensajeVinculacion(r))

        val data = r.data() as? Map<*, *>
        val deviceId = data?.get("deviceId") as? String
            ?: getPairingCodes()[codigo]?.deviceId
            ?: return Pair(false, "Respuesta inesperada del servidor.")
        val padreReal = (data?.get("parentId") as? String)?.takeIf { it.isNotBlank() } ?: parentId

        val dispositivo = (getAllDevices()[deviceId] ?: LocalChildDevice(deviceId = deviceId)).copy(
            padreId = padreReal,
            modelo = (data?.get("deviceModel") as? String)?.takeIf { it.isNotBlank() } ?: "Dispositivo del niño",
            nombre = (data?.get("childName") as? String)?.takeIf { it.isNotBlank() },
            kioscoActivo = false,
            ultimaActualizacion = System.currentTimeMillis()
        )
        guardarDispositivo(dispositivo)

        val codes = getPairingCodes().toMutableMap()
        val actualizado = LocalPairingCode(code = codigo, deviceId = deviceId, estado = "enlazado", padreId = padreReal)
        codes[codigo] = actualizado
        prefs.edit().putString(KEY_PAIRING_CODES, gson.toJson(codes)).apply()

        notificarHijosDelPadre(padreReal)
        mainHandler.post {
            pairingListeners[codigo]?.forEach { it.invoke(actualizado) }
            deviceListeners[deviceId]?.forEach { it.invoke(dispositivo) }
        }
        // Trae del servidor la lista completa (incluye los hijos vinculados desde la web)
        kotlin.concurrent.thread { refrescarDispositivosPadre(padreReal) }
        return Pair(true, deviceId)
    }

    /**
     * Sincroniza localmente un vínculo que el servidor ya confirmó (el padre usó en la web o en su teléfono
     * el código que muestra el niño). El dispositivo no vuelve a consumir ese código.
     */
    fun markDeviceLinkedLocally(deviceId: String, parentId: String) {
        val updated = (getAllDevices()[deviceId] ?: LocalChildDevice(
            deviceId = deviceId,
            modelo = android.os.Build.MODEL
        )).copy(padreId = parentId, kioscoActivo = false, ultimaActualizacion = System.currentTimeMillis())
        guardarDispositivo(updated)
        if (deviceId == idEsteDispositivo()) _kioscoEsteDispositivo.value = false

        mainHandler.post {
            deviceListeners[deviceId]?.forEach { it.invoke(updated) }
        }
        notificarHijosDelPadre(parentId)
    }

    /** Ubicación del niño: se guarda en el teléfono y se envía al servidor (POST .../telemetry). */
    fun updateDeviceLocation(deviceId: String, lat: Double, lng: Double) {
        val current = getAllDevices()[deviceId] ?: LocalChildDevice(deviceId = deviceId)
        val updated = current.copy(latitud = lat, longitud = lng, tieneUbicacion = true, ultimaActualizacion = System.currentTimeMillis())
        guardarDispositivo(updated)

        mainHandler.post {
            deviceListeners[deviceId]?.forEach { it.invoke(updated) }
        }

        kotlin.concurrent.thread {
            httpRequest("POST", "/api/v1/devices/${enc(deviceId)}/telemetry", JSONObject().put("latitude", lat).put("longitude", lng))
        }
    }

    fun getDevicesForParent(parentId: String): List<LocalChildDevice> {
        return getAllDevices().values.filter { it.padreId == parentId }
    }

    private fun notificarHijosDelPadre(parentId: String) {
        val hijos = getDevicesForParent(parentId)
        mainHandler.post {
            parentDeviceListListeners[parentId]?.forEach { it.invoke(hijos) }
        }
    }

    /**
     * Trae del servidor los hijos del padre (GET /api/v1/devices, con su token): nombre, ubicación real,
     * hora de la ubicación y bloqueo kiosco. Reemplaza la copia local. Devuelve false si no se pudo.
     */
    fun refrescarDispositivosPadre(parentId: String): Boolean {
        val token = tokenPara(parentId) ?: return false
        val r = httpRequest("GET", "/api/v1/devices", token = token) ?: return false
        if (!r.ok) return false
        val lista = (r.data() as? List<*>)?.mapNotNull { it as? Map<*, *> } ?: return false

        val remotos = lista.mapNotNull { d ->
            val id = d["deviceId"] as? String ?: return@mapNotNull null
            val lat = (d["lastLatitude"] as? Number)?.toDouble()
            val lng = (d["lastLongitude"] as? Number)?.toDouble()
            LocalChildDevice(
                deviceId = id,
                padreId = parentId,
                modelo = (d["deviceModel"] as? String)?.takeIf { it.isNotBlank() } ?: "Dispositivo del niño",
                latitud = lat ?: 0.0,
                longitud = lng ?: 0.0,
                kioscoActivo = d["isKioskActive"] == true,
                ultimaActualizacion = System.currentTimeMillis(),
                nombre = (d["childName"] as? String)?.takeIf { it.isNotBlank() },
                tieneUbicacion = lat != null && lng != null,
                ubicacionActualizadaEn = d["ubicacionActualizadaEn"] as? String
            )
        }

        val devices = getAllDevices().toMutableMap()
        devices.entries.removeAll { it.value.padreId == parentId }
        remotos.forEach { devices[it.deviceId] = it }
        saveDevicesMap(devices)

        mainHandler.post {
            parentDeviceListListeners[parentId]?.forEach { it.invoke(remotos) }
            remotos.forEach { hijo -> deviceListeners[hijo.deviceId]?.forEach { it.invoke(hijo) } }
        }
        return true
    }

    /** Hijos del padre: la copia local al instante y, mientras haya oyentes, la del servidor cada 10 s. */
    fun listenParentDevices(parentId: String, onDevicesChanged: (List<LocalChildDevice>) -> Unit): ListenerRegistration {
        onDevicesChanged(getDevicesForParent(parentId))
        val list = parentDeviceListListeners.getOrPut(parentId) { CopyOnWriteArrayList() }
        list.add(onDevicesChanged)
        if (parentId != SIN_SESION && parentId.isNotBlank()) {
            iniciarSondeo(sondeosPadre, parentId, 10_000L) { refrescarDispositivosPadre(parentId) }
        }
        return ListenerRegistration {
            list.remove(onDevicesChanged)
            detenerSondeoSiNoHayOyentes(sondeosPadre, parentId, list)
        }
    }

    /** Estado del teléfono del niño en el servidor (vinculado, padre, bloqueo kiosco). */
    private fun consultarEstado(deviceId: String) {
        val r = httpRequest("GET", "/api/v1/devices/status/${enc(deviceId)}") ?: return
        if (!r.ok) return
        val data = r.data() as? Map<*, *> ?: return
        val linked = data["linked"] == true
        val parentId = data["parentId"] as? String ?: ""
        val kiosco = linked && data["kioscoActivo"] == true

        if (deviceId == idEsteDispositivo()) _kioscoEsteDispositivo.value = kiosco

        val local = getAllDevices()[deviceId]
        if (!linked) {
            // Un dispositivo nuevo puede no existir aún en el servidor mientras espera su primer vínculo:
            // solo se limpia si ya estaba asociado a un padre y el vínculo desapareció (p. ej. desde la web).
            if (local?.padreId?.isNotEmpty() == true) deleteDevice(deviceId)
            return
        }
        if (local?.padreId != parentId || local.kioscoActivo != kiosco) {
            val synced = (local ?: LocalChildDevice(deviceId = deviceId, modelo = android.os.Build.MODEL))
                .copy(padreId = parentId, kioscoActivo = kiosco, ultimaActualizacion = System.currentTimeMillis())
            guardarDispositivo(synced)
            mainHandler.post {
                deviceListeners[deviceId]?.forEach { it.invoke(synced) }
            }
        }
    }

    /**
     * Teléfono del niño: estado local al instante y consulta al servidor cada 2 s (una sola consulta aunque
     * escuchen varias pantallas). Detecta la desvinculación hecha desde la web y el bloqueo kiosco.
     */
    fun listenChildDevice(deviceId: String, onDeviceChanged: (LocalChildDevice?) -> Unit): ListenerRegistration {
        onDeviceChanged(getAllDevices()[deviceId])
        val list = deviceListeners.getOrPut(deviceId) { CopyOnWriteArrayList() }
        list.add(onDeviceChanged)
        if (deviceId.isNotBlank()) {
            iniciarSondeo(sondeosEstado, deviceId, 2_000L) { consultarEstado(deviceId) }
        }
        return ListenerRegistration {
            list.remove(onDeviceChanged)
            detenerSondeoSiNoHayOyentes(sondeosEstado, deviceId, list)
        }
    }

    fun listenPairingCode(code: String, onCodeChanged: (LocalPairingCode?) -> Unit): ListenerRegistration {
        onCodeChanged(getPairingCodes()[code])
        val list = pairingListeners.getOrPut(code) { CopyOnWriteArrayList() }
        list.add(onCodeChanged)

        // El teléfono del niño consulta su código hasta que un padre lo use
        var isPollingActive = true
        kotlin.concurrent.thread(isDaemon = true) {
            while (isPollingActive) {
                try {
                    Thread.sleep(1500)
                    if (!isPollingActive) break
                    val r = httpRequest("GET", "/api/v1/devices/pairing/${enc(code)}") ?: continue
                    if (!r.ok) continue
                    val data = r.data() as? Map<*, *> ?: continue
                    val estadoServidor = data["estado"] as? String ?: ""
                    val pId = data["parentId"] as? String ?: ""
                    val dId = data["deviceId"] as? String ?: ""

                    if ((estadoServidor == "vinculado" || estadoServidor == "enlazado" || estadoServidor == "LINKED") && pId.isNotEmpty()) {
                        val entry = LocalPairingCode(code = code, deviceId = dId, estado = "enlazado", padreId = pId)
                        val map = getPairingCodes().toMutableMap()
                        map[code] = entry
                        prefs.edit().putString(KEY_PAIRING_CODES, gson.toJson(map)).apply()

                        mainHandler.post {
                            pairingListeners[code]?.forEach { it.invoke(entry) }
                        }
                        isPollingActive = false
                    }
                } catch (e: InterruptedException) {
                    break
                } catch (e: Exception) {
                    Log.w(TAG, "Error consultando el código de vinculación: ${e.message}")
                }
            }
        }

        return ListenerRegistration {
            isPollingActive = false
            list.remove(onCodeChanged)
        }
    }

    /** Borra el hijo de la copia local (no llama al servidor). */
    fun deleteDevice(deviceId: String, parentId: String = "") {
        val devices = getAllDevices().toMutableMap()
        val keysToRemove = devices.filter { entry ->
            entry.key == deviceId || entry.value.deviceId == deviceId
        }.keys.toList()
        val padres = keysToRemove.mapNotNull { devices[it]?.padreId }.toMutableSet()
        if (parentId.isNotEmpty()) padres.add(parentId)
        keysToRemove.forEach { devices.remove(it) }
        saveDevicesMap(devices)

        val codes = getPairingCodes().toMutableMap()
        codes.entries.removeAll { it.key == deviceId || it.value.deviceId == deviceId }
        prefs.edit().putString(KEY_PAIRING_CODES, gson.toJson(codes)).apply()

        if (deviceId == idEsteDispositivo()) _kioscoEsteDispositivo.value = false

        mainHandler.post {
            deviceListeners[deviceId]?.forEach { it.invoke(null) }
            padres.forEach { pId ->
                val remaining = devices.values.filter { it.padreId == pId }
                parentDeviceListListeners[pId]?.forEach { it.invoke(remaining) }
            }
        }
    }

    /**
     * El padre desvincula un hijo desde su teléfono: DELETE /api/v1/devices/:id con su token
     * (sin token, con ?parentId= en el modo de compatibilidad del servidor).
     */
    fun unlinkChildDevice(deviceId: String, parentId: String = "") {
        deleteDevice(deviceId, parentId)
        kotlin.concurrent.thread {
            val token = tokenSesion()
            val consulta = if (token == null && parentId.isNotEmpty()) "?parentId=${enc(parentId)}" else ""
            val r = httpRequest("DELETE", "/api/v1/devices/${enc(deviceId)}$consulta", token = token)
            if (r == null || (!r.ok && r.codigo != 404)) {
                Log.w(TAG, "El servidor no confirmó la desvinculación (HTTP ${r?.codigo ?: "sin conexión"})")
            }
        }
    }

    /**
     * Desvincular desde el teléfono del niño (kiosco): el padre escribe su correo y contraseña. Se comprueban en
     * el servidor SIN guardar la sesión en este teléfono, se exige que sea el padre vinculado y se borra el vínculo
     * con su token. Fuera del hilo principal.
     */
    fun desvincularDesdeKiosco(deviceId: String, email: String, pass: String, padreEsperado: String): Result<Unit> {
        val login = httpRequest("POST", "/api/auth/login", JSONObject().put("email", email.trim().lowercase()).put("password", pass))
            ?: return Result.failure(Exception(MENSAJE_SIN_CONEXION))
        if (!login.ok) return Result.failure(Exception(login.mensaje("Correo o contraseña incorrectos.")))

        val data = login.data() as? Map<*, *>
        val token = data?.get("token") as? String
        val idPadre = (data?.get("usuario") as? Map<*, *>)?.get("id") as? String
        if (token.isNullOrBlank() || idPadre.isNullOrBlank()) {
            return Result.failure(Exception("Respuesta inesperada del servidor."))
        }
        if (padreEsperado.isNotBlank() && idPadre != padreEsperado) {
            return Result.failure(Exception("Esa cuenta no es la del padre o tutor vinculado a este dispositivo."))
        }

        val borrado = httpRequest("DELETE", "/api/v1/devices/${enc(deviceId)}", token = token)
            ?: return Result.failure(Exception(MENSAJE_SIN_CONEXION))
        if (!borrado.ok && borrado.codigo != 404) {
            return Result.failure(Exception(borrado.mensaje("No se pudo desvincular el dispositivo.")))
        }
        deleteDevice(deviceId)
        return Result.success(Unit)
    }

    // ==========================================
    // BLOQUEO KIOSCO (el padre lo activa; el niño lo recibe en su consulta de estado)
    // ==========================================

    /** PUT /api/v1/devices/:id/kiosk con el token del padre. onResult(ok, mensaje) llega en el hilo principal. */
    fun setKioskActive(deviceId: String, activo: Boolean, onResult: (Boolean, String) -> Unit) {
        kotlin.concurrent.thread {
            val token = tokenSesion()
            val resultado: Pair<Boolean, String> = if (token == null) {
                Pair(false, "Inicia sesión de nuevo para bloquear o desbloquear el dispositivo.")
            } else {
                val r = httpRequest("PUT", "/api/v1/devices/${enc(deviceId)}/kiosk", JSONObject().put("activo", activo), token)
                when {
                    r == null -> Pair(false, MENSAJE_SIN_CONEXION)
                    !r.ok -> Pair(false, r.mensaje("No se pudo cambiar el bloqueo."))
                    else -> {
                        val actual = getAllDevices()[deviceId]
                        if (actual != null) {
                            val nuevo = actual.copy(kioscoActivo = activo, ultimaActualizacion = System.currentTimeMillis())
                            guardarDispositivo(nuevo)
                            notificarHijosDelPadre(nuevo.padreId)
                        }
                        Pair(true, if (activo) "Bloqueo activado." else "Bloqueo retirado.")
                    }
                }
            }
            mainHandler.post { onResult(resultado.first, resultado.second) }
        }
    }

    // ==========================================
    // AVISOS DEL NIÑO A SU PADRE
    // ==========================================

    const val AVISO_TAREA_COMPLETADA = "tarea_completada"
    const val AVISO_RUTINA_COMPLETADA = "rutina_completada"
    // Los crea el servidor al recibir la ubicación del niño (bloque W)
    const val AVISO_ZONA_SALIDA = "zona_salida"
    const val AVISO_ZONA_REGRESO = "zona_regreso"

    /** El teléfono del niño avisa a su padre (el servidor decide quién es el padre). */
    fun enviarAvisoAlPadre(deviceId: String, tipo: String, titulo: String, descripcion: String) {
        if (deviceId.isBlank()) return
        kotlin.concurrent.thread {
            val cuerpo = JSONObject().put("tipo", tipo).put("titulo", titulo).put("descripcion", descripcion)
            val r = httpRequest("POST", "/api/v1/devices/${enc(deviceId)}/notificaciones", cuerpo)
            if (r == null || !r.ok) Log.w(TAG, "No se pudo enviar el aviso al padre (HTTP ${r?.codigo ?: "sin conexión"})")
        }
    }

    /**
     * Registra en el servidor una actividad completada en el teléfono del niño (cumplimiento real para la web).
     * Sin token, como la telemetría: el servidor solo lo acepta si el teléfono está vinculado y la actividad es una
     * rutina activa de su padre. La fecha es el día local del teléfono.
     */
    fun registrarCumplimiento(deviceId: String, actividad: String, turno: String) {
        if (deviceId.isBlank() || actividad.isBlank()) return
        val fecha = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(System.currentTimeMillis())
        kotlin.concurrent.thread {
            val cuerpo = JSONObject().put("actividad", actividad).put("turno", turno).put("fecha", fecha)
            val r = httpRequest("POST", "/api/v1/devices/${enc(deviceId)}/cumplimiento", cuerpo)
            if (r == null || !r.ok) Log.w(TAG, "No se pudo registrar el cumplimiento (HTTP ${r?.codigo ?: "sin conexión"} ${r?.codigoError() ?: ""})")
        }
    }

    private fun parsearFechaIso(iso: String?): Long {
        if (iso.isNullOrBlank()) return 0L
        val formatos = listOf("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", "yyyy-MM-dd'T'HH:mm:ss'Z'")
        for (f in formatos) {
            try {
                val sdf = SimpleDateFormat(f, Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
                return sdf.parse(iso)?.time ?: continue
            } catch (e: Exception) {
                // siguiente formato
            }
        }
        return 0L
    }

    /** Fecha ISO (UTC) que entiende el servidor. */
    fun fechaIso(ms: Long): String =
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }.format(ms)

    /**
     * Avisos del padre con sesión (GET /api/v1/notificaciones), del más reciente al más antiguo; con desdeIso, solo
     * los posteriores. null si no hay sesión o no se pudo consultar. Fuera del hilo principal.
     */
    fun obtenerAvisos(desdeIso: String? = null): List<AvisoPadre>? {
        val token = tokenSesion() ?: return null
        val consulta = if (desdeIso.isNullOrBlank()) "" else "?desde=${enc(desdeIso)}"
        val r = httpRequest("GET", "/api/v1/notificaciones$consulta", token = token) ?: return null
        if (!r.ok) return null
        val lista = ((r.data() as? Map<*, *>)?.get("notificaciones") as? List<*>) ?: return emptyList()
        return lista.mapNotNull { item ->
            val n = item as? Map<*, *> ?: return@mapNotNull null
            AvisoPadre(
                id = n["id"] as? String ?: return@mapNotNull null,
                tipo = n["tipo"] as? String ?: "",
                titulo = n["titulo"] as? String ?: "",
                descripcion = n["descripcion"] as? String ?: "",
                creadoEnMs = parsearFechaIso(n["creadoEn"] as? String),
                leida = n["leida"] == true,
                nombreHijo = n["nombreHijo"] as? String
            )
        }
    }

    /** Fecha (ms) del último aviso ya mostrado como notificación del sistema a esta cuenta; 0 si nunca. */
    fun getUltimoAvisoNotificado(userId: String): Long = upadPrefs.getLong("ULTIMO_AVISO_NOTIFICADO_$userId", 0L)

    fun setUltimoAvisoNotificado(userId: String, ms: Long) {
        upadPrefs.edit().putLong("ULTIMO_AVISO_NOTIFICADO_$userId", ms).apply()
    }

    /** Marca como leídos todos los avisos del padre con sesión. */
    fun marcarAvisosLeidos() {
        val token = tokenSesion() ?: return
        kotlin.concurrent.thread {
            httpRequest("PUT", "/api/v1/notificaciones/leidas", JSONObject(), token)
        }
    }

    fun deletePairingCode(code: String) {
        val map = getPairingCodes().toMutableMap()
        map.remove(code)
        prefs.edit().putString(KEY_PAIRING_CODES, gson.toJson(map)).apply()
    }
}

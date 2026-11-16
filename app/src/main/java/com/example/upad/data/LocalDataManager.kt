package com.example.upad.data

import android.content.Context
import android.content.SharedPreferences
import android.os.Handler
import android.os.Looper
import android.util.Log
import com.example.upad.UPadApplication
import com.example.upad.viewmodel.TaskItem
import com.google.firebase.firestore.ListenerRegistration
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArrayList

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
    val ultimaActualizacion: Long = System.currentTimeMillis()
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

/**
 * Gestor de datos y persistencia completamente LOCAL para U-Pad.
 * Reemplaza de forma autónoma a Firestore y Firebase Auth para que
 * la aplicación funcione sin internet ni dependencias en la nube.
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
    private const val KEY_NOTIFICATIONS_PREFIX = "NOTIF_"
    private const val KEY_EMOTIONS_PREFIX = "EMOTION_"

    private val gson = Gson()
    private val mainHandler = Handler(Looper.getMainLooper())

    private val prefs: SharedPreferences by lazy {
        UPadApplication.appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    // Listeners reactivos en memoria para simular snapshotListeners de Firestore
    private val routineListeners = ConcurrentHashMap<String, CopyOnWriteArrayList<(List<TaskItem>) -> Unit>>()
    private val languageListeners = ConcurrentHashMap<String, CopyOnWriteArrayList<(String) -> Unit>>()
    private val premiumListeners = ConcurrentHashMap<String, CopyOnWriteArrayList<(Boolean) -> Unit>>()
    private val deviceListeners = ConcurrentHashMap<String, CopyOnWriteArrayList<(LocalChildDevice?) -> Unit>>()
    private val pairingListeners = ConcurrentHashMap<String, CopyOnWriteArrayList<(LocalPairingCode?) -> Unit>>()
    private val parentDeviceListListeners = ConcurrentHashMap<String, CopyOnWriteArrayList<(List<LocalChildDevice>) -> Unit>>()
    private val lastSyncSignatureMap = ConcurrentHashMap<String, Long>()

    init {
        // Inicializar usuario demo por defecto si la base de datos está vacía
        val users = getAllUsers().toMutableMap()
        if (users.isEmpty()) {
            val defaultUser = LocalUser(
                uid = "padre_local_1",
                email = "demo@upad.local",
                name = "PAPÁ DEMO",
                isPremium = true,
                language = "es"
            )
            users[defaultUser.email.lowercase()] = defaultUser
            saveUsersMap(users)
        }
    }

    // ==========================================
    // AUTENTICACIÓN LOCAL
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

    fun getCurrentUserId(): String {
        return getCurrentUser()?.uid ?: "padre_local_1"
    }

    fun isLoggedIn(): Boolean {
        return prefs.getString(KEY_CURRENT_USER_UID, null) != null
    }

    fun login(email: String, pass: String): Result<LocalUser> {
        val cleanEmail = email.trim().lowercase()

        // 1. Intento de autenticación en la nube (Google Cloud Platform / Cloud Relational DB)
        try {
            val jsonReq = "{\"email\":\"$cleanEmail\",\"password\":\"$pass\"}"
            val res = httpPostSync("/api/auth/login", jsonReq)
            if (res != null) {
                val root = gson.fromJson(res, Map::class.java)
                val isSuccess = root["success"] as? Boolean ?: false
                if (isSuccess) {
                    val data = root["data"] as? Map<*, *>
                    val token = data?.get("token") as? String ?: ""
                    val usuario = data?.get("usuario") as? Map<*, *>
                    val cloudId = usuario?.get("id") as? String ?: ("usr_" + UUID.randomUUID().toString().take(8))
                    val cloudName = usuario?.get("nombre") as? String ?: cleanEmail.substringBefore("@").uppercase()
                    
                    val cloudUser = LocalUser(
                        uid = cloudId,
                        email = cleanEmail,
                        name = cloudName,
                        isPremium = true
                    )
                    
                    val users = getAllUsers().toMutableMap()
                    users[cleanEmail] = cloudUser
                    saveUsersMap(users)

                    prefs.edit().putString(KEY_CURRENT_USER_UID, cloudUser.uid).apply()
                    UPadApplication.appContext.getSharedPreferences("UPAD_PREFS", Context.MODE_PRIVATE)
                        .edit()
                        .putString("PARENT_NAME", cloudUser.name)
                        .putString("LOCAL_USER_EMAIL", cloudUser.email)
                        .putString("LOCAL_USER_UID", cloudUser.uid)
                        .putString("AUTH_TOKEN", token)
                        .apply()

                    Log.d(TAG, "Login exitoso en Nube GCP para: ${cloudUser.email} con UID: ${cloudUser.uid}")
                    return Result.success(cloudUser)
                } else {
                    val msg = root["message"] as? String ?: "Credenciales inválidas"
                    Log.w(TAG, "Login en Nube falló: $msg")
                    return Result.failure(Exception(msg))
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Excepción durante login en nube: ${e.message}")
        }

        // 2. Fallback local si el servidor no está accesible
        val users = getAllUsers().toMutableMap()
        if (users.containsKey(cleanEmail)) {
            val localUser = users[cleanEmail]!!
            prefs.edit().putString(KEY_CURRENT_USER_UID, localUser.uid).apply()
            UPadApplication.appContext.getSharedPreferences("UPAD_PREFS", Context.MODE_PRIVATE)
                .edit()
                .putString("PARENT_NAME", localUser.name)
                .putString("LOCAL_USER_EMAIL", localUser.email)
                .putString("LOCAL_USER_UID", localUser.uid)
                .apply()
            Log.d(TAG, "Login local offline exitoso: ${localUser.email}")
            return Result.success(localUser)
        }

        // Si tampoco existe localmente y no hubo conexión
        return Result.failure(Exception("No se pudo iniciar sesión. Verifica tu conexión y credenciales."))
    }

    fun register(name: String, email: String, pass: String): Result<LocalUser> {
        val cleanEmail = email.trim().lowercase()
        val cleanName = name.trim().ifEmpty { cleanEmail.substringBefore("@").uppercase() }

        // 1. Registro directo en la Base de Datos Relacional de Google Cloud
        try {
            val jsonReq = "{\"nombre\":\"$cleanName\",\"email\":\"$cleanEmail\",\"password\":\"$pass\",\"rol\":\"tutor\"}"
            val res = httpPostSync("/api/auth/register", jsonReq)
            if (res != null) {
                val root = gson.fromJson(res, Map::class.java)
                val isSuccess = root["success"] as? Boolean ?: false
                if (isSuccess) {
                    val data = root["data"] as? Map<*, *>
                    val token = data?.get("token") as? String ?: ""
                    val usuario = data?.get("usuario") as? Map<*, *>
                    val cloudId = usuario?.get("id") as? String ?: ("usr_" + UUID.randomUUID().toString().take(8))
                    val cloudName = usuario?.get("nombre") as? String ?: cleanName

                    val newUser = LocalUser(
                        uid = cloudId,
                        email = cleanEmail,
                        name = cloudName,
                        isPremium = true
                    )

                    val users = getAllUsers().toMutableMap()
                    users[cleanEmail] = newUser
                    saveUsersMap(users)

                    prefs.edit().putString(KEY_CURRENT_USER_UID, newUser.uid).apply()
                    UPadApplication.appContext.getSharedPreferences("UPAD_PREFS", Context.MODE_PRIVATE)
                        .edit()
                        .putString("PARENT_NAME", newUser.name)
                        .putString("LOCAL_USER_EMAIL", newUser.email)
                        .putString("LOCAL_USER_UID", newUser.uid)
                        .putString("AUTH_TOKEN", token)
                        .apply()

                    Log.d(TAG, "Registro exitoso en Nube GCP para: ${newUser.email} con UID: ${newUser.uid}")
                    return Result.success(newUser)
                } else {
                    val msg = root["message"] as? String ?: "Error al registrar en nube"
                    Log.w(TAG, "Registro en Nube falló: $msg")
                    return Result.failure(Exception(msg))
                }
            } else {
                return Result.failure(Exception("No se pudo conectar al servidor Cloud. Revisa tu conexión Wi-Fi."))
            }
        } catch (e: Exception) {
            Log.e(TAG, "Excepción durante registro en nube: ${e.message}")
            return Result.failure(Exception("Error al conectar con la base de datos de la nube: ${e.message}"))
        }
    }

    fun logout() {
        prefs.edit().remove(KEY_CURRENT_USER_UID).apply()
        UPadApplication.appContext.getSharedPreferences("UPAD_PREFS", Context.MODE_PRIVATE)
            .edit()
            .remove("LOCAL_USER_UID")
            .apply()
        Log.d(TAG, "Sesión cerrada localmente")
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
                        val body = "{\"actividad\":\"${ultima.actividad}\",\"palabraClave\":\"${ultima.palabraClave}\",\"turno\":\"$turnEnvio\",\"userId\":\"$u\"}"
                        httpPost("/api/v1/mobile/sync-routines", body)
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
        val encodedAct = try {
            java.net.URLEncoder.encode(actividad, "UTF-8")
        } catch (e: Exception) {
            actividad
        }
        httpDelete("/api/v1/mobile/sync-routines?userId=$u&actividad=$encodedAct&turno=$turnEnvio")
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

    fun listenRoutinePorDia(userId: String, turn: String, dia: String, onDataChanged: (List<TaskItem>) -> Unit): ListenerRegistration {
        val u = if (userId.isEmpty() || userId == "PADRE_TEST") getCurrentUserId() else userId
        val key = routineKey(u, turn, dia)
        val initial = getRoutinePorDia(u, turn, dia)
        onDataChanged(initial)

        val list = routineListeners.getOrPut(key) { CopyOnWriteArrayList() }
        list.add(onDataChanged)

        // Sincronización en vivo con el Backend (base de datos relacional) para ESTE usuario exacto
        var isPolling = true
        kotlin.concurrent.thread {
            while (isPolling) {
                try {
                    val jsonStr = httpGet("/api/v1/mobile/sync-routines?userId=$u")
                    if (!jsonStr.isNullOrEmpty()) {
                        val root = gson.fromJson(jsonStr, Map::class.java)
                        val dataList = root["data"] as? List<Map<String, Any>>
                        if (dataList != null) {
                            val turnNormalizado = when (turn.uppercase().trim()) {
                                "MAÑANA" -> "MANANA"
                                else -> turn.uppercase().trim()
                            }
                            val tareasFiltradas = dataList.filter {
                                val t = it["turno"] as? String ?: ""
                                t.uppercase() == turnNormalizado
                            }.map {
                                val act = it["actividad"] as? String ?: "ACTIVIDAD"
                                val kw = it["palabraClave"] as? String ?: act.lowercase()
                                TaskItem(
                                    actividad = act,
                                    palabraClave = kw,
                                    imageUrl = "https://static.arasaac.org/pictograms/2445/2445_500.png",
                                    dias = listOf("LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"),
                                    duration = 10
                                )
                            }
                            mainHandler.post {
                                onDataChanged(tareasFiltradas)
                            }
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
    // VINCULACIÓN Y RASTREO DE DISPOSITIVOS
    // ==========================================

    private const val KEY_SERVER_IP = "SERVER_IP"
    private const val DEFAULT_SERVER_IP = "192.168.15.12"

    fun getServerIp(): String {
        return prefs.getString(KEY_SERVER_IP, DEFAULT_SERVER_IP) ?: DEFAULT_SERVER_IP
    }

    fun setServerIp(ip: String) {
        prefs.edit().putString(KEY_SERVER_IP, ip.trim()).apply()
    }

    // =========================================================================
    // CONFIGURACIÓN DE RED Y URLS BASE (A)
    // Para probar en un teléfono físico con IP LAN, cambia DEFAULT_DEV_IP por la IP de tu PC (ej: "192.168.1.50")
    // =========================================================================
    const val DEFAULT_DEV_IP = "10.0.2.2" // <-- Cambiar esta línea si pruebas en teléfono físico LAN (ej: "192.168.1.X")
    private const val DEFAULT_EMULATOR_BASE_URL = "http://$DEFAULT_DEV_IP:3000"
    private const val CLOUD_RUN_FALLBACK_URL = "https://upad-backend-service-466241893446.us-central1.run.app"

    private fun getCloudBaseUrl(): String {
        val ip = getServerIp()
        return "http://$ip:3000"
    }

    private fun getCandidateBaseUrls(): List<String> {
        val configured = getCloudBaseUrl()
        // En la entrega del curso la fuente de verdad es Cloud Run. Se prueba
        // primero para que la pantalla infantil no espere los timeouts de las
        // direcciones locales antes de mostrar su código.
        val candidates = mutableListOf(
            CLOUD_RUN_FALLBACK_URL,
            "http://127.0.0.1:3000",
            configured,
            DEFAULT_EMULATOR_BASE_URL
        )
        return candidates.distinct()
    }

    private fun connectTimeoutFor(baseUrl: String): Int = 3000

    private fun readTimeoutFor(baseUrl: String, defaultTimeout: Int = 3000): Int = 3000

    private fun httpPostSync(path: String, jsonBody: String): String? {
        val urls = getCandidateBaseUrls()
        for (baseUrl in urls) {
            try {
                val url = java.net.URL("$baseUrl$path")
                val conn = (url.openConnection() as java.net.HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = connectTimeoutFor(baseUrl)
                    readTimeout = readTimeoutFor(baseUrl, 4000)
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("Accept", "application/json")
                    setRequestProperty("User-Agent", "UPad-Android-Client/2.0")
                }
                conn.outputStream.use { os ->
                    java.io.OutputStreamWriter(os, "UTF-8").use { osw ->
                        osw.write(jsonBody)
                        osw.flush()
                    }
                }
                val responseCode = conn.responseCode
                if (responseCode !in 200..299) {
                    Log.w(TAG, "httpPostSync fallo $baseUrl$path con HTTP $responseCode")
                    conn.disconnect()
                    continue
                }
                val stream = conn.inputStream
                if (stream != null) {
                    val reader = java.io.BufferedReader(java.io.InputStreamReader(stream))
                    val sb = StringBuilder()
                    var line: String?
                    while (reader.readLine().also { line = it } != null) {
                        sb.append(line)
                    }
                    reader.close()
                    conn.disconnect()
                    // Si esta IP respondió con éxito, la guardamos como la activa
                    val extractedIp = baseUrl.substringAfter("://").substringBefore(":")
                    if (getServerIp() != extractedIp) {
                        setServerIp(extractedIp)
                    }
                    return sb.toString()
                } else {
                    conn.disconnect()
                }
            } catch (e: Exception) {
                Log.w(TAG, "Fallo al conectar a $baseUrl$path: ${e.message}")
            }
        }
        return null
    }

    private fun httpPost(path: String, jsonBody: String) {
        kotlin.concurrent.thread {
            val urls = getCandidateBaseUrls()
            for (baseUrl in urls) {
                try {
                    val url = java.net.URL("$baseUrl$path")
                    val conn = (url.openConnection() as java.net.HttpURLConnection).apply {
                        requestMethod = "POST"
                        connectTimeout = connectTimeoutFor(baseUrl)
                        readTimeout = readTimeoutFor(baseUrl, 3000)
                        doOutput = true
                        setRequestProperty("Content-Type", "application/json")
                        setRequestProperty("User-Agent", "UPad-Android-Client/2.0")
                    }
                    conn.outputStream.use { os ->
                        java.io.OutputStreamWriter(os, "UTF-8").use { osw ->
                            osw.write(jsonBody)
                            osw.flush()
                        }
                    }
                    val code = conn.responseCode
                    Log.d(TAG, "GCP Cloud Run POST $baseUrl$path -> HTTP $code")
                    conn.disconnect()
                    if (code in 200..299) {
                        val extractedIp = baseUrl.substringAfter("://").substringBefore(":")
                        if (getServerIp() != extractedIp) {
                            setServerIp(extractedIp)
                        }
                        break
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "GCP Cloud Run POST $baseUrl$path failed: ${e.message}")
                }
            }
        }
    }

    private fun httpDelete(path: String) {
        kotlin.concurrent.thread {
            val urls = getCandidateBaseUrls()
            for (baseUrl in urls) {
                try {
                    val url = java.net.URL("$baseUrl$path")
                    val conn = (url.openConnection() as java.net.HttpURLConnection).apply {
                        requestMethod = "DELETE"
                        connectTimeout = connectTimeoutFor(baseUrl)
                        readTimeout = readTimeoutFor(baseUrl, 3000)
                        setRequestProperty("User-Agent", "UPad-Android-Client/2.0")
                    }
                    val code = conn.responseCode
                    Log.d(TAG, "GCP Cloud Run DELETE $baseUrl$path -> HTTP $code")
                    conn.disconnect()
                    if (code in 200..299) break
                } catch (e: Exception) {
                    Log.e(TAG, "GCP Cloud Run DELETE $baseUrl$path failed: ${e.message}")
                }
            }
        }
    }

    private fun httpGet(path: String): String? {
        val urls = getCandidateBaseUrls()
        for (baseUrl in urls) {
            try {
                val url = java.net.URL("$baseUrl$path")
                val conn = (url.openConnection() as java.net.HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = connectTimeoutFor(baseUrl)
                    readTimeout = readTimeoutFor(baseUrl, 3000)
                    setRequestProperty("Accept", "application/json")
                    setRequestProperty("User-Agent", "UPad-Android-Client/2.0")
                }
                val responseCode = conn.responseCode
                if (responseCode in 200..299) {
                    val reader = java.io.BufferedReader(java.io.InputStreamReader(conn.inputStream))
                    val sb = StringBuilder()
                    var line: String?
                    while (reader.readLine().also { line = it } != null) {
                        sb.append(line)
                    }
                    reader.close()
                    conn.disconnect()
                    val extractedIp = baseUrl.substringAfter("://").substringBefore(":")
                    if (getServerIp() != extractedIp) {
                        setServerIp(extractedIp)
                    }
                    return sb.toString()
                } else {
                    conn.disconnect()
                }
            } catch (e: Exception) {
                // Siguiente URL candidata
            }
        }
        return null
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

    fun createPairingCode(code: String, deviceId: String, onEffectiveCodeResolved: ((String) -> Unit)? = null): Boolean {
        // Sincronizar creación de código con el backend primero
        val body = "{\"code\":\"$code\",\"deviceId\":\"$deviceId\"}"
        val res = httpPostSync("/api/v1/devices/pairing/create", body)
        if (res == null) {
            Log.e(TAG, "Error registrando código de vinculación en el servidor")
            return false
        }

        var effectiveCode = code
        try {
            val root = gson.fromJson(res, Map::class.java)
            val status = root["status"] as? String
            val success = root["success"] as? Boolean
            if (status == "error" || success == false) {
                Log.e(TAG, "Servidor rechazó la creación del código: $res")
                return false
            }
            // Si la respuesta incluye el código guardado y es distinto del enviado, usar el código del servidor
            val dataObj = root["data"] as? Map<*, *>
            val returnedCode = (dataObj?.get("code") as? String) ?: (root["code"] as? String)
            if (!returnedCode.isNullOrEmpty() && returnedCode != effectiveCode) {
                effectiveCode = returnedCode
                onEffectiveCodeResolved?.invoke(effectiveCode)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error analizando respuesta de pairing/create: ${e.message}")
        }

        // Si el backend confirmó con éxito, guardar en SharedPreferences localmente
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

    fun linkDeviceToParent(codeOrDeviceId: String, parentId: String): Pair<Boolean, String> {
        val devices = getAllDevices().toMutableMap()
        val codes = getPairingCodes().toMutableMap()

        val matchingCode = codes[codeOrDeviceId]
        val targetDeviceId = matchingCode?.deviceId ?: codeOrDeviceId

        // Intentar validación síncrona contra backend (local/cloud)
        val body = "{\"code\":\"$codeOrDeviceId\",\"parentId\":\"$parentId\"}"
        val res = httpPostSync("/api/v1/devices/pairing/link", body)
        if (res != null) {
            try {
                val root = gson.fromJson(res, Map::class.java)
                val status = root["status"] as? String
                val statusCode = (root["statusCode"] as? Number)?.toInt()
                if (status == "error" || statusCode == 410) {
                    val errMsg = (root["message"] as? String) 
                        ?: (root["error"] as? Map<*, *>)?.get("message") as? String 
                        ?: "El código ha expirado o ya fue utilizado."
                    return Pair(false, errMsg)
                }
            } catch (e: Exception) {
                Log.w(TAG, "Error analizando respuesta de link: ${e.message}")
            }
        }

        val updatedDevice = devices[targetDeviceId]?.copy(
            padreId = parentId,
            ultimaActualizacion = System.currentTimeMillis()
        ) ?: LocalChildDevice(
            deviceId = targetDeviceId,
            padreId = parentId,
            modelo = android.os.Build.MODEL
        )
        devices[targetDeviceId] = updatedDevice
        saveDevicesMap(devices)

        val updatedCode = (matchingCode ?: LocalPairingCode(code = codeOrDeviceId, deviceId = targetDeviceId)).copy(
            estado = "enlazado",
            padreId = parentId
        )
        codes[codeOrDeviceId] = updatedCode
        prefs.edit().putString(KEY_PAIRING_CODES, gson.toJson(codes)).apply()

        mainHandler.post {
            pairingListeners[codeOrDeviceId]?.forEach { it.invoke(updatedCode) }
            deviceListeners[targetDeviceId]?.forEach { it.invoke(updatedDevice) }
            parentDeviceListListeners[parentId]?.forEach { listListener ->
                listListener.invoke(devices.values.filter { it.padreId == parentId })
            }
        }

        return Pair(true, targetDeviceId)
    }

    /**
     * Sincroniza localmente un vínculo que ya fue confirmado por Cloud Run.
     * Se usa cuando el padre introduce en la web el código que aparece en el
     * teléfono del niño; el dispositivo no debe volver a consumir ese código.
     */
    fun markDeviceLinkedLocally(deviceId: String, parentId: String) {
        val devices = getAllDevices().toMutableMap()
        val updated = (devices[deviceId] ?: LocalChildDevice(
            deviceId = deviceId,
            modelo = android.os.Build.MODEL
        )).copy(padreId = parentId, ultimaActualizacion = System.currentTimeMillis())
        devices[deviceId] = updated
        saveDevicesMap(devices)

        mainHandler.post {
            deviceListeners[deviceId]?.forEach { it.invoke(updated) }
            parentDeviceListListeners[parentId]?.forEach { listener ->
                listener.invoke(devices.values.filter { it.padreId == parentId })
            }
        }
    }

    fun updateDeviceLocation(deviceId: String, lat: Double, lng: Double) {
        val devices = getAllDevices().toMutableMap()
        val current = devices[deviceId] ?: LocalChildDevice(deviceId = deviceId)
        val updated = current.copy(latitud = lat, longitud = lng, ultimaActualizacion = System.currentTimeMillis())
        devices[deviceId] = updated
        saveDevicesMap(devices)

        mainHandler.post {
            deviceListeners[deviceId]?.forEach { it.invoke(updated) }
        }

        // Sincronizar telemetría GPS con GCP Cloud Run
        val body = "{\"latitude\":$lat,\"longitude\":$lng}"
        httpPost("/api/v1/devices/$deviceId/telemetry", body)
    }

    fun getDevicesForParent(parentId: String): List<LocalChildDevice> {
        return getAllDevices().values.filter { it.padreId == parentId }
    }

    fun listenParentDevices(parentId: String, onDevicesChanged: (List<LocalChildDevice>) -> Unit): ListenerRegistration {
        onDevicesChanged(getDevicesForParent(parentId))
        val list = parentDeviceListListeners.getOrPut(parentId) { CopyOnWriteArrayList() }
        list.add(onDevicesChanged)
        return ListenerRegistration { list.remove(onDevicesChanged) }
    }

    fun listenChildDevice(deviceId: String, onDeviceChanged: (LocalChildDevice?) -> Unit): ListenerRegistration {
        onDeviceChanged(getAllDevices()[deviceId])
        val list = deviceListeners.getOrPut(deviceId) { CopyOnWriteArrayList() }
        list.add(onDeviceChanged)

        // La web puede desvincular el dispositivo en cualquier momento. Como
        // el niño no tiene sesión web, consulta un endpoint de estado mínimo y
        // vuelve a la pantalla inicial cuando el vínculo desaparece.
        var pollingActive = true
        kotlin.concurrent.thread {
            while (pollingActive) {
                try {
                    Thread.sleep(2000)
                    if (!pollingActive) break

                    val json = httpGet("/api/v1/devices/status/$deviceId") ?: continue
                    val root = gson.fromJson(json, Map::class.java)
                    val data = root["data"] as? Map<*, *> ?: continue
                    val linked = data["linked"] as? Boolean ?: false
                    val parentId = data["parentId"] as? String ?: ""
                    val local = getAllDevices()[deviceId]

                    if (!linked) {
                        // Un dispositivo nuevo puede no existir todavía en
                        // child_devices mientras espera su primer vínculo.
                        // Solo se limpia cuando ya estaba asociado a un padre
                        // y ese vínculo desapareció remotamente.
                        if (local?.padreId?.isNotEmpty() == true) {
                            deleteDevice(deviceId)
                        }
                    } else if (local?.padreId != parentId) {
                        val synced = (local ?: LocalChildDevice(
                            deviceId = deviceId,
                            modelo = android.os.Build.MODEL
                        )).copy(padreId = parentId, ultimaActualizacion = System.currentTimeMillis())
                        val devices = getAllDevices().toMutableMap()
                        devices[deviceId] = synced
                        saveDevicesMap(devices)
                        mainHandler.post {
                            deviceListeners[deviceId]?.forEach { it.invoke(synced) }
                        }
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Error consultando estado remoto del dispositivo: ${e.message}")
                }
            }
        }

        return ListenerRegistration {
            pollingActive = false
            list.remove(onDeviceChanged)
        }
    }

    fun listenPairingCode(code: String, onCodeChanged: (LocalPairingCode?) -> Unit): ListenerRegistration {
        val initial = getPairingCodes()[code]
        onCodeChanged(initial)
        val list = pairingListeners.getOrPut(code) { CopyOnWriteArrayList() }
        list.add(onCodeChanged)

        // Monitoreo reactivo en background contra Google Cloud Platform (Cloud Run)
        var isPollingActive = true
        kotlin.concurrent.thread {
            while (isPollingActive) {
                try {
                    Thread.sleep(1500)
                    if (!isPollingActive) break
                    val jsonStr = httpGet("/api/v1/devices/pairing/$code")
                    if (!jsonStr.isNullOrEmpty()) {
                        val root = gson.fromJson(jsonStr, Map::class.java)
                        val data = root["data"] as? Map<*, *>
                        if (data != null) {
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
                                break
                            }
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "GCP Polling Error: ${e.message}")
                }
            }
        }

        return ListenerRegistration {
            isPollingActive = false
            list.remove(onCodeChanged)
        }
    }

    fun deleteDevice(deviceId: String, parentId: String = "") {
        val devices = getAllDevices().toMutableMap()
        val keysToRemove = devices.filter { entry ->
            entry.key == deviceId || 
            entry.value.deviceId == deviceId || 
            (parentId.isNotEmpty() && entry.value.padreId == parentId && (deviceId.isEmpty() || entry.value.deviceId == deviceId))
        }.keys.toList()

        for (k in keysToRemove) {
            devices.remove(k)
        }
        saveDevicesMap(devices)

        // Limpiar códigos de emparejamiento asociados
        val codes = getPairingCodes().toMutableMap()
        val codesToRemove = codes.filter { entry ->
            entry.key == deviceId || 
            entry.value.deviceId == deviceId || 
            (parentId.isNotEmpty() && entry.value.padreId == parentId)
        }.keys.toList()
        for (c in codesToRemove) {
            codes.remove(c)
        }
        prefs.edit().putString(KEY_PAIRING_CODES, gson.toJson(codes)).apply()

        // Notificar en tiempo real en el hilo principal para reactividad instantánea en Compose
        mainHandler.post {
            deviceListeners[deviceId]?.forEach { it.invoke(null) }
            if (parentId.isNotEmpty()) {
                val remaining = devices.values.filter { it.padreId == parentId }
                parentDeviceListListeners[parentId]?.forEach { it.invoke(remaining) }
            } else {
                parentDeviceListListeners.forEach { (pId, listeners) ->
                    val remaining = devices.values.filter { it.padreId == pId }
                    listeners.forEach { it.invoke(remaining) }
                }
            }
        }
    }

    fun unlinkChildDevice(deviceId: String, parentId: String = "") {
        deleteDevice(deviceId, parentId)
        kotlin.concurrent.thread {
            try {
                val urlParam = if (parentId.isNotEmpty()) "?parentId=$parentId" else ""
                httpDelete("/api/v1/devices/$deviceId$urlParam")
                httpDelete("/api/devices/$deviceId$urlParam")
            } catch (e: Exception) {
                Log.e(TAG, "Error unlinking device from server: ${e.message}")
            }
        }
    }

    fun deletePairingCode(code: String) {
        val map = getPairingCodes().toMutableMap()
        map.remove(code)
        prefs.edit().putString(KEY_PAIRING_CODES, gson.toJson(map)).apply()
    }
}

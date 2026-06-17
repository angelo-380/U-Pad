package com.example.upad.viewmodel

import android.content.Context
import android.content.Intent
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.upad.data.FirebaseRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import com.example.upad.data.ArasaacPictogram
import com.example.upad.data.ArasaacService
import com.example.upad.data.DataStoreManager
import com.example.upad.widget.ChildSessionMonitorWidgetProvider
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.asStateFlow
import com.google.firebase.firestore.ListenerRegistration

data class TaskItem(
    val actividad: String = "",
    val palabraClave: String = "",
    val imageUrl: String = "",
    val dias: List<String> = emptyList(),
    val duration: Int = 15,
    val estadosPorDia: Map<String, Boolean> = emptyMap(),
    val emocionesPorDia: Map<String, String> = emptyMap()
) {
    fun estaCompletadaHoy(diaActual: String): Boolean {
        val diaKey = diaActual.uppercase().trim()
        return estadosPorDia[diaKey] ?: false
    }

    fun obtenerEmocionHoy(diaActual: String): String {
        val diaKey = diaActual.uppercase().trim()
        return emocionesPorDia[diaKey] ?: ""
    }
}

class RoutineViewModel(
    private val repository: FirebaseRepository,
    private val dataStoreManager: DataStoreManager
) : ViewModel() {

    private var listenerManana: ListenerRegistration? = null
    private var listenerTarde: ListenerRegistration? = null
    private var listenerNoche: ListenerRegistration? = null

    private val _isPremiumManual = MutableStateFlow(false)
    val isUserPremium: StateFlow<Boolean> = _isPremiumManual

    init {
        viewModelScope.launch {
            dataStoreManager.isPremiumFlow.collectLatest { estadoReal ->
                _isPremiumManual.value = estadoReal
            }
        }
    }

    fun setSuscripcionManual(activarPremium: Boolean, userId: String? = null) {
        viewModelScope.launch {
            dataStoreManager.setPremiumStatus(activarPremium)
            _isPremiumManual.value = activarPremium

            if (!userId.isNullOrEmpty()) {
                try {
                    repository.setPremiumStatus(userId, activarPremium)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    fun purchasePremium(userId: String? = null) { setSuscripcionManual(true, userId) }
    fun cancelPremium(userId: String? = null) { setSuscripcionManual(false, userId) }

    private val _isDarkMode = MutableStateFlow(false)
    val isDarkMode: StateFlow<Boolean> = _isDarkMode.asStateFlow()

    fun setDarkMode(enabled: Boolean) { _isDarkMode.value = enabled }

    private val _currentRoutineName = MutableStateFlow("")
    val currentRoutineName: StateFlow<String> = _currentRoutineName

    private val _tasksManana = MutableStateFlow<List<TaskItem>>(emptyList())
    val tasksManana: StateFlow<List<TaskItem>> = _tasksManana

    private val _tasksTarde = MutableStateFlow<List<TaskItem>>(emptyList())
    val tasksTarde: StateFlow<List<TaskItem>> = _tasksTarde

    private val _tasksNoche = MutableStateFlow<List<TaskItem>>(emptyList())
    val tasksNoche: StateFlow<List<TaskItem>> = _tasksNoche

    private val _searchResults = MutableStateFlow<List<ArasaacPictogram>>(emptyList())
    val searchResults: StateFlow<List<ArasaacPictogram>> = _searchResults

    private val arasaacService = retrofit2.Retrofit.Builder()
        .baseUrl("https://api.arasaac.org/")
        .addConverterFactory(retrofit2.converter.gson.GsonConverterFactory.create())
        .build()
        .create(ArasaacService::class.java)

    fun updateName(newName: String) { _currentRoutineName.value = newName }

    fun cargarRutinasDesdeFirebase(userId: String) {
        viewModelScope.launch {
            listenerManana?.remove()
            listenerTarde?.remove()
            listenerNoche?.remove()

            listenerManana = repository.escucharRutinasDelPadre(userId, "MAÑANA") { lista ->
                _tasksManana.value = lista
                notificarCambioAlWidget()
            }
            listenerTarde = repository.escucharRutinasDelPadre(userId, "TARDE") { lista ->
                _tasksTarde.value = lista
                notificarCambioAlWidget()
            }
            listenerNoche = repository.escucharRutinasDelPadre(userId, "NOCHE") { lista ->
                _tasksNoche.value = lista
                notificarCambioAlWidget()
            }
        }
    }

    private fun notificarCambioAlWidget() {
        try {
            // FIX: usar applicationContext del proceso directamente, no via FirebaseApp
            val context = com.example.upad.UPadApplication.appContext
            val prefs = context.getSharedPreferences("WIDGET_PREFS", Context.MODE_PRIVATE)
            val diaDeHoy = com.example.upad.utils.RoutineProgressCalculator.obtenerDiaDeHoy()
            val prefijoDia = com.example.upad.utils.RoutineProgressCalculator.obtenerPrefijoDia(diaDeHoy)

            val progManana = calcularPorcentaje(_tasksManana.value, prefijoDia)
            val progTarde  = calcularPorcentaje(_tasksTarde.value, prefijoDia)
            val progNoche  = calcularPorcentaje(_tasksNoche.value, prefijoDia)

            prefs.edit().apply {
                putInt("PROGRESO_MANANA", progManana)
                putInt("PROGRESO_TARDE", progTarde)
                putInt("PROGRESO_NOCHE", progNoche)
                putLong("ULTIMO_FETCH", System.currentTimeMillis())
                apply()
            }
            com.example.upad.widget.ParentRoutineWidgetProvider.notificarCambioDatos(context)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun calcularPorcentaje(tareas: List<TaskItem>, prefijoDia: String): Int {
        val (total, completadas) = com.example.upad.utils.RoutineProgressCalculator.calcularProgreso(tareas, prefijoDia)
        return if (total > 0) (completadas * 100) / total else 0
    }

    fun searchArasaac(query: String) {
        viewModelScope.launch {
            try {
                if (query.length > 2) {
                    _searchResults.value = arasaacService.searchPictograms(query)
                } else {
                    _searchResults.value = emptyList()
                }
            } catch (e: Exception) {
                _searchResults.value = emptyList()
            }
        }
    }

    fun addTask(turn: String, actividadTexto: String, imageUrl: String, userId: String = "PADRE_TEST") {
        val newTask = TaskItem(
            actividad = actividadTexto.uppercase(),
            imageUrl = imageUrl,
            dias = listOf("Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"),
        )
        val turnoUpper = turn.uppercase()

        when (turnoUpper) {
            "MAÑANA" -> _tasksManana.value = _tasksManana.value + newTask
            "TARDE" -> _tasksTarde.value = _tasksTarde.value + newTask
            "NOCHE" -> _tasksNoche.value = _tasksNoche.value + newTask
        }

        saveAll(userId, turnoUpper)
    }

    fun removeTask(turn: String, index: Int) {
        when (turn.uppercase()) {
            "MAÑANA" -> {
                val newList = _tasksManana.value.toMutableList()
                if (index in newList.indices) { newList.removeAt(index); _tasksManana.value = newList }
            }
            "TARDE" -> {
                val newList = _tasksTarde.value.toMutableList()
                if (index in newList.indices) { newList.removeAt(index); _tasksTarde.value = newList }
            }
            "NOCHE" -> {
                val newList = _tasksNoche.value.toMutableList()
                if (index in newList.indices) { newList.removeAt(index); _tasksNoche.value = newList }
            }
        }
    }

    fun completeTaskPorNombre(userId: String, turn: String, actividadTexto: String, diaActual: String) {
        val turnoUpper = turn.uppercase()
        // FIX: convertir el día a prefijo ANTES de usarlo como key
        val diaKey = com.example.upad.utils.RoutineProgressCalculator
            .obtenerPrefijoDia(diaActual.uppercase().trim())

        val listaActual = when (turnoUpper) {
            "MAÑANA" -> _tasksManana.value.toMutableList()
            "TARDE"  -> _tasksTarde.value.toMutableList()
            else     -> _tasksNoche.value.toMutableList()
        }

        val indexReal = listaActual.indexOfFirst {
            it.actividad.uppercase() == actividadTexto.uppercase()
        }

        if (indexReal != -1) {
            val tareaEncontrada = listaActual[indexReal]
            val nuevosEstados = tareaEncontrada.estadosPorDia.toMutableMap()
            nuevosEstados[diaKey] = true  // ahora guarda "LUN", no "LUNES"

            listaActual[indexReal] = tareaEncontrada.copy(estadosPorDia = nuevosEstados)

            when (turnoUpper) {
                "MAÑANA" -> _tasksManana.value = listaActual
                "TARDE"  -> _tasksTarde.value = listaActual
                else     -> _tasksNoche.value = listaActual
            }

            viewModelScope.launch {
                try { repository.saveRoutine(userId, turnoUpper, listaActual) }
                catch (e: Exception) { e.printStackTrace() }
            }
        }
    }

    fun getCompletedCount(turn: String, diaActual: String): Int {
        val targetList = when (turn.uppercase()) {
            "MAÑANA" -> _tasksManana.value
            "TARDE" -> _tasksTarde.value
            else -> _tasksNoche.value
        }
        return targetList.count { it.estaCompletadaHoy(diaActual) }
    }

    fun getTotalCount(turn: String, diaActual: String): Int {
        val targetList = when (turn.uppercase()) {
            "MAÑANA" -> _tasksManana.value
            "TARDE" -> _tasksTarde.value
            else -> _tasksNoche.value
        }
        return targetList.count { tarea ->
            tarea.dias.isEmpty() || tarea.dias.any { it.uppercase().trim().startsWith(diaActual.uppercase().trim()) }
        }
    }

    fun saveAll(userId: String, turn: String) {
        viewModelScope.launch {
            val listToSave = when (turn.uppercase()) {
                "MAÑANA" -> _tasksManana.value
                "TARDE" -> _tasksTarde.value
                else -> _tasksNoche.value
            }
            repository.saveRoutine(userId, turn.uppercase(), listToSave)
        }
    }

    fun agregarActividadAutomatica(userId: String, turn: String, textoCompleto: String, diasSeleccionados: List<String>) {
        val turnoUpper = turn.uppercase()

        viewModelScope.launch {
            var urlImagenFinal = ""
            try {
                // ✅ Normalizar el texto completo
                val textoNormalizado = textoCompleto.trim()
                    .lowercase()
                    .replace(Regex("[áàä]"), "a")
                    .replace(Regex("[éèë]"), "e")
                    .replace(Regex("[íìï]"), "i")
                    .replace(Regex("[óòö]"), "o")
                    .replace(Regex("[úùü]"), "u")
                    .replace(Regex("[^a-z0-9 ]"), "")

                // ✅ Separar en palabras y probar una por una
                val palabras = textoNormalizado.split(" ")
                    .map { it.trim() }
                    .filter { it.length > 2 }

                android.util.Log.d("ARASAAC", "Palabras a probar: $palabras")

                for (palabra in palabras) {
                    android.util.Log.d("ARASAAC", "Probando palabra: $palabra")
                    val resultados = arasaacService.searchPictograms(palabra)
                    android.util.Log.d("ARASAAC", "Resultados para '$palabra': ${resultados.size}")

                    if (resultados.isNotEmpty()) {
                        val idImagen = resultados.first()._id
                        urlImagenFinal = "https://static.arasaac.org/pictograms/$idImagen/${idImagen}_300.png"
                        android.util.Log.d("ARASAAC", "✅ Imagen encontrada con '$palabra': $urlImagenFinal")
                        break // ✅ Encontró imagen, para de buscar
                    }
                }

            } catch (e: Exception) {
                android.util.Log.e("ARASAAC", "Error: ${e.message}")
            }

            android.util.Log.d("ARASAAC", "URL final guardada: $urlImagenFinal")

            val mapaInicialEstados = diasSeleccionados.associate { it.uppercase().trim() to false }

            val nuevaTarea = TaskItem(
                actividad = textoCompleto.uppercase(),
                palabraClave = textoCompleto.trim(),
                imageUrl = urlImagenFinal,
                dias = diasSeleccionados.map { it.trim() },
                estadosPorDia = mapaInicialEstados,
            )

            when (turnoUpper) {
                "MAÑANA" -> _tasksManana.value = _tasksManana.value + nuevaTarea
                "TARDE" -> _tasksTarde.value = _tasksTarde.value + nuevaTarea
                else -> _tasksNoche.value = _tasksNoche.value + nuevaTarea
            }

            try {
                val listaActualizada = when (turnoUpper) {
                    "MAÑANA" -> _tasksManana.value
                    "TARDE" -> _tasksTarde.value
                    else -> _tasksNoche.value
                }
                repository.saveRoutine(userId, turnoUpper, listaActualizada)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun registrarFeedbackEmocional(
        userId: String, turn: String,
        actividadNombre: String, emocionSeleccionada: String, context: Context
    ) {
        val turnoUpper = turn.uppercase()
        val diaActual = com.example.upad.utils.RoutineProgressCalculator.obtenerDiaDeHoy()
        // FIX: misma conversión a prefijo
        val diaKey = com.example.upad.utils.RoutineProgressCalculator
            .obtenerPrefijoDia(diaActual.uppercase().trim())

        val listaActual = when (turnoUpper) {
            "MAÑANA" -> _tasksManana.value.toMutableList()
            "TARDE"  -> _tasksTarde.value.toMutableList()
            else     -> _tasksNoche.value.toMutableList()
        }

        val index = listaActual.indexOfFirst {
            it.actividad.uppercase() == actividadNombre.uppercase()
        }

        if (index != -1) {
            val tarea = listaActual[index]
            val nuevasEmociones = tarea.emocionesPorDia.toMutableMap()
            nuevasEmociones[diaKey] = emocionSeleccionada

            listaActual[index] = tarea.copy(emocionesPorDia = nuevasEmociones)

            when (turnoUpper) {
                "MAÑANA" -> _tasksManana.value = listaActual
                "TARDE"  -> _tasksTarde.value = listaActual
                else     -> _tasksNoche.value = listaActual
            }

            viewModelScope.launch {
                try {
                    repository.saveRoutine(userId, turnoUpper, listaActual)
                    val intent = Intent(context, ChildSessionMonitorWidgetProvider::class.java).apply {
                        action = ChildSessionMonitorWidgetProvider.ACTION_REFRESH
                    }
                    context.sendBroadcast(intent)
                } catch (e: Exception) { e.printStackTrace() }
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        listenerManana?.remove()
        listenerTarde?.remove()
        listenerNoche?.remove()
    }
}
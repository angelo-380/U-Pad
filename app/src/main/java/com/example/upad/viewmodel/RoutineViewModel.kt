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
import com.example.upad.utils.RoutineProgressCalculator

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
        val diaKey = RoutineProgressCalculator.obtenerPrefijoDia(diaActual)
        return estadosPorDia[diaKey] ?: false
    }

    fun obtenerEmocionHoy(diaActual: String): String {
        val diaKey = RoutineProgressCalculator.obtenerPrefijoDia(diaActual)
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

    var ultimoDiaCargado: String = "LUNES"
        private set

    fun cargarRutinasDesdeFirebase(userId: String) {
        cargarRutinasPorDia(userId, RoutineProgressCalculator.obtenerDiaDeHoy())
    }

    fun cargarRutinasPorDia(userId: String, dia: String) {
        val uidValido = obtenerUidSeguro(userId)
        val diaKey = dia.uppercase().trim().replace("É", "E").replace("Á", "A")
        val diaFull = when (diaKey.take(3)) {
            "LUN" -> "LUNES"
            "MAR" -> "MARTES"
            "MIE" -> "MIERCOLES"
            "JUE" -> "JUEVES"
            "VIE" -> "VIERNES"
            "SAB" -> "SABADO"
            "DOM" -> "DOMINGO"
            else -> diaKey
        }
        ultimoDiaCargado = diaFull

        viewModelScope.launch {
            listenerManana?.remove()
            listenerTarde?.remove()
            listenerNoche?.remove()

            listenerManana = repository.escucharRutinasDelPadrePorDia(uidValido, "MAÑANA", diaFull) { lista ->
                _tasksManana.value = lista
                notificarCambioAlWidget()
            }
            listenerTarde = repository.escucharRutinasDelPadrePorDia(uidValido, "TARDE", diaFull) { lista ->
                _tasksTarde.value = lista
                notificarCambioAlWidget()
            }
            listenerNoche = repository.escucharRutinasDelPadrePorDia(uidValido, "NOCHE", diaFull) { lista ->
                _tasksNoche.value = lista
                notificarCambioAlWidget()
            }
        }
    }

    private fun notificarCambioAlWidget() {
        try {
            val context = com.example.upad.UPadApplication.appContext
            val prefs = context.getSharedPreferences("WIDGET_PREFS", Context.MODE_PRIVATE)
            val diaDeHoy = RoutineProgressCalculator.obtenerDiaDeHoy()
            val prefijoDia = RoutineProgressCalculator.obtenerPrefijoDia(diaDeHoy)

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
        val (total, completadas) = RoutineProgressCalculator.calcularProgreso(tareas, prefijoDia)
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

    private fun normalizarTurno(turn: String): String {
        val clean = turn.uppercase().trim()
        return when (clean) {
            "MAÑANA", "MANANA" -> "MAÑANA"
            "TARDE" -> "TARDE"
            "NOCHE" -> "NOCHE"
            else -> "MAÑANA"
        }
    }

    private fun obtenerUidSeguro(userId: String): String {
        return if (userId == "PADRE_TEST" || userId.isBlank()) {
            com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.uid ?: "PADRE_TEST"
        } else {
            userId
        }
    }

    fun addTask(turn: String, actividadTexto: String, imageUrl: String, userId: String = "PADRE_TEST") {
        val turnoValido = normalizarTurno(turn)
        val uidValido = obtenerUidSeguro(userId)
        val newTask = TaskItem(
            actividad = actividadTexto.uppercase(),
            imageUrl = imageUrl,
            dias = listOf("LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"),
        )
        val todosLosDias = listOf("LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO")

        viewModelScope.launch {
            for (diaFull in todosLosDias) {
                val listaActualizada = try {
                    val listExistente = repository.obtenerRutinasDelPadreDirectoPorDia(uidValido, turnoValido, diaFull)
                    listExistente + newTask
                } catch (e: Exception) {
                    emptyList<TaskItem>() + newTask
                }
                try {
                    repository.saveRoutinePorDia(uidValido, turnoValido, diaFull, listaActualizada)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    fun addTaskConDia(turn: String, actividadTexto: String, imageUrl: String, dia: String, userId: String = "PADRE_TEST") {
        val turnoValido = normalizarTurno(turn)
        val uidValido = obtenerUidSeguro(userId)
        val diaKey = RoutineProgressCalculator.obtenerPrefijoDia(dia)
        val diaFull = when (diaKey) {
            "LUN" -> "LUNES"
            "MAR" -> "MARTES"
            "MIE", "MIÉ" -> "MIERCOLES"
            "JUE" -> "JUEVES"
            "VIE" -> "VIERNES"
            "SAB", "SÁB" -> "SABADO"
            "DOM" -> "DOMINGO"
            else -> dia.uppercase().trim().replace("É", "E").replace("Á", "A")
        }

        val newTask = TaskItem(
            actividad = actividadTexto.uppercase(),
            imageUrl = imageUrl,
            dias = listOf(diaKey),
        )

        viewModelScope.launch {
            val listaActualizada = try {
                repository.obtenerRutinasDelPadreDirectoPorDia(uidValido, turnoValido, diaFull) + newTask
            } catch (e: Exception) {
                emptyList<TaskItem>() + newTask
            }

            try {
                repository.saveRoutinePorDia(uidValido, turnoValido, diaFull, listaActualizada)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun removeTask(turn: String, index: Int) {
        val turnoValido = normalizarTurno(turn)
        val uidValido = obtenerUidSeguro("PADRE_TEST")
        val diaFull = ultimoDiaCargado

        viewModelScope.launch {
            val listLocal = when (turnoValido) {
                "MAÑANA" -> _tasksManana.value.toMutableList()
                "TARDE" -> _tasksTarde.value.toMutableList()
                else -> _tasksNoche.value.toMutableList()
            }

            if (index in listLocal.indices) {
                listLocal.removeAt(index)

                when (turnoValido) {
                    "MAÑANA" -> _tasksManana.value = listLocal
                    "TARDE" -> _tasksTarde.value = listLocal
                    "NOCHE" -> _tasksNoche.value = listLocal
                }

                try {
                    repository.saveRoutinePorDia(uidValido, turnoValido, diaFull, listLocal)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    fun completeTaskPorNombre(userId: String, turn: String, actividadTexto: String, diaActual: String) {
        val turnoValido = normalizarTurno(turn)
        val uidValido = obtenerUidSeguro(userId)
        val diaKey = RoutineProgressCalculator.obtenerPrefijoDia(diaActual)
        val diaFull = when (diaKey) {
            "LUN" -> "LUNES"
            "MAR" -> "MARTES"
            "MIE" -> "MIERCOLES"
            "JUE" -> "JUEVES"
            "VIE" -> "VIERNES"
            "SAB" -> "SABADO"
            "DOM" -> "DOMINGO"
            else -> diaActual.uppercase().trim().replace("É", "E").replace("Á", "A")
        }

        viewModelScope.launch {
            val listaActual = try {
                repository.obtenerRutinasDelPadreDirectoPorDia(uidValido, turnoValido, diaFull).toMutableList()
            } catch (e: Exception) {
                when (turnoValido) {
                    "MAÑANA" -> _tasksManana.value.toMutableList()
                    "TARDE"  -> _tasksTarde.value.toMutableList()
                    else     -> _tasksNoche.value.toMutableList()
                }
            }

            val indexReal = listaActual.indexOfFirst {
                it.actividad.uppercase() == actividadTexto.uppercase()
            }

            if (indexReal != -1) {
                val tareaEncontrada = listaActual[indexReal]
                val nuevosEstados = tareaEncontrada.estadosPorDia.toMutableMap()
                nuevosEstados[diaKey] = true

                listaActual[indexReal] = tareaEncontrada.copy(estadosPorDia = nuevosEstados)

                when (turnoValido) {
                    "MAÑANA" -> _tasksManana.value = listaActual
                    "TARDE"  -> _tasksTarde.value = listaActual
                    "NOCHE"  -> _tasksNoche.value = listaActual
                }

                try {
                    repository.saveRoutinePorDia(uidValido, turnoValido, diaFull, listaActual)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    fun getCompletedCount(turn: String, diaActual: String): Int {
        val turnoValido = normalizarTurno(turn)
        val targetList = when (turnoValido) {
            "MAÑANA" -> _tasksManana.value
            "TARDE" -> _tasksTarde.value
            else -> _tasksNoche.value
        }
        val prefijoLimpio = RoutineProgressCalculator.obtenerPrefijoDia(diaActual)
        return targetList.count { it.estaCompletadaHoy(prefijoLimpio) }
    }

    fun getTotalCount(turn: String, diaActual: String): Int {
        val turnoValido = normalizarTurno(turn)
        val targetList = when (turnoValido) {
            "MAÑANA" -> _tasksManana.value
            "TARDE" -> _tasksTarde.value
            else -> _tasksNoche.value
        }
        val prefijoLimpio = RoutineProgressCalculator.obtenerPrefijoDia(diaActual)
        return targetList.count { tarea ->
            tarea.dias.isEmpty() || tarea.dias.any {
                RoutineProgressCalculator.obtenerPrefijoDia(it) == prefijoLimpio
            }
        }
    }

    fun saveAll(userId: String, turn: String) {
        val turnoValido = normalizarTurno(turn)
        val uidValido = obtenerUidSeguro(userId)
        val diaFull = ultimoDiaCargado
        viewModelScope.launch {
            val listToSave = when (turnoValido) {
                "MAÑANA" -> _tasksManana.value
                "TARDE" -> _tasksTarde.value
                else -> _tasksNoche.value
            }
            repository.saveRoutinePorDia(uidValido, turnoValido, diaFull, listToSave)
        }
    }

    fun agregarActividadAutomatica(userId: String, turn: String, textoCompleto: String, diasSeleccionados: List<String>) {
        val turnoValido = normalizarTurno(turn)
        val uidValido = obtenerUidSeguro(userId)

        viewModelScope.launch {
            var urlImagenFinal = ""
            try {
                val textoNormalizado = textoCompleto.trim()
                    .lowercase()
                    .replace(Regex("[áàä]"), "a")
                    .replace(Regex("[éèë]"), "e")
                    .replace(Regex("[íìï]"), "i")
                    .replace(Regex("[óòö]"), "o")
                    .replace(Regex("[úùü]"), "u")
                    .replace(Regex("[^a-z0-9 ]"), "")

                val palabras = textoNormalizado.split(" ")
                    .map { it.trim() }
                    .filter { it.length > 2 }

                for (palabra in palabras) {
                    val resultados = arasaacService.searchPictograms(palabra)
                    if (resultados.isNotEmpty()) {
                        val idImagen = resultados.first()._id
                        urlImagenFinal = "https://static.arasaac.org/pictograms/$idImagen/${idImagen}_300.png"
                        break
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }

            val diasFinales = if (diasSeleccionados.isEmpty()) {
                listOf(ultimoDiaCargado)
            } else {
                diasSeleccionados
            }

            val mapaInicialEstados = diasFinales.associate {
                RoutineProgressCalculator.obtenerPrefijoDia(it) to false
            }

            val nuevaTarea = TaskItem(
                actividad = textoCompleto.uppercase(),
                palabraClave = textoCompleto.trim(),
                imageUrl = urlImagenFinal,
                dias = diasFinales.map { RoutineProgressCalculator.obtenerPrefijoDia(it) },
                estadosPorDia = mapaInicialEstados,
            )

            for (dia in diasFinales) {
                val diaNormalizado = RoutineProgressCalculator.obtenerPrefijoDia(dia)
                val diaFull = when (diaNormalizado) {
                    "LUN" -> "LUNES"
                    "MAR" -> "MARTES"
                    "MIE" -> "MIERCOLES"
                    "JUE" -> "JUEVES"
                    "VIE" -> "VIERNES"
                    "SAB" -> "SABADO"
                    "DOM" -> "DOMINGO"
                    else -> dia.uppercase().trim().replace("É", "E").replace("Á", "A")
                }

                val listaActualizada = try {
                    val listExistente = repository.obtenerRutinasDelPadreDirectoPorDia(uidValido, turnoValido, diaFull)
                    listExistente + nuevaTarea
                } catch (e: Exception) {
                    emptyList<TaskItem>() + nuevaTarea
                }

                try {
                    repository.saveRoutinePorDia(uidValido, turnoValido, diaFull, listaActualizada)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    fun registrarFeedbackEmocional(
        userId: String, turn: String,
        actividadNombre: String, emocionSeleccionada: String, context: Context
    ) {
        val turnoValido = normalizarTurno(turn)
        val uidValido = obtenerUidSeguro(userId)
        val diaActual = RoutineProgressCalculator.obtenerDiaDeHoy()
        val diaKey = RoutineProgressCalculator.obtenerPrefijoDia(diaActual)
        val diaFull = when (diaKey) {
            "LUN" -> "LUNES"
            "MAR" -> "MARTES"
            "MIE" -> "MIERCOLES"
            "JUE" -> "JUEVES"
            "VIE" -> "VIERNES"
            "SAB" -> "SABADO"
            "DOM" -> "DOMINGO"
            else -> diaActual.uppercase().trim().replace("É", "E").replace("Á", "A")
        }

        viewModelScope.launch {
            val listaActual = try {
                repository.obtenerRutinasDelPadreDirectoPorDia(uidValido, turnoValido, diaFull).toMutableList()
            } catch (e: Exception) {
                when (turnoValido) {
                    "MAÑANA" -> _tasksManana.value.toMutableList()
                    "TARDE"  -> _tasksTarde.value.toMutableList()
                    else     -> _tasksNoche.value.toMutableList()
                }
            }

            val index = listaActual.indexOfFirst {
                it.actividad.uppercase() == actividadNombre.uppercase()
            }

            if (index != -1) {
                val tarea = listaActual[index]
                val nuevasEmociones = tarea.emocionesPorDia.toMutableMap()
                nuevasEmociones[diaKey] = emocionSeleccionada

                listaActual[index] = tarea.copy(emocionesPorDia = nuevasEmociones)

                when (turnoValido) {
                    "MAÑANA" -> _tasksManana.value = listaActual
                    "TARDE"  -> _tasksTarde.value = listaActual
                    "NOCHE"  -> _tasksNoche.value = listaActual
                }

                try {
                    repository.saveRoutinePorDia(uidValido, turnoValido, diaFull, listaActual)
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
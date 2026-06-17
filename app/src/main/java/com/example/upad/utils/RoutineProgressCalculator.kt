package com.example.upad.utils

import com.example.upad.viewmodel.TaskItem
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

object RoutineProgressCalculator {
    val diasSemana = listOf("LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO")

    fun obtenerDiaDeHoy(): String {
        val formato = SimpleDateFormat("EEEE", Locale("es", "ES")).format(Date()).uppercase()
        val formateado = formato.replace("É", "E").replace("Í", "I").replace("Á", "A")
        return if (diasSemana.contains(formateado)) formateado else "LUNES"
    }

    fun obtenerPrefijoDia(dia: String): String {
        return when (dia.uppercase()) {
            "MIÉRCOLES", "MIERCOLES" -> "MIÉ"
            "SÁBADO", "SABADO" -> "SÁB"
            else -> dia.uppercase().take(3)
        }
    }

    fun filtrarTareasPorDia(tareas: List<TaskItem>, prefijoDia: String): List<TaskItem> {
        return tareas.filter { task ->
            task.dias.isEmpty() || task.dias.any { it.uppercase().trim().startsWith(prefijoDia.uppercase()) }
        }
    }

    fun calcularProgreso(tareas: List<TaskItem>, prefijoDia: String): Pair<Int, Int> {
        val tareasFiltradas = filtrarTareasPorDia(tareas, prefijoDia)
        val total = tareasFiltradas.size
        val completadas = tareasFiltradas.count { it.estaCompletadaHoy(prefijoDia) }
        return Pair(total, completadas)
    }
}

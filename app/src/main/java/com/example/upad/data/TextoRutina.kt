package com.example.upad.data

import com.example.upad.R

/**
 * Regla de caracteres del título y de los pasos de una rutina (bloque V). Es la misma del backend
 * (backend/src/utils/textoRutina.js), que es la autoridad: solo letras (con tildes, ü y ñ), números, espacios y
 * el guion «-»; sin dos guiones seguidos; empieza y termina con letra o número.
 * Título: 3 a 60 caracteres y como máximo 4 guiones. Paso: 1 a 120 caracteres y como máximo 6 guiones.
 */
object TextoRutina {
    const val TITULO_MIN = 3
    const val TITULO_MAX = 60
    const val TITULO_GUIONES_MAX = 4
    const val PASO_MAX = 120
    const val PASO_GUIONES_MAX = 6

    private fun permitido(c: Char) = c.isLetterOrDigit() || c == ' ' || c == '-'

    /** Para el campo de texto: descarta lo que no se permite mientras se escribe y corta en el máximo. */
    fun filtrar(texto: String, max: Int): String = texto.filter(::permitido).take(max)

    fun limpiar(texto: String): String = texto.trim().replace(Regex("\\s+"), " ")

    /**
     * Para textos que no escribió el padre (sugerencias de la IA): quita los signos, junta guiones y espacios
     * y recorta los bordes. Puede quedar vacío.
     */
    fun sanear(texto: String, max: Int): String {
        val base = texto.filter(::permitido).replace(Regex("-\\s*-+"), "-")
        return limpiar(base).trim('-', ' ').take(max).trim('-', ' ')
    }

    /** Mensaje de error (id del string y sus argumentos) o null si el texto vale. */
    data class Motivo(val resId: Int, val args: List<Any> = emptyList())

    private fun motivo(texto: String, min: Int, max: Int, guionesMax: Int): Motivo? {
        val limpio = limpiar(texto)
        if (limpio.any { !permitido(it) }) return Motivo(R.string.rutina_texto_signos)
        if (limpio.length < min || limpio.length > max) return Motivo(R.string.rutina_texto_longitud, listOf(min, max))
        if (!limpio.first().isLetterOrDigit() || !limpio.last().isLetterOrDigit()) return Motivo(R.string.rutina_texto_bordes)
        if (Regex("-\\s*-").containsMatchIn(limpio)) return Motivo(R.string.rutina_texto_guiones_seguidos)
        if (limpio.count { it == '-' } > guionesMax) return Motivo(R.string.rutina_texto_guiones_max, listOf(guionesMax))
        return null
    }

    fun motivoTitulo(texto: String): Motivo? = motivo(texto, TITULO_MIN, TITULO_MAX, TITULO_GUIONES_MAX)

    fun motivoPaso(texto: String): Motivo? = motivo(texto, 1, PASO_MAX, PASO_GUIONES_MAX)
}

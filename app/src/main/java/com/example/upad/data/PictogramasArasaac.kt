package com.example.upad.data

import android.content.Context
import android.util.Log
import com.example.upad.UPadApplication
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.ConcurrentHashMap

/**
 * Búsqueda del pictograma de ARASAAC para una frase (punto 1 del docente). Mismo algoritmo que la web
 * (frontend/src/services/arasaacService.js):
 *   1. bestsearch de la frase completa, en minúsculas y CON tildes («cepillar los dientes»);
 *   2. la frase sin el «se» de los verbos («lavarse las manos» → «lavar las manos»): ARASAAC no los indexa;
 *   3. cada palabra con contenido, de la ÚLTIMA a la primera («tomar desayuno» → «desayuno»), también sin el «se»;
 *   4. como último recurso, la búsqueda aproximada (search) de la frase.
 * Los resultados (también los vacíos) se guardan en el teléfono. Las llamadas son bloqueantes: usar fuera del hilo principal.
 */
object PictogramasArasaac {
    private const val TAG = "PictogramasArasaac"
    private const val API = "https://api.arasaac.org/api/pictograms/es"
    private const val PREFS = "UPAD_PICTOGRAMAS"
    private const val SIN_RESULTADO = -1

    private val PALABRAS_VACIAS = setOf(
        "el", "la", "los", "las", "lo", "de", "del", "al", "a", "y", "e", "o", "en", "con", "por", "para",
        "un", "una", "unos", "unas", "mi", "mis", "tu", "su", "sus", "se", "me", "te"
    )
    private val REFLEXIVO = Regex("(ar|er|ir)se\\b")

    private val memoria = ConcurrentHashMap<String, Int>()
    private val prefs by lazy { UPadApplication.appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE) }

    fun urlImagen(id: Int): String = "https://static.arasaac.org/pictograms/$id/${id}_500.png"

    private fun sinReflexivo(texto: String): String = texto.replace(REFLEXIVO, "$1")

    /** Candidatos en orden de preferencia, sin repetidos. */
    fun candidatos(frase: String): List<String> {
        val termino = frase.trim().lowercase().replace(Regex("\\s+"), " ")
        if (termino.isEmpty()) return emptyList()
        val lista = mutableListOf(termino, sinReflexivo(termino))
        val palabras = termino.split(Regex("[\\s,.;:_-]+")).filter { it.length > 2 && it !in PALABRAS_VACIAS }
        for (palabra in palabras.reversed()) {
            lista.add(palabra)
            lista.add(sinReflexivo(palabra))
        }
        return lista.filter { it.isNotBlank() }.distinct()
    }

    private fun consultar(tipo: String, termino: String): Int? {
        val ruta = URLEncoder.encode(termino, "UTF-8").replace("+", "%20")
        var conn: HttpURLConnection? = null
        return try {
            conn = (URL("$API/$tipo/$ruta").openConnection() as HttpURLConnection).apply {
                connectTimeout = 6000
                readTimeout = 8000
                setRequestProperty("Accept", "application/json")
            }
            if (conn.responseCode !in 200..299) return null
            val texto = conn.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            val arreglo = JSONArray(texto)
            if (arreglo.length() == 0) null else arreglo.getJSONObject(0).optInt("_id").takeIf { it > 0 }
        } catch (e: Exception) {
            Log.w(TAG, "Sin respuesta de ARASAAC ($tipo «$termino»): ${e.message}")
            throw e
        } finally {
            conn?.disconnect()
        }
    }

    /** bestsearch con caché (memoria y teléfono). null si no hay coincidencia; lanza si no hubo conexión. */
    private fun mejorCoincidencia(termino: String): Int? {
        val clave = "best:$termino"
        memoria[clave]?.let { return it.takeIf { id -> id != SIN_RESULTADO } }
        val guardado = prefs.getInt(clave, 0)
        if (guardado != 0) {
            memoria[clave] = guardado
            return guardado.takeIf { it != SIN_RESULTADO }
        }
        val id = consultar("bestsearch", termino)
        val valor = id ?: SIN_RESULTADO
        memoria[clave] = valor
        prefs.edit().putInt(clave, valor).apply()
        return id
    }

    /** Id del pictograma para una frase, o null si no hay ninguno (o no hay conexión). */
    fun buscarId(frase: String): Int? {
        val termino = frase.trim().lowercase().replace(Regex("\\s+"), " ")
        if (termino.isEmpty()) return null
        val clave = "frase:$termino"
        memoria[clave]?.let { return it.takeIf { id -> id != SIN_RESULTADO } }
        val guardado = prefs.getInt(clave, 0)
        if (guardado != 0) {
            memoria[clave] = guardado
            return guardado.takeIf { it != SIN_RESULTADO }
        }
        return try {
            val id = candidatos(termino).firstNotNullOfOrNull { mejorCoincidencia(it) } ?: consultar("search", termino)
            val valor = id ?: SIN_RESULTADO
            memoria[clave] = valor
            prefs.edit().putInt(clave, valor).apply()
            id
        } catch (e: Exception) {
            null // sin conexión: no se guarda, se reintentará
        }
    }

    /** URL de la imagen para una frase, o "" si no hay pictograma. */
    fun urlPara(frase: String): String = buscarId(frase)?.let { urlImagen(it) } ?: ""
}

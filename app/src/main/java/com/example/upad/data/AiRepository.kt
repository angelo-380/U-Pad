package com.example.upad.data

import com.example.upad.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException

class AiRepository {
    private val client = OkHttpClient()

    suspend fun getRoutineSuggestions(routineTurn: String): List<String> = withContext(Dispatchers.IO) {
        val body = """
            {
                "model": "llama-3.3-70b-versatile",
                "max_tokens": 200,
                "messages": [
                    {
                        "role": "system",
                        "content": "Eres un psicopedagogo experto en autismo (TEA). Sugiere exactamente 3 actividades, una por linea, empezando con numero y punto. Maximo 4 palabras cada una. Sin saludos ni explicaciones."
                    },
                    {
                        "role": "user",
                        "content": "Dame 3 actividades para la rutina de la $routineTurn de un nino con TEA."
                    }
                ]
            }
        """.trimIndent()

        val request = Request.Builder()
            .url("https://api.groq.com/openai/v1/chat/completions")
            .post(body.toRequestBody("application/json".toMediaTypeOrNull()))
            .addHeader("Authorization", "Bearer ${BuildConfig.GROQ_API_KEY}")
            .addHeader("Content-Type", "application/json")
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IOException("Error de API: ${response.code}")
            }
            val jsonResponse = response.body?.string() ?: ""
            val jsonObj = JSONObject(jsonResponse)

            if (jsonObj.has("error")) {
                val errorMsg = jsonObj.getJSONObject("error").optString("message", "Error desconocido")
                throw IOException(errorMsg)
            }

            val rawText = jsonObj
                .getJSONArray("choices")
                .getJSONObject(0)
                .getJSONObject("message")
                .getString("content")

            val suggestions = mutableListOf<String>()
            if (rawText.isNotEmpty()) {
                val lines = rawText.split("\n")
                for (line in lines) {
                    val cleaned = line
                        .replace(Regex("^[0-9]+\\.\\s*"), "")
                        .trim()
                    if (cleaned.isNotEmpty()) {
                        suggestions.add(cleaned)
                    }
                }
            }
            suggestions
        }
    }
}

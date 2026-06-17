package com.example.upad.data

import android.net.Uri
import com.example.upad.viewmodel.TaskItem
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.storage.FirebaseStorage
import kotlinx.coroutines.tasks.await

class FirebaseRepository {
    private val firestore = FirebaseFirestore.getInstance()
    private val storage = FirebaseStorage.getInstance().reference

    suspend fun saveUserData(userId: String, name: String) {
        firestore.collection("users").document(userId)
            .set(mapOf("name" to name), SetOptions.merge())
            .await()
    }

    suspend fun uploadPictogram(userId: String, imageUri: Uri): String {
        val ref = storage.child("pictograms/$userId/${System.currentTimeMillis()}.jpg")
        ref.putFile(imageUri).await()
        return ref.downloadUrl.await().toString()
    }

    suspend fun setPremiumStatus(userId: String, isPremium: Boolean) {
        firestore.collection("users").document(userId)
            .set(mapOf("isPremium" to isPremium), SetOptions.merge())
            .await()
    }

    // --- GUARDADO CORREGIDO ---
    // Guardamos en: routines -> userId -> turns -> {turno}
    suspend fun saveRoutine(userId: String, turn: String, tasks: List<TaskItem>) {
        firestore.collection("routines")
            .document(userId)
            .collection("turns")
            .document(turn.uppercase()) // Asegura que se guarde en MAYÚSCULAS limpias
            .set(mapOf("tasks" to tasks), SetOptions.merge())
            .await()
    }

    // --- ESCUCHA EN TIEMPO REAL CORREGIDA ---
    // Escucha EXACTAMENTE en la misma ruta donde se guarda
    fun escucharRutinasDelPadre(padreId: String, turn: String, onDataChanged: (List<TaskItem>) -> Unit): ListenerRegistration {
        return firestore.collection("routines")
            .document(padreId)
            .collection("turns")
            .document(turn.uppercase()) // Buscamos en "MAÑANA", "TARDE" o "NOCHE"
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    return@addSnapshotListener
                }

                val tareas = mutableListOf<TaskItem>()
                if (snapshot != null && snapshot.exists()) {
                    val tasksList = snapshot.get("tasks") as? List<*> ?: emptyList<Any>()
                    for (taskItem in tasksList) {
                        if (taskItem is Map<*, *>) {
                            try {
                                val actividad = taskItem["actividad"] as? String ?: ""
                                val palabraClave = taskItem["palabraClave"] as? String ?: ""
                                val imageUrl = taskItem["imageUrl"] as? String ?: ""
                                
                                val rawDias = taskItem["dias"] as? List<*> ?: emptyList<Any>()
                                val dias = rawDias.mapNotNull { it?.toString() }
                                
                                val durationNum = taskItem["duration"] as? Number ?: 15

                                val rawEstados = taskItem["estadosPorDia"] as? Map<*, *> ?: emptyMap<Any, Any>()
                                val estadosPorDia = rawEstados.entries.associate {
                                    it.key.toString() to (it.value as? Boolean ?: false)
                                }

                                val rawEmociones = taskItem["emocionesPorDia"] as? Map<*, *> ?: emptyMap<Any, Any>()
                                val emocionesPorDia = rawEmociones.entries.associate {
                                    it.key.toString() to (it.value as? String ?: "")
                                }

                                tareas.add(
                                    TaskItem(
                                        actividad = actividad,
                                        palabraClave = palabraClave,
                                        imageUrl = imageUrl,
                                        dias = dias,
                                        duration = durationNum.toInt(),
                                        estadosPorDia = estadosPorDia,
                                        emocionesPorDia = emocionesPorDia
                                    )
                                )
                            } catch (e: Exception) {
                                e.printStackTrace()
                            }
                        }
                    }
                }
                // Le enviamos la lista real con "actividad" al ViewModel
                onDataChanged(tareas)
            }
    }
}
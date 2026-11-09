package com.example.upad.data

import android.net.Uri
import com.example.upad.viewmodel.TaskItem
import com.google.firebase.firestore.ListenerRegistration

class FirebaseRepository {

    suspend fun saveUserData(userId: String, name: String) {
        LocalDataManager.saveUserData(userId, name)
    }

    suspend fun uploadPictogram(userId: String, imageUri: Uri): String {
        // En modo puramente local retornamos directamente la URI local de la imagen
        return imageUri.toString()
    }

    suspend fun setPremiumStatus(userId: String, isPremium: Boolean) {
        LocalDataManager.setPremiumStatus(userId, isPremium)
    }

    suspend fun saveUserLanguage(userId: String, languageCode: String) {
        LocalDataManager.saveUserLanguage(userId, languageCode)
    }

    fun listenUserLanguage(userId: String, onLanguageChanged: (String) -> Unit): ListenerRegistration {
        return LocalDataManager.listenUserLanguage(userId, onLanguageChanged)
    }

    suspend fun saveRoutine(userId: String, turn: String, tasks: List<TaskItem>) {
        val dias = listOf("LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO", "DOMINGO")
        for (dia in dias) {
            LocalDataManager.saveRoutinePorDia(userId, turn, dia, tasks)
        }
    }

    fun escucharRutinasDelPadre(padreId: String, turn: String, onDataChanged: (List<TaskItem>) -> Unit): ListenerRegistration {
        return LocalDataManager.listenRoutinePorDia(padreId, turn, "LUNES", onDataChanged)
    }

    suspend fun obtenerRutinasDelPadreDirecto(padreId: String, turn: String): List<TaskItem> {
        return LocalDataManager.getRoutinePorDia(padreId, turn, "LUNES")
    }

    suspend fun saveRoutinePorDia(userId: String, turn: String, dia: String, tasks: List<TaskItem>) {
        LocalDataManager.saveRoutinePorDia(userId, turn, dia, tasks)
    }

    fun escucharRutinasDelPadrePorDia(padreId: String, turn: String, dia: String, onDataChanged: (List<TaskItem>) -> Unit): ListenerRegistration {
        return LocalDataManager.listenRoutinePorDia(padreId, turn, dia, onDataChanged)
    }

    suspend fun obtenerRutinasDelPadreDirectoPorDia(padreId: String, turn: String, dia: String): List<TaskItem> {
        return LocalDataManager.getRoutinePorDia(padreId, turn, dia)
    }

    fun listenToChildDevice(deviceId: String, onDeviceChanged: (LocalChildDevice?) -> Unit): ListenerRegistration {
        return LocalDataManager.listenChildDevice(deviceId, onDeviceChanged)
    }

    fun createPairingCode(code: String, deviceId: String) {
        LocalDataManager.createPairingCode(code, deviceId)
    }

    fun listenToPairingCode(code: String, onCodeChanged: (LocalPairingCode?) -> Unit): ListenerRegistration {
        return LocalDataManager.listenPairingCode(code, onCodeChanged)
    }

    fun linkDeviceToParent(deviceId: String, parentId: String) {
        LocalDataManager.linkDeviceToParent(deviceId, parentId)
    }

    fun deletePairingCode(code: String) {
        LocalDataManager.deletePairingCode(code)
    }

    fun listenToUserPremium(parentId: String, onPremiumChanged: (Boolean) -> Unit): ListenerRegistration {
        return LocalDataManager.listenUserPremium(parentId, onPremiumChanged)
    }

    suspend fun updateDeviceLocation(deviceId: String, latitude: Double, longitude: Double) {
        LocalDataManager.updateDeviceLocation(deviceId, latitude, longitude)
    }

    suspend fun deleteDeviceDoc(deviceId: String) {
        LocalDataManager.deleteDevice(deviceId)
    }

    suspend fun guardarMensajesRefuerzo(userId: String, turn: String, mensajes: List<String>) {
        LocalDataManager.saveReinforcementMessages(userId, turn, mensajes)
    }

    suspend fun obtenerMensajesRefuerzo(userId: String, turn: String): List<String> {
        return LocalDataManager.getReinforcementMessages(userId, turn)
    }
}

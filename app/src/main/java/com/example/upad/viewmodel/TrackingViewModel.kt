package com.example.upad.viewmodel

import androidx.lifecycle.ViewModel
import com.example.upad.data.LocalDataManager
import com.example.upad.dashboard.DispositivoVinculado
import com.google.firebase.firestore.ListenerRegistration
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

data class UbicacionHijo(
    val latitud: Double = 0.0,
    val longitud: Double = 0.0
)

class TrackingViewModel : ViewModel() {

    private var ubicacionListener: ListenerRegistration? = null
    private var dispositivosListener: ListenerRegistration? = null

    private val _ubicacion = MutableStateFlow<UbicacionHijo?>(null)
    val ubicacion: StateFlow<UbicacionHijo?> = _ubicacion

    private val _dispositivosConectados = MutableStateFlow<List<DispositivoVinculado>>(emptyList())
    val dispositivosConectados: StateFlow<List<DispositivoVinculado>> = _dispositivosConectados

    // Escucha en tiempo real la ubicación del niño desde el gestor de datos local
    fun iniciarRastreoHijo(hijoId: String) {
        ubicacionListener?.remove()

        ubicacionListener = LocalDataManager.listenChildDevice(hijoId) { dev ->
            if (dev != null) {
                _ubicacion.value = UbicacionHijo(latitud = dev.latitud, longitud = dev.longitud)
            } else {
                // Coordenadas representativas por defecto si aún no ha emitido GPS
                _ubicacion.value = UbicacionHijo(latitud = -12.046374, longitud = -77.042793)
            }
        }
    }

    // Escucha en tiempo real la lista de dispositivos vinculados al padre
    fun escucharDispositivosVinculados(padreId: String) {
        dispositivosListener?.remove()
        val targetPadreId = if (padreId.isEmpty()) LocalDataManager.getCurrentUserId() else padreId

        dispositivosListener = LocalDataManager.listenParentDevices(targetPadreId) { dispositivos ->
            val lista = if (dispositivos.isEmpty()) {
                listOf(DispositivoVinculado(id = "dispositivo_local_1", modelo = "Tablet U-Pad (Modo Local)"))
            } else {
                dispositivos.map { DispositivoVinculado(id = it.deviceId, modelo = it.modelo) }
            }
            _dispositivosConectados.value = lista
        }
    }

    override fun onCleared() {
        super.onCleared()
        ubicacionListener?.remove()
        dispositivosListener?.remove()
    }
}

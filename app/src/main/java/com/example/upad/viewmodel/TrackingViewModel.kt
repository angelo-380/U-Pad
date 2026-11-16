package com.example.upad.viewmodel

import androidx.lifecycle.ViewModel
import com.example.upad.data.ListenerRegistration
import com.example.upad.data.LocalChildDevice
import com.example.upad.data.LocalDataManager
import com.example.upad.dashboard.DispositivoVinculado
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/** Ubicación real del niño tal como la guarda el servidor (actualizadaEn: fecha ISO en UTC). */
data class UbicacionHijo(
    val latitud: Double = 0.0,
    val longitud: Double = 0.0,
    val actualizadaEn: String? = null
)

/**
 * Mapa del padre: los hijos y sus ubicaciones salen del servidor (GET /api/v1/devices cada 10 s, con el token).
 * Sin hijos o sin ubicación, el estado queda vacío: no se inventan coordenadas.
 */
class TrackingViewModel : ViewModel() {

    private var dispositivosListener: ListenerRegistration? = null
    private var hijoSeleccionado: String? = null
    private var ultimosHijos: List<LocalChildDevice> = emptyList()

    private val _ubicacion = MutableStateFlow<UbicacionHijo?>(null)
    val ubicacion: StateFlow<UbicacionHijo?> = _ubicacion

    private val _dispositivosConectados = MutableStateFlow<List<DispositivoVinculado>>(emptyList())
    val dispositivosConectados: StateFlow<List<DispositivoVinculado>> = _dispositivosConectados

    fun iniciarRastreoHijo(hijoId: String) {
        hijoSeleccionado = hijoId
        actualizarUbicacion()
    }

    private fun actualizarUbicacion() {
        val hijo = ultimosHijos.find { it.deviceId == hijoSeleccionado }
        _ubicacion.value = if (hijo != null && hijo.tieneUbicacion) {
            UbicacionHijo(latitud = hijo.latitud, longitud = hijo.longitud, actualizadaEn = hijo.ubicacionActualizadaEn)
        } else {
            null
        }
    }

    fun escucharDispositivosVinculados(padreId: String) {
        dispositivosListener?.remove()
        val targetPadreId = padreId.ifEmpty { LocalDataManager.getCurrentUserId() }

        dispositivosListener = LocalDataManager.listenParentDevices(targetPadreId) { hijos ->
            ultimosHijos = hijos
            _dispositivosConectados.value = hijos.map { DispositivoVinculado(id = it.deviceId, modelo = it.nombre ?: it.modelo) }
            actualizarUbicacion()
        }
    }

    override fun onCleared() {
        super.onCleared()
        dispositivosListener?.remove()
    }
}

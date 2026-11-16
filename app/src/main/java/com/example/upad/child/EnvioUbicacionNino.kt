package com.example.upad.child

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import com.example.upad.data.LocalDataManager
import com.example.upad.viewmodel.RoutineViewModel
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority

/**
 * Ubicación del niño en tiempo real (punto 4): mientras la app del niño esté abierta y vinculada, en CUALQUIER pantalla
 * (lista, actividad, valoración…), se envía la ubicación cada ~10 s al servidor, que la muestra en la web y en el
 * teléfono del padre. Ya no depende del plan premium. Se pide el permiso una vez al vincular.
 */
@Composable
fun EnvioUbicacionNino(activo: Boolean, routineViewModel: RoutineViewModel) {
    val context = LocalContext.current
    val deviceId = remember { LocalDataManager.idEsteDispositivo() }
    var tienePermiso by remember {
        mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED)
    }
    var permisoPedido by rememberSaveable { mutableStateOf(false) }

    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { aceptado ->
        tienePermiso = aceptado
    }

    LaunchedEffect(activo) {
        if (activo && !tienePermiso && !permisoPedido) {
            permisoPedido = true
            launcher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
        }
    }

    DisposableEffect(activo, tienePermiso, deviceId) {
        var callback: LocationCallback? = null
        val client = LocationServices.getFusedLocationProviderClient(context)
        if (activo && tienePermiso && deviceId.isNotBlank()) {
            try {
                val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10_000L)
                    .setMinUpdateIntervalMillis(5_000L)
                    .build()
                callback = object : LocationCallback() {
                    override fun onLocationResult(result: LocationResult) {
                        result.lastLocation?.let { routineViewModel.updateLocation(deviceId, it.latitude, it.longitude) }
                    }
                }
                client.requestLocationUpdates(request, callback, android.os.Looper.getMainLooper())
            } catch (e: SecurityException) {
                callback = null
            }
        }
        onDispose {
            callback?.let { client.removeLocationUpdates(it) }
        }
    }
}

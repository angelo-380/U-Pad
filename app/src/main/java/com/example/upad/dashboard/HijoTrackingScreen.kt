package com.example.upad.dashboard

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.request.ImageRequest
import com.example.upad.components.UPADBackgroundWrapper // 🛠️ Importamos el contenedor unificado
import com.example.upad.dashboard.components.UpadTopAppBar
import com.example.upad.viewmodel.RoutineViewModel // 🛠️ Importamos el ViewModel de estado Premium/Tema
import com.example.upad.viewmodel.TrackingViewModel
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.Priority
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.BoundingBox
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.CopyrightOverlay
import org.osmdroid.views.overlay.Marker

/** Punto redondo de color con borde blanco para los marcadores del mapa (sin imágenes externas). */
private fun puntoMarcador(context: Context, color: Int): android.graphics.drawable.Drawable {
    val tamano = (28 * context.resources.displayMetrics.density).toInt()
    return android.graphics.drawable.GradientDrawable().apply {
        shape = android.graphics.drawable.GradientDrawable.OVAL
        setColor(color)
        setStroke((4 * context.resources.displayMetrics.density).toInt(), android.graphics.Color.WHITE)
        setSize(tamano, tamano)
    }
}

@Composable
fun HijoTrackingScreen(
    routineViewModel: RoutineViewModel, // 🛡️ AGREGADO DE FORMA SEGURA COMO PRIMER PARÁMETRO
    hijoId: String,
    onNavigateBack: () -> Unit,
    onNavigateToHelp: () -> Unit = {},
    onNavigateToProfile: () -> Unit = {},
    trackingViewModel: TrackingViewModel = viewModel()
) {
    // 📨 1. RECOLECCIÓN DE ESTADOS GLOBALES (Cabecera del componente)
    val isPremiumUser by routineViewModel.isUserPremium.collectAsState(initial = false)
    val isDarkMode by routineViewModel.isDarkMode.collectAsState()

    // --- NUEVOS ESTADOS Y CONFIGURACIÓN REQUERIDA ---
    val context = LocalContext.current
    val sharedPreferences = remember { context.getSharedPreferences("UPAD_PREFS", Context.MODE_PRIVATE) }
    var imageUri by remember { mutableStateOf<Uri?>(null) }

    LaunchedEffect(Unit) {
        val saved = sharedPreferences.getString("PROFILE_IMAGE_URI", null)
        imageUri = when {
            saved != null -> Uri.parse(saved)
            else -> null
        }
    }

    val fuentePremium = FontFamily.SansSerif
    val colorFondoSolido = if (isPremiumUser) {
        if (isDarkMode) Color(0xFF0F0C29) else Color(0xFFFBE9E7)
    } else {
        if (isDarkMode) Color(0xFF121212) else Color.White
    }

    // 🎨 PALETA DE COLORES ADAPTATIVA EN BASE AL ESTADO PREMIUM Y MODO VISUAL
    val colorAcabadoPrincipal = if (isPremiumUser) Color(0xFFC5A059) else MaterialTheme.colorScheme.primary
    val colorTextoPrincipal = if (isDarkMode) Color.White else Color(0xFF111111)
    val colorTextoSecundario = if (isDarkMode) Color(0xFFB0B0B0) else Color(0xFF555555)

    // Configuración para tarjetas flotantes y TopBar: Translúcido en Premium o sólido en Básico
    val colorSuperficieFlotante = if (isPremiumUser) {
        if (isDarkMode) Color.Black.copy(alpha = 0.65f) else Color.White.copy(alpha = 0.75f)
    } else {
        if (isDarkMode) Color(0xFF1E1E1E) else Color.White
    }

    val idPadre = remember { com.example.upad.data.LocalDataManager.getCurrentUserId() }

    val dispositivosConectados by trackingViewModel.dispositivosConectados.collectAsState()
    var dispositivoSeleccionado by remember { mutableStateOf<DispositivoVinculado?>(null) }

    var miUbicacionReal by remember { mutableStateOf<GeoPoint?>(null) }
    val datosUbicacionNino by trackingViewModel.ubicacion.collectAsState()

    var tienePermisoUbicacion by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        )
    }

    // Mapa de OpenStreetMap (sin claves). La política de uso de OSM exige identificar la app (userAgent);
    // la caché de teselas va en la carpeta privada de la app (no pide permisos de almacenamiento).
    val mapView = remember {
        Configuration.getInstance().apply {
            // OSM bloquea los identificadores de ejemplo como «com.example.*»: se usa uno propio de la app
            userAgentValue = "UPad-Android/1.0 (proyecto academico U-Pad)"
            osmdroidBasePath = java.io.File(context.cacheDir, "osmdroid")
            osmdroidTileCache = java.io.File(context.cacheDir, "osmdroid/tiles")
        }
        MapView(context).apply {
            setTileSource(TileSourceFactory.MAPNIK)
            setMultiTouchControls(true)
            minZoomLevel = 3.0
            controller.setZoom(3.0)
            overlays.add(CopyrightOverlay(context))
        }
    }
    val marcadorPadre = remember {
        Marker(mapView).apply {
            title = "Tu ubicación"
            icon = puntoMarcador(context, android.graphics.Color.parseColor("#007AFF"))
            setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
        }
    }
    val marcadorHijo = remember {
        Marker(mapView).apply {
            icon = puntoMarcador(context, android.graphics.Color.parseColor("#4CAF50"))
            setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
        }
    }

    // Ciclo de vida del mapa (osmdroid pausa la descarga de teselas fuera de pantalla)
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observador = LifecycleEventObserver { _, evento ->
            when (evento) {
                Lifecycle.Event.ON_RESUME -> mapView.onResume()
                Lifecycle.Event.ON_PAUSE -> mapView.onPause()
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observador)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observador)
            mapView.onDetach()
        }
    }

    val launcherPermisos = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { aceptado ->
        tienePermisoUbicacion = aceptado
    }

    LaunchedEffect(Unit) {
        if (!tienePermisoUbicacion) {
            launcherPermisos.launch(Manifest.permission.ACCESS_FINE_LOCATION)
        }
    }

    // 📡 ESCUCHA DE UBICACIÓN DEL PADRE EN TIEMPO REAL (se detiene al salir de la pantalla)
    DisposableEffect(tienePermisoUbicacion) {
        val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
        val locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                val location = locationResult.lastLocation ?: return
                miUbicacionReal = GeoPoint(location.latitude, location.longitude)
            }
        }
        if (tienePermisoUbicacion) {
            try {
                val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5000L).build()
                fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, android.os.Looper.getMainLooper())
            } catch (e: SecurityException) {
                e.printStackTrace()
            }
        }
        onDispose { fusedLocationClient.removeLocationUpdates(locationCallback) }
    }

    // 📡 Lista de dispositivos vinculados en tiempo real
    LaunchedEffect(idPadre) {
        trackingViewModel.escucharDispositivosVinculados(idPadre)
    }

    LaunchedEffect(dispositivosConectados) {
        if (dispositivosConectados.isNotEmpty() && dispositivoSeleccionado == null) {
            val preferido = dispositivosConectados.find { it.id == hijoId }
            dispositivoSeleccionado = preferido ?: dispositivosConectados.first()
        }
    }

    LaunchedEffect(dispositivoSeleccionado) {
        dispositivoSeleccionado?.let {
            trackingViewModel.iniciarRastreoHijo(it.id)
        }
    }

    // 🎯 MARCADORES Y ENCUADRE: el hijo (y el padre, si se conoce su posición)
    LaunchedEffect(datosUbicacionNino, miUbicacionReal, dispositivoSeleccionado) {
        val infoNino = datosUbicacionNino
        val posPadre = miUbicacionReal
        val posHijo = infoNino?.takeIf { it.latitud != 0.0 || it.longitud != 0.0 }?.let { GeoPoint(it.latitud, it.longitud) }

        mapView.overlays.remove(marcadorPadre)
        mapView.overlays.remove(marcadorHijo)
        posPadre?.let {
            marcadorPadre.position = it
            mapView.overlays.add(marcadorPadre)
        }
        posHijo?.let {
            marcadorHijo.position = it
            marcadorHijo.title = dispositivoSeleccionado?.modelo ?: "Hijo"
            mapView.overlays.add(marcadorHijo)
        }

        when {
            // Padre e hijo casi en el mismo sitio: un recuadro de tamaño cero haría un zoom extremo
            posHijo != null && posPadre != null && posHijo.distanceToAsDouble(posPadre) < 50.0 ->
                mapView.controller.animateTo(posHijo, 17.0, 1000L)
            posHijo != null && posPadre != null -> mapView.post {
                mapView.zoomToBoundingBox(BoundingBox.fromGeoPoints(listOf(posHijo, posPadre)), true, 150)
            }
            posHijo != null -> mapView.controller.animateTo(posHijo, 16.0, 1000L)
            posPadre != null -> mapView.controller.animateTo(posPadre, 15.0, 1000L)
        }
        mapView.invalidate()
    }

    // 🚀 2. IMPLEMENTACIÓN DEL CONTENEDOR BASE
    UPADBackgroundWrapper(isPremium = isPremiumUser, isDarkMode = isDarkMode) {
        Scaffold(
            containerColor = Color.Transparent, // Fondo transparente para que funcione la estética Premium/Fondo unificado
            topBar = {
                UpadTopAppBar(
                    title = "Ubicar a mi Hijo",
                    imageUri = imageUri,
                    colorFondo = colorFondoSolido,
                    colorIconos = colorAcabadoPrincipal,
                    fuentePremium = fuentePremium,
                    showBackButton = true,
                    onBackPressed = onNavigateBack,
                    onNavigateToProfile = onNavigateToProfile,
                    onNavigateToHelp = onNavigateToHelp
                )
            }
        ) { innerPadding ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                // Mapa de OpenStreetMap a pantalla completa (© OpenStreetMap contributors, abajo a la izquierda)
                AndroidView(factory = { mapView }, modifier = Modifier.fillMaxSize())

                // Estado real: sin hijos, sin ubicación todavía, u hora de la última ubicación recibida
                val textoEstado = when {
                    dispositivosConectados.isEmpty() ->
                        "Aún no tienes hijos vinculados. Vincula el teléfono de tu hijo desde «Conexión»."
                    datosUbicacionNino == null ->
                        "${dispositivoSeleccionado?.modelo ?: "Tu hijo"} todavía no ha enviado su ubicación. Abre U-Pad en su teléfono con el GPS activado."
                    else -> datosUbicacionNino?.actualizadaEn?.let { iso ->
                        val ms = try {
                            java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
                                .apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }
                                .parse(iso)?.time
                        } catch (e: Exception) {
                            null
                        }
                        ms?.let {
                            val minutos = ((System.currentTimeMillis() - it) / 60000L).coerceAtLeast(0L)
                            if (minutos < 1) "Ubicación actualizada hace menos de un minuto."
                            else "Última ubicación recibida hace $minutos min."
                        }
                    }
                }
                textoEstado?.let { texto ->
                    Card(
                        shape = RoundedCornerShape(20.dp),
                        colors = CardDefaults.cardColors(containerColor = colorSuperficieFlotante),
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .padding(16.dp)
                            .fillMaxWidth()
                    ) {
                        Text(
                            text = texto,
                            color = colorTextoPrincipal,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(16.dp)
                        )
                    }
                }

                // Carrusel horizontal superior flotante de dispositivos adaptado con Glassmorphism
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 12.dp)
                ) {
                    LazyRow(
                        modifier = Modifier.fillMaxWidth(),
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(dispositivosConectados) { dispositivo ->
                            val esElSeleccionado = dispositivo.id == dispositivoSeleccionado?.id

                            Card(
                                shape = RoundedCornerShape(24.dp),
                                colors = CardDefaults.cardColors(
                                    containerColor = if (esElSeleccionado) colorAcabadoPrincipal else colorSuperficieFlotante
                                ),
                                border = if (isPremiumUser && !esElSeleccionado) androidx.compose.foundation.BorderStroke(1.dp, colorAcabadoPrincipal.copy(alpha = 0.25f)) else null,
                                elevation = CardDefaults.cardElevation(defaultElevation = if (isPremiumUser) 0.dp else 6.dp),
                                modifier = Modifier.clickable { dispositivoSeleccionado = dispositivo }
                            ) {
                                Row(
                                    modifier = Modifier.padding(horizontal = 18.dp, vertical = 10.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Text(
                                        text = if (esElSeleccionado) "🎯" else "📱",
                                        fontSize = 16.sp
                                    )
                                    Text(
                                        text = dispositivo.modelo,
                                        color = if (esElSeleccionado) Color.White else colorTextoPrincipal,
                                        fontWeight = FontWeight.ExtraBold,
                                        fontSize = 14.sp
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
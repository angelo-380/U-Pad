package com.example.upad.dashboard

import android.content.Context
import android.net.Uri
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.NightsStay
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.WbTwilight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.res.stringResource
import com.example.upad.R
import coil.request.ImageRequest
import com.example.upad.components.UPADBackgroundWrapper
import com.example.upad.dashboard.components.UpadTopAppBar
import com.example.upad.viewmodel.RoutineViewModel
import java.util.Calendar

/**
 * Desempeño del padre (punto 8): lo que sus hijos completaron de verdad en su teléfono, según el servidor
 * (GET /api/v1/cumplimiento, los mismos datos que la web). Por día, por turno y por hijo; estado vacío si no hay registros.
 * Se actualiza al abrir y cada 30 s. Ya no usa la memoria del teléfono del padre ni un «análisis inteligente».
 */
@Composable
fun AnalyticsScreen(
    routineViewModel: RoutineViewModel,
    onNavigateBack: () -> Unit,
    onNavigateToPremium: () -> Unit,
    onNavigateToHelp: () -> Unit = {},
    onNavigateToProfile: () -> Unit = {}
) {
    val isPremiumUser by routineViewModel.isUserPremium.collectAsState(initial = false)
    val isDarkMode by routineViewModel.isDarkMode.collectAsState()

    val context = LocalContext.current
    val sharedPreferences = remember { context.getSharedPreferences("UPAD_PREFS", Context.MODE_PRIVATE) }
    var imageUri by remember { mutableStateOf<Uri?>(null) }
    LaunchedEffect(Unit) {
        imageUri = sharedPreferences.getString("PROFILE_IMAGE_URI", null)?.let { Uri.parse(it) }
    }

    val fuentePremium = FontFamily.SansSerif
    val colorFondoSolido = if (isPremiumUser) {
        if (isDarkMode) Color(0xFF0F0C29) else Color(0xFFFBE9E7)
    } else {
        if (isDarkMode) Color(0xFF121212) else Color.White
    }
    val colorAcabadoPrincipal = if (isPremiumUser) Color(0xFFC5A059) else MaterialTheme.colorScheme.primary
    val colorTextoPrincipal = if (isDarkMode) Color.White else Color(0xFF111111)
    val colorTextoSecundario = if (isDarkMode) Color(0xFFB0B0B0) else Color(0xFF555555)
    val colorSuperficieTarjetas = if (isPremiumUser) {
        if (isDarkMode) Color.White.copy(alpha = 0.08f) else Color.White.copy(alpha = 0.65f)
    } else {
        if (isDarkMode) Color(0xFF1E1E1E) else Color.White
    }
    val colorTurnoManana = Color(0xFFFFB74D)
    val colorTurnoTarde = Color(0xFF81C784)
    val colorTurnoNoche = Color(0xFF9575CD)

    var resumen by remember { mutableStateOf<com.example.upad.data.ResumenCumplimiento?>(null) }
    var cargando by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf(false) }
    var recarga by remember { mutableIntStateOf(0) }

    LaunchedEffect(recarga) {
        while (true) {
            val datos = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                com.example.upad.data.LocalDataManager.obtenerCumplimiento(7)
            }
            if (datos != null) {
                resumen = datos
                error = false
            } else if (resumen == null) {
                error = true
            }
            cargando = false
            kotlinx.coroutines.delay(30_000L)
        }
    }

    val formatoDia = remember { java.text.SimpleDateFormat("EEE d", java.util.Locale.getDefault()) }
    val parseoDia = remember { java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US) }

    UPADBackgroundWrapper(isPremium = isPremiumUser, isDarkMode = isDarkMode) {
        Scaffold(
            containerColor = Color.Transparent,
            topBar = {
                UpadTopAppBar(
                    title = stringResource(id = R.string.weekly_report),
                    imageUri = imageUri,
                    colorFondo = colorFondoSolido,
                    colorIconos = colorTextoPrincipal,
                    fuentePremium = fuentePremium,
                    showBackButton = true,
                    onBackPressed = onNavigateBack,
                    onNavigateToProfile = onNavigateToProfile,
                    onNavigateToHelp = onNavigateToHelp
                )
            }
        ) { paddingValues ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .padding(16.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                val datos = resumen
                when {
                    cargando && datos == null -> Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = colorAcabadoPrincipal)
                    }
                    datos == null -> Surface(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(20.dp),
                        color = colorSuperficieTarjetas
                    ) {
                        Column(Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(stringResource(id = R.string.perf_error), color = colorTextoPrincipal, textAlign = TextAlign.Center)
                            Spacer(Modifier.height(12.dp))
                            Button(onClick = { cargando = true; recarga++ }) { Text(stringResource(id = R.string.perf_retry)) }
                        }
                    }
                    else -> {
                        // --- RESUMEN DE LOS 7 DÍAS ---
                        Surface(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(24.dp),
                            color = colorAcabadoPrincipal
                        ) {
                            Row(modifier = Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(stringResource(id = R.string.perf_title), color = Color.White.copy(alpha = 0.85f), fontSize = 13.sp, fontWeight = FontWeight.Medium)
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(
                                        text = datos.total.porcentaje?.let { "$it%" } ?: stringResource(id = R.string.no_activity),
                                        color = Color.White,
                                        fontSize = 28.sp,
                                        fontWeight = FontWeight.Black
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = stringResource(id = R.string.perf_total, datos.total.completadas, datos.total.esperadas),
                                        color = Color.White.copy(alpha = 0.9f),
                                        fontSize = 12.sp
                                    )
                                }
                                Box(
                                    modifier = Modifier.size(50.dp).background(Color.White.copy(alpha = 0.2f), CircleShape),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Default.Star, contentDescription = null, tint = Color.White, modifier = Modifier.size(26.dp))
                                }
                            }
                        }

                        if (!datos.hayRegistros) {
                            Surface(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), color = colorSuperficieTarjetas) {
                                Text(
                                    text = stringResource(id = R.string.perf_empty),
                                    color = colorTextoSecundario,
                                    fontSize = 13.sp,
                                    textAlign = TextAlign.Center,
                                    modifier = Modifier.padding(20.dp).fillMaxWidth()
                                )
                            }
                        }

                        // --- POR DÍA ---
                        SeccionCumplimiento(stringResource(id = R.string.perf_by_day), colorTextoSecundario, colorSuperficieTarjetas) {
                            datos.dias.forEach { d ->
                                val etiqueta = try { parseoDia.parse(d.etiqueta)?.let { formatoDia.format(it) } ?: d.etiqueta } catch (e: Exception) { d.etiqueta }
                                FilaBarra(etiqueta, d, colorAcabadoPrincipal, colorTextoPrincipal)
                            }
                        }

                        // --- POR TURNO ---
                        SeccionCumplimiento(stringResource(id = R.string.weekly_turn_compliance), colorTextoSecundario, colorSuperficieTarjetas) {
                            datos.porTurno.forEach { t ->
                                val (color, icono) = when (t.etiqueta) {
                                    "MANANA" -> colorTurnoManana to Icons.Default.LightMode
                                    "TARDE" -> colorTurnoTarde to Icons.Default.WbTwilight
                                    else -> colorTurnoNoche to Icons.Default.NightsStay
                                }
                                BarChartRow(progress = t.porcentaje?.let { it / 100f } ?: -1f, color = color, icon = icono, textColor = colorTextoPrincipal)
                            }
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceAround) {
                                LegendItem(text = stringResource(id = R.string.morning), color = colorTurnoManana, icon = Icons.Default.LightMode, textColor = colorTextoPrincipal)
                                LegendItem(text = stringResource(id = R.string.afternoon), color = colorTurnoTarde, icon = Icons.Default.WbTwilight, textColor = colorTextoPrincipal)
                                LegendItem(text = stringResource(id = R.string.evening), color = colorTurnoNoche, icon = Icons.Default.NightsStay, textColor = colorTextoPrincipal)
                            }
                        }

                        // --- POR HIJO ---
                        if (datos.porHijo.isNotEmpty()) {
                            SeccionCumplimiento(stringResource(id = R.string.perf_by_child), colorTextoSecundario, colorSuperficieTarjetas) {
                                datos.porHijo.forEach { h -> FilaBarra(h.etiqueta, h, colorAcabadoPrincipal, colorTextoPrincipal) }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SeccionCumplimiento(titulo: String, colorTitulo: Color, colorFondo: Color, contenido: @Composable ColumnScope.() -> Unit) {
    Text(text = titulo.uppercase(), fontSize = 11.sp, fontWeight = FontWeight.Black, color = colorTitulo, letterSpacing = 1.sp)
    Surface(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), color = colorFondo) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp), content = contenido)
    }
}

@Composable
private fun FilaBarra(etiqueta: String, fila: com.example.upad.data.FilaCumplimiento, color: Color, colorTexto: Color) {
    Column {
        Row(modifier = Modifier.fillMaxWidth()) {
            Text(etiqueta, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = colorTexto, modifier = Modifier.weight(1f))
            Text("${fila.completadas}/${fila.esperadas}", fontSize = 11.sp, color = colorTexto.copy(alpha = 0.6f))
        }
        Spacer(Modifier.height(4.dp))
        BarChartRow(progress = fila.porcentaje?.let { it / 100f } ?: -1f, color = color, icon = Icons.Default.Star, textColor = colorTexto)
    }
}

@Composable
fun BarChartRow(progress: Float, color: Color, icon: ImageVector, textColor: Color) {
    val tieneTareas = progress >= 0f
    val barraProgresoAnimada by animateFloatAsState(
        targetValue = if (tieneTareas) progress else 0f,
        animationSpec = tween(durationMillis = 800),
        label = "BarraAnimada"
    )

    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = if (tieneTareas) color else textColor.copy(alpha = 0.2f),
            modifier = Modifier
                .padding(end = 8.dp)
                .size(16.dp)
        )

        Box(
            modifier = Modifier
                .weight(1f)
                .height(12.dp)
                .background(textColor.copy(alpha = 0.08f), CircleShape)
        ) {
            if (tieneTareas && barraProgresoAnimada > 0f) {
                Box(
                    modifier = Modifier
                        .fillMaxHeight()
                        .fillMaxWidth(fraction = barraProgresoAnimada)
                        .background(color, CircleShape)
                )
            }
        }

        Spacer(modifier = Modifier.width(10.dp))

        Text(
            text = if (tieneTareas) "${(progress * 100).toInt()}%" else "--",
            fontSize = 11.sp,
            fontWeight = FontWeight.Black,
            color = if (tieneTareas) textColor else textColor.copy(alpha = 0.3f),
            modifier = Modifier.width(32.dp),
            textAlign = TextAlign.End
        )
    }
}

@Composable
fun LegendItem(text: String, color: Color, icon: ImageVector, textColor: Color) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(imageVector = icon, contentDescription = null, tint = color, modifier = Modifier.size(16.dp))
        Spacer(modifier = Modifier.width(6.dp))
        Text(text = text, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = textColor.copy(alpha = 0.8f))
    }
}
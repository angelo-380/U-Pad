package com.example.upad.child

import android.provider.Settings
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.upad.viewmodel.RoutineViewModel
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.SetOptions
import java.util.Calendar

@Composable
fun ChildStartScreen(
    routineViewModel: RoutineViewModel,
    onNavigateToTask: (actividadNombre: String, turno: String) -> Unit,
    onNavigateToCompleted: () -> Unit,
    onPadreIdObtenido: (String) -> Unit = {}  // FIX: nuevo parámetro para propagar el padreId real
) {
    val colorFondoNiño = Color(0xFFF4F9FC)
    val context = LocalContext.current

    val deviceId = remember { Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID) }

    var codigoNiño by remember { mutableStateOf("------") }
    var estaVinculado by remember { mutableStateOf(false) }
    var cargando by remember { mutableStateOf(true) }
    var padreIdAsociado by remember { mutableStateOf("") }
    var esPremiumPorPadre by remember { mutableStateOf(false) }
    var verTareasModoBasico by remember { mutableStateOf(false) }
    var codigoGeneradoEnSesion by remember { mutableStateOf(false) }

    val firestore = remember { FirebaseFirestore.getInstance() }

    DisposableEffect(deviceId) {
        var devicesListener: ListenerRegistration? = null
        var premiumListener: ListenerRegistration? = null
        var pairingCodeListener: ListenerRegistration? = null

        devicesListener = firestore.collection("dispositivos_niños").document(deviceId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    cargando = false
                    return@addSnapshotListener
                }

                val padreId = snapshot?.getString("padreId") ?: ""

                if (snapshot == null || !snapshot.exists() || padreId.isEmpty()) {
                    estaVinculado = false
                    padreIdAsociado = ""
                    premiumListener?.remove()

                    if (!codigoGeneradoEnSesion) {
                        codigoGeneradoEnSesion = true
                        val nuevoCodigo = (100000..999999).random().toString()
                        codigoNiño = nuevoCodigo

                        firestore.collection("codigos_vinculacion").document(nuevoCodigo)
                            .set(mapOf(
                                "deviceId" to deviceId,
                                "estado" to "esperando",
                                "padreId" to ""
                            ))

                        pairingCodeListener?.remove()
                        pairingCodeListener = firestore.collection("codigos_vinculacion")
                            .document(nuevoCodigo)
                            .addSnapshotListener { codeSnapshot, codeError ->
                                if (codeError != null) return@addSnapshotListener
                                if (codeSnapshot != null && codeSnapshot.exists()) {
                                    val estado = codeSnapshot.getString("estado")
                                    val pId = codeSnapshot.getString("padreId")
                                    if (estado == "enlazado" && !pId.isNullOrEmpty()) {
                                        firestore.collection("dispositivos_niños").document(deviceId)
                                            .set(mapOf("padreId" to pId), SetOptions.merge())
                                        firestore.collection("codigos_vinculacion")
                                            .document(nuevoCodigo).delete()
                                    }
                                }
                            }
                    } else if (codigoNiño == "------") {
                        codigoGeneradoEnSesion = false
                    }

                    cargando = false
                    return@addSnapshotListener
                }

                // Padre vinculado
                estaVinculado = true

                if (padreIdAsociado != padreId) {
                    padreIdAsociado = padreId
                    onPadreIdObtenido(padreId)  // FIX: propagar el padreId real al NavHost
                    routineViewModel.cargarRutinasDesdeFirebase(padreId)

                    premiumListener?.remove()
                    premiumListener = firestore.collection("users").document(padreId)
                        .addSnapshotListener { userSnapshot, userError ->
                            if (userError != null) {
                                cargando = false
                                return@addSnapshotListener
                            }
                            if (userSnapshot != null && userSnapshot.exists()) {
                                esPremiumPorPadre = userSnapshot.getBoolean("isPremium") ?: false
                            }
                            cargando = false
                        }
                }

                pairingCodeListener?.remove()
                pairingCodeListener = null
            }

        onDispose {
            devicesListener?.remove()
            premiumListener?.remove()
            pairingCodeListener?.remove()
        }
    }

    val tasksManana by routineViewModel.tasksManana.collectAsState()
    val tasksTarde by routineViewModel.tasksTarde.collectAsState()
    val tasksNoche by routineViewModel.tasksNoche.collectAsState()

    val calendar = Calendar.getInstance()
    val numeroDia = calendar.get(Calendar.DAY_OF_WEEK)
    val horaActual = calendar.get(Calendar.HOUR_OF_DAY)

    val diaActualTexto = when (numeroDia) {
        Calendar.MONDAY -> "LUN"
        Calendar.TUESDAY -> "MAR"
        Calendar.WEDNESDAY -> "MIÉ"
        Calendar.THURSDAY -> "JUE"
        Calendar.FRIDAY -> "VIE"
        Calendar.SATURDAY -> "SÁB"
        Calendar.SUNDAY -> "DOM"
        else -> "LUN"
    }

    val listaVariacionesDia = when (numeroDia) {
        Calendar.MONDAY -> listOf("LUN", "LUNES")
        Calendar.TUESDAY -> listOf("MAR", "MARTES")
        Calendar.WEDNESDAY -> listOf("MIÉ", "MIERCOLES", "MIÉRCOLES")
        Calendar.THURSDAY -> listOf("JUE", "JUEVES")
        Calendar.FRIDAY -> listOf("VIE", "VIERNES")
        Calendar.SATURDAY -> listOf("SÁB", "SABADO", "SÁBADO")
        Calendar.SUNDAY -> listOf("DOM", "DOMINGO")
        else -> emptyList()
    }

    val filtradasManana = remember(tasksManana, listaVariacionesDia) {
        tasksManana.filter { item ->
            try {
                val listaDias = item.javaClass.getMethod("getDias").invoke(item) as? List<*> ?: emptyList<String>()
                listaDias.isEmpty() || listaDias.any { d -> listaVariacionesDia.contains(d.toString().uppercase().trim()) }
            } catch (e: Exception) { true }
        }
    }

    val filtradasTarde = remember(tasksTarde, listaVariacionesDia) {
        tasksTarde.filter { item ->
            try {
                val listaDias = item.javaClass.getMethod("getDias").invoke(item) as? List<*> ?: emptyList<String>()
                listaDias.isEmpty() || listaDias.any { d -> listaVariacionesDia.contains(d.toString().uppercase().trim()) }
            } catch (e: Exception) { true }
        }
    }

    val filtradasNoche = remember(tasksNoche, listaVariacionesDia) {
        tasksNoche.filter { item ->
            try {
                val listaDias = item.javaClass.getMethod("getDias").invoke(item) as? List<*> ?: emptyList<String>()
                listaDias.isEmpty() || listaDias.any { d -> listaVariacionesDia.contains(d.toString().uppercase().trim()) }
            } catch (e: Exception) { true }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                if (esPremiumPorPadre)
                    Brush.verticalGradient(listOf(Color(0xFFFFF9C4), Color(0xFFFBC02D).copy(alpha = 0.3f)))
                else
                    Brush.verticalGradient(listOf(colorFondoNiño, colorFondoNiño))
            ),
        contentAlignment = Alignment.Center
    ) {
        if (cargando) {
            CircularProgressIndicator(color = Color(0xFF0D47A1))
        } else {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(20.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.Top
            ) {
                if (!estaVinculado) {
                    Text(
                        text = "¡Hola! Dile a tus papás que escriban este código en su teléfono:",
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF1A1A1A),
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(top = 40.dp)
                    )
                    Spacer(modifier = Modifier.height(32.dp))
                    Card(
                        shape = RoundedCornerShape(24.dp),
                        colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(defaultElevation = 6.dp)
                    ) {
                        Text(
                            text = if (codigoNiño.length == 6) "${codigoNiño.take(3)} ${codigoNiño.drop(3)}" else codigoNiño,
                            fontSize = 54.sp,
                            fontWeight = FontWeight.Black,
                            color = Color(0xFF0D47A1),
                            modifier = Modifier.padding(horizontal = 40.dp, vertical = 20.dp),
                            letterSpacing = 4.sp
                        )
                    }
                    Spacer(modifier = Modifier.height(32.dp))
                    CircularProgressIndicator(color = Color(0xFF0D47A1), strokeWidth = 5.dp)
                } else {
                    if (esPremiumPorPadre || verTareasModoBasico) {
                        Text(
                            text = "¡MIS ACTIVIDADES DE HOY! 🏆",
                            fontSize = 26.sp,
                            fontWeight = FontWeight.Black,
                            color = Color(0xFF1A1A1A),
                            modifier = Modifier.padding(top = 16.dp, bottom = 12.dp)
                        )

                        val turnoMananaActivo = horaActual < 13
                        val turnoTardeActivo = horaActual in 13..17
                        val turnoNocheActivo = horaActual >= 18

                        var yaSeEncontroLaActivaGlobal = false

                        SeccionTurnoTitulo(titulo = "🌅 ACTIVIDADES DE LA MAÑANA", activo = turnoMananaActivo, horasTexto = "(12:00 AM - 1:00 PM)")
                        if (turnoMananaActivo) {
                            BloqueListaTareas(
                                tareas = filtradasManana,
                                turnoNombre = "MAÑANA",
                                diaActualTexto = diaActualTexto,
                                yaSeEncontroActiva = yaSeEncontroLaActivaGlobal,
                                onNavigateToTask = onNavigateToTask,
                                marcarActivaEncontrada = { yaSeEncontroLaActivaGlobal = true }
                            )
                        } else {
                            CardBloqueadoPorHorario(mensaje = "Disponible solo por la mañana.")
                        }

                        Spacer(modifier = Modifier.height(20.dp))

                        SeccionTurnoTitulo(titulo = "☀️ ACTIVIDADES DE LA TARDE", activo = turnoTardeActivo, horasTexto = "(1:00 PM - 6:00 PM)")
                        if (turnoTardeActivo) {
                            BloqueListaTareas(
                                tareas = filtradasTarde,
                                turnoNombre = "TARDE",
                                diaActualTexto = diaActualTexto,
                                yaSeEncontroActiva = yaSeEncontroLaActivaGlobal,
                                onNavigateToTask = onNavigateToTask,
                                marcarActivaEncontrada = { yaSeEncontroLaActivaGlobal = true }
                            )
                        } else {
                            CardBloqueadoPorHorario(mensaje = "Disponible a partir de la 1:00 PM hasta las 6:00 PM.")
                        }

                        Spacer(modifier = Modifier.height(20.dp))

                        SeccionTurnoTitulo(titulo = "🌙 ACTIVIDADES DE LA NOCHE", activo = turnoNocheActivo, horasTexto = "(6:00 PM - 12:00 AM)")
                        if (turnoNocheActivo) {
                            BloqueListaTareas(
                                tareas = filtradasNoche,
                                turnoNombre = "NOCHE",
                                diaActualTexto = diaActualTexto,
                                yaSeEncontroActiva = yaSeEncontroLaActivaGlobal,
                                onNavigateToTask = onNavigateToTask,
                                marcarActivaEncontrada = { yaSeEncontroLaActivaGlobal = true }
                            )
                        } else {
                            CardBloqueadoPorHorario(mensaje = "Disponible a partir de las 6:00 PM.")
                        }

                    } else {
                        Text(
                            text = "¡Todo listo para empezar tus actividades!",
                            fontSize = 26.sp,
                            fontWeight = FontWeight.Black,
                            color = Color(0xFF1A1A1A),
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(top = 60.dp)
                        )
                        Spacer(modifier = Modifier.height(48.dp))
                        Button(
                            onClick = { verTareasModoBasico = true },
                            modifier = Modifier
                                .fillMaxWidth(0.85f)
                                .height(85.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4CAF50)),
                            shape = RoundedCornerShape(24.dp)
                        ) {
                            Text("VER MIS TAREAS 🚀", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = Color.White)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SeccionTurnoTitulo(titulo: String, activo: Boolean, horasTexto: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column {
            Text(
                text = titulo,
                fontSize = 17.sp,
                fontWeight = FontWeight.Black,
                color = if (activo) Color(0xFF1A1A1A) else Color(0xFF90A4AE)
            )
            Text(text = horasTexto, fontSize = 11.sp, color = Color.Gray, fontWeight = FontWeight.Bold)
        }
        if (activo) {
            SuggestionChip(
                onClick = {},
                label = { Text("ACTIVO", fontWeight = FontWeight.Bold, fontSize = 11.sp) },
                colors = SuggestionChipDefaults.suggestionChipColors(
                    labelColor = Color(0xFF2E7D32),
                    containerColor = Color(0xFFE8F5E9)
                )
            )
        }
    }
}

@Composable
fun CardBloqueadoPorHorario(mensaje: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFECEFF1)),
        border = BorderStroke(1.dp, Color(0xFFCFD8DC))
    ) {
        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(imageVector = Icons.Default.Lock, contentDescription = null, tint = Color(0xFF78909C))
            Spacer(modifier = Modifier.width(12.dp))
            Text(text = mensaje, fontSize = 13.sp, color = Color(0xFF607D8B), fontWeight = FontWeight.Medium)
        }
    }
}

@Composable
fun BloqueListaTareas(
    tareas: List<Any>,
    turnoNombre: String,
    diaActualTexto: String,
    yaSeEncontroActiva: Boolean,
    onNavigateToTask: (String, String) -> Unit,
    marcarActivaEncontrada: () -> Unit
) {
    if (tareas.isEmpty()) {
        Text(
            "No hay actividades agregadas para este turno.",
            fontSize = 14.sp,
            color = Color.Gray,
            modifier = Modifier.padding(8.dp)
        )
    } else {
        var localActivaEncontrada = yaSeEncontroActiva
        Column(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
            tareas.forEachIndexed { index, task ->
                val clase = task.javaClass

                val nombreActividad = try {
                    clase.getMethod("getActividad").invoke(task).toString()
                } catch (e: Exception) { "" }

                var duracionText = try {
                    clase.getMethod("getDuration").invoke(task).toString()
                } catch (e: Exception) {
                    try { clase.getMethod("getDuracion").invoke(task).toString() } catch (ex: Exception) { "5" }
                }

                if (duracionText.trim() == "55" || duracionText.trim() == "0") {
                    duracionText = "5"
                }

                val imageUrlText = try {
                    clase.getMethod("getImageUrl").invoke(task).toString()
                } catch (e: Exception) { "" }

                val completada = try {
                    clase.getMethod("estaCompletadaHoy", String::class.java).invoke(task, diaActualTexto) as Boolean
                } catch (e: Exception) { false }

                val estaHabilitada = if (completada) {
                    false
                } else if (!localActivaEncontrada) {
                    localActivaEncontrada = true
                    marcarActivaEncontrada()
                    true
                } else {
                    false
                }

                if (nombreActividad.isNotEmpty()) {
                    ItemActividadContenedor(
                        nombre = nombreActividad,
                        duracion = duracionText,
                        imageUrl = imageUrlText,
                        turno = turnoNombre,
                        isCompletada = completada,
                        isHabilitada = estaHabilitada,
                        index = index,
                        onClick = {
                            if (estaHabilitada && !completada) {
                                onNavigateToTask(nombreActividad, turnoNombre)
                            }
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun ItemActividadContenedor(
    nombre: String,
    duracion: String,
    imageUrl: String,
    turno: String,
    isCompletada: Boolean,
    isHabilitada: Boolean,
    index: Int,
    onClick: () -> Unit
) {
    val colorBaseDinamico = when (index % 4) {
        0 -> Color(0xFFE3F2FD)
        1 -> Color(0xFFE8F5E9)
        2 -> Color(0xFFF3E5F5)
        else -> Color(0xFFFFF3E0)
    }

    val colorBordeDinamico = when (index % 4) {
        0 -> Color(0xFF1E88E5)
        1 -> Color(0xFF4CAF50)
        2 -> Color(0xFFAB47BC)
        else -> Color(0xFFFF9800)
    }

    val colorContenedor = when {
        isCompletada -> Color(0xFFECEFF1)
        !isHabilitada -> Color(0xFFF5F5F5)
        else -> colorBaseDinamico
    }

    val colorTexto = if (isCompletada || !isHabilitada) Color(0xFF78909C) else Color(0xFF1A1A1A)

    val colorBorde = when {
        isCompletada -> Color(0xFFCFD8DC)
        !isHabilitada -> Color(0xFFE0E0E0)
        else -> colorBordeDinamico
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = isHabilitada && !isCompletada) { onClick() },
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = colorContenedor),
        border = BorderStroke(2.5.dp, colorBorde),
        elevation = CardDefaults.cardElevation(defaultElevation = if (isHabilitada && !isCompletada) 4.dp else 0.dp)
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                Card(
                    modifier = Modifier.size(68.dp),
                    shape = RoundedCornerShape(18.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = BorderStroke(1.dp, Color(0xFFE0E0E0))
                ) {
                    Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                        if (imageUrl.isNotEmpty()) {
                            AsyncImage(
                                model = imageUrl,
                                contentDescription = nombre,
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(6.dp),
                                contentScale = ContentScale.Fit,
                                alpha = if (isHabilitada && !isCompletada) 1f else 0.35f
                            )
                        } else {
                            Text(
                                text = nombre.take(1).uppercase(),
                                fontSize = 26.sp,
                                fontWeight = FontWeight.Black,
                                color = Color.LightGray
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.width(16.dp))

                Column {
                    Text(
                        text = nombre.uppercase(),
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Black,
                        color = colorTexto
                    )
                    Text(
                        text = "⏱️ $duracion min | 📍 $turno",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (isHabilitada && !isCompletada) Color.DarkGray else Color(0xFF90A4AE)
                    )
                }
            }

            Box(
                modifier = Modifier
                    .size(38.dp)
                    .clip(CircleShape)
                    .background(
                        when {
                            isCompletada -> Color(0xFF81C784).copy(alpha = 0.2f)
                            !isHabilitada -> Color.Transparent
                            else -> colorBordeDinamico
                        }
                    ),
                contentAlignment = Alignment.Center
            ) {
                when {
                    isCompletada -> Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF388E3C))
                    !isHabilitada -> Icon(Icons.Default.Lock, contentDescription = null, tint = Color(0xFF90A4AE))
                    else -> Icon(Icons.Default.PlayArrow, contentDescription = null, tint = Color.White)
                }
            }
        }
    }
}
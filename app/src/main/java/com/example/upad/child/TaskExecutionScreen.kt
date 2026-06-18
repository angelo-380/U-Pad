package com.example.upad.child

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.example.upad.viewmodel.RoutineViewModel
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.delay
import java.util.Locale

@Composable
fun TaskExecutionScreen(
    viewModel: RoutineViewModel,
    activityName: String,
    turn: String,
    padreId: String,
    onFinishRoutine: (String) -> Unit
) {
    val colorFondoNiño = Color(0xFFE1F5FE)
    val colorVerdeExito = Color(0xFF4CAF50)
    val colorGrisBloqueado = Color(0xFFB0BEC5)
    val colorNaranjaPomodoro = Color(0xFFFF5722)

    val currentUserId = remember {
        padreId.ifEmpty {
            FirebaseAuth.getInstance().currentUser?.uid ?: "PADRE_TEST"
        }
    }

    // Recolectamos las tareas del turno actual desde el ViewModel
    val tasks by when (turn.uppercase()) {
        "MAÑANA" -> viewModel.tasksManana.collectAsState()
        "TARDE" -> viewModel.tasksTarde.collectAsState()
        else -> viewModel.tasksNoche.collectAsState()
    }

    val currentTask = remember(tasks, activityName) {
        tasks.firstOrNull { it.actividad.uppercase().trim() == activityName.uppercase().trim() }
    }

    var mostrandoCelebracionIdivual by remember { mutableStateOf(false) }

    // --- ⏱️ CONFIGURACIÓN DEL TEMPORIZADOR POMODORO (5 MINUTOS = 300 SEGUNDOS) ---
    val tiempoInicialSegundos = remember(currentTask) { 1 * 60 }
    var tiempoRestanteSegundos by remember { mutableStateOf(tiempoInicialSegundos) }
    var tiempoCumplido by remember { mutableStateOf(false) }

    // Corrutina que gestiona el paso de los segundos
    // Corrutina que gestiona el paso de los segundos (Estructura corregida para Compose)
    LaunchedEffect(currentTask, mostrandoCelebracionIdivual) {
        if (currentTask != null && !mostrandoCelebracionIdivual) {
            while (tiempoRestanteSegundos > 0) {
                delay(1000)
                tiempoRestanteSegundos -= 1
            }
            tiempoCumplido = true
        }
    }

    // Formateador visual para el reloj (MM:SS)
    val textoTemporizador = remember(tiempoRestanteSegundos) {
        val minutos = tiempoRestanteSegundos / 60
        val segundos = tiempoRestanteSegundos % 60
        String.format(Locale.getDefault(), "%02d:%02d", minutos, segundos)
    }

    // --- MANEJADOR DE TRANSICIÓN INTEGRADO ---
    if (mostrandoCelebracionIdivual) {
        LaunchedEffect(Unit) {
            delay(2500)
            mostrandoCelebracionIdivual = false
            onFinishRoutine(activityName)
        }
    }

    val diaActualTexto = remember {
        when (java.util.Calendar.getInstance().get(java.util.Calendar.DAY_OF_WEEK)) {
            java.util.Calendar.MONDAY -> "LUN"
            java.util.Calendar.TUESDAY -> "MAR"
            java.util.Calendar.WEDNESDAY -> "MIÉ"
            java.util.Calendar.THURSDAY -> "JUE"
            java.util.Calendar.FRIDAY -> "VIE"
            java.util.Calendar.SATURDAY -> "SÁB"
            java.util.Calendar.SUNDAY -> "DOM"
            else -> "LUN"
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(colorFondoNiño, Color.White))),
        contentAlignment = Alignment.Center
    ) {
        if (currentTask == null) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator(color = Color(0xFF0288D1), strokeWidth = 5.dp)
                Spacer(modifier = Modifier.height(16.dp))
                Text("Cargando tu actividad...", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFF01579B))
            }
        }
        else if (mostrandoCelebracionIdivual) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
                modifier = Modifier.fillMaxSize()
            ) {
                Text(text = "✨ ⭐ 🏆 ⭐ ✨", fontSize = 60.sp, textAlign = TextAlign.Center)
                Spacer(modifier = Modifier.height(24.dp))
                Text(text = "¡MISION CUMPLIDA!", fontSize = 36.sp, fontWeight = FontWeight.Black, color = colorVerdeExito, textAlign = TextAlign.Center)
                Spacer(modifier = Modifier.height(12.dp))
                Text(text = "¡Hiciste un gran trabajo concentrándote!", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Color(0xFF0288D1), textAlign = TextAlign.Center)
            }
        }
        else {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxSize().padding(24.dp)
            ) {
                // Cabecera indicadora
                Text(
                    text = "🎯 ENFOQUE ACTIVO",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Black,
                    color = Color(0xFF0288D1),
                    letterSpacing = 2.sp,
                    modifier = Modifier.padding(top = 8.dp)
                )

                // 🖼️ CONTENEDOR CENTRAL DEL PICTOGRAMA
                Card(
                    shape = RoundedCornerShape(36.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 10.dp),
                    border = BorderStroke(4.dp, if (tiempoCumplido) colorVerdeExito else colorNaranjaPomodoro),
                    modifier = Modifier.size(260.dp)
                ) {
                    Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                        if (currentTask.imageUrl.isNotEmpty()) {
                            AsyncImage(
                                model = currentTask.imageUrl,
                                contentDescription = currentTask.actividad,
                                modifier = Modifier.fillMaxSize().padding(24.dp),
                                contentScale = ContentScale.Fit
                            )
                        } else {
                            Text(
                                text = currentTask.actividad.take(1).uppercase(),
                                fontSize = 100.sp,
                                fontWeight = FontWeight.Black,
                                color = Color(0xFFCFD8DC)
                            )
                        }
                    }
                }

                // Nombre Gigante de la Actividad
                Text(
                    text = currentTask.actividad.uppercase(),
                    fontSize = 32.sp,
                    fontWeight = FontWeight.Black,
                    color = Color(0xFF01579B),
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 8.dp)
                )

                // ⏱️ SECCIÓN POMODORO MEJORADA VISUALMENTE
                Card(
                    shape = RoundedCornerShape(50.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = if (tiempoCumplido) Color(0xFFE8F5E9) else Color(0xFFFFE0B2)
                    ),
                    modifier = Modifier.padding(vertical = 4.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(horizontal = 24.dp, vertical = 12.dp)
                    ) {
                        Text(
                            text = if (tiempoCumplido) "⏰ ¡TIEMPO LISTO!: " else "⏳ TRABAJANDO: ",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Black,
                            color = if (tiempoCumplido) Color(0xFF2E7D32) else Color(0xFFE65100)
                        )
                        Text(
                            text = textoTemporizador,
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Black,
                            color = if (tiempoCumplido) Color(0xFF2E7D32) else colorNaranjaPomodoro
                        )
                    }
                }

                // 🚨 BOTÓN DE FINALIZACIÓN CONTROLADO
                Button(
                    onClick = {
                        if (tiempoCumplido) {
                            viewModel.completeTaskPorNombre(
                                userId = currentUserId,
                                turn = turn,
                                actividadTexto = currentTask.actividad,
                                diaActual = diaActualTexto
                            )
                            mostrandoCelebracionIdivual = true
                        }
                    },
                    // Deshabilitado por completo a nivel de interacción si no han pasado los 5 minutos
                    enabled = tiempoCumplido,
                    modifier = Modifier
                        .fillMaxWidth(0.9f)
                        .height(75.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = colorVerdeExito,
                        disabledContainerColor = colorGrisBloqueado.copy(alpha = 0.6f)
                    ),
                    shape = RoundedCornerShape(24.dp),
                    elevation = ButtonDefaults.buttonElevation(defaultElevation = if (tiempoCumplido) 6.dp else 0.dp)
                ) {
                    Text(
                        text = if (tiempoCumplido) "¡TERMINAR! 🎉" else "ESPERA QUE TERMINE EL RELOJ 🔒",
                        fontSize = if (tiempoCumplido) 24.sp else 16.sp,
                        fontWeight = FontWeight.Black,
                        color = if (tiempoCumplido) Color.White else Color(0xFF546E7A),
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}
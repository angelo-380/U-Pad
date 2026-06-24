package com.example.upad.dashboard

import android.content.Context
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DeviceUnknown
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.request.ImageRequest
import com.example.upad.components.UPADBackgroundWrapper
import com.example.upad.dashboard.components.UpadTopAppBar
import com.example.upad.viewmodel.RoutineViewModel
import com.google.firebase.auth.FirebaseAuth

// Estructura de datos temporal para simular alertas reales de Firebase
data class NotificationItem(
    val id: String = "",
    val title: String = "",
    val description: String = "",
    val time: String = "",
    val type: NotificationType = NotificationType.INFO
)

enum class NotificationType {
    SUCCESS, WARNING, INFO
}

@Composable
fun NotificationsScreen(
    routineViewModel: RoutineViewModel,
    onNavigateBack: () -> Unit,
    onNavigateToHelp: () -> Unit = {},
    onNavigateToProfile: () -> Unit = {}
) {
    val isPremiumUser by routineViewModel.isUserPremium.collectAsState(initial = false)
    val isDarkMode by routineViewModel.isDarkMode.collectAsState()

    // --- NUEVOS ESTADOS Y CONFIGURACIÓN REQUERIDA ---
    val context = LocalContext.current
    val currentUser = remember { FirebaseAuth.getInstance().currentUser }
    val sharedPreferences = remember { context.getSharedPreferences("UPAD_PREFS", Context.MODE_PRIVATE) }
    var imageUri by remember { mutableStateOf<Uri?>(null) }

    LaunchedEffect(Unit) {
        val saved = sharedPreferences.getString("PROFILE_IMAGE_URI", null)
        imageUri = when {
            saved != null -> Uri.parse(saved)
            currentUser?.photoUrl != null -> currentUser.photoUrl
            else -> null
        }
    }

    val fuentePremium = FontFamily.SansSerif
    val colorFondoSolido = if (isPremiumUser) {
        if (isDarkMode) Color(0xFF0F0C29) else Color(0xFFFBE9E7)
    } else {
        if (isDarkMode) Color(0xFF121212) else Color.White
    }

    val colorTextoPrincipal = if (isDarkMode) Color.White else Color(0xFF111111)
    val colorTextoSecundario = if (isDarkMode) Color(0xFFB0B0B0) else Color(0xFF555555)

    val colorSuperficieTarjetas = if (isPremiumUser) {
        if (isDarkMode) Color.White.copy(alpha = 0.06f) else Color.White.copy(alpha = 0.7f)
    } else {
        if (isDarkMode) Color(0xFF1E1E1E) else Color.White
    }

    // Lista de notificaciones simulada basada en eventos comunes de U-Pad
    val notificationsList = remember {
        listOf(
            NotificationItem(
                id = "1",
                title = "¡Rutina de la Mañana completada!",
                description = "Tu hijo ha terminado con éxito todas las tareas asignadas para el turno de hoy.",
                time = "Hace 10 min",
                type = NotificationType.SUCCESS
            ),
            NotificationItem(
                id = "2",
                title = "Alerta de Bloqueo de Sistema",
                description = "El modo Kiosco se activó correctamente en el dispositivo del menor.",
                time = "Hace 1 hora",
                type = NotificationType.INFO
            ),
            NotificationItem(
                id = "3",
                title = "Feedback Emocional Recibido",
                description = "Se ha registrado una nueva emoción en la bitácora tras finalizar la tarea 'Lavarse los dientes'.",
                time = "Hace 2 horas",
                type = NotificationType.SUCCESS
            ),
            NotificationItem(
                id = "4",
                title = "Batería Baja en Dispositivo Vinculado",
                description = "La tableta/teléfono de tu hijo se encuentra por debajo del 20%.",
                time = "Ayer",
                type = NotificationType.WARNING
            )
        )
    }

    UPADBackgroundWrapper(isPremium = isPremiumUser, isDarkMode = isDarkMode) {
        Scaffold(
            containerColor = Color.Transparent,
            topBar = {
                UpadTopAppBar(
                    title = "Centro de Alertas 🔔",
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
                    .padding(horizontal = 24.dp)
                    .padding(top = 16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(
                    text = "Mantente al tanto en tiempo real de los avances, estados y reportes del dispositivo de tu hijo.",
                    fontSize = 14.sp,
                    color = colorTextoSecundario,
                    modifier = Modifier.padding(bottom = 8.dp)
                )

                if (notificationsList.isEmpty()) {
                    // Estado vacío si no hay alertas
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                imageVector = Icons.Default.Notifications,
                                contentDescription = null,
                                tint = colorTextoSecundario.copy(alpha = 0.4f),
                                modifier = Modifier.size(64.dp)
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = "No tienes notificaciones por ahora",
                                color = colorTextoSecundario,
                                fontSize = 15.sp
                            )
                        }
                    }
                } else {
                    // Listado optimizado y fluido con LazyColumn
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        contentPadding = PaddingValues(bottom = 24.dp)
                    ) {
                        items(notificationsList) { notification ->
                            NotificationCard(
                                notification = notification,
                                backgroundColor = colorSuperficieTarjetas,
                                textColor = colorTextoPrincipal,
                                subTextColor = colorTextoSecundario
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun NotificationCard(
    notification: NotificationItem,
    backgroundColor: Color,
    textColor: Color,
    subTextColor: Color
) {
    val (icon, iconColor) = when (notification.type) {
        NotificationType.SUCCESS -> Icons.Default.CheckCircle to Color(0xFF4CAF50)
        NotificationType.WARNING -> Icons.Default.Warning to Color(0xFFFF9800)
        NotificationType.INFO -> Icons.Default.DeviceUnknown to Color(0xFF2196F3)
    }

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        color = backgroundColor,
        border = BorderStroke(1.dp, subTextColor.copy(alpha = 0.1f))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Círculo contenedor para el ícono de estado
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .background(iconColor.copy(alpha = 0.15f), shape = CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = iconColor,
                    modifier = Modifier.size(22.dp)
                )
            }

            // Textos descriptivos de la notificación
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = notification.title,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                        color = textColor,
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        text = notification.time,
                        fontSize = 11.sp,
                        color = subTextColor.copy(alpha = 0.8f),
                        modifier = Modifier.padding(end = 4.dp)
                    )
                }
                Text(
                    text = notification.description,
                    fontSize = 13.sp,
                    color = subTextColor,
                    lineHeight = 18.sp
                )
            }
        }
    }
}
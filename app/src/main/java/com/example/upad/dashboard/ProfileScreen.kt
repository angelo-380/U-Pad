package com.example.upad.dashboard

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.upad.components.UPADBackgroundWrapper
import com.example.upad.viewmodel.RoutineViewModel
import com.google.firebase.auth.FirebaseAuth

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    routineViewModel: RoutineViewModel,
    onNavigateBack: () -> Unit,
    onLogoutSuccess: () -> Unit
) {
    // 📨 1. RECOLECCIÓN DE ESTADOS GLOBALES (Cabecera del componente)
    val isPremiumUser by routineViewModel.isUserPremium.collectAsState(initial = false)
    val isDarkMode by routineViewModel.isDarkMode.collectAsState()

    // 🎨 CONFIGURACIÓN DE PALETA ADAPTATIVA
    val colorAcabadoPrincipal = if (isPremiumUser) Color(0xFFC5A059) else MaterialTheme.colorScheme.primary
    val colorTextoPrincipal = if (isDarkMode) Color.White else Color(0xFF111111)
    val colorTextoSecundario = if (isDarkMode) Color(0xFFB0B0B0) else Color(0xFF555555)

    // Superficie de tarjetas: Translúcidas en Premium (Glassmorphism), sólidas en Básico
    val colorSuperficieTarjetas = if (isPremiumUser) {
        if (isDarkMode) Color.White.copy(alpha = 0.08f) else Color.White.copy(alpha = 0.65f)
    } else {
        if (isDarkMode) Color(0xFF1E1E1E) else Color.White
    }

    val firebaseAuth = remember { FirebaseAuth.getInstance() }
    val currentUser = firebaseAuth.currentUser

    val parentName = remember(currentUser) {
        val emailName = currentUser?.email?.substringBefore("@")
        val nameToDisplay = currentUser?.displayName ?: emailName
        if (!nameToDisplay.isNullOrBlank()) nameToDisplay.uppercase() else "PADRE/TUTOR"
    }

    // 🚀 2. IMPLEMENTACIÓN DEL CONTENEDOR BASE
    UPADBackgroundWrapper(isPremium = isPremiumUser, isDarkMode = isDarkMode) {
        Scaffold(
            containerColor = Color.Transparent,
            topBar = {
                TopAppBar(
                    title = { Text("Mi Perfil", fontWeight = FontWeight.Bold, color = colorTextoPrincipal) },
                    navigationIcon = {
                        IconButton(onClick = onNavigateBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Volver", tint = colorAcabadoPrincipal)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent)
                )
            }
        ) { paddingValues ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Spacer(modifier = Modifier.height(20.dp))

                // Avatar Circular de perfil adaptable
                Box(
                    modifier = Modifier
                        .size(100.dp)
                        .background(colorAcabadoPrincipal.copy(alpha = 0.2f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Person, contentDescription = null, tint = colorAcabadoPrincipal, modifier = Modifier.size(50.dp))
                }

                Spacer(modifier = Modifier.height(32.dp))

                // 🛠️ Tarjeta contenedora purificada usando Surface nativa para disolver el plomo residual
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    color = colorSuperficieTarjetas,
                    border = if (isPremiumUser) BorderStroke(1.dp, colorAcabadoPrincipal.copy(alpha = 0.25f)) else BorderStroke(1.dp, colorTextoSecundario.copy(alpha = 0.1f)),
                    tonalElevation = 0.dp,
                    shadowElevation = 0.dp
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        ProfileInfoRow(
                            icon = Icons.Default.Person,
                            title = "Nombre de Usuario",
                            value = parentName,
                            iconColor = colorAcabadoPrincipal,
                            textColor = colorTextoPrincipal,
                            subTextColor = colorTextoSecundario
                        )
                        HorizontalDivider(
                            modifier = Modifier.padding(vertical = 12.dp),
                            color = if (isDarkMode) Color.White.copy(alpha = 0.1f) else Color.Black.copy(alpha = 0.05f)
                        )
                        ProfileInfoRow(
                            icon = Icons.Default.Email,
                            title = "Correo Electrónico",
                            value = currentUser?.email ?: "No disponible",
                            iconColor = colorAcabadoPrincipal,
                            textColor = colorTextoPrincipal,
                            subTextColor = colorTextoSecundario
                        )
                    }
                }

                Spacer(modifier = Modifier.weight(1f))

                // Botón estructurado para desconexión segura en Firebase
                Button(
                    onClick = {
                        firebaseAuth.signOut()
                        onLogoutSuccess()
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF5350)),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Icon(Icons.Default.ExitToApp, contentDescription = null, tint = Color.White)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Cerrar Sesión", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color.White)
                }
            }
        }
    }
}

@Composable
fun ProfileInfoRow(
    icon: ImageVector,
    title: String,
    value: String,
    iconColor: Color,
    textColor: Color,
    subTextColor: Color
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = null, tint = iconColor, modifier = Modifier.size(24.dp))
        Spacer(modifier = Modifier.width(16.dp))
        Column {
            Text(text = title, fontSize = 12.sp, color = subTextColor, fontWeight = FontWeight.Medium)
            Text(text = value, fontSize = 16.sp, color = textColor, fontWeight = FontWeight.Bold)
        }
    }
}
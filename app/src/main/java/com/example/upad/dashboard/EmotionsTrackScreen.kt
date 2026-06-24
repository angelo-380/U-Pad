package com.example.upad.dashboard

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.EmojiEmotions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.upad.components.UPADBackgroundWrapper
import com.example.upad.viewmodel.RoutineViewModel

@Composable
fun EmotionsTrackScreen(routineViewModel: RoutineViewModel) {
    val isPremiumUser by routineViewModel.isUserPremium.collectAsState(initial = false)
    val isDarkMode by routineViewModel.isDarkMode.collectAsState()

    val colorAcabadoPrincipal = if (isPremiumUser) Color(0xFFC5A059) else MaterialTheme.colorScheme.primary
    val colorTextoPrincipal = if (isDarkMode) Color.White else Color(0xFF111111)
    val colorTextoSecundario = if (isDarkMode) Color(0xFFB0B0B0) else Color(0xFF555555)

    val colorSuperficieTarjetas = if (isPremiumUser) {
        if (isDarkMode) Color.White.copy(alpha = 0.08f) else Color.White.copy(alpha = 0.65f)
    } else {
        if (isDarkMode) Color(0xFF1E1E1E) else Color.White
    }

    UPADBackgroundWrapper(isPremium = isPremiumUser, isDarkMode = isDarkMode) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Text(
                text = "Bitácora de Emociones ✨",
                fontSize = 24.sp,
                fontWeight = FontWeight.Black,
                color = colorTextoPrincipal
            )

            Text(
                text = "Observa el estado anímico reportado por tu hijo al completar sus rutinas diarias para entender su progreso.",
                fontSize = 14.sp,
                color = colorTextoSecundario
            )

            Surface(
                modifier = Modifier.fillMaxWidth().height(300.dp),
                shape = RoundedCornerShape(22.dp),
                color = colorSuperficieTarjetas,
                border = BorderStroke(1.dp, colorTextoSecundario.copy(alpha = 0.1f))
            ) {
                Column(
                    modifier = Modifier.fillMaxSize().padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.EmojiEmotions,
                        contentDescription = null,
                        tint = colorAcabadoPrincipal,
                        modifier = Modifier.size(52.dp)
                    )
                    Spacer(modifier = Modifier.height(14.dp))
                    Text(
                        text = "Gráficas de Estado de Ánimo",
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = colorTextoPrincipal
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Aquí aparecerán métricas semanales detalladas sobre las emociones asociadas a cada pictograma.",
                        color = colorTextoSecundario,
                        fontSize = 13.sp,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                }
            }
        }
    }
}
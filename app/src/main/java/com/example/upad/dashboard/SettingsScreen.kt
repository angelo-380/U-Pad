package com.example.upad.dashboard

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.res.stringResource
import androidx.compose.foundation.clickable
import com.example.upad.R
import com.google.firebase.auth.FirebaseAuth
import com.example.upad.components.UPADBackgroundWrapper
import com.example.upad.viewmodel.RoutineViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    routineViewModel: RoutineViewModel,
    onNavigateBack: () -> Unit
) {
    val isPremiumUser by routineViewModel.isUserPremium.collectAsState(initial = false)
    val isDarkMode by routineViewModel.isDarkMode.collectAsState()
    val appLanguage by routineViewModel.appLanguage.collectAsState()

    val colorTextoPrincipal = if (isDarkMode) Color.White else Color(0xFF111111)
    val colorTextoSecundario = if (isDarkMode) Color(0xFFB0B0B0) else Color(0xFF555555)

    // Configuración limpia de las superficies: Translúcidas en premium, sólidas y claras en básico
    val colorSuperficieTarjetas = if (isPremiumUser) {
        if (isDarkMode) Color.White.copy(alpha = 0.08f) else Color.White.copy(alpha = 0.65f)
    } else {
        if (isDarkMode) Color(0xFF1E1E1E) else Color(0xFFF7F7F7)
    }

    val colorAcabadoPrincipal = if (isPremiumUser) Color(0xFFC5A059) else MaterialTheme.colorScheme.primary
    var notificationsEnabled by remember { mutableStateOf(true) }
    var expandedLanguage by remember { mutableStateOf(false) }
    val idiomasDisponibles = listOf(
        "es" to "Español",
        "en" to "English",
        "fr" to "Français",
        "de" to "Deutsch",
        "ru" to "Русский",
        "pt" to "Português"
    )

    UPADBackgroundWrapper(isPremium = isPremiumUser, isDarkMode = isDarkMode) {
        Scaffold(
            containerColor = Color.Transparent,
            topBar = {
                TopAppBar(
                    title = { Text(stringResource(R.string.settings_title), fontWeight = FontWeight.Bold, color = colorTextoPrincipal) },
                    navigationIcon = {
                        IconButton(onClick = onNavigateBack) {
                            Icon(
                                Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Volver",
                                tint = colorTextoPrincipal
                            )
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
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {

                Text(stringResource(R.string.settings_subscription), fontSize = 14.sp, fontWeight = FontWeight.Bold, color = colorTextoSecundario)

                // 🛠️ Contenedor 1: Usamos Surface para desvincular los tintes grises automatizados de las Cards
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    color = colorSuperficieTarjetas,
                    border = if (isPremiumUser) BorderStroke(1.dp, colorAcabadoPrincipal.copy(alpha = 0.25f)) else null,
                    tonalElevation = 0.dp,
                    shadowElevation = 0.dp
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = if (isPremiumUser) Icons.Default.WorkspacePremium else Icons.Default.Star,
                                contentDescription = null,
                                tint = if (isPremiumUser) Color(0xFFFFD700) else colorAcabadoPrincipal,
                                modifier = Modifier.size(28.dp)
                            )
                            Spacer(modifier = Modifier.width(16.dp))
                            Column {
                                Text(
                                    text = if (isPremiumUser) stringResource(R.string.plan_gold) else stringResource(R.string.plan_basic),
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Black,
                                    color = colorTextoPrincipal
                                )
                                Text(
                                    text = if (isPremiumUser) stringResource(R.string.gold_desc) else stringResource(R.string.basic_desc),
                                    fontSize = 12.sp,
                                    color = colorTextoSecundario
                                )
                            }
                        }

                        if (isPremiumUser) {
                            Surface(
                                color = Color(0xFFFFD700),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.padding(start = 8.dp)
                            ) {
                                Text(
                                    stringResource(R.string.active),
                                    color = Color.Black,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Black,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                                )
                            }
                        }
                    }
                }

                Text(stringResource(R.string.settings_general), fontSize = 14.sp, fontWeight = FontWeight.Bold, color = colorTextoSecundario)

                // 🛠️ Contenedor 2 limpiado de herencias plomas de Material
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(20.dp),
                    color = colorSuperficieTarjetas,
                    border = if (isPremiumUser) BorderStroke(1.dp, colorAcabadoPrincipal.copy(alpha = 0.25f)) else null,
                    tonalElevation = 0.dp,
                    shadowElevation = 0.dp
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        SettingSwitchRow(
                            icon = Icons.Default.Notifications,
                            title = stringResource(R.string.settings_notifications),
                            subtitle = stringResource(R.string.settings_notifications_desc),
                            checked = notificationsEnabled,
                            onCheckedChange = { notificationsEnabled = it },
                            switchColor = colorAcabadoPrincipal,
                            textColor = colorTextoPrincipal,
                            subTextColor = colorTextoSecundario
                        )

                        HorizontalDivider(
                            modifier = Modifier.padding(vertical = 12.dp),
                            color = colorTextoPrincipal.copy(alpha = 0.1f)
                        )

                        SettingSwitchRow(
                            icon = Icons.Default.DarkMode,
                            title = if (isPremiumUser) "Tema Premium Visual" else stringResource(R.string.settings_dark_mode),
                            subtitle = if (isPremiumUser) "Cambiar entre Rosa Pastel y Azul Profundo" else stringResource(R.string.settings_dark_mode_desc),
                            checked = isDarkMode,
                            onCheckedChange = { routineViewModel.setDarkMode(it) },
                            switchColor = colorAcabadoPrincipal,
                            textColor = colorTextoPrincipal,
                            subTextColor = colorTextoSecundario
                        )
                    }
                }

                Text(stringResource(R.string.settings_app), fontSize = 14.sp, fontWeight = FontWeight.Bold, color = colorTextoSecundario)

                // 🛠️ Contenedor 3 purificado
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { expandedLanguage = true },
                    shape = RoundedCornerShape(20.dp),
                    color = colorSuperficieTarjetas,
                    border = if (isPremiumUser) BorderStroke(1.dp, colorAcabadoPrincipal.copy(alpha = 0.25f)) else null,
                    tonalElevation = 0.dp,
                    shadowElevation = 0.dp
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(20.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Language, contentDescription = null, tint = colorAcabadoPrincipal)
                            Spacer(modifier = Modifier.width(16.dp))
                            Column {
                                Text(stringResource(R.string.settings_language), fontSize = 16.sp, fontWeight = FontWeight.Bold, color = colorTextoPrincipal)
                                val nombreIdiomaActual = idiomasDisponibles.find { it.first == appLanguage }?.second ?: "Español"
                                Text(nombreIdiomaActual, fontSize = 12.sp, color = colorTextoSecundario)
                            }
                        }

                        DropdownMenu(
                            expanded = expandedLanguage,
                            onDismissRequest = { expandedLanguage = false }
                        ) {
                            idiomasDisponibles.forEach { (codigo, nombre) ->
                                DropdownMenuItem(
                                    text = { Text(nombre) },
                                    onClick = {
                                        expandedLanguage = false
                                        val userId = FirebaseAuth.getInstance().currentUser?.uid
                                        routineViewModel.changeLanguage(userId, codigo)
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SettingSwitchRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    switchColor: Color,
    textColor: Color,
    subTextColor: Color
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(modifier = Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, contentDescription = null, tint = switchColor)
            Spacer(modifier = Modifier.width(16.dp))
            Column {
                Text(title, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = textColor)
                Text(subtitle, fontSize = 12.sp, color = subTextColor)
            }
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = Color.White,
                checkedTrackColor = switchColor
            )
        )
    }
}
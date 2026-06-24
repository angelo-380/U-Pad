package com.example.upad.components

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.Color
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.currentBackStackEntryAsState
import com.example.upad.navigation.BottomBarScreen
import com.example.upad.viewmodel.RoutineViewModel
import androidx.compose.ui.unit.dp
@Composable
fun UPADBottomBar(
    navController: NavHostController,
    routineViewModel: RoutineViewModel
) {
    // 🌗 Obtener estados dinámicos del tema
    val isPremiumUser by routineViewModel.isUserPremium.collectAsState(initial = false)
    val isDarkMode by routineViewModel.isDarkMode.collectAsState()

    // Controlar qué pantalla está activa actualmente para iluminar el ícono correcto
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

    // Definimos la lista de las pantallas inferiores
    val screens = listOf(
        BottomBarScreen.Dashboard,
        BottomBarScreen.Analytics,
        BottomBarScreen.Profile,
        BottomBarScreen.Settings
    )

    // 🎨 Paleta adaptativa idéntica al resto de tu sistema
    val colorAcabadoPrincipal = if (isPremiumUser) Color(0xFFC5A059) else MaterialTheme.colorScheme.primary
    val colorTextoPrincipal = if (isDarkMode) Color.White else Color(0xFF111111)
    val colorTextoSecundario = if (isDarkMode) Color(0xFFB0B0B0) else Color(0xFF555555)

    val colorFondoBarra = if (isPremiumUser) {
        if (isDarkMode) Color.White.copy(alpha = 0.05f) else Color.White.copy(alpha = 0.80f)
    } else {
        if (isDarkMode) Color(0xFF1E1E1E) else Color.White
    }

    // Ocultar la barra si se navega a sub-pantallas profundas (ej: "help_tutorial" o "create_routine")
    val showBottomBar = screens.any { it.route == currentDestination?.route }

    if (showBottomBar) {
        NavigationBar(
            containerColor = colorFondoBarra,
            tonalElevation = if (isPremiumUser) 0.dp else NavigationBarDefaults.Elevation
        ) {
            screens.forEach { screen ->
                val isSelected = currentDestination?.route == screen.route

                NavigationBarItem(
                    label = {
                        Text(
                            text = screen.title,
                            color = if (isSelected) colorTextoPrincipal else colorTextoSecundario
                        )
                    },
                    icon = {
                        Icon(
                            imageVector = screen.icon,
                            contentDescription = screen.title
                        )
                    },
                    selected = isSelected,
                    onClick = {
                        // Navegación inteligente para no duplicar pantallas en la pila trasera
                        if (!isSelected) {
                            navController.navigate(screen.route) {
                                popUpTo(navController.graph.findStartDestination().id) {
                                    saveState = true
                                }
                                launchSingleTop = true
                                restoreState = true
                            }
                        }
                    },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = if (isPremiumUser && !isDarkMode) Color.Black else Color.White,
                        selectedTextColor = colorTextoPrincipal,
                        unselectedIconColor = colorTextoSecundario,
                        unselectedTextColor = colorTextoSecundario,
                        indicatorColor = colorAcabadoPrincipal // El óvalo detrás del ícono seleccionado
                    )
                )
            }
        }
    }
}
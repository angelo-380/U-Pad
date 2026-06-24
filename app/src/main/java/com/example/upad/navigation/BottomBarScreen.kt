package com.example.upad.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Analytics
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.ui.graphics.vector.ImageVector

sealed class BottomBarScreen(
    val route: String,
    val title: String,
    val icon: ImageVector
) {
    object Dashboard : BottomBarScreen(
        route = "parent_dashboard",
        title = "Inicio",
        icon = Icons.Default.Dashboard
    )

    object Analytics : BottomBarScreen(
        route = "analytics",
        title = "Análisis",
        icon = Icons.Default.Analytics
    )

    object Profile : BottomBarScreen(
        route = "profile",
        title = "Perfil",
        icon = Icons.Default.Person
    )

    object Settings : BottomBarScreen(
        route = "settings",
        title = "Ajustes",
        icon = Icons.Default.Settings
    )
}
package com.example.upad.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Analytics
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.EmojiEmotions
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Settings
import androidx.compose.ui.graphics.vector.ImageVector

sealed class BottomBarScreen(
    val route: String,
    val title: String,
    val icon: ImageVector
) {
    // 🏠 Comunes / Básicos
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

    // 🌟 Exclusivos Premium
    object Calendario : BottomBarScreen(
        route = "today_calendar",
        title = "Calendario",
        icon = Icons.Default.CalendarMonth
    )

    object Emociones : BottomBarScreen(
        route = "emotions_track",
        title = "Emociones",
        icon = Icons.Default.EmojiEmotions
    )

    object Notificaciones : BottomBarScreen(
        route = "notifications",
        title = "Alertas",
        icon = Icons.Default.Notifications
    )
}
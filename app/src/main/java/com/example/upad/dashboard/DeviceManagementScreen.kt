package com.example.upad.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.LockOpen
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentActivity
import com.example.upad.components.UPADBackgroundWrapper // 🛠️ Importamos el contenedor unificado
import com.example.upad.utils.BiometricHelper
import com.example.upad.viewmodel.RoutineViewModel
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore

// Usamos un modelo consistente con los datos reales guardados en Firebase
data class DispositivoNiño(
    val id: String = "",
    val nombreDispositivo: String = "Tablet/Celular Niño",
    val kioscoActivo: Boolean = false
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DeviceManagementScreen(
    routineViewModel: RoutineViewModel, // 🛡️ SE MANTIENE INTACTO (Sin romper rutas)
    onNavigateBack: () -> Unit
) {
    // 📨 1. LLAMAR A LOS ESTADOS LOCALES EN LA CABECERA (Procedimiento Estándar)
    val isPremiumUser by routineViewModel.isUserPremium.collectAsState(initial = false)
    val isDarkMode by routineViewModel.isDarkMode.collectAsState()

    // 🎨 PALETA DE COLORES RE-ACOPLADA AL DISEÑO DEL CONTENEDOR
    val colorAcabadoPrincipal = if (isPremiumUser) Color(0xFFC5A059) else MaterialTheme.colorScheme.primary
    val colorTextoPrincipal = if (isDarkMode) Color.White else Color(0xFF111111)
    val colorTextoSecundario = if (isDarkMode) Color(0xFFB0B0B0) else Color(0xFF555555)

    val colorSuperficieTarjetas = if (isPremiumUser) {
        if (isDarkMode) Color.White.copy(alpha = 0.1f) else Color.White.copy(alpha = 0.7f)
    } else {
        if (isDarkMode) Color(0xFF1E1E1E) else Color(0xFFF7F7F7)
    }

    val context = LocalContext.current
    val activity = context as FragmentActivity

    var listaDispositivos by remember { mutableStateOf(listOf<DispositivoNiño>()) }
    var cargando by remember { mutableStateOf(true) }

    val firestore = remember { FirebaseFirestore.getInstance() }
    val idPadre = remember { FirebaseAuth.getInstance().currentUser?.uid ?: "" }

    // 📡 ESCUCHA EN ESPEJO
    DisposableEffect(idPadre) {
        val listener = firestore.collection("dispositivos_niños")
            .whereEqualTo("padreId", idPadre)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    cargando = false
                    return@addSnapshotListener
                }

                val listaTemporal = mutableListOf<DispositivoNiño>()
                if (snapshot != null) {
                    for (dispositivo in snapshot.documents) {
                        val id = dispositivo.id
                        val nombre = dispositivo.getString("nombreDispositivo")
                            ?: dispositivo.getString("modelo")
                            ?: "Tablet/Celular Niño"
                        val activo = dispositivo.getBoolean("kioscoActivo") ?: false

                        listaTemporal.add(DispositivoNiño(id, nombre, activo))
                    }
                }

                listaDispositivos = listaTemporal
                cargando = false
            }

        onDispose {
            listener.remove()
        }
    }

    // 🚀 2. IMPLEMENTAR EL CONTENEDOR BASE
    UPADBackgroundWrapper(isPremium = isPremiumUser, isDarkMode = isDarkMode) {
        Scaffold(
            containerColor = Color.Transparent, // 🔑 Permite ver el fondo degradado o sólido del Wrapper
            topBar = {
                TopAppBar(
                    title = { Text("Control de Bloqueo Remoto", color = colorTextoPrincipal) },
                    navigationIcon = {
                        IconButton(onClick = onNavigateBack) {
                            Icon(Icons.Default.ArrowBack, contentDescription = "Regresar", tint = colorAcabadoPrincipal)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = Color.Transparent // Fondo transparente para la TopBar
                    )
                )
            }
        ) { paddingValues ->
            if (cargando) {
                Box(modifier = Modifier.fillMaxSize().padding(paddingValues), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = colorAcabadoPrincipal)
                }
            } else if (listaDispositivos.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize().padding(paddingValues), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("No tienes dispositivos vinculados.", color = colorTextoPrincipal, style = MaterialTheme.typography.bodyLarge)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Ve al menú lateral de Conexión para enlazar el equipo del niño con el código de 6 dígitos.",
                            style = MaterialTheme.typography.bodySmall,
                            color = colorTextoSecundario,
                            modifier = Modifier.padding(horizontal = 32.dp),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(paddingValues).padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(listaDispositivos) { dispositivo ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(18.dp),
                            colors = CardDefaults.cardColors(containerColor = colorSuperficieTarjetas),
                            border = if (isPremiumUser) androidx.compose.foundation.BorderStroke(1.dp, colorAcabadoPrincipal.copy(alpha = 0.2f)) else null,
                            elevation = CardDefaults.cardElevation(defaultElevation = if (isPremiumUser) 0.dp else 2.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(dispositivo.nombreDispositivo, color = colorTextoPrincipal, style = MaterialTheme.typography.titleMedium)
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = if (dispositivo.kioscoActivo) "Estado: BLOQUEADO remoto 🔒" else "Estado: LIBRE 🔓",
                                        color = if (dispositivo.kioscoActivo) MaterialTheme.colorScheme.error else colorAcabadoPrincipal,
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                }

                                Button(
                                    onClick = {
                                        val nuevoEstado = !dispositivo.kioscoActivo
                                        BiometricHelper.cambiarEstadoKioscoConHuella(
                                            activity = activity,
                                            idDispositivoNiño = dispositivo.id,
                                            debeBloquear = nuevoEstado
                                        )
                                    },
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = if (dispositivo.kioscoActivo) colorAcabadoPrincipal else MaterialTheme.colorScheme.error
                                    ),
                                    shape = RoundedCornerShape(12.dp)
                                ) {
                                    if (dispositivo.kioscoActivo) {
                                        Icon(Icons.Default.LockOpen, contentDescription = null)
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text("Liberar")
                                    } else {
                                        Icon(Icons.Default.Lock, contentDescription = null)
                                        Spacer(modifier = Modifier.width(4.dp))
                                        Text("Bloquear")
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
package com.example.upad.premium

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.upad.viewmodel.RoutineViewModel
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun PaymentViewScreen(
    routineViewModel: RoutineViewModel,
    onPaymentConfirmed: () -> Unit // 👶 Callback definitivo que te lleva a ChildProfileSetupScreen
) {
    val scope = rememberCoroutineScope()
    val auth = remember { FirebaseAuth.getInstance() }
    val firestore = remember { FirebaseFirestore.getInstance() }

    var procesandoPago by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF121214))
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        if (!procesandoPago) {
            Icon(
                imageVector = Icons.Default.WorkspacePremium,
                contentDescription = null,
                tint = Color(0xFFD4AF37),
                modifier = Modifier.size(80.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "Desbloquea UPad Gold",
                color = Color.White,
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "Estás a un paso de automatizar las rutinas de tus hijos usando modelos de Inteligencia Artificial.",
                color = Color.LightGray,
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 16.dp)
            )

            Spacer(modifier = Modifier.height(20.dp))

            // Indicador visual de Módulo en Desarrollo / Sandbox
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF2A2312)),
                shape = RoundedCornerShape(10.dp)
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "🛠️",
                        fontSize = 20.sp,
                        modifier = Modifier.padding(end = 10.dp)
                    )
                    Column {
                        Text(
                            text = "MÓDULO EN DESARROLLO (SANDBOX)",
                            color = Color(0xFFFFD54F),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "La pasarela bancaria está en fase de integración. No se realizarán cargos a tarjetas de crédito reales.",
                            color = Color(0xFFE0E0E0),
                            fontSize = 11.sp,
                            lineHeight = 15.sp
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E1E24)),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.CreditCard, contentDescription = null, tint = Color.White)
                    Spacer(modifier = Modifier.width(16.dp))
                    Column {
                        Text("Tarjeta de Pruebas (Sandbox)", color = Color.White, fontWeight = FontWeight.Bold)
                        Text("•••• •••• •••• 4321", color = Color.Gray, fontSize = 12.sp)
                    }
                }
            }

            Spacer(modifier = Modifier.height(30.dp))

            Button(
                onClick = {
                    scope.launch {
                        procesandoPago = true
                        delay(2000) // Simulación de verificación bancaria

                        val uid = auth.currentUser?.uid ?: com.example.upad.data.LocalDataManager.getCurrentUserId()
                        // Actualizar estado en LocalDataManager y backend
                        com.example.upad.data.LocalDataManager.setPremiumStatus(uid, true)

                        // Intentar Firebase solo si está disponible sin bloquear
                        try {
                            val datosPremium = hashMapOf(
                                "planSuscripcion" to "premium",
                                "estadoSuscripcion" to "Activo",
                                "fechaSeleccionPlan" to com.google.firebase.Timestamp.now()
                            )
                            firestore.collection("usuarios").document(uid)
                                .set(datosPremium, com.google.firebase.firestore.SetOptions.merge())
                        } catch (e: Exception) {}

                        // Cambiar estado reactivo global en ViewModel
                        routineViewModel.setPremiumUser(true)

                        // Continuar al setup
                        onPaymentConfirmed()
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFD4AF37)),
                shape = RoundedCornerShape(28.dp)
            ) {
                Text("Activar Suscripción Demo (Pruebas)", color = Color.Black, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            }
        } else {
            CircularProgressIndicator(color = Color(0xFFD4AF37))
            Spacer(modifier = Modifier.height(16.dp))
            Text("Procesando pago seguro...", color = Color.White, fontWeight = FontWeight.Medium)
            Text("Configurando entorno Premium...", color = Color.Gray, fontSize = 12.sp)
        }
    }
}
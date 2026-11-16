package com.example.upad.setup

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.PhonelinkSetup
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.upad.data.LocalDataManager
import com.google.firebase.auth.FirebaseAuth
import androidx.compose.material.icons.filled.Timer
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DevicePairingScreen(
    onNavigateToDashboard: () -> Unit
) {
    val context = LocalContext.current
    val configuration = LocalConfiguration.current
    val prefs = remember { context.getSharedPreferences("UPAD_PREFS", Context.MODE_PRIVATE) }
 
    // 🎨 DETECCIÓN DE TEMA REMOTO/LOCAL (Por defecto es falso -> Modo Claro)
    val esTemaOscuro = remember { prefs.getBoolean("TEMA_OSCURO", false) }
 
    // Extraemos variables guardadas en los pasos previos del Setup
    val childName = remember { prefs.getString("CHILD_NAME", "tu pequeño") ?: "tu pequeño" }
 
    // Extraemos el UID real del Padre logueado
    val currentParentId = remember {
        FirebaseAuth.getInstance().currentUser?.uid ?: LocalDataManager.getCurrentUserId()
    }
 
    // --- ESTADOS LÓGICOS DE CONEXIÓN ---
    var pairingCode by remember { mutableStateOf("") }
    var isPaired by remember { mutableStateOf(false) }
    var mensajeError by remember { mutableStateOf("") }
    var estaConectando by remember { mutableStateOf(false) }
    var secondsRemaining by remember { mutableIntStateOf(60) }
    var codeSeed by remember { mutableIntStateOf(1) }

    LaunchedEffect(isPaired, codeSeed) {
        if (!isPaired) {
            secondsRemaining = 60
            while (secondsRemaining > 0) {
                delay(1000L)
                secondsRemaining--
            }
            // Expired: reset code to enforce MFA time-based security
            pairingCode = ""
            mensajeError = "El código expiró por seguridad. Ingresa el nuevo código generado."
            codeSeed++
        }
    }
 
    val pantallaPequeña = configuration.screenHeightDp < 650

    // --- PALETA DE COLORES ADAPTATIVA MULTI-TEMA ---
    val colorAzulTEA = Color(0xFF4FC3F7)
    val colorVerdeExito = Color(0xFF4CAF50)

    // Asignación según la personalización previa del usuario
    val colorFondoBase = if (esTemaOscuro) Color(0xFF0F172A) else Color(0xFFF8FAFC)
    val colorSuperficie = if (esTemaOscuro) Color(0xFF1E293B) else Color.White
    val colorTextoPrincipal = if (esTemaOscuro) Color(0xFFF1F5F9) else Color(0xFF1E293B)
    val colorTextoSecundario = if (esTemaOscuro) Color(0xFF94A3B8) else Color(0xFF64748B)
    val colorBordeInput = if (esTemaOscuro) Color(0xFF334155) else Color(0xFFCBD5E1)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colorFondoBase)
    ) {
        // --- CABECERA ADAPTATIVA ---
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(bottomStart = 32.dp, bottomEnd = 32.dp))
                .background(colorSuperficie)
                .padding(
                    top = if (pantallaPequeña) 32.dp else 50.dp,
                    bottom = if (pantallaPequeña) 16.dp else 24.dp,
                    start = 24.dp,
                    end = 24.dp
                )
        ) {
            Text(
                text = "SINCRONIZACIÓN REALTIME",
                fontSize = 11.sp,
                fontWeight = FontWeight.Black,
                color = Color.LightGray,
                letterSpacing = 1.5.sp
            )
            Text(
                text = if (!isPaired) "Enlaza tu cuenta" else "¡Sincronizado con éxito!",
                fontSize = if (pantallaPequeña) 24.sp else 28.sp,
                fontWeight = FontWeight.Black,
                color = if (!isPaired) colorTextoPrincipal else colorVerdeExito
            )
            Text(
                text = if (!isPaired)
                    "Vincula la tablet de $childName para sincronizar rutinas al instante."
                else
                    "Tu cuenta está vinculada en modo local seguro.",
                fontSize = 14.sp,
                color = colorTextoSecundario,
                modifier = Modifier.padding(top = 4.dp)
            )
        }

        // --- ZONA CENTRAL SCROLLEABLE ---
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp, vertical = if (pantallaPequeña) 12.dp else 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            if (!isPaired) {
                // PANTALLA 1: FORMULARIO DE INGRESO DEL CÓDIGO
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Surface(
                        modifier = Modifier.size(if (pantallaPequeña) 70.dp else 85.dp),
                        shape = CircleShape,
                        color = colorAzulTEA.copy(alpha = 0.15f)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Default.PhonelinkSetup,
                                contentDescription = null,
                                tint = colorAzulTEA,
                                modifier = Modifier.size(if (pantallaPequeña) 35.dp else 45.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "Código de Vinculación",
                        fontSize = if (pantallaPequeña) 18.sp else 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = colorTextoPrincipal
                    )

                    Text(
                        text = "Introduce los 6 dígitos que aparecen en la tablet de $childName",
                        fontSize = 13.sp,
                        color = colorTextoSecundario,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(top = 4.dp, start = 8.dp, end = 8.dp)
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    OutlinedTextField(
                        value = pairingCode,
                        onValueChange = { if (it.length <= 6 && it.all { char -> char.isDigit() }) pairingCode = it },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(if (pantallaPequeña) 65.dp else 75.dp),
                        shape = RoundedCornerShape(18.dp),
                        textStyle = LocalTextStyle.current.copy(
                            fontSize = if (pantallaPequeña) 28.sp else 34.sp,
                            fontWeight = FontWeight.Black,
                            textAlign = TextAlign.Center,
                            letterSpacing = 8.sp,
                            color = colorTextoPrincipal
                        ),
                        placeholder = {
                            Text(
                                text = "------",
                                modifier = Modifier.fillMaxWidth(),
                                textAlign = TextAlign.Center,
                                fontSize = if (pantallaPequeña) 28.sp else 34.sp,
                                fontWeight = FontWeight.Black,
                                letterSpacing = 8.sp,
                                color = colorTextoSecundario.copy(alpha = 0.3f)
                            )
                        },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = colorAzulTEA,
                            unfocusedBorderColor = colorBordeInput,
                            focusedContainerColor = colorSuperficie,
                            unfocusedContainerColor = colorSuperficie,
                            focusedTextColor = colorTextoPrincipal,
                            unfocusedTextColor = colorTextoPrincipal
                        )
                    )

                    Spacer(modifier = Modifier.height(14.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(
                            imageVector = Icons.Default.Timer,
                            contentDescription = null,
                            tint = if (secondsRemaining <= 10) Color(0xFFEF4444) else colorAzulTEA,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Código válido por: ${secondsRemaining}s (seguridad TOTP)",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (secondsRemaining <= 10) Color(0xFFEF4444) else colorTextoSecundario
                        )
                    }
                    LinearProgressIndicator(
                        progress = { secondsRemaining / 60f },
                        modifier = Modifier
                            .fillMaxWidth(0.6f)
                            .padding(top = 6.dp)
                            .height(4.dp)
                            .clip(RoundedCornerShape(2.dp)),
                        color = if (secondsRemaining <= 10) Color(0xFFEF4444) else colorAzulTEA,
                        trackColor = if (esTemaOscuro) Color(0xFF334155) else Color(0xFFE2E8F0)
                    )

                    if (mensajeError.isNotEmpty()) {
                        Text(
                            text = mensajeError,
                            color = MaterialTheme.colorScheme.error,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            modifier = Modifier.padding(top = 8.dp)
                        )
                    }
                }
            } else {
                // PANTALLA 2: CONTROL DE ÉXITO CONFIRMADO
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Surface(
                        modifier = Modifier.size(if (pantallaPequeña) 100.dp else 130.dp),
                        shape = CircleShape,
                        color = colorVerdeExito.copy(alpha = 0.15f)
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Default.CheckCircle,
                                contentDescription = null,
                                tint = colorVerdeExito,
                                modifier = Modifier.size(if (pantallaPequeña) 50.dp else 65.dp)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    Text(
                        text = "¡Enlace Completado!",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Black,
                        color = colorTextoPrincipal
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = "El dispositivo se ha enlazado localmente con éxito. Las rutinas creadas se sincronizarán inmediatamente con la tablet de $childName.",
                        fontSize = 15.sp,
                        color = colorTextoSecundario,
                        textAlign = TextAlign.Center,
                        lineHeight = 22.sp,
                        modifier = Modifier.padding(horizontal = 16.dp)
                    )
                }
            }
        }

        // --- SECCIÓN INFERIOR DE ACCIONES ADAPTATIVA ---
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(colorSuperficie)
                .padding(horizontal = 24.dp, vertical = if (pantallaPequeña) 12.dp else 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Button(
                onClick = {
                    if (!isPaired) {
                        if (pairingCode.length == 6) {
                            mensajeError = ""
                            estaConectando = true

                            val parentId = currentParentId.ifEmpty { LocalDataManager.getCurrentUserId() }
                            kotlin.concurrent.thread {
                                val result = LocalDataManager.linkDeviceToParent(pairingCode, parentId)
                                (context as? android.app.Activity)?.runOnUiThread {
                                    estaConectando = false
                                    if (result.first) {
                                        isPaired = true
                                    } else {
                                        mensajeError = result.second
                                    }
                                }
                            }
                        } else {
                            mensajeError = "Introduce los 6 números obligatorios."
                        }
                    } else {
                        onNavigateToDashboard()
                    }
                },
                enabled = !estaConectando,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(if (pantallaPequeña) 54.dp else 60.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (!isPaired) colorAzulTEA else colorVerdeExito
                ),
                elevation = ButtonDefaults.buttonElevation(defaultElevation = 2.dp)
            ) {
                if (estaConectando) {
                    CircularProgressIndicator(
                        color = Color.White,
                        modifier = Modifier.size(24.dp),
                        strokeWidth = 2.dp
                    )
                } else {
                    Text(
                        text = if (!isPaired) "VINCULAR TABLET" else "IR AL DASHBOARD",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Black,
                        color = Color.White
                    )
                }
            }

            if (!isPaired) {
                TextButton(
                    onClick = onNavigateToDashboard,
                    modifier = Modifier.padding(top = 8.dp)
                ) {
                    Text(
                        text = "Omitir por ahora",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = colorTextoSecundario
                    )
                }
            }
        }
    }
}

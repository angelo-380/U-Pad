package com.example.upad.auth

import android.util.Log
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.upad.data.FirebaseRepository
import com.example.upad.data.LocalDataManager
import com.example.upad.utils.PasswordValidator
import com.example.upad.utils.rememberDebouncedClick
import kotlinx.coroutines.launch

@Composable
fun RegisterScreen(
    onRegisterComplete: (String, String) -> Unit,
    onBackClick: () -> Unit
) {
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val repository = remember { FirebaseRepository() }
    val keyboardController = LocalSoftwareKeyboardController.current
    val focusManager = LocalFocusManager.current

    val colorAzulTEA = MaterialTheme.colorScheme.primary
    val colorFondoBase = Color(0xFFF0F4F8)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(colorFondoBase)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(bottomStart = 45.dp, bottomEnd = 45.dp))
                .background(Color.White)
                .padding(start = 24.dp, top = 40.dp, end = 24.dp, bottom = 32.dp)
        ) {
            IconButton(onClick = onBackClick) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Atrás", tint = colorAzulTEA)
            }
            Text(
                text = "NUEVA CUENTA",
                fontSize = 12.sp,
                fontWeight = FontWeight.Black,
                color = Color.LightGray,
                modifier = Modifier.padding(start = 12.dp)
            )
            Text(
                text = "Únete a U-Pad",
                fontSize = 32.sp,
                fontWeight = FontWeight.Black,
                color = colorAzulTEA,
                modifier = Modifier.padding(horizontal = 12.dp)
            )
        }

        Column(
            modifier = Modifier
                .weight(1f)
                .padding(horizontal = 32.dp),
            verticalArrangement = Arrangement.Center
        ) {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text("Nombre completo") },
                leadingIcon = { Icon(Icons.Default.Person, contentDescription = null, tint = colorAzulTEA) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                enabled = !isLoading,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = colorAzulTEA,
                    unfocusedContainerColor = Color.White,
                    focusedContainerColor = Color.White
                ),
                singleLine = true
            )

            Spacer(modifier = Modifier.height(16.dp))

            OutlinedTextField(
                value = email,
                onValueChange = { email = it },
                label = { Text("Correo electrónico") },
                leadingIcon = { Icon(Icons.Default.Email, contentDescription = null, tint = colorAzulTEA) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                enabled = !isLoading,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = colorAzulTEA,
                    unfocusedContainerColor = Color.White,
                    focusedContainerColor = Color.White
                ),
                singleLine = true
            )

            Spacer(modifier = Modifier.height(16.dp))

            OutlinedTextField(
                value = password,
                onValueChange = { password = it },
                label = { Text("Contraseña / Password") },
                leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = colorAzulTEA) },
                modifier = Modifier.fillMaxWidth(),
                visualTransformation = PasswordVisualTransformation(),
                shape = RoundedCornerShape(20.dp),
                enabled = !isLoading,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = colorAzulTEA,
                    unfocusedContainerColor = Color.White,
                    focusedContainerColor = Color.White
                ),
                singleLine = true
            )

            Text(
                text = "Requiere mín. 8 caracteres, 1 mayúscula, 1 número y 1 símbolo especial",
                fontSize = 11.sp,
                color = Color.Gray,
                modifier = Modifier.padding(start = 12.dp, top = 4.dp)
            )

            Spacer(modifier = Modifier.height(30.dp))

            val debouncedRegister = rememberDebouncedClick(debounceIntervalMs = 1200L) {
                keyboardController?.hide()
                focusManager.clearFocus()

                if (isLoading) return@rememberDebouncedClick

                if (name.isBlank() || email.isBlank() || password.isBlank()) {
                    Toast.makeText(context, "Por favor, completa todos los campos", Toast.LENGTH_SHORT).show()
                    return@rememberDebouncedClick
                }

                // Validación estricta de política de seguridad de contraseña
                val validation = PasswordValidator.validate(password)
                if (!validation.isValid) {
                    Toast.makeText(context, validation.errorMessage, Toast.LENGTH_LONG).show()
                    return@rememberDebouncedClick
                }

                isLoading = true
                Log.d("UPAD_DEBUG", "SUBMIT REGISTER - Email: $email")

                scope.launch(kotlinx.coroutines.Dispatchers.IO) {
                    val localUserRes = LocalDataManager.register(name.trim(), email.trim(), password.trim())
                    kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) {
                        isLoading = false
                        if (localUserRes.isSuccess) {
                            val userId = localUserRes.getOrNull()?.uid ?: "local_user_1"
                            scope.launch {
                                try { repository.saveUserData(userId, name) } catch (e: Exception) {}
                            }
                            Toast.makeText(context, "¡Cuenta creada exitosamente!", Toast.LENGTH_SHORT).show()
                            onRegisterComplete(email, password)
                        } else {
                            val errorMsg = localUserRes.exceptionOrNull()?.message ?: "Error al registrar la cuenta"
                            Toast.makeText(context, errorMsg, Toast.LENGTH_LONG).show()
                        }
                    }
                }
            }

            Button(
                onClick = debouncedRegister,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(65.dp),
                shape = RoundedCornerShape(22.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isLoading) Color.Gray else colorAzulTEA
                ),
                enabled = !isLoading,
                elevation = ButtonDefaults.buttonElevation(defaultElevation = 4.dp)
            ) {
                if (isLoading) {
                    CircularProgressIndicator(
                        color = Color.White,
                        modifier = Modifier.size(24.dp),
                        strokeWidth = 2.dp
                    )
                } else {
                    Text(
                        text = "CREAR CUENTA",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black
                    )
                }
            }
        }
    }
}

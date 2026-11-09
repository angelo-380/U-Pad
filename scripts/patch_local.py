import os

# Update MainActivity.kt
path_main = r"app/src/main/java/com/example/upad/MainActivity.kt"
with open(path_main, "r", encoding="utf-8") as f:
    text = f.read()

# Replace kiosco listener
old_kiosco = """        kioscoListener = firestore.collection("dispositivos_niños").document(deviceId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) return@addSnapshotListener
                if (snapshot != null && snapshot.exists()) {
                    val kioscoActivo = snapshot.getBoolean("kioscoActivo") ?: false
                    ordenBloqueoPadreActiva = kioscoActivo
                } else {
                    ordenBloqueoPadreActiva = false
                }
            }"""

new_kiosco = """        try {
            kioscoListener = com.example.upad.data.LocalDataManager.listenChildDevice(deviceId) { dev ->
                ordenBloqueoPadreActiva = dev?.kioscoActivo ?: false
            }
        } catch (e: Exception) {
            ordenBloqueoPadreActiva = false
        }"""

text = text.replace(old_kiosco, new_kiosco)
text = text.replace(old_kiosco.replace("\r\n", "\n"), new_kiosco)

# Replace destination check
old_dest = "val usuarioLogueado = auth.currentUser != null"
new_dest = "val usuarioLogueado = auth.currentUser != null || com.example.upad.data.LocalDataManager.isLoggedIn()"
text = text.replace(old_dest, new_dest)

# Replace empty fallback UIDs
text = text.replace('FirebaseAuth.getInstance().currentUser?.uid ?: ""', 'FirebaseAuth.getInstance().currentUser?.uid ?: com.example.upad.data.LocalDataManager.getCurrentUserId()')
text = text.replace('FirebaseAuth.getInstance().currentUser?.uid ?: "PADRE_TEST"', 'FirebaseAuth.getInstance().currentUser?.uid ?: com.example.upad.data.LocalDataManager.getCurrentUserId()')

# Add fallback auth listener
old_auth_listener = """            LaunchedEffect(routineViewModel) {
                FirebaseAuth.getInstance().addAuthStateListener { auth ->
                    val user = auth.currentUser
                    if (user != null) {
                        val sharedPrefs = getSharedPreferences("UPadPrefs", Context.MODE_PRIVATE)
                        val rol = sharedPrefs.getString("rol_usuario", null)
                        if (rol == "padre" || rol == "padre_directo") {
                            iniciarEscuchaNotificacionesPadre(user.uid)
                            iniciarEscuchaPremiumPadre(user.uid, routineViewModel)
                        }
                    } else {
                        notificationsListener?.remove()
                        parentPremiumListener?.remove()
                    }
                }
            }"""

new_auth_listener = """            LaunchedEffect(routineViewModel) {
                val currentUid = FirebaseAuth.getInstance().currentUser?.uid ?: com.example.upad.data.LocalDataManager.getCurrentUserId()
                val sharedPrefs = getSharedPreferences("UPadPrefs", Context.MODE_PRIVATE)
                val rol = sharedPrefs.getString("rol_usuario", null)
                if (rol == "padre" || rol == "padre_directo") {
                    iniciarEscuchaNotificacionesPadre(currentUid)
                    iniciarEscuchaPremiumPadre(currentUid, routineViewModel)
                }
            }"""

text = text.replace(old_auth_listener, new_auth_listener)
text = text.replace(old_auth_listener.replace("\r\n", "\n"), new_auth_listener)

with open(path_main, "w", encoding="utf-8") as f:
    f.write(text)
print("MainActivity patched successfully")

# Patch RoleSelectionScreen.kt
path_role = r"app/src/main/java/com/example/upad/auth/RoleSelectionScreen.kt"
with open(path_role, "r", encoding="utf-8") as f:
    role_text = f.read()

role_text = role_text.replace(
    "if (usuarioFirebase != null) {",
    "if (usuarioFirebase != null || com.example.upad.data.LocalDataManager.isLoggedIn()) {"
)

with open(path_role, "w", encoding="utf-8") as f:
    f.write(role_text)
print("RoleSelectionScreen patched successfully")

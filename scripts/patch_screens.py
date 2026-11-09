# Patch ConnectionScreen.kt
path_conn = r"app/src/main/java/com/example/upad/dashboard/ConnectionScreen.kt"
with open(path_conn, "r", encoding="utf-8") as f:
    text = f.read()

# Update idPadre
old_id = 'val idPadre = remember { FirebaseAuth.getInstance().currentUser?.uid ?: "" }'
new_id = 'val idPadre = remember { FirebaseAuth.getInstance().currentUser?.uid ?: com.example.upad.data.LocalDataManager.getCurrentUserId() }'
text = text.replace(old_id, new_id)

# Update listener
old_listener = """    DisposableEffect(idPadre) {
        val listener = firestore.collection("dispositivos_niños")
            .whereEqualTo("padreId", idPadre)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    cargandoVerificacion = false
                    return@addSnapshotListener
                }
                listaDispositivos.clear()
                if (snapshot != null) {
                    for (dispositivo in snapshot.documents) {
                        val model = dispositivo.getString("modelo") ?: "Dispositivo del Niño"
                        listaDispositivos.add(DispositivoVinculado(id = dispositivo.id, modelo = model))
                    }
                }
                cargandoVerificacion = false
            }

        onDispose {
            listener.remove()
        }
    }"""

new_listener = """    DisposableEffect(idPadre) {
        val listener = com.example.upad.data.LocalDataManager.listenParentDevices(idPadre) { devs ->
            listaDispositivos.clear()
            for (d in devs) {
                listaDispositivos.add(DispositivoVinculado(id = d.deviceId, modelo = d.modelo))
            }
            cargandoVerificacion = false
        }

        onDispose {
            listener.remove()
        }
    }"""

text = text.replace(old_listener, new_listener)
text = text.replace(old_listener.replace("\r\n", "\n"), new_listener)

# Update linking button action
old_link = """                                            if (codigoIngresado.length == 6) {
                                                mensajeError = ""
                                                firestore.collection("codigos_vinculacion").document(codigoIngresado)
                                                    .get()
                                                    .addOnSuccessListener { snapshot ->
                                                        if (snapshot.exists()) {
                                                            val actualizaciones = mapOf(
                                                                "estado" to "enlazado",
                                                                "padreId" to idPadre
                                                            )
                                                            firestore.collection("codigos_vinculacion").document(codigoIngresado)
                                                                .update(actualizaciones)
                                                                .addOnSuccessListener {
                                                                    codigoIngresado = ""
                                                                    onLinkSuccess()
                                                                }
                                                                .addOnFailureListener {
                                                                    mensajeError = context.getString(R.string.network_error_linking)
                                                                }
                                                        } else {
                                                            mensajeError = context.getString(R.string.code_invalid_expired)
                                                        }
                                                    }
                                                    .addOnFailureListener {
                                                        mensajeError = context.getString(R.string.network_error_linking)
                                                    }
                                            } else {"""

new_link = """                                            if (codigoIngresado.length == 6) {
                                                mensajeError = ""
                                                com.example.upad.data.LocalDataManager.linkDeviceToParent(codigoIngresado, idPadre)
                                                codigoIngresado = ""
                                                onLinkSuccess()
                                            } else {"""

text = text.replace(old_link, new_link)
text = text.replace(old_link.replace("\r\n", "\n"), new_link)

with open(path_conn, "w", encoding="utf-8") as f:
    f.write(text)
print("ConnectionScreen patched successfully")

# Patch DeviceManagementScreen.kt
path_dev = r"app/src/main/java/com/example/upad/dashboard/DeviceManagementScreen.kt"
with open(path_dev, "r", encoding="utf-8") as f:
    dev_text = f.read()

old_dev_id = 'val idPadre = remember { FirebaseAuth.getInstance().currentUser?.uid ?: "" }'
new_dev_id = 'val idPadre = remember { FirebaseAuth.getInstance().currentUser?.uid ?: com.example.upad.data.LocalDataManager.getCurrentUserId() }'
dev_text = dev_text.replace(old_dev_id, new_dev_id)

old_dev_listener = """    DisposableEffect(idPadre) {
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
    }"""

new_dev_listener = """    DisposableEffect(idPadre) {
        val listener = com.example.upad.data.LocalDataManager.listenParentDevices(idPadre) { devs ->
            listaDispositivos = devs.map { DispositivoNiño(it.deviceId, it.modelo, it.kioscoActivo) }
            cargando = false
        }

        onDispose {
            listener.remove()
        }
    }"""

dev_text = dev_text.replace(old_dev_listener, new_dev_listener)
dev_text = dev_text.replace(old_dev_listener.replace("\r\n", "\n"), new_dev_listener)

with open(path_dev, "w", encoding="utf-8") as f:
    f.write(dev_text)
print("DeviceManagementScreen patched successfully")

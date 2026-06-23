package com.example.upad.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.util.Log
import android.view.View
import android.widget.RemoteViews
import com.example.upad.MainActivity
import com.example.upad.R
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class DeviceLockWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            actualizarWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        val action = intent.action
        if (action == ACTION_REFRESH || action == ParentRoutineWidgetProvider.ACTION_DATA_CHANGED) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val componentName = ComponentName(context, DeviceLockWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
            for (appWidgetId in appWidgetIds) {
                actualizarWidget(context, appWidgetManager, appWidgetId, forzarActualizacion = (action == ACTION_REFRESH))
            }
        } else if (action == ACTION_TOGGLE_LOCK) {
            val deviceId = intent.getStringExtra(EXTRA_DEVICE_ID)
            val currentState = intent.getBooleanExtra(EXTRA_CURRENT_STATE, false)
            val appWidgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)

            if (deviceId != null && appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                val nuevoEstado = !currentState
                CoroutineScope(Dispatchers.IO).launch {
                    try {
                        val db = FirebaseFirestore.getInstance()
                        db.collection("dispositivos_niños")
                            .document(deviceId)
                            .update("kioscoActivo", nuevoEstado)
                            .await()

                        // Refrescar inmediatamente el widget para mostrar el nuevo estado
                        val appWidgetManager = AppWidgetManager.getInstance(context)
                        actualizarWidget(context, appWidgetManager, appWidgetId, forzarActualizacion = true)
                    } catch (e: Exception) {
                        Log.e("DeviceLockWidget", "Error al cambiar estado de bloqueo", e)
                    }
                }
            }
        }
    }

    companion object {
        const val ACTION_REFRESH = "com.example.upad.widget.lock.ACTION_REFRESH"
        const val ACTION_TOGGLE_LOCK = "com.example.upad.widget.lock.ACTION_TOGGLE_LOCK"
        const val EXTRA_DEVICE_ID = "com.example.upad.widget.lock.EXTRA_DEVICE_ID"
        const val EXTRA_CURRENT_STATE = "com.example.upad.widget.lock.EXTRA_CURRENT_STATE"

        fun notificarCambioDatos(context: Context) {
            val intent = Intent(context, DeviceLockWidgetProvider::class.java).apply {
                action = ParentRoutineWidgetProvider.ACTION_DATA_CHANGED
            }
            context.sendBroadcast(intent)
        }

        private fun actualizarWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int,
            forzarActualizacion: Boolean = false
        ) {
            val views = RemoteViews(context.packageName, R.layout.widget_device_lock)

            // Configurar PendingIntent para abrir la App al tocar el fondo del widget
            val openAppIntent = Intent(context, MainActivity::class.java)
            val flagImmutable = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
            val openAppPendingIntent = PendingIntent.getActivity(
                context,
                appWidgetId * 10 + 0,
                openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or flagImmutable
            )
            views.setOnClickPendingIntent(R.id.widget_lock_background, openAppPendingIntent)

            // Configurar PendingIntent para el botón de refresco
            val refreshIntent = Intent(context, DeviceLockWidgetProvider::class.java).apply {
                action = ACTION_REFRESH
            }
            val refreshPendingIntent = PendingIntent.getBroadcast(
                context,
                appWidgetId * 10 + 1,
                refreshIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or flagImmutable
            )
            views.setOnClickPendingIntent(R.id.btn_refresh_lock_widget, refreshPendingIntent)

            // Leer de caché rápida
            val prefs = context.getSharedPreferences("DEVICE_LOCK_WIDGET_PREFS", Context.MODE_PRIVATE)
            val deviceCount = prefs.getInt("DEVICE_COUNT", 0)

            // Renderizar con datos cacheados
            if (deviceCount == 0) {
                views.setViewVisibility(R.id.tv_empty_devices, View.VISIBLE)
                views.setViewVisibility(R.id.layout_device_1, View.GONE)
                views.setViewVisibility(R.id.layout_device_2, View.GONE)
            } else {
                views.setViewVisibility(R.id.tv_empty_devices, View.GONE)

                // Dispositivo 1
                views.setViewVisibility(R.id.layout_device_1, View.VISIBLE)
                val dev1Id = prefs.getString("DEV_1_ID", "") ?: ""
                val dev1Name = prefs.getString("DEV_1_NAME", "Dispositivo 1") ?: "Dispositivo 1"
                val dev1Locked = prefs.getBoolean("DEV_1_LOCKED", false)

                views.setTextViewText(R.id.tv_device_1_name, dev1Name)
                if (dev1Locked) {
                    views.setTextViewText(R.id.tv_device_1_status, "Estado: BLOQUEADO 🔒")
                    views.setTextColor(R.id.tv_device_1_status, Color.parseColor("#E53935")) // Red
                    views.setTextViewText(R.id.btn_device_1_action, "LIBERAR")
                    views.setInt(R.id.btn_device_1_action, "setBackgroundResource", R.drawable.widget_btn_unlock_bg)
                } else {
                    views.setTextViewText(R.id.tv_device_1_status, "Estado: LIBRE 🔓")
                    views.setTextColor(R.id.tv_device_1_status, Color.parseColor("#43A047")) // Green
                    views.setTextViewText(R.id.btn_device_1_action, "BLOQUEAR")
                    views.setInt(R.id.btn_device_1_action, "setBackgroundResource", R.drawable.widget_btn_lock_bg)
                }

                // Registrar clic para Dispositivo 1
                val intent1 = Intent(context, DeviceLockWidgetProvider::class.java).apply {
                    action = ACTION_TOGGLE_LOCK
                    putExtra(EXTRA_DEVICE_ID, dev1Id)
                    putExtra(EXTRA_CURRENT_STATE, dev1Locked)
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
                }
                val pending1 = PendingIntent.getBroadcast(
                    context,
                    appWidgetId * 100 + 2,
                    intent1,
                    PendingIntent.FLAG_UPDATE_CURRENT or flagImmutable
                )
                views.setOnClickPendingIntent(R.id.btn_device_1_action, pending1)

                // Dispositivo 2
                if (deviceCount >= 2) {
                    views.setViewVisibility(R.id.layout_device_2, View.VISIBLE)
                    val dev2Id = prefs.getString("DEV_2_ID", "") ?: ""
                    val dev2Name = prefs.getString("DEV_2_NAME", "Dispositivo 2") ?: "Dispositivo 2"
                    val dev2Locked = prefs.getBoolean("DEV_2_LOCKED", false)

                    views.setTextViewText(R.id.tv_device_2_name, dev2Name)
                    if (dev2Locked) {
                        views.setTextViewText(R.id.tv_device_2_status, "Estado: BLOQUEADO 🔒")
                        views.setTextColor(R.id.tv_device_2_status, Color.parseColor("#E53935"))
                        views.setTextViewText(R.id.btn_device_2_action, "LIBERAR")
                        views.setInt(R.id.btn_device_2_action, "setBackgroundResource", R.drawable.widget_btn_unlock_bg)
                    } else {
                        views.setTextViewText(R.id.tv_device_2_status, "Estado: LIBRE 🔓")
                        views.setTextColor(R.id.tv_device_2_status, Color.parseColor("#43A047"))
                        views.setTextViewText(R.id.btn_device_2_action, "BLOQUEAR")
                        views.setInt(R.id.btn_device_2_action, "setBackgroundResource", R.drawable.widget_btn_lock_bg)
                    }

                    // Registrar clic para Dispositivo 2
                    val intent2 = Intent(context, DeviceLockWidgetProvider::class.java).apply {
                        action = ACTION_TOGGLE_LOCK
                        putExtra(EXTRA_DEVICE_ID, dev2Id)
                        putExtra(EXTRA_CURRENT_STATE, dev2Locked)
                        putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
                    }
                    val pending2 = PendingIntent.getBroadcast(
                        context,
                        appWidgetId * 100 + 3,
                        intent2,
                        PendingIntent.FLAG_UPDATE_CURRENT or flagImmutable
                    )
                    views.setOnClickPendingIntent(R.id.btn_device_2_action, pending2)
                } else {
                    views.setViewVisibility(R.id.layout_device_2, View.GONE)
                }
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)

            // Consultar a Firestore si es forzado o si la caché tiene más de 5 minutos
            val ultimoFetch = prefs.getLong("ULTIMO_FETCH", 0)
            val tiempoActual = System.currentTimeMillis()

            if (forzarActualizacion || (tiempoActual - ultimoFetch > 5 * 60 * 1000)) {
                CoroutineScope(Dispatchers.IO).launch {
                    val userId = FirebaseAuth.getInstance().currentUser?.uid
                    if (userId != null) {
                        try {
                            val db = FirebaseFirestore.getInstance()
                            val querySnapshot = db.collection("dispositivos_niños")
                                .whereEqualTo("padreId", userId)
                                .get()
                                .await()

                            val editor = prefs.edit()
                            if (querySnapshot.isEmpty) {
                                editor.putInt("DEVICE_COUNT", 0)
                            } else {
                                val docs = querySnapshot.documents
                                editor.putInt("DEVICE_COUNT", docs.size)

                                if (docs.size >= 1) {
                                    val doc1 = docs[0]
                                    val name1 = doc1.getString("nombreDispositivo")
                                        ?: doc1.getString("modelo")
                                        ?: "Tablet/Celular Niño"
                                    editor.putString("DEV_1_ID", doc1.id)
                                    editor.putString("DEV_1_NAME", name1)
                                    editor.putBoolean("DEV_1_LOCKED", doc1.getBoolean("kioscoActivo") ?: false)
                                }
                                if (docs.size >= 2) {
                                    val doc2 = docs[1]
                                    val name2 = doc2.getString("nombreDispositivo")
                                        ?: doc2.getString("modelo")
                                        ?: "Tablet/Celular Niño"
                                    editor.putString("DEV_2_ID", doc2.id)
                                    editor.putString("DEV_2_NAME", name2)
                                    editor.putBoolean("DEV_2_LOCKED", doc2.getBoolean("kioscoActivo") ?: false)
                                }
                            }
                            editor.putLong("ULTIMO_FETCH", tiempoActual)
                            editor.apply()

                            // Actualizar UI con datos de Firestore
                            actualizarWidget(context, appWidgetManager, appWidgetId, forzarActualizacion = false)
                        } catch (e: Exception) {
                            Log.e("DeviceLockWidget", "Error cargando dispositivos desde Firestore", e)
                        }
                    }
                }
            }
        }
    }
}

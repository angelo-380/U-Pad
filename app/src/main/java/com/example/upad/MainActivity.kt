package com.example.upad

import android.app.Activity
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.view.WindowInsets
import android.view.WindowManager
import androidx.activity.compose.setContent
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowInsetsControllerCompat
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.upad.ui.theme.UPadTheme
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.example.upad.dashboard.HijoTrackingScreen
import com.example.upad.auth.ForgotPasswordScreen
import com.example.upad.data.ListenerRegistration
import com.example.upad.auth.LoginScreen
import com.example.upad.auth.RegisterScreen
import com.example.upad.auth.RoleSelectionScreen
import com.example.upad.auth.WelcomeScreen
import com.example.upad.child.ChildStartScreen
import com.example.upad.child.RoutineCompletedScreen
import com.example.upad.child.TaskExecutionScreen
import com.example.upad.child.TaskFeedbackScreen
import com.example.upad.dashboard.AchievementReportScreen
import com.example.upad.dashboard.ActivityDetailsScreen
import com.example.upad.dashboard.NotificationsScreen
import com.example.upad.dashboard.RoutineDashboardScreen
import com.example.upad.dashboard.DeviceManagementScreen
import com.example.upad.data.FirebaseRepository
import com.example.upad.routines.CreateRoutineScreen
import com.example.upad.routines.PictogramSelectionScreen
import com.example.upad.setup.ChildProfileSetupScreen
import com.example.upad.setup.DevicePairingScreen
import com.example.upad.setup.ExperienceSetupScreen
import com.example.upad.setup.SubscriptionPlansScreen
import com.example.upad.setup.TrialDisclaimerScreen
import com.example.upad.setup.TutorialsScreen
import com.example.upad.setup.ChangePlanScreen
import com.example.upad.dashboard.ProfileScreen
import com.example.upad.dashboard.SettingsScreen
import com.example.upad.viewmodel.RoutineViewModel
import com.example.upad.dashboard.ConnectionScreen
import com.example.upad.dashboard.AnalyticsScreen
import com.example.upad.premium.PaymentViewScreen
import android.content.Context
import android.content.Intent
import com.example.upad.components.UPADBottomBar
import com.example.upad.dashboard.EmotionsTrackScreen
import com.example.upad.dashboard.HelpTutorialScreen
import com.example.upad.dashboard.TodayCalendarScreen

class MainActivity : AppCompatActivity() {

    private var currentRoute = ""
    private var pendingLanguage = ""

    private var ordenBloqueoPadreActiva by mutableStateOf(false)
    private var kioscoListener: ListenerRegistration? = null
    private var notificationsListener: ListenerRegistration? = null
    private var escuchasPadreDe: String? = null
    private var parentPremiumListener: ListenerRegistration? = null
    private val listenerStartTime = System.currentTimeMillis()

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)

        createNotificationChannel()
        requestNotificationPermission()

        val deviceId = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)

        // Bloqueo kiosco: lo activa el padre en el servidor y este teléfono lo recibe en su consulta de estado (cada 2 s).
        // El teléfono del padre no consulta su propio estado.
        val rolInicial = getSharedPreferences("UPadPrefs", Context.MODE_PRIVATE).getString("rol_usuario", null)
        if (rolInicial != "padre" && rolInicial != "padre_directo" && !deviceId.isNullOrBlank()) {
            kioscoListener = com.example.upad.data.LocalDataManager.listenChildDevice(deviceId) { }
        }
        lifecycleScope.launch {
            com.example.upad.data.LocalDataManager.kioscoEsteDispositivo.collect { ordenBloqueoPadreActiva = it }
        }

        setContent {
            val repository = remember { FirebaseRepository() }
            val routineViewModel: RoutineViewModel = viewModel(
                factory = com.example.upad.viewmodel.RoutineViewModelFactory(repository)
            )

            LaunchedEffect(routineViewModel) {
                val currentUid = com.example.upad.data.LocalDataManager.getCurrentUserId()
                val sharedPrefs = getSharedPreferences("UPadPrefs", Context.MODE_PRIVATE)
                val rol = sharedPrefs.getString("rol_usuario", null)
                if (rol == "padre" || rol == "padre_directo") {
                    asegurarEscuchasPadre(currentUid, routineViewModel)
                }
            }

            val appLanguage by routineViewModel.appLanguage.collectAsState()
            LaunchedEffect(appLanguage) {
                evaluarYAplicarIdioma(appLanguage)
            }

            val sharedPrefs = remember { getSharedPreferences("UPadPrefs", Context.MODE_PRIVATE) }
            val sistemaEstaEnOscuro = isSystemInDarkTheme()

            val isDarkModeFlow by routineViewModel.isDarkMode.collectAsState()
            var estadoTemaOscuroReal by remember {
                mutableStateOf(sharedPrefs.getBoolean("pref_tema_oscuro", sistemaEstaEnOscuro))
            }

            LaunchedEffect(isDarkModeFlow) {
                estadoTemaOscuroReal = isDarkModeFlow
                sharedPrefs.edit().putBoolean("pref_tema_oscuro", isDarkModeFlow).apply()
            }

            val isPremiumUser by routineViewModel.isUserPremium.collectAsState(initial = null)

            UPadTheme(darkTheme = estadoTemaOscuroReal, isPremium = isPremiumUser ?: false) {
                UPadNavigation(
                    bloqueoActivo = ordenBloqueoPadreActiva,
                    routineViewModel = routineViewModel,
                    isPremiumListo = isPremiumUser != null,
                    onCambiarEstadoSistema = ::gestionarRestriccionesSistema,
                    onSesionPadreLista = { uid -> asegurarEscuchasPadre(uid, routineViewModel) },
                    onRouteChanged = { route ->
                        currentRoute = route
                        if (pendingLanguage.isNotEmpty() && esRutaSeguraParaIdioma(route)) {
                            aplicarLocale(pendingLanguage)
                            pendingLanguage = ""
                        }
                    }
                )
            }
        }
    }

    private fun evaluarYAplicarIdioma(idiomaCode: String) {
        if (esRutaSeguraParaIdioma(currentRoute)) {
            aplicarLocale(idiomaCode)
        } else {
            pendingLanguage = idiomaCode
        }
    }

    private fun esRutaSeguraParaIdioma(route: String): Boolean {
        if (route.isEmpty()) return true
        val esTareaActiva = route.contains("child_task_execution") || route.contains("child_task_feedback")
        return !esTareaActiva
    }

    private fun aplicarLocale(idiomaCode: String) {
        val appLocale = LocaleListCompat.forLanguageTags(idiomaCode)
        val currentLocales = AppCompatDelegate.getApplicationLocales()
        if (currentLocales != appLocale) {
            AppCompatDelegate.setApplicationLocales(appLocale)
        }

        // Guardar idioma para los widgets
        try {
            val widgetPrefs = getSharedPreferences("WIDGET_PREFS", Context.MODE_PRIVATE)
            widgetPrefs.edit().putString("app_language", idiomaCode).apply()

            val sessionPrefs = getSharedPreferences("SESSION_WIDGET_PREFS", Context.MODE_PRIVATE)
            sessionPrefs.edit().putString("app_language", idiomaCode).apply()

            // Notificar a los widgets para que se redibujen con el nuevo idioma
            com.example.upad.widget.ParentRoutineWidgetProvider.notificarCambioDatos(this)
            com.example.upad.widget.PremiumProgressWidgetProvider.notificarCambioDatos(this)

            val intent = Intent(this, com.example.upad.widget.ChildSessionMonitorWidgetProvider::class.java).apply {
                action = com.example.upad.widget.ParentRoutineWidgetProvider.ACTION_DATA_CHANGED
            }
            sendBroadcast(intent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun gestionarRestriccionesSistema(activarFijacionKiosco: Boolean) {
        if (activarFijacionKiosco) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                window.insetsController?.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
            } else {
                @Suppress("DEPRECATION")
                window.decorView.systemUiVisibility = (
                        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                                or View.SYSTEM_UI_FLAG_FULLSCREEN
                        )
            }
            try { startLockTask() } catch (e: Exception) { e.printStackTrace() }
        } else {
            try {
                stopLockTask()
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    window.insetsController?.show(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                } else {
                    @Suppress("DEPRECATION")
                    window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
                }
                window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            } catch (e: Exception) { e.printStackTrace() }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "Notificaciones de Rutina"
            val descriptionText = "Alertas sobre el estado de las rutinas del niño"
            val importance = android.app.NotificationManager.IMPORTANCE_HIGH
            val channel = android.app.NotificationChannel("upad_notifications_channel", name, importance).apply {
                description = descriptionText
            }
            val notificationManager: android.app.NotificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (androidx.core.content.ContextCompat.checkSelfPermission(
                    this,
                    android.Manifest.permission.POST_NOTIFICATIONS
                ) != android.content.pm.PackageManager.PERMISSION_GRANTED
            ) {
                androidx.core.app.ActivityCompat.requestPermissions(
                    this,
                    arrayOf(android.Manifest.permission.POST_NOTIFICATIONS),
                    1001
                )
            }
        }
    }

    /**
     * Avisos del niño para el padre (GET /api/v1/notificaciones cada 15 s): la primera consulta solo marca el punto
     * de partida; después, cada aviso nuevo sin leer se muestra como notificación del sistema.
     */
    /** Arranca (una vez por cuenta) la consulta de avisos y la escucha del plan del padre con sesión. */
    private fun asegurarEscuchasPadre(userId: String, routineViewModel: RoutineViewModel) {
        if (userId.isEmpty() || userId == com.example.upad.data.LocalDataManager.SIN_SESION) return
        if (userId == escuchasPadreDe) return
        escuchasPadreDe = userId
        iniciarEscuchaNotificacionesPadre(userId)
        iniciarEscuchaPremiumPadre(userId, routineViewModel)
    }

    private fun iniciarEscuchaNotificacionesPadre(userId: String) {
        notificationsListener?.remove()
        if (userId.isEmpty() || userId == com.example.upad.data.LocalDataManager.SIN_SESION) return

        val ldm = com.example.upad.data.LocalDataManager
        var activo = true
        kotlin.concurrent.thread(isDaemon = true, name = "upad-avisos-padre") {
            while (activo) {
                // Marca guardada en el teléfono: avisos ya notificados (sobrevive a cerrar la app).
                val marca = ldm.getUltimoAvisoNotificado(userId)
                val avisos = ldm.obtenerAvisos(if (marca > 0L) ldm.fechaIso(marca) else null)
                if (avisos == null) {
                    android.util.Log.w("UPadAvisos", "No se pudieron consultar los avisos")
                } else {
                    val maxima = avisos.maxOfOrNull { it.creadoEnMs } ?: 0L
                    if (marca == 0L) {
                        // Primera vez en este teléfono: no se notifica el historial, solo lo posterior.
                        ldm.setUltimoAvisoNotificado(userId, maxOf(maxima, 1L))
                    } else {
                        val nuevos = avisos.filter { !it.leida && it.creadoEnMs > marca }.sortedBy { it.creadoEnMs }
                        android.util.Log.d("UPadAvisos", "Avisos recibidos: ${avisos.size}, nuevos sin leer: ${nuevos.size}")
                        if (nuevos.isNotEmpty()) {
                            runOnUiThread { nuevos.forEach { mostrarNotificacionLocal(it.titulo, it.descripcion) } }
                        }
                        if (maxima > marca) ldm.setUltimoAvisoNotificado(userId, maxima)
                    }
                }
                try {
                    // Cada 15 s: el aviso de salida de la zona segura (bloque W) llega en unos 25 s como máximo
                    Thread.sleep(15_000L)
                } catch (e: InterruptedException) {
                    break
                }
            }
        }
        notificationsListener = ListenerRegistration { activo = false }
    }

    private fun mostrarNotificacionLocal(title: String, description: String) {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = android.app.PendingIntent.getActivity(
            this,
            0,
            intent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                android.app.PendingIntent.FLAG_IMMUTABLE or android.app.PendingIntent.FLAG_UPDATE_CURRENT
            } else {
                android.app.PendingIntent.FLAG_UPDATE_CURRENT
            }
        )

        val builder = androidx.core.app.NotificationCompat.Builder(this, "upad_notifications_channel")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(description)
            .setPriority(androidx.core.app.NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)

        with(androidx.core.app.NotificationManagerCompat.from(this)) {
            try {
                val hasPermission = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    androidx.core.content.ContextCompat.checkSelfPermission(
                        this@MainActivity,
                        android.Manifest.permission.POST_NOTIFICATIONS
                    ) == android.content.pm.PackageManager.PERMISSION_GRANTED
                } else {
                    true
                }

                if (hasPermission) {
                    notify((System.currentTimeMillis() % 100000).toInt(), builder.build())
                }
            } catch (e: SecurityException) {
                e.printStackTrace()
            }
        }
    }

    private fun iniciarEscuchaPremiumPadre(userId: String, routineViewModel: RoutineViewModel) {
        parentPremiumListener?.remove()
        if (userId.isEmpty() || userId == "PADRE_TEST") return

        // El plan (premium o básico) se guarda en el teléfono
        parentPremiumListener = com.example.upad.data.LocalDataManager.listenUserPremium(userId) { isPremium ->
            routineViewModel.setPremiumUser(isPremium)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        kioscoListener?.remove()
        notificationsListener?.remove()
        parentPremiumListener?.remove()
    }

    val ROUTE_HELP = "help_tutorial"
}

// ── DESTINO INICIAL ──────────────────────────────────────────────────────────
private fun obtenerDestinoInicial(context: android.content.Context): String {
    val sharedPreferences = context.getSharedPreferences("UPadPrefs", android.content.Context.MODE_PRIVATE)
    val usuarioLogueado = com.example.upad.data.LocalDataManager.isLoggedIn()
    val rolGuardado = sharedPreferences.getString("rol_usuario", null)
    val esPadre = rolGuardado == "padre" || rolGuardado == "padre_directo"
    return when {
        rolGuardado.isNullOrEmpty() -> "role_selection"
        // El teléfono del niño no inicia sesión: vuelve directo a su pantalla (código o actividades).
        !esPadre -> "child_start"
        usuarioLogueado -> "parent_dashboard"
        else -> "role_selection"
    }
}


// ── NAVEGACIÓN ───────────────────────────────────────────────────────────────
@Composable
fun UPadNavigation(
    bloqueoActivo: Boolean,
    routineViewModel: RoutineViewModel,
    isPremiumListo: Boolean,
    onCambiarEstadoSistema: (Boolean) -> Unit,
    onSesionPadreLista: (String) -> Unit,
    onRouteChanged: (String) -> Unit
) {
    val navController = rememberNavController()
    val isDarkMode by routineViewModel.isDarkMode.collectAsState()

    var padreIdDelHijo by remember { mutableStateOf("") }

    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val rutaActual = navBackStackEntry?.destination?.route ?: ""
    val estaEnSeccionNiño = rutaActual.startsWith("child_")

    LaunchedEffect(rutaActual) { onRouteChanged(rutaActual) }

    // Si el servidor rechaza el token (cuenta borrada o desactivada, sesión vencida), se vuelve a la bienvenida.
    // El teléfono del niño no usa sesión, así que no se le saca de su pantalla.
    val sesionCaducada by com.example.upad.data.LocalDataManager.sesionCaducada.collectAsState()
    val contextoSesion = androidx.compose.ui.platform.LocalContext.current
    LaunchedEffect(sesionCaducada) {
        if (sesionCaducada && !estaEnSeccionNiño && rutaActual.isNotEmpty() && rutaActual != "sincronizando") {
            android.widget.Toast.makeText(contextoSesion, "Tu sesión terminó. Vuelve a iniciar sesión.", android.widget.Toast.LENGTH_LONG).show()
            navController.navigate("welcome") { popUpTo(0) { inclusive = true } }
        }
    }

    // Ubicación del niño en tiempo real mientras su app esté abierta (cualquier pantalla del niño)
    val niñoVinculado by routineViewModel.estaVinculado.collectAsState()
    com.example.upad.child.EnvioUbicacionNino(activo = estaEnSeccionNiño && niñoVinculado, routineViewModel = routineViewModel)

    LaunchedEffect(bloqueoActivo, estaEnSeccionNiño) {
        if (bloqueoActivo && estaEnSeccionNiño) onCambiarEstadoSistema(true)
        else onCambiarEstadoSistema(false)
    }

    val view = LocalView.current
    if (!view.isInEditMode && !(bloqueoActivo && estaEnSeccionNiño)) {
        val activity = view.context as Activity
        val window = activity.window
        window.statusBarColor = if (isDarkMode) android.graphics.Color.parseColor("#1E1E1E")
        else android.graphics.Color.TRANSPARENT
        val windowInsetsController = WindowInsetsControllerCompat(window, window.decorView)
        windowInsetsController.isAppearanceLightStatusBars = !isDarkMode
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        bottomBar = {
            UPADBottomBar(navController = navController, routineViewModel = routineViewModel)
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            val contextoNav = androidx.compose.ui.platform.LocalContext.current

            NavHost(navController = navController, startDestination = "sincronizando") {

                // ── SINCRONIZANDO ────────────────────────────────────────────
                composable("sincronizando") {
                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                    }
                    if (isPremiumListo) {
                        LaunchedEffect(Unit) {
                            val destinoReal = obtenerDestinoInicial(contextoNav)
                            navController.navigate(destinoReal) {
                                popUpTo("sincronizando") { inclusive = true }
                            }
                        }
                    }
                }

                // ── AUTH ─────────────────────────────────────────────────────
                composable("role_selection") {
                    val contextoRol = androidx.compose.ui.platform.LocalContext.current
                    RoleSelectionScreen(
                        onRoleSelected = { role: String ->
                            val sharedPrefs = contextoRol.getSharedPreferences("UPadPrefs", android.content.Context.MODE_PRIVATE)
                            when (role) {
                                "padre_directo" -> {
                                    sharedPrefs.edit().putString("rol_usuario", "padre_directo").apply()
                                    navController.navigate("parent_dashboard") {
                                        popUpTo("role_selection") { inclusive = true }
                                    }
                                }
                                "padre" -> {
                                    sharedPrefs.edit().putString("rol_usuario", "padre").apply()
                                    navController.navigate("welcome")
                                }
                                else -> {
                                    sharedPrefs.edit().putString("rol_usuario", "hijo").apply()
                                    navController.navigate("child_start")
                                }
                            }
                        }
                    )
                }

                composable("welcome") {
                    WelcomeScreen(
                        onNavigateToLogin = { navController.navigate("login") },
                        onNavigateToRegister = { navController.navigate("register") },
                        onLoginExitoso = {
                            navController.navigate("parent_dashboard") {
                                popUpTo("welcome") { inclusive = true }
                            }
                        }
                    )
                }

                composable("login") {
                    LoginScreen(
                        onLoginClick = { _, _ ->
                            // Con sesión iniciada, «atrás» no debe volver a la bienvenida ni al login.
                            navController.navigate("parent_dashboard") {
                                popUpTo(navController.graph.id) { inclusive = true }
                            }
                        },
                        onForgotPasswordClick = { navController.navigate("forgot_password") },
                        onBackClick = { navController.popBackStack() }
                    )
                }

                composable("register") {
                    RegisterScreen(
                        onRegisterComplete = { _, _ -> navController.navigate("subscription_plans") },
                        onBackClick = { navController.popBackStack() }
                    )
                }

                composable("forgot_password") {
                    ForgotPasswordScreen(onBackToLogin = { navController.popBackStack() })
                }

                // ── SETUP ────────────────────────────────────────────────────
                composable("subscription_plans") {
                    SubscriptionPlansScreen(
                        routineViewModel = routineViewModel,
                        onNavigateToBenefits = { navController.navigate("change_plan") },
                        onDirectToProfile = { navController.navigate("trial_disclaimer") }
                    )
                }

                composable("trial_disclaimer") {
                    TrialDisclaimerScreen(
                        onStartTrialClick = { navController.navigate("child_profile_setup") },
                        onMoreInfoClick = {}
                    )
                }

                composable("child_profile_setup") {
                    ChildProfileSetupScreen(
                        onBackClick = { navController.popBackStack() },
                        onSaveClick = { navController.navigate("experience_setup") }
                    )
                }

                composable("experience_setup") {
                    ExperienceSetupScreen(
                        routineViewModel = routineViewModel,
                        onBackClick = { navController.popBackStack() },
                        onNextClick = { navController.navigate("device_pairing") }
                    )
                }

                composable("device_pairing") {
                    DevicePairingScreen(
                        onNavigateToDashboard = { navController.navigate("parent_dashboard") }
                    )
                }

                composable("tutorials") {
                    TutorialsScreen(
                        onBackClick = { navController.popBackStack() },
                        onFinishSetupClick = { navController.navigate("parent_dashboard") }
                    )
                }

                composable("change_plan") {
                    ChangePlanScreen(
                        onBackClick = { navController.popBackStack() },
                        onNavigateToPayment = { navController.navigate("payment_view") }
                    )
                }

                composable("payment_view") {
                    PaymentViewScreen(
                        routineViewModel = routineViewModel,
                        onPaymentConfirmed = {
                            val uid = com.example.upad.data.LocalDataManager.getCurrentUserId()
                            routineViewModel.setSuscripcionManual(true, uid)
                            navController.navigate("parent_dashboard") {
                                popUpTo("parent_dashboard") { inclusive = true }
                            }
                        }
                    )
                }

                // ── DASHBOARD PADRE ──────────────────────────────────────────
                composable("parent_dashboard") {
                    LaunchedEffect(Unit) {
                        val uid = com.example.upad.data.LocalDataManager.getCurrentUserId()
                        routineViewModel.cargarRutinasDesdeFirebase(uid)
                        // Tras iniciar sesión (sin reiniciar la app) también deben arrancar los avisos y el plan.
                        onSesionPadreLista(uid)
                    }
                    RoutineDashboardScreen(
                        routineViewModel = routineViewModel,
                        onNavigateToCreateRoutine = { turn, day -> navController.navigate("create_routine/$turn/$day") },
                        onRoutineClick = { turn, day -> navController.navigate("create_routine/$turn/$day") },
                        onNavigateToProfile = { navController.navigate("profile") },
                        onNavigateToSettings = { navController.navigate("settings") },
                        onNavigateToConnection = { navController.navigate("connection_code") },
                        onNavigateToAnalytics = { navController.navigate("analytics") },
                        onNavigateToChangePlan = { navController.navigate("change_plan") },
                        onNavigateToTracking = { hijoId -> navController.navigate("tracking/$hijoId") },
                        onNavigateToHelp = { navController.navigate("help_tutorial") }
                    )
                }

                // ✅ FIX: help_tutorial ahora pasa onNavigateToHelp y onNavigateToProfile
                composable("help_tutorial") {
                    HelpTutorialScreen(
                        routineViewModel = routineViewModel,
                        onNavigateBack = { navController.popBackStack() },
                        onNavigateToHelp = { navController.navigate("help_tutorial") },
                        onNavigateToProfile = { navController.navigate("profile") }
                    )
                }

                composable("today_calendar") {
                    TodayCalendarScreen(
                        routineViewModel = routineViewModel,
                        onNavigateBack = { navController.popBackStack() },
                        onNavigateToHelp = { navController.navigate("help_tutorial") },
                        onNavigateToProfile = { navController.navigate("profile") }
                    )
                }

                composable("emotions_track") {
                    EmotionsTrackScreen(
                        routineViewModel = routineViewModel,
                        onNavigateBack = { navController.popBackStack() },
                        onNavigateToHelp = { navController.navigate("help_tutorial") },
                        onNavigateToProfile = { navController.navigate("profile") }
                    )
                }

                composable("notifications") {
                    NotificationsScreen(
                        routineViewModel = routineViewModel,
                        onNavigateBack = { navController.popBackStack() },
                        onNavigateToHelp = { navController.navigate("help_tutorial") },
                        onNavigateToProfile = { navController.navigate("profile") }
                    )
                }

                composable(
                    route = "tracking/{hijoId}",
                    arguments = listOf(navArgument("hijoId") { type = NavType.StringType })
                ) { backStackEntry ->
                    val hijoId = backStackEntry.arguments?.getString("hijoId") ?: ""
                    val trackingViewModel: com.example.upad.viewmodel.TrackingViewModel = viewModel()
                    HijoTrackingScreen(
                        routineViewModel = routineViewModel,
                        hijoId = hijoId,
                        trackingViewModel = trackingViewModel,
                        onNavigateBack = { navController.popBackStack() },
                        onNavigateToHelp = { navController.navigate("help_tutorial") },
                        onNavigateToProfile = { navController.navigate("profile") }
                    )
                }

                // ✅ FIX: profile ahora recibe onNavigateToHelp
                composable("profile") {
                    val contextoPerfil = androidx.compose.ui.platform.LocalContext.current
                    ProfileScreen(
                        routineViewModel = routineViewModel,
                        onNavigateBack = { navController.popBackStack() },
                        onLogoutSuccess = {
                            val sharedPrefs = contextoPerfil.getSharedPreferences("UPadPrefs", android.content.Context.MODE_PRIVATE)
                            sharedPrefs.edit()
                                .remove("rol_usuario")
                                .remove("pref_tema_oscuro")
                                .apply()
                            navController.navigate("role_selection") {
                                popUpTo(0) { inclusive = true }
                            }
                        },
                        // ✅ FIX: conectado — antes faltaba este parámetro
                        onNavigateToHelp = { navController.navigate("help_tutorial") }
                    )
                }

                // ✅ FIX: settings recibe onNavigateToHelp si tu SettingsScreen lo tiene
                composable("settings") {
                    SettingsScreen(
                        routineViewModel = routineViewModel,
                        onNavigateBack = { navController.popBackStack() },
                        onNavigateToHelp = { navController.navigate("help_tutorial") },
                        onNavigateToProfile = { navController.navigate("profile") }
                    )
                }

                composable("connection_code") {
                    ConnectionScreen(
                        routineViewModel = routineViewModel,
                        onNavigateBack = { navController.popBackStack() },
                        onLinkSuccess = { navController.popBackStack() },
                        onNavigateToHelp = { navController.navigate("help_tutorial") },
                        onNavigateToProfile = { navController.navigate("profile") }
                    )
                }

                composable("analytics") {
                    AnalyticsScreen(
                        routineViewModel = routineViewModel,
                        onNavigateBack = { navController.popBackStack() },
                        onNavigateToPremium = { navController.navigate("subscription_plans") },
                        onNavigateToHelp = { navController.navigate("help_tutorial") },
                        onNavigateToProfile = { navController.navigate("profile") }
                    )
                }
                composable("device_management") {
                    DeviceManagementScreen(
                        routineViewModel = routineViewModel,
                        onNavigateBack = { navController.popBackStack() },
                        onNavigateToHelp = { navController.navigate("help_tutorial") },
                        onNavigateToProfile = { navController.navigate("profile") }
                    )
                }

                // ── CREATE ROUTINE ───────────────────────────────────────────
                composable(
                    route = "create_routine/{routineTurn}/{selectedDay}",
                    arguments = listOf(
                        navArgument("routineTurn") { type = NavType.StringType },
                        navArgument("selectedDay") { type = NavType.StringType }
                    )
                ) { backStackEntry ->
                    val turn = backStackEntry.arguments?.getString("routineTurn") ?: "MAÑANA"
                    val day = backStackEntry.arguments?.getString("selectedDay") ?: "LUNES"
                    val turnoNormalizado = when (turn.uppercase().trim()) {
                        "MAÑANA", "MANANA" -> "MAÑANA"
                        "TARDE" -> "TARDE"
                        "NOCHE" -> "NOCHE"
                        else -> "MAÑANA"
                    }
                    val diaNormalizado = when (day.uppercase().trim()) {
                        "LUNES", "LUN" -> "LUNES"
                        "MARTES", "MAR" -> "MARTES"
                        "MIERCOLES", "MIE", "MIÉRCOLES" -> "MIERCOLES"
                        "JUEVES", "JUE" -> "JUEVES"
                        "VIERNES", "VIE" -> "VIERNES"
                        "SABADO", "SAB", "SÁBADO" -> "SABADO"
                        "DOMINGO", "DOM" -> "DOMINGO"
                        else -> "LUNES"
                    }

                    LaunchedEffect(turnoNormalizado, diaNormalizado) {
                        val uid = com.example.upad.data.LocalDataManager.getCurrentUserId()
                        routineViewModel.cargarRutinasPorDia(uid, diaNormalizado)
                    }

                    val listaPasosTurno by when (turnoNormalizado) {
                        "MAÑANA" -> routineViewModel.tasksManana.collectAsState()
                        "TARDE" -> routineViewModel.tasksTarde.collectAsState()
                        else -> routineViewModel.tasksNoche.collectAsState()
                    }

                    CreateRoutineScreen(
                        routineTurn = turnoNormalizado,
                        childName = "tu hijo",
                        pasosSeleccionados = listaPasosTurno,
                        onBackClick = { navController.popBackStack() },
                        onNavigateToPictogramSearch = { navController.navigate("pictogram_selection/$turnoNormalizado/$diaNormalizado") },
                        onRemoveTaskClick = { index -> routineViewModel.removeTask(turnoNormalizado, index) },
                        onSendRoutine = {
                            val uid = com.example.upad.data.LocalDataManager.getCurrentUserId()
                            routineViewModel.saveAll(uid, turnoNormalizado)
                            navController.navigate("parent_dashboard")
                        },
                        viewModel = routineViewModel,
                        drawableId = android.R.drawable.ic_menu_manage,
                        diaInicial = diaNormalizado,
                        // ✅ FIX: conectado
                    )
                }

                // ── PICTOGRAM ────────────────────────────────────────────────
                composable(
                    route = "pictogram_selection/{routineTurn}/{selectedDay}",
                    arguments = listOf(
                        navArgument("routineTurn") { type = NavType.StringType },
                        navArgument("selectedDay") { type = NavType.StringType }
                    )
                ) { backStackEntry ->
                    val turn = backStackEntry.arguments?.getString("routineTurn") ?: "MAÑANA"
                    val day = backStackEntry.arguments?.getString("selectedDay") ?: "LUNES"
                    val turnoNormalizado = when (turn.uppercase().trim()) {
                        "MAÑANA", "MANANA" -> "MAÑANA"; "TARDE" -> "TARDE"; "NOCHE" -> "NOCHE"; else -> "MAÑANA"
                    }
                    val diaNormalizado = when (day.uppercase().trim()) {
                        "LUNES", "LUN" -> "LUNES"; "MARTES", "MAR" -> "MARTES"
                        "MIERCOLES", "MIE", "MIÉRCOLES" -> "MIERCOLES"; "JUEVES", "JUE" -> "JUEVES"
                        "VIERNES", "VIE" -> "VIERNES"; "SABADO", "SAB", "SÁBADO" -> "SABADO"
                        "DOMINGO", "DOM" -> "DOMINGO"; else -> "LUNES"
                    }
                    PictogramSelectionScreen(
                        viewModel = routineViewModel,
                        onBackClick = { navController.popBackStack() },
                        onPictogramSelected = { description, url ->
                            val uid = com.example.upad.data.LocalDataManager.getCurrentUserId()
                            routineViewModel.addTaskConDia(turnoNormalizado, description, url, diaNormalizado, uid)
                            navController.popBackStack()
                        }
                    )
                }

                // ── SECCIÓN NIÑO ─────────────────────────────────────────────
                composable("child_start") {
                    ChildStartScreen(
                        routineViewModel = routineViewModel,
                        onNavigateToTask = { actividadNombre, turno ->
                            navController.navigate("child_task_execution/$actividadNombre/$turno")
                        },
                        onNavigateToCompleted = { navController.navigate("child_routine_completed") },
                        onPadreIdObtenido = { pId -> padreIdDelHijo = pId }
                    )
                }

                composable(
                    route = "child_task_execution/{activityName}/{routineTurn}",
                    arguments = listOf(
                        navArgument("activityName") { type = NavType.StringType },
                        navArgument("routineTurn") { type = NavType.StringType }
                    )
                ) { backStackEntry ->
                    val activityName = backStackEntry.arguments?.getString("activityName") ?: "Actividad"
                    val turn = backStackEntry.arguments?.getString("routineTurn") ?: "MAÑANA"
                    TaskExecutionScreen(
                        viewModel = routineViewModel,
                        activityName = activityName,
                        turn = turn,
                        padreId = padreIdDelHijo,
                        onFinishRoutine = { nombreDeLaTareaCompletada ->
                            navController.navigate("child_task_feedback/$nombreDeLaTareaCompletada")
                        }
                    )
                }

                composable(
                    route = "child_task_feedback/{activityName}",
                    arguments = listOf(navArgument("activityName") { type = NavType.StringType })
                ) { backStackEntry ->
                    val activityName = backStackEntry.arguments?.getString("activityName") ?: "Actividad"
                    val context = androidx.compose.ui.platform.LocalContext.current
                    TaskFeedbackScreen(
                        activityName = activityName,
                        onFeedbackSelected = { emocion ->
                            val idPadre = padreIdDelHijo.ifEmpty {
                                com.example.upad.data.LocalDataManager.getCurrentUserId()
                            }
                            val horaActual = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
                            val turnoActual = when {
                                horaActual < 13 -> "MAÑANA"
                                horaActual in 13..17 -> "TARDE"
                                else -> "NOCHE"
                            }
                            routineViewModel.registrarFeedbackEmocional(
                                userId = idPadre,
                                turn = turnoActual,
                                actividadNombre = activityName,
                                emocionSeleccionada = emocion,
                                context = context
                            )
                            routineViewModel.cargarMensajesRefuerzo(idPadre, turnoActual)
                            navController.navigate("child_routine_completed") {
                                popUpTo("child_start") { inclusive = false }
                            }
                        }
                    )
                }

                composable("child_routine_completed") {
                    val reinforcementMessages by routineViewModel.reinforcementMessages.collectAsState()
                    val manana by routineViewModel.tasksManana.collectAsState()
                    val tarde by routineViewModel.tasksTarde.collectAsState()
                    val noche by routineViewModel.tasksNoche.collectAsState()
                    // Siguiente actividad pendiente de hoy (en orden de turno y de creación); vacío = no queda ninguna
                    val diaHoy = com.example.upad.utils.RoutineProgressCalculator.obtenerDiaDeHoy()
                    val prefijoHoy = com.example.upad.utils.RoutineProgressCalculator.obtenerPrefijoDia(diaHoy)
                    // Solo el turno actual y los siguientes: los anteriores ya no se pueden hacer hoy
                    val hora = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
                    val pendientesPosibles = when {
                        hora < 13 -> manana + tarde + noche
                        hora < 18 -> tarde + noche
                        else -> noche
                    }
                    val siguiente = pendientesPosibles.firstOrNull { tarea ->
                        val tocaHoy = tarea.dias.isEmpty() || tarea.dias.any { d ->
                            d.uppercase().trim().replace("É", "E").replace("Á", "A").take(3) == prefijoHoy.take(3)
                        }
                        tocaHoy && !tarea.estaCompletadaHoy(diaHoy)
                    }?.actividad.orEmpty()
                    RoutineCompletedScreen(
                        nextActivityPreview = siguiente,
                        reinforcementMessages = reinforcementMessages,
                        onFinishClick = {
                            navController.navigate("child_start") {
                                popUpTo("child_start") { inclusive = true }
                            }
                        }
                    )
                }

                composable("achievement_report") {
                    AchievementReportScreen(
                        onBackClick = { navController.popBackStack() },
                        onViewDetailsClick = { navController.navigate("activity_details") }
                    )
                }

                composable("activity_details") {
                    LaunchedEffect(Unit) {
                        val uid = com.example.upad.data.LocalDataManager.getCurrentUserId()
                        routineViewModel.cargarRutinasDesdeFirebase(uid)
                    }
                    ActivityDetailsScreen(
                        viewModel = routineViewModel,
                        onBack = { navController.popBackStack() }
                    )
                }
            }
        }
    }
}
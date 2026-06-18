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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowInsetsControllerCompat
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.example.upad.dashboard.HijoTrackingScreen
import com.example.upad.auth.ForgotPasswordScreen
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

class MainActivity : FragmentActivity() {

    private var ordenBloqueoPadreActiva by mutableStateOf(false)
    private val firestore = FirebaseFirestore.getInstance()
    private var kioscoListener: ListenerRegistration? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)

        val deviceId = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)

        kioscoListener = firestore.collection("dispositivos_niños").document(deviceId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) return@addSnapshotListener
                if (snapshot != null && snapshot.exists()) {
                    val kioscoActivo = snapshot.getBoolean("kioscoActivo") ?: false
                    ordenBloqueoPadreActiva = kioscoActivo
                } else {
                    ordenBloqueoPadreActiva = false
                }
            }

        setContent {
            val repository = remember { FirebaseRepository() }
            val routineViewModel: RoutineViewModel = viewModel(
                factory = com.example.upad.viewmodel.RoutineViewModelFactory(repository)
            )

            val isDarkMode by routineViewModel.isDarkMode.collectAsState()
            val isPremiumUser by routineViewModel.isUserPremium.collectAsState(initial = false)

            UPadTheme(darkTheme = isDarkMode, isPremium = isPremiumUser) {
                UPadNavigation(
                    bloqueoActivo = ordenBloqueoPadreActiva,
                    routineViewModel = routineViewModel,
                    onCambiarEstadoSistema = ::gestionarRestriccionesSistema
                )
            }
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

    override fun onDestroy() {
        super.onDestroy()
        kioscoListener?.remove()
    }
}

@Composable
fun UPadTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    isPremium: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorAcabadoPrincipal = if (isPremium) Color(0xFFC5A059) else Color(0xFF4FC3F7)

    val colorScheme = if (darkTheme) {
        darkColorScheme(
            primary = colorAcabadoPrincipal,
            background = Color(0xFF121212),
            surface = Color(0xFF1E1E1E),
            onBackground = Color.White,
            onSurface = Color(0xFFE0E0E0)
        )
    } else {
        lightColorScheme(
            primary = colorAcabadoPrincipal,
            background = Color(0xFFF0F4F8),
            surface = Color.White,
            onBackground = Color(0xFF212121),
            onSurface = Color(0xFF757575)
        )
    }

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}

@Composable
fun UPadNavigation(
    bloqueoActivo: Boolean,
    routineViewModel: RoutineViewModel,
    onCambiarEstadoSistema: (Boolean) -> Unit
) {
    val navController = rememberNavController()
    val isDarkMode by routineViewModel.isDarkMode.collectAsState()

    // FIX: estado compartido que recibe el padreId real cuando el hijo se vincula
    var padreIdDelHijo by remember { mutableStateOf("") }

    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val rutaActual = navBackStackEntry?.destination?.route ?: ""
    val estaEnSeccionNiño = rutaActual.startsWith("child_")

    LaunchedEffect(bloqueoActivo, estaEnSeccionNiño) {
        if (bloqueoActivo && estaEnSeccionNiño) {
            onCambiarEstadoSistema(true)
        } else {
            onCambiarEstadoSistema(false)
        }
    }

    val view = LocalView.current
    if (!view.isInEditMode && !(bloqueoActivo && estaEnSeccionNiño)) {
        val activity = view.context as Activity
        val window = activity.window
        window.statusBarColor = if (isDarkMode) android.graphics.Color.parseColor("#1E1E1E") else android.graphics.Color.TRANSPARENT
        val windowInsetsController = WindowInsetsControllerCompat(window, window.decorView)
        windowInsetsController.isAppearanceLightStatusBars = !isDarkMode
    }

    Scaffold(modifier = Modifier.fillMaxSize()) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            NavHost(
                navController = navController,
                startDestination = "role_selection"
            ) {
                composable("role_selection") {
                    RoleSelectionScreen(
                        onRoleSelected = { role ->
                            when (role) {
                                "padre_directo" -> navController.navigate("parent_dashboard") {
                                    popUpTo("role_selection") { inclusive = true }
                                }
                                "padre" -> navController.navigate("welcome")
                                else -> navController.navigate("child_start")
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
                            navController.navigate("parent_dashboard") {
                                popUpTo("login") { inclusive = true }
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

                composable("subscription_plans") {
                    SubscriptionPlansScreen(
                        onPlanSelected = { planType ->
                            if (planType == "premium") navController.navigate("child_profile_setup")
                            else navController.navigate("trial_disclaimer")
                        },
                        onSkip = { navController.navigate("trial_disclaimer") }
                    )
                }

                composable("trial_disclaimer") {
                    TrialDisclaimerScreen(
                        onStartTrialClick = { navController.navigate("child_profile_setup") },
                        onMoreInfoClick = { }
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
                            routineViewModel.setSuscripcionManual(true)
                            navController.navigate("parent_dashboard") {
                                popUpTo("parent_dashboard") { inclusive = true }
                            }
                        }
                    )
                }

                composable("parent_dashboard") {
                    LaunchedEffect(Unit) {
                        routineViewModel.cargarRutinasDesdeFirebase("PADRE_TEST")
                    }
                    RoutineDashboardScreen(
                        routineViewModel = routineViewModel,
                        onNavigateToCreateRoutine = { turn, day -> navController.navigate("create_routine/$turn/$day") },
                        onRoutineClick = { turn, day -> navController.navigate("create_routine/$turn/$day") },
                        onNavigateToProfile = { navController.navigate("profile") },
                        onNavigateToSettings = { navController.navigate("settings") },
                        onNavigateToConnection = { navController.navigate("connection_code") },
                        onNavigateToAnalytics = { navController.navigate("analytics") },
                        onNavigateToDeviceManagement = { navController.navigate("device_management") },
                        onNavigateToChangePlan = { navController.navigate("change_plan") },
                        onNavigateToTracking = { hijoId -> navController.navigate("tracking/$hijoId") }
                    )
                }

                composable(
                    route = "tracking/{hijoId}",
                    arguments = listOf(navArgument("hijoId") { type = NavType.StringType })
                ) { backStackEntry ->
                    val hijoId = backStackEntry.arguments?.getString("hijoId") ?: ""
                    val trackingViewModel: com.example.upad.viewmodel.TrackingViewModel = viewModel()
                    HijoTrackingScreen(
                        routineViewModel = routineViewModel, // 👈 Pasamos el ViewModel global aquí en primer lugar
                        hijoId = hijoId,
                        trackingViewModel = trackingViewModel,
                        onNavigateBack = { navController.popBackStack() }
                    )
                }

                composable("profile") {
                    ProfileScreen(
                        routineViewModel = routineViewModel, // 👈 Pasamos el ViewModel aquí para que compile correctamente
                        onNavigateBack = { navController.popBackStack() },
                        onLogoutSuccess = {
                            navController.navigate("welcome") {
                                popUpTo("parent_dashboard") { inclusive = true }
                            }
                        }
                    )
                }

                composable("settings") {
                    SettingsScreen(
                        routineViewModel = routineViewModel,
                        onNavigateBack = { navController.popBackStack() }
                    )
                }

                composable("connection_code") {
                    ConnectionScreen(
                        routineViewModel = routineViewModel, // 👈 Pásale tu instancia del ViewModel aquí
                        onNavigateBack = { navController.popBackStack() },
                        onLinkSuccess = { navController.popBackStack() }
                    )
                }

                composable("analytics") {
                    AnalyticsScreen(
                        routineViewModel = routineViewModel,
                        onNavigateBack = { navController.popBackStack() },
                        onNavigateToPremium = { navController.navigate("subscription_plans") }
                    )
                }

                composable("device_management") {
                    DeviceManagementScreen(
                        routineViewModel = routineViewModel,
                        onNavigateBack = { navController.popBackStack() }
                    )
                }

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

                    // Force the ViewModel to load the correct day's tasks
                    LaunchedEffect(turnoNormalizado, diaNormalizado) {
                        routineViewModel.cargarRutinasPorDia("PADRE_TEST", diaNormalizado)
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
                            routineViewModel.saveAll("PADRE_TEST", turnoNormalizado)
                            navController.navigate("parent_dashboard")
                        },
                        viewModel = routineViewModel,
                        drawableId = android.R.drawable.ic_menu_manage,
                        diaInicial = diaNormalizado
                    )
                }

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
                    PictogramSelectionScreen(
                        viewModel = routineViewModel,
                        onBackClick = { navController.popBackStack() },
                        onPictogramSelected = { description, url ->
                            routineViewModel.addTaskConDia(turnoNormalizado, description, url, diaNormalizado, "PADRE_TEST")
                            navController.popBackStack()
                        }
                    )
                }

                // FIX: child_start ahora propaga el padreId real
                composable("child_start") {
                    ChildStartScreen(
                        routineViewModel = routineViewModel,
                        onNavigateToTask = { actividadNombre, turno ->
                            navController.navigate("child_task_execution/$actividadNombre/$turno")
                        },
                        onNavigateToCompleted = {
                            navController.navigate("child_routine_completed")
                        },
                        onPadreIdObtenido = { pId ->
                            padreIdDelHijo = pId
                        }
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
                            // FIX: usar padreIdDelHijo en lugar de FirebaseAuth
                            // el hijo no está autenticado, así que currentUser sería null
                            val idPadre = padreIdDelHijo.ifEmpty {
                                com.google.firebase.auth.FirebaseAuth.getInstance().currentUser?.uid
                                    ?: "PADRE_TEST"
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

                            navController.navigate("child_routine_completed") {
                                popUpTo("child_start") { inclusive = false }
                            }
                        }
                    )
                }

                composable("child_routine_completed") {
                    RoutineCompletedScreen(
                        nextActivityPreview = "¡Felicidades! Completaste todo",
                        onFinishClick = {
                            navController.navigate("child_start") {
                                popUpTo("child_start") { inclusive = true }
                            }
                        }
                    )
                }

                composable("notifications") {
                    NotificationsScreen(onViewReportClick = { navController.navigate("achievement_report") })
                }

                composable("achievement_report") {
                    AchievementReportScreen(
                        onBackClick = { navController.popBackStack() },
                        onViewDetailsClick = { navController.navigate("activity_details") }
                    )
                }

                composable("activity_details") {
                    LaunchedEffect(Unit) {
                        routineViewModel.cargarRutinasDesdeFirebase("PADRE_TEST")
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
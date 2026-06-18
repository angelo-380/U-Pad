package com.example.upad.dashboard

import android.content.Context
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.res.stringResource
import com.example.upad.R
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.launch
import java.util.Calendar
import java.util.Locale

data class RoutineItem(
    val name: String,
    val icon: ImageVector,
    val totalTasks: Int,
    val completedTasks: Int,
    val color: Color
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RoutineDashboardScreen(
    routineViewModel: com.example.upad.viewmodel.RoutineViewModel,
    onNavigateToCreateRoutine: (String, String) -> Unit,
    onRoutineClick: (String, String) -> Unit,
    onNavigateToAnalytics: () -> Unit = {},
    onNavigateToSettings: () -> Unit = {},
    onNavigateToProfile: () -> Unit = {},
    onNavigateToConnection: () -> Unit = {},
    onNavigateToDeviceManagement: () -> Unit = {},
    onNavigateToChangePlan: () -> Unit = {},
    onNavigateToTracking: (String) -> Unit = {}
) {
    val firebaseAuth = remember { FirebaseAuth.getInstance() }
    val currentUser = firebaseAuth.currentUser
    val context = LocalContext.current

    // 🌗 ESTADOS DE AJUSTES DESDE EL VIEWMODEL
    val esPremium by routineViewModel.isUserPremium.collectAsState()
    val isDarkMode by routineViewModel.isDarkMode.collectAsState()

    // 🎨 PALETA DE COLORES ADAPTATIVA (CAMBIA SEGÚN EL MODO OSCURO)
    val colorTextoPrincipal = if (isDarkMode) Color.White else Color(0xFF111111)
    val colorTextoSecundario = if (isDarkMode) Color(0xFFB0B0B0) else Color(0xFF444444)
    val fuentePremium = FontFamily.SansSerif

    // 🌸 GRADIENTE PREMIUM: Rosita en Claro / Púrpura y Negro Elegante en Oscuro
    val gradienteFondoPremium = if (isDarkMode) {
        Brush.verticalGradient(
            colors = listOf(
                Color(0xFF0F0C29),
                Color(0xFF302B63),
                Color(0xFF121212)
            )
        )
    } else {
        Brush.verticalGradient(
            colors = listOf(
                Color(0xFFFBE9E7),
                Color(0xFFF3E5F5),
                Color(0xFFE8EAF6)
            )
        )
    }

    val colorFondoBase = if (isDarkMode) Color(0xFF121212) else MaterialTheme.colorScheme.background
    val colorSuperficieTarjetas = if (esPremium) {
        if (isDarkMode) Color.White.copy(alpha = 0.12f) else Color.White.copy(alpha = 0.85f)
    } else {
        MaterialTheme.colorScheme.surface
    }

    val colorAcabadoPrincipal = MaterialTheme.colorScheme.primary
    val colorDinamicoSuscripcion = if (esPremium) Color(0xFFC5A059) else colorAcabadoPrincipal

    val hijoVinculadoId = remember(currentUser) {
        context.getSharedPreferences("UPAD_PREFS", Context.MODE_PRIVATE)
            .getString("HIJO_VINCULADO_ID", "DISPOSITIVO_PADRE")
    }

    var parentName by remember {
        mutableStateOf(
            context.getSharedPreferences("UPAD_PREFS", Context.MODE_PRIVATE)
                .getString("PARENT_NAME", "PADRE/TUTOR") ?: "PADRE/TUTOR"
        )
    }

    LaunchedEffect(currentUser) {
        if (currentUser != null) {
            val emailName = currentUser.email?.substringBefore("@")?.uppercase()
            val nameToDisplay = currentUser.displayName?.uppercase() ?: emailName
            if (!nameToDisplay.isNullOrBlank()) {
                parentName = nameToDisplay
                context.getSharedPreferences("UPAD_PREFS", Context.MODE_PRIVATE)
                    .edit().putString("PARENT_NAME", nameToDisplay).apply()
            }
        }
    }

    val onUbicarHijoAccionUnificada = {
        onNavigateToTracking(hijoVinculadoId ?: "DISPOSITIVO_PADRE")
    }

    // Localized child text is handled directly in UI string resource
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    val diasSemana = com.example.upad.utils.RoutineProgressCalculator.diasSemana
    val diaDeHoy = remember { com.example.upad.utils.RoutineProgressCalculator.obtenerDiaDeHoy() }
    val numeroDeHoyReal = remember { Calendar.getInstance().get(Calendar.DAY_OF_MONTH) }

    var diaSeleccionado by remember { mutableStateOf(diaDeHoy) }
    var diaNumeroSeleccionado by remember { mutableStateOf(numeroDeHoyReal) }
    var mostrarCalendarioCompleto by remember { mutableStateOf(false) }
    var showTurnSelectionDialog by remember { mutableStateOf(false) }

    val currentUserId = remember(currentUser) {
        currentUser?.uid ?: "PADRE_TEST"
    }

    LaunchedEffect(diaSeleccionado, currentUserId) {
        routineViewModel.cargarRutinasPorDia(currentUserId, diaSeleccionado)
    }

    val currentLocale = LocalContext.current.resources.configuration.locales[0]
    val infoMesActual = remember(currentLocale) {
        val cal = Calendar.getInstance()
        val nombreMes = cal.getDisplayName(Calendar.MONTH, Calendar.LONG, currentLocale)?.uppercase() ?: ""
        val anio = cal.get(Calendar.YEAR)
        val maxDias = cal.getActualMaximum(Calendar.DAY_OF_MONTH)

        val listaDiasDelMes = (1..maxDias).map { dia ->
            val tempCal = Calendar.getInstance().apply { set(Calendar.DAY_OF_MONTH, dia) }
            val nombreDiaAsignado = when (tempCal.get(Calendar.DAY_OF_WEEK)) {
                Calendar.MONDAY -> "LUNES"
                Calendar.TUESDAY -> "MARTES"
                Calendar.WEDNESDAY -> "MIÉRCOLES"
                Calendar.THURSDAY -> "JUEVES"
                Calendar.FRIDAY -> "VIERNES"
                Calendar.SATURDAY -> "SÁBADO"
                Calendar.SUNDAY -> "DOMINGO"
                else -> "LUNES"
            }
            Pair(dia, nombreDiaAsignado)
        }
        Triple("$nombreMes $anio", maxDias, listaDiasDelMes)
    }

    val tituloMes = infoMesActual.first
    val diasDelMesArray = infoMesActual.third

    val allTasksManana by routineViewModel.tasksManana.collectAsState()
    val allTasksTarde by routineViewModel.tasksTarde.collectAsState()
    val allTasksNoche by routineViewModel.tasksNoche.collectAsState()

    val prefijoDiaSeleccionado = com.example.upad.utils.RoutineProgressCalculator.obtenerPrefijoDia(diaSeleccionado)

    val progresoManana = com.example.upad.utils.RoutineProgressCalculator.calcularProgreso(allTasksManana, prefijoDiaSeleccionado)
    val progresoTarde = com.example.upad.utils.RoutineProgressCalculator.calcularProgreso(allTasksTarde, prefijoDiaSeleccionado)
    val progresoNoche = com.example.upad.utils.RoutineProgressCalculator.calcularProgreso(allTasksNoche, prefijoDiaSeleccionado)

    val totalTareasDia = progresoManana.first + progresoTarde.first + progresoNoche.first
    val completadasTareasDia = progresoManana.second + progresoTarde.second + progresoNoche.second
    val pendientesTareasDia = totalTareasDia - completadasTareasDia
    val porcentajeGlobal = if (totalTareasDia > 0) (completadasTareasDia.toFloat() / totalTareasDia * 100).toInt() else 0

    val routines = listOf(
        RoutineItem("MAÑANA", Icons.Default.LightMode, progresoManana.first, progresoManana.second, Color(0xFFFFB74D)),
        RoutineItem("TARDE", Icons.Default.WbTwilight, progresoTarde.first, progresoTarde.second, Color(0xFF81C784)),
        RoutineItem("NOCHE", Icons.Default.NightsStay, progresoNoche.first, progresoNoche.second, Color(0xFF9575CD))
    )

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                // 🛠️ Hacemos transparente el contenedor base para que se vea nuestro gradiente premium de fondo
                drawerContainerColor = if (esPremium) Color.Transparent else (if (isDarkMode) Color(0xFF1E1E1E) else MaterialTheme.colorScheme.surface),
                modifier = Modifier
                    .width(300.dp)
                    .fillMaxHeight()
                    // 🌸 Si es premium, le aplicamos el mismo gradiente adaptativo (Rosita o Azul Profundo)
                    .then(
                        if (esPremium) Modifier.background(gradienteFondoPremium) else Modifier
                    )
            ) {
                // Cabecera del Drawer (Donde sale el nombre y correo)
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        // Si es premium, dejamos que use el fondo del gradiente limpio o un sutil toque dorado oscuro en Dark Mode
                        .background(if (esPremium) Color.Transparent else colorDinamicoSuscripcion)
                        .padding(24.dp)
                ) {
                    Column {
                        Icon(
                            Icons.Default.AccountCircle,
                            contentDescription = null,
                            tint = if (esPremium && !isDarkMode) Color(0xFF111111) else Color.White,
                            modifier = Modifier.size(64.dp)
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = parentName,
                            color = if (esPremium && !isDarkMode) Color(0xFF111111) else Color.White,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = fuentePremium
                        )
                        Text(
                            text = currentUser?.email ?: "Gestor de Rutinas",
                            color = if (esPremium && !isDarkMode) Color(0xFF444444) else Color.White.copy(alpha = 0.8f),
                            fontSize = 14.sp,
                            fontFamily = fuentePremium
                        )
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))

                // Configuración de colores dinámicos para los ítems del menú
                val drawerColors = NavigationDrawerItemDefaults.colors(
                    unselectedIconColor = colorTextoSecundario,
                    unselectedTextColor = colorTextoPrincipal,
                    selectedIconColor = colorDinamicoSuscripcion,
                    selectedTextColor = colorTextoPrincipal,
                    // Hace que el contenedor de los ítems al pasar el dedo o seleccionarlos sea sutil y translúcido
                    unselectedContainerColor = Color.Transparent,
                    selectedContainerColor = colorTextoPrincipal.copy(alpha = 0.1f)
                )

                NavigationDrawerItem(
                    icon = { Icon(Icons.Default.Star, contentDescription = null, tint = Color(0xFFFFD700)) },
                    label = { Text(text = if (esPremium) "Cambiar a Plan Básico" else "Cambiar a Plan Premium", fontWeight = FontWeight.Bold, color = colorTextoPrincipal, fontFamily = fuentePremium) },
                    selected = false,
                    onClick = {
                        scope.launch { drawerState.close() }
                        val uid = currentUser?.uid ?: ""
                        if (esPremium) routineViewModel.cancelPremium(uid) else onNavigateToChangePlan()
                    },
                    colors = drawerColors,
                    modifier = Modifier.padding(horizontal = 12.dp)
                )

                if (esPremium) {
                    NavigationDrawerItem(
                        icon = { Text(text = "📍", fontSize = 20.sp) },
                        label = { Text(text = "Ubicar a mi Hijo", fontWeight = FontWeight.Bold, color = colorTextoPrincipal, fontFamily = fuentePremium) },
                        badge = {
                            Surface(color = Color(0xFFFFD700), shape = RoundedCornerShape(6.dp)) {
                                Text("PRO", fontSize = 10.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(horizontal = 5.dp, vertical = 1.dp), color = Color.Black, fontFamily = fuentePremium)
                            }
                        },
                        selected = false,
                        onClick = { scope.launch { drawerState.close() }; onUbicarHijoAccionUnificada() },
                        colors = drawerColors,
                        modifier = Modifier.padding(horizontal = 12.dp)
                    )
                }

                NavigationDrawerItem(
                    icon = { Icon(Icons.Default.Analytics, contentDescription = null) },
                    label = { Text("Análisis de Desempeño", fontWeight = FontWeight.Medium, color = colorTextoPrincipal, fontFamily = fuentePremium) },
                    selected = false,
                    onClick = { scope.launch { drawerState.close() }; onNavigateToAnalytics() },
                    colors = drawerColors,
                    modifier = Modifier.padding(horizontal = 12.dp)
                )

                NavigationDrawerItem(
                    icon = { Icon(Icons.Default.Lock, contentDescription = null) },
                    label = { Text("Bloquear Dispositivo", fontWeight = FontWeight.Medium, color = colorTextoPrincipal, fontFamily = fuentePremium) },
                    selected = false,
                    onClick = { scope.launch { drawerState.close() }; onNavigateToDeviceManagement() },
                    colors = drawerColors,
                    modifier = Modifier.padding(horizontal = 12.dp)
                )

                NavigationDrawerItem(
                    icon = { Icon(Icons.Default.Link, contentDescription = null) },
                    label = { Text("Conectar con el Niño (Código)", fontWeight = FontWeight.Medium, color = colorTextoPrincipal, fontFamily = fuentePremium) },
                    selected = false,
                    onClick = { scope.launch { drawerState.close() }; onNavigateToConnection() },
                    colors = drawerColors,
                    modifier = Modifier.padding(horizontal = 12.dp)
                )

                NavigationDrawerItem(
                    icon = { Icon(Icons.Default.Person, contentDescription = null) },
                    label = { Text("Mi Perfil", fontWeight = FontWeight.Medium, color = colorTextoPrincipal, fontFamily = fuentePremium) },
                    selected = false,
                    onClick = { scope.launch { drawerState.close() }; onNavigateToProfile() },
                    colors = drawerColors,
                    modifier = Modifier.padding(horizontal = 12.dp)
                )
                NavigationDrawerItem(
                    icon = { Icon(Icons.Default.Settings, contentDescription = null) },
                    label = { Text("Ajustes", fontWeight = FontWeight.Medium, color = colorTextoPrincipal, fontFamily = fuentePremium) },
                    selected = false,
                    onClick = { scope.launch { drawerState.close() }; onNavigateToSettings() },
                    colors = drawerColors,
                    modifier = Modifier.padding(horizontal = 12.dp)
                )
            }
        }
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(if (esPremium) Color.Transparent else colorFondoBase)
                .then(if (esPremium) Modifier.background(gradienteFondoPremium) else Modifier)
        ) {
            Scaffold(
                containerColor = Color.Transparent,
                contentWindowInsets = WindowInsets(0, 0, 0, 0),
                floatingActionButton = {
                    FloatingActionButton(
                        onClick = {
                            if (esPremium) {
                                onUbicarHijoAccionUnificada()
                            } else {
                                showTurnSelectionDialog = true
                            }
                        },
                        containerColor = if (isDarkMode) Color.White else Color.Black,
                        contentColor = if (isDarkMode) Color.Black else Color.White,
                        shape = CircleShape
                    ) {
                        if (esPremium) {
                            Text(text = "🗺️", fontSize = 26.sp)
                        } else {
                            Icon(Icons.Default.Add, contentDescription = stringResource(R.string.create_new_routine), modifier = Modifier.size(30.dp))
                        }
                    }
                }
            ) { paddingValues ->
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(
                        top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding() + 12.dp,
                        bottom = paddingValues.calculateBottomPadding() + 100.dp
                    ),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Cabecera superior interactiva adaptada al tema
                    item {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 24.dp)
                        ) {
                            IconButton(
                                onClick = { scope.launch { drawerState.open() } },
                                modifier = Modifier.size(32.dp).align(Alignment.Start)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Menu,
                                    contentDescription = "Abrir menú",
                                    tint = colorTextoPrincipal,
                                    modifier = Modifier.size(28.dp)
                                )
                            }

                            Spacer(modifier = Modifier.height(10.dp))

                            Text(
                                text = stringResource(R.string.hello_parent, parentName),
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Black,
                                color = colorTextoSecundario.copy(alpha = 0.6f)
                            )

                            Text(
                                text = if (esPremium) stringResource(R.string.child_routines) + " ⭐" else stringResource(R.string.child_routines),
                                fontSize = 28.sp,
                                fontWeight = FontWeight.Black,
                                color = colorTextoPrincipal,
                                fontFamily = fuentePremium
                            )
                        }
                    }

                    // Tarjeta de progreso Premium
                    if (esPremium) {
                        item {
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 20.dp),
                                shape = RoundedCornerShape(28.dp),
                                colors = CardDefaults.cardColors(
                                    containerColor = if (isDarkMode) Color(0xFF1F1F1F) else Color(0xFF1E222B)
                                ),
                                elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
                            ) {
                                Column(modifier = Modifier.padding(24.dp)) {
                                    Text(
                                        text = stringResource(R.string.todays_progress),
                                        color = Color.White,
                                        fontSize = 18.sp,
                                        fontWeight = FontWeight.Bold,
                                        fontFamily = fuentePremium
                                    )
                                    Spacer(modifier = Modifier.height(20.dp))

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Box(
                                            contentAlignment = Alignment.Center,
                                            modifier = Modifier.size(100.dp)
                                        ) {
                                            CircularProgressIndicator(
                                                progress = { if (totalTareasDia > 0) completadasTareasDia.toFloat() / totalTareasDia else 0f },
                                                modifier = Modifier.fillMaxSize(),
                                                color = Color(0xFF9CCC65),
                                                strokeWidth = 10.dp,
                                                trackColor = Color.White.copy(alpha = 0.12f),
                                            )
                                            Text(
                                                text = "$porcentajeGlobal%",
                                                color = Color.White,
                                                fontSize = 20.sp,
                                                fontWeight = FontWeight.Black,
                                                fontFamily = fuentePremium
                                            )
                                        }

                                        Column(
                                            verticalArrangement = Arrangement.spacedBy(10.dp),
                                            modifier = Modifier.padding(start = 16.dp)
                                        ) {
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                Box(modifier = Modifier.size(28.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.1f)), contentAlignment = Alignment.Center) {
                                                    Icon(Icons.Default.Assignment, contentDescription = null, tint = Color.White, modifier = Modifier.size(14.dp))
                                                }
                                                Spacer(modifier = Modifier.width(8.dp))
                                                Column {
                                                    Text(text = "$totalTareasDia", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold, fontFamily = fuentePremium)
                                                    Text(text = stringResource(R.string.total_tasks), color = Color.Gray, fontSize = 11.sp, fontFamily = fuentePremium)
                                                }
                                            }
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                Box(modifier = Modifier.size(28.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.1f)), contentAlignment = Alignment.Center) {
                                                    Icon(Icons.Default.Assignment, contentDescription = null, tint = Color(0xFF9CCC65), modifier = Modifier.size(14.dp))
                                                }
                                                Spacer(modifier = Modifier.width(8.dp))
                                                Column {
                                                    Text(text = "$completadasTareasDia", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold, fontFamily = fuentePremium)
                                                    Text(text = stringResource(R.string.completed_tasks), color = Color.Gray, fontSize = 11.sp, fontFamily = fuentePremium)
                                                }
                                            }
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                Box(modifier = Modifier.size(28.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.1f)), contentAlignment = Alignment.Center) {
                                                    Icon(Icons.Default.Assignment, contentDescription = null, tint = Color(0xFFE57373), modifier = Modifier.size(14.dp))
                                                }
                                                Spacer(modifier = Modifier.width(8.dp))
                                                Column {
                                                    Text(text = "$pendientesTareasDia", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold, fontFamily = fuentePremium)
                                                    Text(text = stringResource(R.string.pending_tasks), color = Color.Gray, fontSize = 11.sp, fontFamily = fuentePremium)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Agenda horizontal diaria adaptada
                    item {
                        Column(modifier = Modifier.fillMaxWidth()) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 24.dp, vertical = 4.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = if (diaSeleccionado == diaDeHoy && diaNumeroSeleccionado == numeroDeHoyReal) {
                                        stringResource(R.string.today_program) + " (${getLocalizedDayName(diaDeHoy)} $numeroDeHoyReal)"
                                    } else {
                                        stringResource(R.string.program_of) + " ${getLocalizedDayName(diaSeleccionado)}" + if (diaNumeroSeleccionado > 0) " $diaNumeroSeleccionado" else ""
                                    },
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Black,
                                    color = colorTextoPrincipal,
                                    fontFamily = fuentePremium
                                )

                                IconButton(
                                    onClick = { mostrarCalendarioCompleto = !mostrarCalendarioCompleto },
                                    modifier = Modifier.background(if (mostrarCalendarioCompleto) colorTextoPrincipal.copy(alpha = 0.1f) else Color.Transparent, CircleShape)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.CalendarMonth,
                                        contentDescription = stringResource(R.string.monthly_view),
                                        tint = colorDinamicoSuscripcion
                                    )
                                }
                            }

                            LazyRow(
                                modifier = Modifier.fillMaxWidth(),
                                contentPadding = PaddingValues(horizontal = 20.dp),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                items(diasSemana) { dia ->
                                    val esElSeleccionado = dia == diaSeleccionado
                                    val esHoyReal = dia == diaDeHoy
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(16.dp))
                                            .background(
                                                if (esElSeleccionado) colorTextoPrincipal
                                                else if (esHoyReal) colorTextoPrincipal.copy(alpha = 0.12f)
                                                else colorSuperficieTarjetas
                                            )
                                            .clickable {
                                                diaSeleccionado = dia
                                                diaNumeroSeleccionado = if (dia == diaDeHoy) numeroDeHoyReal else -1
                                            }
                                            .padding(horizontal = 18.dp, vertical = 10.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = getLocalizedDayName(dia),
                                            color = if (esElSeleccionado) {
                                                if (isDarkMode) Color.Black else Color.White
                                            } else colorTextoPrincipal,
                                            fontWeight = if (esElSeleccionado || esHoyReal) FontWeight.Black else FontWeight.Bold,
                                            fontSize = 13.sp,
                                            fontFamily = fuentePremium
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // Calendario mensual alternable adaptado
                    item {
                        AnimatedVisibility(visible = mostrarCalendarioCompleto) {
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 20.dp, vertical = 4.dp),
                                shape = RoundedCornerShape(24.dp),
                                colors = CardDefaults.cardColors(containerColor = colorSuperficieTarjetas),
                                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                                border = BorderStroke(1.dp, colorTextoSecundario.copy(alpha = 0.15f))
                            ) {
                                Column(modifier = Modifier.padding(16.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = tituloMes,
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Black,
                                            color = colorTextoPrincipal,
                                            letterSpacing = 0.5.sp,
                                            fontFamily = fuentePremium
                                        )
                                        Text(
                                            text = stringResource(R.string.monthly_view),
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = colorTextoSecundario.copy(alpha = 0.6f)
                                        )
                                    }

                                    Spacer(modifier = Modifier.height(14.dp))

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        val currentLocale = java.util.Locale.getDefault()
                                        val initialsCal = Calendar.getInstance()
                                        val inicialesDias = (Calendar.SUNDAY..Calendar.SATURDAY).map { dayOfWeek ->
                                            initialsCal.set(Calendar.DAY_OF_WEEK, dayOfWeek)
                                            initialsCal.getDisplayName(Calendar.DAY_OF_WEEK, Calendar.SHORT, currentLocale)
                                                ?.take(1)?.uppercase(currentLocale) ?: ""
                                        }
                                        inicialesDias.forEach { letra ->
                                            Text(
                                                text = letra,
                                                modifier = Modifier.weight(1f),
                                                textAlign = TextAlign.Center,
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = colorTextoSecundario.copy(alpha = 0.6f),
                                                fontFamily = fuentePremium
                                            )
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(8.dp))

                                    val calendarAux = Calendar.getInstance().apply { set(Calendar.DAY_OF_MONTH, 1) }
                                    val espacioVacioInicial = calendarAux.get(Calendar.DAY_OF_WEEK) - 1

                                    var diaProcesadoIndex = 0
                                    val totalCeldasNecesarias = espacioVacioInicial + diasDelMesArray.size
                                    val filasDeSemanas = (totalCeldasNecesarias + 6) / 7

                                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                        for (semana in 0 until filasDeSemanas) {
                                            Row(modifier = Modifier.fillMaxWidth()) {
                                                for (diaSemanaFila in 0 until 7) {
                                                    val posicionCelda = semana * 7 + diaSemanaFila

                                                    if (posicionCelda < espacioVacioInicial || diaProcesadoIndex >= diasDelMesArray.size) {
                                                        Spacer(modifier = Modifier.weight(1f))
                                                    } else {
                                                        val datosDelDia = diasDelMesArray[diaProcesadoIndex]
                                                        val numeroDia = datosDelDia.first
                                                        val nombreDiaCompleto = datosDelDia.second

                                                        val esElSeleccionadoHoy = numeroDia == diaNumeroSeleccionado
                                                        val esDiaActualDelMes = numeroDia == numeroDeHoyReal

                                                        Box(
                                                            modifier = Modifier
                                                                .weight(1f)
                                                                .aspectRatio(1f)
                                                                .clip(CircleShape)
                                                                .background(
                                                                    when {
                                                                        esElSeleccionadoHoy -> colorTextoPrincipal
                                                                        esDiaActualDelMes -> colorTextoPrincipal.copy(alpha = 0.15f)
                                                                        else -> Color.Transparent
                                                                    }
                                                                )
                                                                .clickable {
                                                                    diaSeleccionado = nombreDiaCompleto
                                                                    diaNumeroSeleccionado = numeroDia
                                                                    mostrarCalendarioCompleto = false
                                                                },
                                                            contentAlignment = Alignment.Center
                                                        ) {
                                                            Text(
                                                                text = numeroDia.toString(),
                                                                fontSize = 13.sp,
                                                                fontWeight = if (esElSeleccionadoHoy || esDiaActualDelMes) FontWeight.Black else FontWeight.Medium,
                                                                color = if (esElSeleccionadoHoy) {
                                                                    if (isDarkMode) Color.Black else Color.White
                                                                } else colorTextoPrincipal,
                                                                fontFamily = fuentePremium
                                                            )
                                                        }
                                                        diaProcesadoIndex++
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    item {
                        Text(
                            text = if (diaNumeroSeleccionado > 0) {
                                stringResource(R.string.activity_blocks) + " - ${getLocalizedDayName(diaSeleccionado)} $diaNumeroSeleccionado"
                            } else {
                                stringResource(R.string.activity_blocks) + " - ${getLocalizedDayName(diaSeleccionado)}"
                            },
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = colorTextoPrincipal,
                            fontFamily = fuentePremium,
                            modifier = Modifier.padding(start = 24.dp, top = 8.dp, end = 24.dp)
                        )
                    }

                    items(routines) { routine ->
                        Box(modifier = Modifier.padding(horizontal = 20.dp)) {
                            RoutineProgressCard(
                                routine = routine,
                                colorSuperficie = colorSuperficieTarjetas,
                                colorTexto = colorTextoPrincipal,
                                colorTextoSec = colorTextoSecundario,
                                fuente = fuentePremium,
                                onClick = { onRoutineClick(routine.name, diaSeleccionado) }
                            )
                        }
                    }
                }
            }
        }
    }

    if (showTurnSelectionDialog) {
        AlertDialog(
            onDismissRequest = { showTurnSelectionDialog = false },
            title = {
                Text(
                    text = stringResource(R.string.select_turn),
                    fontWeight = FontWeight.Black,
                    fontSize = 18.sp,
                    color = colorTextoPrincipal
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        text = stringResource(R.string.choose_time_block, getLocalizedDayName(diaSeleccionado)),
                        fontSize = 14.sp,
                        color = colorTextoSecundario
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Button(
                        onClick = {
                            showTurnSelectionDialog = false
                            onNavigateToCreateRoutine("MAÑANA", diaSeleccionado)
                        },
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFFFB74D))
                    ) {
                        Text("☀️ " + stringResource(R.string.morning), fontWeight = FontWeight.Bold, color = Color.White)
                    }
                    Button(
                        onClick = {
                            showTurnSelectionDialog = false
                            onNavigateToCreateRoutine("TARDE", diaSeleccionado)
                        },
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF81C784))
                    ) {
                        Text("⛅ " + stringResource(R.string.afternoon), fontWeight = FontWeight.Bold, color = Color.White)
                    }
                    Button(
                        onClick = {
                            showTurnSelectionDialog = false
                            onNavigateToCreateRoutine("NOCHE", diaSeleccionado)
                        },
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF9575CD))
                    ) {
                        Text("🌙 " + stringResource(R.string.evening), fontWeight = FontWeight.Bold, color = Color.White)
                    }
                }
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { showTurnSelectionDialog = false }) {
                    Text(stringResource(R.string.cancel), fontWeight = FontWeight.Bold, color = colorDinamicoSuscripcion)
                }
            },
            containerColor = colorSuperficieTarjetas,
            shape = RoundedCornerShape(24.dp)
        )
    }
}

@Composable
fun RoutineProgressCard(
    routine: RoutineItem,
    colorSuperficie: Color,
    colorTexto: Color,
    colorTextoSec: Color,
    fuente: FontFamily,
    onClick: () -> Unit
) {
    val factorProgreso = if (routine.totalTasks > 0) routine.completedTasks.toFloat() / routine.totalTasks else 0f
    val porcentajeTexto = (factorProgreso * 100).toInt()

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .clickable { onClick() },
        shape = RoundedCornerShape(24.dp),
        color = colorSuperficie,
        border = BorderStroke(1.dp, colorTextoSec.copy(alpha = 0.1f)),
        tonalElevation = 0.dp,
        shadowElevation = 0.dp
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .background(routine.color.copy(alpha = 0.15f), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = routine.icon,
                            contentDescription = null,
                            tint = routine.color,
                            modifier = Modifier.size(22.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(14.dp))
                    Column {
                        Text(
                            text = getLocalizedTurnName(routine.name),
                            color = colorTexto,
                            fontWeight = FontWeight.Black,
                            fontSize = 16.sp,
                            fontFamily = fuente
                        )
                        Text(
                            text = stringResource(R.string.tasks_completed, routine.completedTasks, routine.totalTasks),
                            color = colorTextoSec.copy(alpha = 0.7f),
                            fontSize = 12.sp,
                            fontFamily = fuente
                        )
                    }
                }
                Text(
                    text = "$porcentajeTexto%",
                    color = colorTexto,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Black,
                    fontFamily = fuente
                )
            }
            Spacer(modifier = Modifier.height(14.dp))
            LinearProgressIndicator(
                progress = { factorProgreso },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(RoundedCornerShape(4.dp)),
                color = routine.color,
                trackColor = routine.color.copy(alpha = 0.12f)
            )
        }
    }
}

@Composable
fun getLocalizedDayName(day: String): String {
    val cleanDay = day.uppercase()
        .replace("Á", "A")
        .replace("É", "E")
        .replace("Í", "I")
        .replace("Ó", "O")
        .replace("Ú", "U")
        .trim()
    val resId = when (cleanDay) {
        "LUN", "LUNES" -> R.string.monday
        "MAR", "MARTES" -> R.string.tuesday
        "MIE", "MIERCOLES" -> R.string.wednesday
        "JUE", "JUEVES" -> R.string.thursday
        "VIE", "VIERNES" -> R.string.friday
        "SAB", "SABADO" -> R.string.saturday
        "DOM", "DOMINGO" -> R.string.sunday
        else -> return day
    }
    return stringResource(resId)
}

@Composable
fun getLocalizedTurnName(turn: String): String {
    val resId = when (turn.uppercase()) {
        "MAÑANA" -> R.string.morning
        "TARDE" -> R.string.afternoon
        "NOCHE" -> R.string.evening
        else -> return turn
    }
    return stringResource(resId)
}
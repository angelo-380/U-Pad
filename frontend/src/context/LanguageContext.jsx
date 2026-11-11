import React, { createContext, useContext, useState, useEffect } from 'react';

export const SUPPORTED_LANGUAGES = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
];

// Diccionario de frases y términos comunes de rutinas para traducción dinámica
export const VOCABULARY_TRANSLATIONS = {
  // Español
  es: {
    'rutina visual de mañana': 'Rutina Visual de Mañana',
    'rutina visual de tarde': 'Rutina Visual de Tarde',
    'rutina visual de noche': 'Rutina Visual de Noche',
    'cepillarse los dientes': 'Cepillarse los dientes',
    'ponerse el uniforme': 'Ponerse el uniforme',
    'lavarse las manos': 'Lavarse las manos',
    'tomar desayuno': 'Tomar desayuno',
    'hacer la tarea': 'Hacer la tarea',
    'guardar los juguetes': 'Guardar los juguetes',
    'ponerse el pijama': 'Ponerse el pijama',
    'dormir': 'Dormir',
    'dientes': 'dientes',
    'ropa': 'ropa',
    'manos': 'manos',
    'desayuno': 'desayuno',
    'tarea': 'tarea',
    'juguetes': 'juguetes',
  },
  // Inglés
  en: {
    'rutina visual de mañana': 'Morning Visual Routine',
    'rutina visual de tarde': 'Afternoon Visual Routine',
    'rutina visual de noche': 'Night Visual Routine',
    'cepillarse los dientes': 'Brush teeth',
    'ponerse el uniforme': 'Put on uniform',
    'lavarse las manos': 'Wash hands',
    'tomar desayuno': 'Have breakfast',
    'hacer la tarea': 'Do homework',
    'guardar los juguetes': 'Put away toys',
    'ponerse el pijama': 'Put on pajamas',
    'dormir': 'Sleep',
    'dientes': 'teeth',
    'ropa': 'clothes',
    'manos': 'hands',
    'desayuno': 'breakfast',
    'tarea': 'homework',
    'juguetes': 'toys',
  },
  // Portugués
  pt: {
    'rutina visual de mañana': 'Rotina Visual da Manhã',
    'rutina visual de tarde': 'Rotina Visual da Tarde',
    'rutina visual de noche': 'Rotina Visual da Noite',
    'cepillarse los dientes': 'Escovar os dentes',
    'ponerse el uniforme': 'Vestir o uniforme',
    'lavarse las manos': 'Lavar as mãos',
    'tomar desayuno': 'Tomar café da manhã',
    'hacer la tarea': 'Fazer a lição de casa',
    'guardar los juguetes': 'Guardar os brinquedos',
    'ponerse el pijama': 'Vestir o pijama',
    'dormir': 'Dormir',
    'dientes': 'dentes',
    'ropa': 'roupas',
    'manos': 'mãos',
    'desayuno': 'café da manhã',
    'tarea': 'lição',
    'juguetes': 'brinquedos',
  },
  // Francés
  fr: {
    'rutina visual de mañana': 'Routine Visuelle du Matin',
    'rutina visual de tarde': 'Routine Visuelle de l\'Après-midi',
    'rutina visual de noche': 'Routine Visuelle du Soir',
    'cepillarse los dientes': 'Se brosser les dents',
    'ponerse el uniforme': 'Mettre l\'uniforme',
    'lavarse las manos': 'Se laver les mains',
    'tomar desayuno': 'Prendre le petit déjeuner',
    'hacer la tarea': 'Faire les devoirs',
    'guardar los juguetes': 'Ranger les jouets',
    'ponerse el pijama': 'Mettre le pyjama',
    'dormir': 'Dormir',
    'dientes': 'dents',
    'ropa': 'vêtements',
    'manos': 'mains',
    'desayuno': 'petit déjeuner',
    'tarea': 'devoirs',
    'juguetes': 'jouets',
  },
  // Alemán
  de: {
    'rutina visual de mañana': 'Visuelle Morgenroutine',
    'rutina visual de tarde': 'Visuelle Nachmittagsroutine',
    'rutina visual de noche': 'Visuelle Abendroutine',
    'cepillarse los dientes': 'Zähne putzen',
    'ponerse el uniforme': 'Uniform anziehen',
    'lavarse las manos': 'Hände waschen',
    'tomar desayuno': 'Frühstücken',
    'hacer la tarea': 'Hausaufgaben machen',
    'guardar los juguetes': 'Spielzeug aufräumen',
    'ponerse el pijama': 'Schlafanzug anziehen',
    'dormir': 'Schlafen',
    'dientes': 'Zähne',
    'ropa': 'Kleidung',
    'manos': 'Hände',
    'desayuno': 'Frühstück',
    'tarea': 'Hausaufgaben',
    'juguetes': 'Spielzeug',
  },
};

export const TRANSLATIONS = {
  es: {
    // Header & Layout
    panel_title: 'Panel de Gestión',
    nav_routines: 'Rutinas Visuales',
    nav_gps: 'Seguimiento GPS',
    nav_ai: 'Sugerencias IA',
    nav_additional: 'Módulos adicionales',
    upcoming_badge: 'Próx.',
    session_expired: 'Tu sesión ha expirado por seguridad. Por favor inicia sesión nuevamente.',
    logout: 'Salir',
    logout_confirm: 'Cerrar sesión',
    footer_copy: 'U-Pad — Plataforma Accesible para Personas con TEA.',
    footer_arasaac: 'Símbolos pictográficos utilizados:',
    select_language: 'Cambiar idioma',

    // Roles
    role_empresario: 'Empresario',
    role_tutor: 'Tutor / Familiar',
    role_anonymous: 'Anónimo',

    // Registro de cuenta (idioma base: español; los demás idiomas usan estas frases mientras no se traduzcan)
    register_title: 'Registro de cuenta',
    register_subtitle: 'Completa tus datos para habilitar el acceso',
    register_hero_title: 'Crea tu cuenta de U-Pad',
    register_hero_desc: 'Únete a la plataforma para coordinar y supervisar agendas visuales en colegios y centros de terapia.',
    have_account: '¿Ya tienes una cuenta?',
    login_here: 'Inicia sesión',
    person_name_label: 'Nombre completo',
    person_name_placeholder: 'Ej. María Pérez',
    org_name_label: 'Nombre de la institución',
    org_name_placeholder: 'Ej. Colegio San Martín',
    email_label: 'Correo electrónico',
    role_label: 'Tipo de perfil',
    role_org_option: 'Colegio o centro de terapia (director)',
    role_tutor_option: 'Tutor o familiar',
    password_policy_label: 'Contraseña (mín. 8 caracteres, con mayúscula, número y símbolo)',
    btn_register: 'Completar registro',
    creating_account: 'Creando cuenta segura...',
    register_fill_fields: 'Completa todos los campos obligatorios.',
    register_pass_short: 'La contraseña debe tener al menos 8 caracteres.',
    register_pass_policy: 'La contraseña debe incluir una mayúscula, un número y un símbolo especial.',
    register_error: 'No se pudo completar el registro. Inténtalo de nuevo.',
    org_code_label: 'Código de organización (opcional)',
    org_code_placeholder: 'Ej. K7M2-Q9XD',
    org_code_hint: 'Si tu colegio o centro te entregó un código, ingrésalo para que tus rutinas se sumen a sus Rutinas Institucionales. Su director podrá ver esas rutinas. Si no tienes un código, déjalo vacío.',
    org_code_card_title: 'Código de organización',
    org_code_card_hint: 'Compártelo con los tutores de tu institución para que se unan al registrarse.',
    org_code_copy: 'Copiar código',
    org_code_copied: 'Código copiado',

    // Rutinas Page
    routines_title: 'Gestión de Rutinas',
    routines_subtitle: 'Estructura secuencias con pictogramas ARASAAC para anticipar actividades y calmar la ansiedad diaria',
    reload_routines: 'Recargar rutinas del servidor',
    new_routine: 'Nueva rutina',
    tab_all: 'Todas',
    tab_morning: 'Mañana',
    tab_afternoon: 'Tarde',
    tab_night: 'Noche',

    // Shifts
    shift_morning_title: 'Turno Mañana',
    shift_morning_sub: 'Horario matutino (08:00 - 12:00)',
    shift_afternoon_title: 'Turno Tarde',
    shift_afternoon_sub: 'Horario vespertino (13:00 - 18:00)',
    shift_night_title: 'Turno Noche',
    shift_night_sub: 'Horario nocturno (19:00 - 22:00)',
    add_in_shift: 'Agregar en',
    no_routines_in_shift: 'No hay rutinas registradas para el turno de',
    routine_single: 'rutina',
    routine_plural: 'rutinas',

    // Card
    visual_step_single: 'paso visual',
    visual_step_plural: 'pasos visuales',
    activity_sequence: 'Secuencia de actividades:',
    step_prefix: 'Paso',
    keyword_label: 'Clave:',
    show_less_steps: 'Mostrar menos pasos',
    see_more_steps: 'Ver',
    activities_more_single: 'actividad más',
    activities_more_plural: 'actividades más',
    no_steps_configured: 'Sin pasos configurados',
    btn_edit: 'Editar',
    btn_delete: 'Eliminar',
    org_label: 'Org:',

    // Drawer / Formulario de creación y edición
    drawer_create_title: 'Crear Nueva Rutina Visual',
    drawer_edit_title: 'Editar Rutina Visual',
    drawer_subtitle: 'Estructura los pasos con palabras clave para asociar automáticamente pictogramas ARASAAC.',
    drawer_field_title: 'Título de la rutina',
    drawer_field_title_placeholder: 'Ej. Rutina de Despertar y Salida',
    drawer_field_shift: 'Turno del día',
    drawer_field_child_id: 'ID del Niño o Usuario asignado (opcional)',
    drawer_field_child_id_placeholder: 'Ej. nino_001',
    drawer_steps_title: 'Secuencia de Pasos con Pictogramas ARASAAC',
    drawer_step_label: 'Paso',
    drawer_step_text_label: 'Descripción de la actividad',
    drawer_step_text_placeholder: 'Ej. Lavarse los dientes con pasta',
    drawer_step_keyword_label: 'Palabra clave (ARASAAC)',
    drawer_step_keyword_placeholder: 'Ej. dientes',
    drawer_add_step: 'Añadir nuevo paso',
    drawer_cancel: 'Cancelar',
    drawer_save_create: 'Crear Rutina',
    drawer_save_edit: 'Guardar Cambios',
    drawer_loading: 'Guardando...',

    // Empty state
    empty_example_badge: 'Ejemplo de agenda visual',
    empty_example_turn: 'Turno Mañana',
    empty_example_title: 'Rutina de Inicio del Día',
    empty_step_1: 'Lavarse las manos',
    empty_step_2: 'Tomar desayuno',
    empty_step_3: 'Cepillarse los dientes',
    empty_title_filtered: 'Sin rutinas programadas para',
    empty_title_general: 'Comienza diseñando tu primera rutina visual',
    empty_desc_filtered: 'No hay agendas configuradas para este turno. Puedes crear una nueva secuencia adaptada a las necesidades del niño.',
    empty_desc_general: 'Las secuencias de pasos con pictogramas anticipan actividades, aportan predictibilidad y reducen la ansiedad sensorial.',
    empty_btn_create: 'Crear primera rutina',
    the_morning: 'la mañana',
    the_afternoon: 'la tarde',
    the_night: 'la noche',
    this_shift: 'este turno',

    // Modals
    delete_modal_title: '¿Eliminar esta rutina?',
    delete_modal_msg: 'Se eliminará la rutina visual. Esta acción es irreversible.',
    delete_modal_confirm: 'Sí, eliminar',
    delete_modal_cancel: 'Cancelar',

    // Páginas informativas
    forbidden_title: 'Permisos insuficientes',
    forbidden_desc: 'Tu rol de usuario actual no cuenta con las autorizaciones requeridas para visualizar este contenido institucional.',
    forbidden_btn: 'Volver a mis Rutinas',
    indev_tag: 'Hoja de Ruta del Proyecto · Entrega del 25%',
  },
  en: {
    // Header & Layout
    panel_title: 'Management Portal',
    nav_routines: 'Visual Routines',
    nav_gps: 'GPS Tracking',
    nav_ai: 'AI Suggestions',
    nav_additional: 'Additional Modules',
    upcoming_badge: 'Soon',
    session_expired: 'Your session has expired for security. Please sign in again.',
    logout: 'Log Out',
    logout_confirm: 'Log out',
    footer_copy: 'U-Pad — Accessible Platform for Individuals with ASD.',
    footer_arasaac: 'Pictographic symbols used:',
    select_language: 'Change language',

    // Roles
    role_empresario: 'Manager',
    role_tutor: 'Tutor / Guardian',
    role_anonymous: 'Anonymous',

    // Rutinas Page
    routines_title: 'Routine Management',
    routines_subtitle: 'Structure step sequences with ARASAAC pictograms to anticipate activities and reduce daily anxiety',
    reload_routines: 'Reload routines from server',
    new_routine: 'New Routine',
    tab_all: 'All',
    tab_morning: 'Morning',
    tab_afternoon: 'Afternoon',
    tab_night: 'Night',

    // Shifts
    shift_morning_title: 'Morning Shift',
    shift_morning_sub: 'Morning hours (08:00 - 12:00)',
    shift_afternoon_title: 'Afternoon Shift',
    shift_afternoon_sub: 'Afternoon hours (13:00 - 18:00)',
    shift_night_title: 'Night Shift',
    shift_night_sub: 'Night hours (19:00 - 22:00)',
    add_in_shift: 'Add to',
    no_routines_in_shift: 'No routines scheduled for',
    routine_single: 'routine',
    routine_plural: 'routines',

    // Card
    visual_step_single: 'visual step',
    visual_step_plural: 'visual steps',
    activity_sequence: 'Sequence of activities:',
    step_prefix: 'Step',
    keyword_label: 'Keyword:',
    show_less_steps: 'Show fewer steps',
    see_more_steps: 'View',
    activities_more_single: 'more activity',
    activities_more_plural: 'more activities',
    no_steps_configured: 'No steps configured',
    btn_edit: 'Edit',
    btn_delete: 'Delete',
    org_label: 'Org:',

    // Drawer / Form
    drawer_create_title: 'Create New Visual Routine',
    drawer_edit_title: 'Edit Visual Routine',
    drawer_subtitle: 'Structure activities with keywords to automatically bind ARASAAC pictograms.',
    drawer_field_title: 'Routine title',
    drawer_field_title_placeholder: 'E.g., Morning Wake-up and Departure',
    drawer_field_shift: 'Shift of the day',
    drawer_field_child_id: 'Assigned Child or User ID (optional)',
    drawer_field_child_id_placeholder: 'E.g., child_001',
    drawer_steps_title: 'Step Sequence with ARASAAC Pictograms',
    drawer_step_label: 'Step',
    drawer_step_text_label: 'Activity description',
    drawer_step_text_placeholder: 'E.g., Brush teeth with toothpaste',
    drawer_step_keyword_label: 'Keyword (ARASAAC)',
    drawer_step_keyword_placeholder: 'E.g., teeth',
    drawer_add_step: 'Add new step',
    drawer_cancel: 'Cancel',
    drawer_save_create: 'Create Routine',
    drawer_save_edit: 'Save Changes',
    drawer_loading: 'Saving...',

    // Empty state
    empty_example_badge: 'Visual schedule example',
    empty_example_turn: 'Morning Shift',
    empty_example_title: 'Daily Start Routine',
    empty_step_1: 'Wash hands',
    empty_step_2: 'Have breakfast',
    empty_step_3: 'Brush teeth',
    empty_title_filtered: 'No routines scheduled for',
    empty_title_general: 'Start by creating your first visual routine',
    empty_desc_filtered: 'There are no schedules set for this shift. You can create a new personalized sequence.',
    empty_desc_general: 'Step sequences with pictograms anticipate activities, provide predictability, and reduce sensory anxiety.',
    empty_btn_create: 'Create first routine',
    the_morning: 'the morning',
    the_afternoon: 'the afternoon',
    the_night: 'the night',
    this_shift: 'this shift',

    // Modals
    delete_modal_title: 'Delete this routine?',
    delete_modal_msg: 'This visual routine will be permanently deleted. This action cannot be undone.',
    delete_modal_confirm: 'Yes, delete',
    delete_modal_cancel: 'Cancel',

    // Pages
    forbidden_title: 'Insufficient Permissions',
    forbidden_desc: 'Your current account role does not have authorization to view this institutional section.',
    forbidden_btn: 'Back to my Routines',
    indev_tag: 'Project Roadmap · 25% Delivery',
  },
  pt: {
    // Header & Layout
    panel_title: 'Painel de Gestão',
    nav_routines: 'Rotinas Visuais',
    nav_gps: 'Rastreamento GPS',
    nav_ai: 'Sugestões IA',
    nav_additional: 'Módulos adicionais',
    upcoming_badge: 'Em breve',
    session_expired: 'Sua sessão expirou por segurança. Faça login novamente.',
    logout: 'Sair',
    logout_confirm: 'Encerrar sessão',
    footer_copy: 'U-Pad — Plataforma Acessível para Pessoas com TEA.',
    footer_arasaac: 'Símbolos pictográficos utilizados:',
    select_language: 'Mudar idioma',

    // Roles
    role_empresario: 'Gestor',
    role_tutor: 'Tutor / Familiar',
    role_anonymous: 'Anônimo',

    // Rutinas Page
    routines_title: 'Gestão de Rotinas',
    routines_subtitle: 'Estruture sequências com pictogramas ARASAAC para antecipar atividades e reduzir a ansiedade diária',
    reload_routines: 'Recarregar rotinas do servidor',
    new_routine: 'Nova rotina',
    tab_all: 'Todas',
    tab_morning: 'Manhã',
    tab_afternoon: 'Tarde',
    tab_night: 'Noite',

    // Shifts
    shift_morning_title: 'Turno Manhã',
    shift_morning_sub: 'Horário matutino (08:00 - 12:00)',
    shift_afternoon_title: 'Turno Tarde',
    shift_afternoon_sub: 'Horário vespertino (13:00 - 18:00)',
    shift_night_title: 'Turno Noite',
    shift_night_sub: 'Horário noturno (19:00 - 22:00)',
    add_in_shift: 'Adicionar em',
    no_routines_in_shift: 'Nenhuma rotina cadastrada para o turno de',
    routine_single: 'rotina',
    routine_plural: 'rotinas',

    // Card
    visual_step_single: 'passo visual',
    visual_step_plural: 'passos visuais',
    activity_sequence: 'Sequência de atividades:',
    step_prefix: 'Passo',
    keyword_label: 'Chave:',
    show_less_steps: 'Mostrar menos passos',
    see_more_steps: 'Ver mais',
    activities_more_single: 'atividade restante',
    activities_more_plural: 'atividades restantes',
    no_steps_configured: 'Sem passos configurados',
    btn_edit: 'Editar',
    btn_delete: 'Excluir',
    org_label: 'Org:',

    // Drawer
    drawer_create_title: 'Criar Nova Rotina Visual',
    drawer_edit_title: 'Editar Rotina Visual',
    drawer_subtitle: 'Estruture atividades com palavras-chave para vincular automaticamente pictogramas ARASAAC.',
    drawer_field_title: 'Título da rotina',
    drawer_field_title_placeholder: 'Ex: Rotina Matinal',
    drawer_field_shift: 'Turno do dia',
    drawer_field_child_id: 'ID da Criança ou Usuário atribuído (opcional)',
    drawer_field_child_id_placeholder: 'Ex: nino_001',
    drawer_steps_title: 'Sequência de Passos com Pictogramas ARASAAC',
    drawer_step_label: 'Passo',
    drawer_step_text_label: 'Descrição da atividade',
    drawer_step_text_placeholder: 'Ex: Escovar os dentes com pasta',
    drawer_step_keyword_label: 'Palavra-chave (ARASAAC)',
    drawer_step_keyword_placeholder: 'Ex: dentes',
    drawer_add_step: 'Adicionar novo passo',
    drawer_cancel: 'Cancelar',
    drawer_save_create: 'Criar Rotina',
    drawer_save_edit: 'Salvar Alterações',
    drawer_loading: 'Salvando...',

    // Empty state
    empty_example_badge: 'Exemplo de agenda visual',
    empty_example_turn: 'Turno Manhã',
    empty_example_title: 'Rotina de Início do Dia',
    empty_step_1: 'Lavar as mãos',
    empty_step_2: 'Tomar café da manhã',
    empty_step_3: 'Escovar os dentes',
    empty_title_filtered: 'Nenhuma rotina agendada para',
    empty_title_general: 'Comece criando sua primeira rotina visual',
    empty_desc_filtered: 'Não há agendas configuradas para este turno. Você pode criar uma nova sequência adaptada às necessidades da criança.',
    empty_desc_general: 'As sequências com pictogramas antecipam atividades, trazem previsibilidade e diminuem a ansiedade sensorial.',
    empty_btn_create: 'Criar primeira rotina',
    the_morning: 'a manhã',
    the_afternoon: 'a tarde',
    the_night: 'a noite',
    this_shift: 'este turno',

    // Modals
    delete_modal_title: 'Excluir esta rotina?',
    delete_modal_msg: 'A rotina visual será excluída permanentemente. Esta ação é irreversível.',
    delete_modal_confirm: 'Sim, excluir',
    delete_modal_cancel: 'Cancelar',

    // Pages
    forbidden_title: 'Permissões Insuficientes',
    forbidden_desc: 'Sua conta não possui permissões necessárias para acessar este recurso institucional.',
    forbidden_btn: 'Voltar para minhas Rotinas',
    indev_tag: 'Roteiro do Projeto · Entrega de 25%',
  },
  fr: {
    // Header & Layout
    panel_title: 'Panneau de Gestion',
    nav_routines: 'Routines Visuelles',
    nav_gps: 'Suivi GPS',
    nav_ai: 'Suggestions IA',
    nav_additional: 'Modules complémentaires',
    upcoming_badge: 'Bientôt',
    session_expired: 'Votre session a expiré par sécurité. Veuillez vous reconnecter.',
    logout: 'Quitter',
    logout_confirm: 'Se déconnecter',
    footer_copy: 'U-Pad — Plateforme Accessible pour Personnes avec TSA.',
    footer_arasaac: 'Symboles pictographiques utilisés :',
    select_language: 'Changer de langue',

    // Roles
    role_empresario: 'Gestionnaire',
    role_tutor: 'Tuteur / Famille',
    role_anonymous: 'Anonyme',

    // Rutinas Page
    routines_title: 'Gestion des Routines',
    routines_subtitle: 'Structurez des étapes avec des pictogrammes ARASAAC pour anticiper les activités et apaiser l\'anxiété',
    reload_routines: 'Recharger les routines',
    new_routine: 'Nouvelle routine',
    tab_all: 'Toutes',
    tab_morning: 'Matin',
    tab_afternoon: 'Après-midi',
    tab_night: 'Soir',

    // Shifts
    shift_morning_title: 'Matinée',
    shift_morning_sub: 'Créneau matinal (08:00 - 12:00)',
    shift_afternoon_title: 'Après-midi',
    shift_afternoon_sub: 'Créneau après-midi (13:00 - 18:00)',
    shift_night_title: 'Soirée',
    shift_night_sub: 'Créneau du soir (19:00 - 22:00)',
    add_in_shift: 'Ajouter dans',
    no_routines_in_shift: 'Aucune routine enregistrée pour',
    routine_single: 'routine',
    routine_plural: 'routines',

    // Card
    visual_step_single: 'étape visuelle',
    visual_step_plural: 'étapes visuelles',
    activity_sequence: 'Séquence d\'activités :',
    step_prefix: 'Étape',
    keyword_label: 'Clé :',
    show_less_steps: 'Afficher moins d\'étapes',
    see_more_steps: 'Voir',
    activities_more_single: 'activité en plus',
    activities_more_plural: 'activités en plus',
    no_steps_configured: 'Aucune étape configurée',
    btn_edit: 'Modifier',
    btn_delete: 'Supprimer',
    org_label: 'Org :',

    // Drawer
    drawer_create_title: 'Créer une Nouvelle Routine Visuelle',
    drawer_edit_title: 'Modifier la Routine Visuelle',
    drawer_subtitle: 'Définissez les activités avec des mots-clés pour associer automatiquement des pictogrammes ARASAAC.',
    drawer_field_title: 'Titre de la routine',
    drawer_field_title_placeholder: 'Ex: Routine du matin',
    drawer_field_shift: 'Créneau du jour',
    drawer_field_child_id: 'ID de l\'enfant ou utilisateur assigné (facultatif)',
    drawer_field_child_id_placeholder: 'Ex: nino_001',
    drawer_steps_title: 'Séquence d\'Étapes avec Pictogrammes ARASAAC',
    drawer_step_label: 'Étape',
    drawer_step_text_label: 'Description de l\'activité',
    drawer_step_text_placeholder: 'Ex: Se brosser les dents avec du dentifrice',
    drawer_step_keyword_label: 'Mot-clé (ARASAAC)',
    drawer_step_keyword_placeholder: 'Ex: dents',
    drawer_add_step: 'Ajouter une nouvelle étape',
    drawer_cancel: 'Annuler',
    drawer_save_create: 'Créer la Routine',
    drawer_save_edit: 'Enregistrer les Modifications',
    drawer_loading: 'Enregistrement...',

    // Empty state
    empty_example_badge: 'Exemple d\'agenda visuel',
    empty_example_turn: 'Matinée',
    empty_example_title: 'Routine de Début de Journée',
    empty_step_1: 'Se laver les mains',
    empty_step_2: 'Prendre le petit déjeuner',
    empty_step_3: 'Se brosser les dents',
    empty_title_filtered: 'Aucune routine prévue pour',
    empty_title_general: 'Commencez par concevoir votre première routine',
    empty_desc_filtered: 'Aucune activité n\'est configurée pour ce créneau. Vous pouvez créer une séquence sur mesure dès maintenant.',
    empty_desc_general: 'Les pictogrammes anticipent les étapes quotidiennes, créent des repères et diminuent le stress sensoriel.',
    empty_btn_create: 'Créer la première routine',
    the_morning: 'la matinée',
    the_afternoon: 'l\'après-midi',
    the_night: 'la soirée',
    this_shift: 'ce créneau',

    // Modals
    delete_modal_title: 'Supprimer cette routine ?',
    delete_modal_msg: 'Cette routine visuelle sera définitivement supprimée.',
    delete_modal_confirm: 'Oui, supprimer',
    delete_modal_cancel: 'Annuler',

    // Pages
    forbidden_title: 'Autorisations Insuffisantes',
    forbidden_desc: 'Votre profil utilisateur n\'a pas accès à cet espace sécurisé.',
    forbidden_btn: 'Retour à mes Routines',
    indev_tag: 'Feuille de Route du Projet · Livraison 25%',
  },
  de: {
    // Header & Layout
    panel_title: 'Verwaltungsportal',
    nav_routines: 'Visuelle Routinen',
    nav_gps: 'GPS-Ortung',
    nav_ai: 'KI-Vorschläge',
    nav_additional: 'Zusatzmodule',
    upcoming_badge: 'Demnächst',
    session_expired: 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.',
    logout: 'Abmelden',
    logout_confirm: 'Sitzung beenden',
    footer_copy: 'U-Pad — Barrierefreie Plattform für Menschen mit Autismus.',
    footer_arasaac: 'Verwendete Piktogramme:',
    select_language: 'Sprache wechseln',

    // Roles
    role_empresario: 'Manager',
    role_tutor: 'Betreuer / Familie',
    role_anonymous: 'Anonym',

    // Rutinas Page
    routines_title: 'Routinen-Verwaltung',
    routines_subtitle: 'Abläufe mit ARASAAC-Piktogrammen strukturieren, um Aktivitäten zu planen und Unruhe abzubauen',
    reload_routines: 'Routinen neu laden',
    new_routine: 'Neue Routine',
    tab_all: 'Alle',
    tab_morning: 'Morgen',
    tab_afternoon: 'Nachmittag',
    tab_night: 'Abend',

    // Shifts
    shift_morning_title: 'Vormittag',
    shift_morning_sub: 'Morgenzeit (08:00 - 12:00)',
    shift_afternoon_title: 'Nachmittag',
    shift_afternoon_sub: 'Nachmittagszeit (13:00 - 18:00)',
    shift_night_title: 'Abend',
    shift_night_sub: 'Abendzeit (19:00 - 22:00)',
    add_in_shift: 'Hinzufügen zu',
    no_routines_in_shift: 'Keine Routinen geplant für',
    routine_single: 'Routine',
    routine_plural: 'Routinen',

    // Card
    visual_step_single: 'visueller Schritt',
    visual_step_plural: 'visuelle Schritte',
    activity_sequence: 'Aktivitätenfolge:',
    step_prefix: 'Schritt',
    keyword_label: 'Schlagwort:',
    show_less_steps: 'Weniger Schritte anzeigen',
    see_more_steps: 'Mehr anzeigen',
    activities_more_single: 'weitere Aktivität',
    activities_more_plural: 'weitere Aktivitäten',
    no_steps_configured: 'Keine Schritte eingerichtet',
    btn_edit: 'Bearbeiten',
    btn_delete: 'Löschen',
    org_label: 'Org:',

    // Drawer
    drawer_create_title: 'Neue Visuelle Routine Erstellen',
    drawer_edit_title: 'Visuelle Routine Bearbeiten',
    drawer_subtitle: 'Aktivitäten mit Schlagwörtern strukturieren, um ARASAAC-Piktogramme automatisch zuzuweisen.',
    drawer_field_title: 'Titel der Routine',
    drawer_field_title_placeholder: 'Z.B. Morgenroutine zum Aufstehen',
    drawer_field_shift: 'Tageszeit',
    drawer_field_child_id: 'Zugeordnete Benutzer- oder Kind-ID (optional)',
    drawer_field_child_id_placeholder: 'Z.B. kind_001',
    drawer_steps_title: 'Schrittfolge mit ARASAAC-Piktogrammen',
    drawer_step_label: 'Schritt',
    drawer_step_text_label: 'Beschreibung der Aktivität',
    drawer_step_text_placeholder: 'Z.B. Zähne mit Zahnpasta putzen',
    drawer_step_keyword_label: 'Schlagwort (ARASAAC)',
    drawer_step_keyword_placeholder: 'Z.B. Zähne',
    drawer_add_step: 'Neuen Schritt hinzufügen',
    drawer_cancel: 'Abbrechen',
    drawer_save_create: 'Routine Erstellen',
    drawer_save_edit: 'Änderungen Speichern',
    drawer_loading: 'Wird gespeichert...',

    // Empty state
    empty_example_badge: 'Beispiel für einen Ablauf',
    empty_example_turn: 'Vormittag',
    empty_example_title: 'Morgenroutine',
    empty_step_1: 'Hände waschen',
    empty_step_2: 'Frühstücken',
    empty_step_3: 'Zähne putzen',
    empty_title_filtered: 'Keine Routinen geplant für',
    empty_title_general: 'Erstellen Sie Ihre erste visuelle Routine',
    empty_desc_filtered: 'Für diese Tageszeit sind keine Abläufe konfiguriert. Sie können jetzt eine neue Routine anlegen.',
    empty_desc_general: 'Piktogramme geben Struktur und Vorhersehbarkeit und erleichtern den Alltag bei Reizüberflutung.',
    empty_btn_create: 'Erste Routine erstellen',
    the_morning: 'den Vormittag',
    the_afternoon: 'den Nachmittag',
    the_night: 'den Abend',
    this_shift: 'diese Zeit',

    // Modals
    delete_modal_title: 'Diese Routine löschen?',
    delete_modal_msg: 'Diese visuelle Routine wird dauerhaft entfernt. Dieser Vorgang kann nicht rückgängig gemacht werden.',
    delete_modal_confirm: 'Ja, löschen',
    delete_modal_cancel: 'Abbrechen',

    // Pages
    forbidden_title: 'Unzureichende Berechtigungen',
    forbidden_desc: 'Ihr Benutzerkonto verfügt nicht über die erforderliche Berechtigung für diesen Bereich.',
    forbidden_btn: 'Zurück zu meinen Routinen',
    indev_tag: 'Projekt-Fahrplan · 25% Meilenstein',
  },
};

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('upad_web_language') || 'en';
  });

  const changeLanguage = (newLang) => {
    if (TRANSLATIONS[newLang]) {
      setLanguage(newLang);
      localStorage.setItem('upad_web_language', newLang);
      document.documentElement.lang = newLang;
    }
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = (key) => {
    return TRANSLATIONS[language]?.[key] || TRANSLATIONS['en']?.[key] || TRANSLATIONS['es']?.[key] || key;
  };

  /**
   * Traduce texto dinámico (como títulos de rutinas, pasos o palabras clave de la base de datos).
   * Si no está en el mapa, devuelve el texto original intacto.
   */
  const translateDynamicText = (text) => {
    if (!text || typeof text !== 'string') return text;
    const clean = text.trim().toLowerCase();
    const vocab = VOCABULARY_TRANSLATIONS[language] || {};
    return vocab[clean] || text;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        changeLanguage,
        t,
        translateDynamicText,
        supportedLanguages: SUPPORTED_LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage debe ser utilizado dentro de un LanguageProvider');
  }
  return context;
};

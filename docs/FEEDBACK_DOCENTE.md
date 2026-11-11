# Feedback del docente

1. Hacer posible el inicio de sesión con google
2. Mejorar el nombre de los botones o labels, btn_register debería llarmse registrarse
3. Quitar todo tipo de seeders por ejemplo que ya exista un teléfono/tablet vinculado
4. Reducir el perímetro a 200 m máximo para el módulo de GPD tracking
5. Quitar los siguientes elementos del módulo GPS Tracking "Perímetro Seguro Dentro de la zona Radio: 100m Batería & Kiosk 89% · En Carga Kiosk U-Pad Activo Última Conexión Hace un momento Precisión: ±4.5m" "Configuración de Geocerca Zona Segura Designada Colegio San Martín (Escolar) Radio de Tolerancia Perimetral 500 metros 50m (Aula) 250m (Campus) 500m (Barrio) Supervisión Perimetral Activa Si el menor se aleja más de 500m de Colegio San Martín (Zona Segura), se enviará una notificación sonora a tu teléfono y se bloqueará el modo Kiosk." "Protocolo de Emergencia & Kiosk Modo Kiosk Protegido Bloqueado Estado de Red del Móvil 4G LTE Emitir Ping de Localización Sonora"
6. Hacer que el GPS funcione tanto en el teléfono como en la página, por default se debe saber la ubicación en tiempo real del dispositivo del niño/s por lo que el botón de "Simular Trayecto" no tiene sentido
7. Quitar todo el modulo de AI Suggestions del menú principal
8. Eliminar todo tipo de seeder en el módulo "Análisis de desempeño" no debería decir este mensaje si no hay rutinas "Eficacia de Hoy (Miércoles) 83% Logrado Completaste 5 de 6 actividades asignadas en la jornada. La consistencia visual fortalece la autonomía del niño." Si creo un usuario nuevo entonces no debería tener absolutamente nada creado, ni mucho menos tener estadísticas ya hechas en Análisis de Desempeño porque para empezar nunca he creado una rutina
9. Un tutor puede tener más de un hijo/a conectados así que en la pagina cuando se crea una rutina se debe seleccionar de un desplegable entre los hijos, si solo hay uno entonces que se seleccione por defecto.
10. El código del teléfono del niño para poder vincular debe renovarse después de 60 segundos. El error es que nunca se renueva tiene que funcionar como mfa
11. Quitar este texto del modulo rutinas "Structure activities with keywords to automatically bind ARASAAC pictograms."
12. Dentro del panel gerencial de un usuario "Empresario / Colegio" si creo una rutina como usuario tutor debe incrementar Rutinas Institucionales, siempre permanece en 7
13. Que cuando un teléfono se vincule con otro que se incremente el valor de "Población Estudiantil TEA" para que cuente que hay más niños ya que no hay manera de saber cuantos hay dado que no se registran ni logran en la app
14. Quitar este kpi "Tablets en Perímetro 2 Dispositivos Kiosk activos en aula" y este también "Tasa de Adherencia TEA"
15. Quitar este texto del panel gerencial "Colegio Sol de Lima (Educación Inclusiva TEA) · Supervisión ejecutiva basada en evidencias para directores de colegio y clínicas." "Vista Gerencial con Privacidad Protegida (Cero Datos Personales) Cumplimiento de la Ley de Protección de Datos de Menores TEA: Los nombres, correos y fichas médicas personales están completamente aislados y no son visibles en esta vista de dirección. ✓ PII Blindado"
16. Lo mismo para análisis de desempeño en el usuario empresario/colegio, las gráficas y porcentajes deben salir de datos reales de la base de datos no inventarlos o sacarlos de seeders
17. Quitar esto del módulo de developer center como usuario developer quien tiene control absoluto "Persistencia Cloud Run Google Cloud KMS Activo Poder de Administrador CRUD Completo Habilitado"
18. Arreglar el poder desvincular un niño desde la página, en la app movil ya funciona bien pero no en la pagina
19. Además de "Gestión de Cuentas (CRUD Developer)" agregar lo mismo pero para rutinas que me liste todas las rutinas que existan y que muestre siempre la más reciente y abajo la más antigua, lo mismo para usuarios.
20. Cambiar el nombre de "Gestión de Cuentas (CRUD DEVELOPER)" a solo "Gestión de Cuentas"
21. Eliminar por completo "SELECT * FROM usuarios (Raw Database View)" y cambiar el nombre de "Developer Center: Poder Absoluto de Base de Datos" a tan solo "Developer Center" quitar la opción "Refrescar"
22. Arreglar esto "Página 1 de 128 (763 rutinas registradas) Anterior 1 2 3 4 5 6 7 8 9 10" ya que se rompe la pagina y no hay paginación

Nota extra de la entrega: borrar el rol de administrador del sistema ya que se duplica con el de empresario.

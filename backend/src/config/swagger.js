import swaggerUi from 'swagger-ui-express';

export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'U-Pad API Documentation',
    version: '1.0.0',
    description: 'Documentación técnica interactiva de la API Backend de U-Pad (Entrega 25%). Incluye autenticación con JWT, contraseñas con bcrypt, control de Rate Limiting y CRUD de Rutinas Visuales para niños con TEA.',
    contact: {
      name: 'Equipo U-Pad',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Servidor local de desarrollo / emulador',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Introduce tu token JWT obtenido en /api/auth/login o /api/auth/register (ej: Bearer eyJhbGci...)',
      },
    },
    schemas: {
      StandardResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operación exitosa' },
          data: { type: 'object' },
        },
      },
      StandardError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Descripción del error' },
          errors: { type: 'object' },
        },
      },
      PasoRutina: {
        type: 'object',
        required: ['orden', 'texto'],
        properties: {
          orden: { type: 'integer', example: 1 },
          texto: { type: 'string', example: 'Lavarse las manos', description: '1 a 120 caracteres; mismos caracteres que el título, máx. 6 guiones' },
          palabraClave: { type: 'string', example: 'lavar', description: 'Palabra para buscar el pictograma (por defecto, el texto)' },
          duracionMinutos: { type: 'integer', minimum: 1, maximum: 120, example: 5, description: 'Minutos del paso (por defecto 5)' },
          pictogramaId: { type: 'integer', example: 8975, description: 'Opcional: pictograma de ARASAAC elegido' },
        },
      },
      RutinaInput: {
        type: 'object',
        required: ['titulo'],
        properties: {
          titulo: {
            type: 'string',
            example: 'Rutina de Mañana - Escuela',
            description: '3 a 60 caracteres: solo letras (con tildes, ü y ñ), números, espacios y el guion (máx. 4, sin dos seguidos; empieza y termina con letra o número). Si no → 400 TITULO_INVALIDO.',
          },
          turno: { type: 'string', enum: ['MANANA', 'TARDE', 'NOCHE'], example: 'MANANA' },
          ninoId: {
            type: 'string',
            nullable: true,
            example: 'device_id del hijo',
            description: 'device_id de un hijo vinculado; null = para todos los hijos',
          },
          pasos: {
            type: 'array',
            maxItems: 20,
            description: 'Hasta 20 pasos; sin pasos, la rutina tiene un único paso con su título. La respuesta incluye duracionTotalMinutos (suma). Inválidos → 400 PASOS_INVALIDOS.',
            items: { $ref: '#/components/schemas/PasoRutina' },
          },
        },
      },
    },
  },
  paths: {
    '/': {
      get: {
        summary: 'Sitio en desarrollo (Ruta raíz)',
        tags: ['Sistema'],
        responses: {
          200: {
            description: 'Estado operativo del servicio',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/StandardResponse' } } },
          },
        },
      },
    },
    '/health': {
      get: {
        summary: 'Health Check y verificación de Firestore',
        tags: ['Sistema'],
        responses: {
          200: { description: 'Conexión a base de datos operativa' },
          503: { description: 'Fallo de conectividad con Firestore' },
        },
      },
    },
    '/api/auth/register': {
      post: {
        summary: 'Registro de usuario (contraseña hasheada con bcrypt)',
        tags: ['Autenticación'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['nombre', 'email', 'password'],
                properties: {
                  nombre: { type: 'string', example: 'Colegio San Martín' },
                  email: { type: 'string', example: 'director@sanmartin.edu.pe' },
                  password: { type: 'string', example: 'claveSegura123' },
                  rol: { type: 'string', enum: ['empresario', 'tutor'], example: 'empresario' },
                  codigoOrganizacion: {
                    type: 'string',
                    description: 'Solo para tutores (opcional): código de la organización que entregó su institución. El empresario recibe su propia organización al registrarse. El cliente nunca envía un organizacionId.',
                    example: 'K7M2-Q9XD',
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Usuario registrado exitosamente con token JWT (y su organización)' },
          400: { description: 'Datos inválidos o contraseña menor a 6 caracteres' },
          409: { description: 'El correo electrónico ya existe' },
          429: { description: 'Límite de intentos de autenticación excedido' },
        },
      },
    },
    '/api/auth/login': {
      post: {
        summary: 'Inicio de sesión (verificación de credenciales y emisión de JWT)',
        tags: ['Autenticación'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'director@sanmartin.edu.pe' },
                  password: { type: 'string', example: 'claveSegura123' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Login exitoso, devuelve usuario y token' },
          401: { description: 'Credenciales inválidas' },
          403: { description: 'Cuenta desactivada' },
          429: { description: 'Límite de peticiones excedido' },
        },
      },
    },
    '/api/auth/me': {
      get: {
        summary: 'Perfil del usuario con token activo',
        tags: ['Autenticación'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Sesión activa y datos del usuario' },
          401: { description: 'Token faltante o expirado' },
        },
      },
      delete: {
        summary: 'Borrar la propia cuenta (confirmando la contraseña)',
        description:
          'Borra la cuenta y sus rutinas, hijos vinculados, avisos y cumplimientos. Si es un empresario, también su organización (sus tutores quedan sin organización). Un developer no puede borrarse a sí mismo. Lo usan las pruebas de k6 para no dejar cuentas temporales.',
        tags: ['Autenticación'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['password'], properties: { password: { type: 'string' } } },
            },
          },
        },
        responses: {
          200: { description: 'Cuenta eliminada' },
          400: { description: 'Falta la contraseña (PASSWORD_REQUERIDO)' },
          401: { description: 'Contraseña incorrecta o token inválido' },
          403: { description: 'Un developer no puede borrarse a sí mismo' },
        },
      },
    },
    '/api/rutinas': {
      get: {
        summary: 'Listar rutinas (con filtros por turno y aislamiento por rol)',
        tags: ['Rutinas'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'turno',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['MANANA', 'TARDE', 'NOCHE'] },
            description: 'Filtrar por horario del día',
          },
        ],
        responses: {
          200: { description: 'Listado de rutinas encontradas' },
          401: { description: 'No autorizado' },
        },
      },
      post: {
        summary: 'Crear nueva rutina con pictogramas visuales',
        tags: ['Rutinas'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/RutinaInput' } },
          },
        },
        responses: {
          201: { description: 'Rutina creada exitosamente' },
          400: { description: 'Título obligatorio o datos inválidos' },
          401: { description: 'No autorizado' },
        },
      },
    },
    '/api/rutinas/{id}': {
      get: {
        summary: 'Obtener detalle de una rutina por su ID',
        tags: ['Rutinas'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Detalle de la rutina' },
          404: { description: 'Rutina no encontrada' },
        },
      },
      put: {
        summary: 'Actualizar una rutina existente',
        tags: ['Rutinas'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/RutinaInput' } },
          },
        },
        responses: {
          200: { description: 'Rutina actualizada' },
          404: { description: 'Rutina no encontrada' },
        },
      },
      delete: {
        summary: 'Eliminar una rutina de Firestore',
        tags: ['Rutinas'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Rutina eliminada exitosamente' },
          404: { description: 'Rutina no encontrada' },
        },
      },
    },
    '/api/organizaciones/unirse': {
      post: {
        summary: 'Un tutor se une (o cambia) a una institución con su código',
        description: 'Sus rutinas y cumplimientos pasan a la institución y cuentan en los KPIs del director.',
        tags: ['Organizaciones'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['codigo'], properties: { codigo: { type: 'string', example: 'K7M2-Q9XD' } } } } },
        },
        responses: {
          200: { description: 'Unido: { organizacion: { id, nombre } }' },
          400: { description: 'Código inválido (ORGANIZACION_CODIGO_INVALIDO)' },
          403: { description: 'Solo tutores (FORBIDDEN_ROLE)' },
        },
      },
    },
    '/api/organizaciones/membresia': {
      delete: {
        summary: 'Un tutor deja su institución',
        tags: ['Organizaciones'],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Sin institución' }, 403: { description: 'Solo tutores' } },
      },
    },
    '/api/v1/devices/{deviceId}/cumplimiento': {
      get: {
        summary: 'Lo que el teléfono del niño completó en una fecha (sin token; solo vinculados)',
        tags: ['Dispositivos'],
        parameters: [
          { name: 'deviceId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'fecha', in: 'query', required: true, schema: { type: 'string', example: '2026-11-16' }, description: 'Fecha local, ±1 día' },
        ],
        responses: {
          200: { description: '{ fecha, completadas: [{ rutinaId, actividad, turno }] }' },
          400: { description: 'FECHA_INVALIDA' },
          404: { description: 'Dispositivo no vinculado' },
          429: { description: 'CUMPLIMIENTO_RATE_LIMIT (60 por minuto)' },
        },
      },
    },
    '/api/v1/mobile/sync-routines': {
      get: {
        summary: 'Rutinas para la app (en orden de creación); con ?deviceId= solo las de ese hijo y las «para todos»',
        tags: ['App móvil'],
        parameters: [
          { name: 'userId', in: 'query', schema: { type: 'string' }, description: 'Sin token (modo de compatibilidad)' },
          { name: 'deviceId', in: 'query', schema: { type: 'string' }, description: 'Teléfono del niño' },
        ],
        responses: { 200: { description: 'Lista con id, actividad, turno, ninoId, pasos y duracionTotalMinutos' } },
      },
    },
    '/api/test-status/{code}': {
      get: {
        summary: 'Simular códigos de estado HTTP controlados',
        tags: ['Pruebas'],
        parameters: [
          {
            name: 'code',
            in: 'path',
            required: true,
            schema: { type: 'integer', enum: [200, 201, 400, 401, 403, 409, 429, 500] },
            description: 'Código HTTP a simular',
          },
        ],
        responses: {
          200: { description: 'Simulación exitosa' },
          400: { description: 'Simulación 400' },
          401: { description: 'Simulación 401' },
          403: { description: 'Simulación 403' },
          409: { description: 'Simulación 409' },
          429: { description: 'Simulación 429' },
          500: { description: 'Simulación 500' },
        },
      },
    },
  },
};

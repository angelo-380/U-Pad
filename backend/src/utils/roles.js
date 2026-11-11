/**
 * Catálogo central de roles de U-Pad (backend web).
 *
 * - developer: administrador del sistema (backups, consola SQL, CRUD de usuarios).
 * - empresario: director de colegio o clínica (KPIs y rutinas de su organización).
 * - tutor: familiar o docente (solo ve sus propias rutinas).
 * - nino: rol objetivo para una etapa futura. Hoy NO es registrable ni asignable
 *   y ninguna ruta lo autoriza (el niño es solo un dispositivo vinculado).
 */
export const ROLES = Object.freeze({
  DEVELOPER: 'developer',
  EMPRESARIO: 'empresario',
  TUTOR: 'tutor',
  NINO: 'nino',
});

/** Roles que una persona puede elegir al registrarse por la API pública. */
export const ROLES_REGISTRO_PUBLICO = Object.freeze([ROLES.EMPRESARIO, ROLES.TUTOR]);

/** Roles que un developer puede asignar al crear o editar usuarios. */
export const ROLES_ASIGNABLES = Object.freeze([ROLES.DEVELOPER, ROLES.EMPRESARIO, ROLES.TUTOR]);

/**
 * Normaliza un rol recibido (trim + minúsculas).
 * Devuelve null si el valor no es un string, para evitar errores 500 con entradas
 * inesperadas (números, objetos, arreglos).
 */
export const normalizarRol = (valor) => {
  if (typeof valor !== 'string') return null;
  return valor.trim().toLowerCase();
};

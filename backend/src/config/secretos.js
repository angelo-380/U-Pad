/**
 * Secretos obligatorios del backend. NUNCA llevan valores por defecto en el código:
 * se leen solo del entorno (backend/.env en local, variables de Cloud Run en producción).
 */
export const SECRETOS_OBLIGATORIOS = ['JWT_SECRET', 'GCP_KMS_PEPPER_SECRET'];

const definido = (valor) => typeof valor === 'string' && valor.trim() !== '';

/** Nombres de los secretos que faltan (o están vacíos) en el entorno indicado. */
export const secretosFaltantes = (env = process.env) => SECRETOS_OBLIGATORIOS.filter((nombre) => !definido(env[nombre]));

/**
 * Detiene el arranque si falta algún secreto, avisando solo con los NOMBRES (nunca con valores).
 */
export const exigirSecretosAlArrancar = () => {
  const faltan = secretosFaltantes();
  if (faltan.length > 0) {
    console.error(
      `[U-Pad Backend] No se puede arrancar: faltan las variables de entorno obligatorias ${faltan.join(', ')}. ` +
        'Defínelas en backend/.env (local) o en las variables del servicio de Cloud Run (producción).'
    );
    process.exit(1);
  }
};

/** Lee un secreto obligatorio en el momento de usarlo; falla de forma explícita si no existe. */
export const leerSecreto = (nombre) => {
  const valor = process.env[nombre];
  if (!definido(valor)) {
    throw new Error(`Falta la variable de entorno obligatoria ${nombre}.`);
  }
  return valor;
};

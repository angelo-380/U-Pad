/**
 * Traduce los errores de la API al idioma activo usando el `code` que devuelve el backend
 * (en `errors.code`). Si el código no es conocido, se usa el mensaje original del servidor.
 */
const CLAVES_POR_CODIGO = {
  INVALID_CREDENTIALS: 'api_invalid_credentials',
  ACCOUNT_INACTIVE: 'api_account_inactive',
  EMAIL_ALREADY_EXISTS: 'api_email_exists',
  INVALID_EMAIL_FORMAT: 'api_invalid_email',
  INVALID_ROLE: 'api_invalid_role',
  ORGANIZACION_CODIGO_INVALIDO: 'api_org_code_invalid',
  ORGANIZACION_CODIGO_NO_APLICA: 'api_org_code_not_applicable',
  PASSWORD_TOO_SHORT: 'register_pass_short',
  PASSWORD_NO_UPPERCASE: 'register_pass_policy',
  PASSWORD_NO_DIGIT: 'register_pass_policy',
  PASSWORD_NO_SPECIAL: 'register_pass_policy',
  AUTH_RATE_LIMIT_EXCEEDED: 'api_rate_limited',
  RATE_LIMIT_EXCEEDED: 'api_rate_limited',
  NETWORK_ERROR: 'api_network_error',
  GOOGLE_NO_CONFIGURADO: 'api_google_not_configured',
  GOOGLE_TOKEN_INVALIDO: 'api_google_invalid',
  GOOGLE_CREDENCIAL_REQUERIDA: 'api_google_invalid',
  GOOGLE_EMAIL_NO_VERIFICADO: 'api_google_email_unverified',
  GOOGLE_CUENTA_DISTINTA: 'api_google_other_account',
  GOOGLE_YA_REGISTRADO: 'api_google_already_registered',
  NOMBRE_INSTITUCION_REQUERIDO: 'api_institution_required',
};

export const mensajeDeError = (err, t, respaldo = '') => {
  const detalles = err?.data?.errors || {};
  const codigo = detalles.code || err?.code;

  if (codigo === 'ACCOUNT_LOCKED') {
    const minutos = Math.max(1, Math.ceil((Number(detalles.remainingSeconds) || 60) / 60));
    return t('api_account_locked', { minutos });
  }
  if (codigo === 'INVALID_CREDENTIALS' && Number.isInteger(detalles.intentosRestantes)) {
    return t('api_invalid_credentials_left', { intentos: detalles.intentosRestantes });
  }

  const clave = CLAVES_POR_CODIGO[codigo];
  if (clave) return t(clave);
  return err?.message || respaldo;
};

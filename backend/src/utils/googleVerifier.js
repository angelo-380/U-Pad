import { OAuth2Client } from 'google-auth-library';
import { AppError } from './AppError.js';

/**
 * Verificación de la credencial (ID token) que entrega Google Identity Services en la web.
 * La librería oficial comprueba la firma con las claves públicas de Google, la audiencia
 * (= GOOGLE_CLIENT_ID), el emisor y la caducidad. Además se exige que el correo esté verificado.
 */

/** Client ID público de Google (no es un secreto). null si no está configurado. */
export const googleClientId = () => {
  const valor = (process.env.GOOGLE_CLIENT_ID || '').trim();
  return valor || null;
};

let clienteOAuth = null;
let clienteParaId = null;
const verificarConGoogle = async (credential, audiencia) => {
  if (!clienteOAuth || clienteParaId !== audiencia) {
    clienteOAuth = new OAuth2Client(audiencia);
    clienteParaId = audiencia;
  }
  const ticket = await clienteOAuth.verifyIdToken({ idToken: credential, audience: audiencia });
  return ticket.getPayload();
};

// Solo para tests: permite simular a Google (no se pueden firmar tokens reales de Google en los tests).
let verificadorPersonalizado = null;
export const establecerVerificadorGoogle = (fn) => {
  verificadorPersonalizado = typeof fn === 'function' ? fn : null;
};

/** Devuelve { sub, email, nombre } de una credencial válida de Google, o lanza AppError. */
export const verificarCredencialGoogle = async (credential) => {
  const audiencia = googleClientId();
  if (!audiencia) {
    throw new AppError('El inicio de sesión con Google no está configurado en el servidor.', 503, { code: 'GOOGLE_NO_CONFIGURADO' });
  }
  if (typeof credential !== 'string' || !credential.trim()) {
    throw new AppError('Falta la credencial de Google.', 400, { code: 'GOOGLE_CREDENCIAL_REQUERIDA' });
  }

  let payload;
  try {
    payload = verificadorPersonalizado
      ? await verificadorPersonalizado(credential, audiencia)
      : await verificarConGoogle(credential, audiencia);
  } catch (e) {
    throw new AppError('No se pudo verificar la cuenta de Google. Inténtalo de nuevo.', 401, { code: 'GOOGLE_TOKEN_INVALIDO' });
  }

  if (!payload?.sub || !payload?.email) {
    throw new AppError('No se pudo verificar la cuenta de Google. Inténtalo de nuevo.', 401, { code: 'GOOGLE_TOKEN_INVALIDO' });
  }
  if (payload.email_verified !== true) {
    throw new AppError('El correo de esta cuenta de Google no está verificado.', 401, { code: 'GOOGLE_EMAIL_NO_VERIFICADO' });
  }

  const email = String(payload.email).toLowerCase().trim();
  const nombre = typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim().slice(0, 100) : email.split('@')[0];
  return { sub: String(payload.sub), email, nombre };
};

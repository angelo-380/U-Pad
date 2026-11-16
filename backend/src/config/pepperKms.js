/**
 * Pepper de las contraseñas custodiado por Cloud KMS.
 *
 * En Cloud Run se configuran:
 *   PEPPER_KMS_CIFRADO  texto cifrado del pepper (base64), generado con scripts/cifrarPepper.js
 *   PEPPER_KMS_CLAVE    nombre completo de la clave: projects/…/locations/…/keyRings/…/cryptoKeys/…
 * Al arrancar (server.js, antes de abrir la base) se descifra con KMS y el pepper queda SOLO en memoria
 * (process.env.GCP_KMS_PEPPER_SECRET del proceso). Nunca se imprime.
 * Sin esas variables se usa GCP_KMS_PEPPER_SECRET tal cual (desarrollo local y tests).
 */

const descifrarConKms = async ({ nombreClave, cifrado }) => {
  const { KeyManagementServiceClient } = await import('@google-cloud/kms');
  const cliente = new KeyManagementServiceClient();
  const [respuesta] = await cliente.decrypt({ name: nombreClave, ciphertext: cifrado });
  return Buffer.from(respuesta.plaintext);
};

/**
 * Devuelve { origen: 'kms' | 'entorno' }. Lanza un error (sin datos secretos) si la configuración de KMS
 * está incompleta, si KMS falla o si el pepper descifrado está vacío.
 */
export async function resolverPepperKms(env = process.env, { descifrar = descifrarConKms } = {}) {
  const cifrado = (env.PEPPER_KMS_CIFRADO || '').trim();
  const nombreClave = (env.PEPPER_KMS_CLAVE || '').trim();

  if (!cifrado && !nombreClave) {
    env.UPAD_PEPPER_ORIGEN = 'variable de entorno';
    return { origen: 'entorno' };
  }
  const faltan = [!cifrado && 'PEPPER_KMS_CIFRADO', !nombreClave && 'PEPPER_KMS_CLAVE'].filter(Boolean);
  if (faltan.length) {
    throw new Error(`Configuración de Cloud KMS incompleta: falta ${faltan.join(' y ')}.`);
  }

  const claro = Buffer.from(await descifrar({ nombreClave, cifrado: Buffer.from(cifrado, 'base64') })).toString('utf8');
  if (!claro.trim()) {
    throw new Error('El pepper descifrado con Cloud KMS está vacío.');
  }
  if ((env.GCP_KMS_PEPPER_SECRET || '').trim()) {
    console.warn('[U-Pad] GCP_KMS_PEPPER_SECRET se ignora: el pepper viene de Cloud KMS. Quita esa variable de Cloud Run.');
  }
  env.GCP_KMS_PEPPER_SECRET = claro;
  env.UPAD_PEPPER_ORIGEN = 'Cloud KMS';
  return { origen: 'kms' };
}

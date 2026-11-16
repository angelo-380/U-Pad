/**
 * Genera un pepper NUEVO y aleatorio, lo cifra con Cloud KMS e imprime SOLO el texto cifrado (base64),
 * que va en la variable PEPPER_KMS_CIFRADO de Cloud Run. El pepper en claro nunca se muestra ni se guarda.
 *
 * Uso (lo ejecuta el usuario, con sus credenciales de Google: `gcloud auth application-default login`):
 *   cd backend
 *   node scripts/cifrarPepper.js projects/PROYECTO/locations/REGION/keyRings/LLAVERO/cryptoKeys/CLAVE
 */
import crypto from 'node:crypto';
import { KeyManagementServiceClient } from '@google-cloud/kms';

const nombreClave = (process.argv[2] || '').trim();
if (!/^projects\/[^/]+\/locations\/[^/]+\/keyRings\/[^/]+\/cryptoKeys\/[^/]+$/.test(nombreClave)) {
  console.error('Uso: node scripts/cifrarPepper.js projects/PROYECTO/locations/REGION/keyRings/LLAVERO/cryptoKeys/CLAVE');
  process.exit(1);
}

const cliente = new KeyManagementServiceClient();
const claro = Buffer.from(crypto.randomBytes(32).toString('hex'), 'utf8');

try {
  const [cifrado] = await cliente.encrypt({ name: nombreClave, plaintext: claro });
  // Comprobación de ida y vuelta: la clave descifra lo que cifró (requiere permiso de descifrado)
  const [descifrado] = await cliente.decrypt({ name: nombreClave, ciphertext: cifrado.ciphertext });
  if (!crypto.timingSafeEqual(Buffer.from(descifrado.plaintext), claro)) {
    throw new Error('la comprobación de descifrado no coincide');
  }
  console.error('Pepper nuevo cifrado y comprobado con Cloud KMS. Copia esta línea en PEPPER_KMS_CIFRADO:');
  console.log(Buffer.from(cifrado.ciphertext).toString('base64'));
} catch (e) {
  console.error(`No se pudo cifrar con Cloud KMS: ${e.message}`);
  process.exit(1);
} finally {
  claro.fill(0);
}

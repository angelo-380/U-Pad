import fs from 'fs';
import path from 'path';
import JavaScriptObfuscator from 'javascript-obfuscator';

/**
 * Script de Cifrado y Ofuscación para U-Pad Backend (Entrega 25%).
 * Cifra el código fuente de /src hacia /dist transformando variables,
 * strings y funciones a formato hexadecimal/ininteligible.
 */

const SRC_DIR = path.resolve('src');
const DIST_DIR = path.resolve('dist');

const OBFUSCATOR_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  numbersToExpressions: true,
  simplify: true,
  stringArrayShuffle: true,
  splitStrings: true,
  stringArrayThreshold: 0.75,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  identifierNamesGenerator: 'hexadecimal',
};

function ofuscarDirectorio(directorioOrigen, directorioDestino) {
  if (!fs.existsSync(directorioDestino)) {
    fs.mkdirSync(directorioDestino, { recursive: true });
  }

  const items = fs.readdirSync(directorioOrigen);

  for (const item of items) {
    const origenItem = path.join(directorioOrigen, item);
    const destinoItem = path.join(directorioDestino, item);
    const stat = fs.statSync(origenItem);

    if (stat.isDirectory()) {
      ofuscarDirectorio(origenItem, destinoItem);
    } else if (item.endsWith('.js')) {
      const codigoOriginal = fs.readFileSync(origenItem, 'utf-8');
      const resultadoOfuscado = JavaScriptObfuscator.obfuscate(codigoOriginal, OBFUSCATOR_OPTIONS);
      fs.writeFileSync(destinoItem, resultadoOfuscado.getObfuscatedCode(), 'utf-8');
      console.log(`[CIFRADO OK] ${path.relative(process.cwd(), origenItem)} -> ${path.relative(process.cwd(), destinoItem)}`);
    } else {
      fs.copyFileSync(origenItem, destinoItem);
    }
  }
}

console.log('\n============================================================');
console.log('[U-PAD SECURITY] Iniciando Cifrado y Ofuscación de Código');
console.log('============================================================\n');

ofuscarDirectorio(SRC_DIR, DIST_DIR);

console.log('\n============================================================');
console.log('¡Código del Backend 100% cifrado y ofuscado en /dist!');
console.log('Para ejecutar la versión cifrada: npm run start:dist');
console.log('============================================================\n');

/**
 * Ejecuta k6 con los argumentos recibidos (lo usan los scripts «carga*» de package.json).
 * Funciona en macOS, Linux y Windows, y explica cómo instalar k6 si no está.
 */
import { spawnSync } from 'node:child_process';

const opciones = { shell: process.platform === 'win32' };

const instalado = spawnSync('k6', ['version'], { ...opciones, stdio: 'ignore' });
if (instalado.error || instalado.status !== 0) {
  console.error('\nNo se encontró k6. Instálalo y vuelve a intentarlo:');
  console.error('  macOS:   brew install k6');
  console.error('  Windows: winget install k6 --source winget');
  console.error('  Linux:   https://grafana.com/docs/k6/latest/set-up/install-k6/\n');
  process.exit(1);
}

const resultado = spawnSync('k6', process.argv.slice(2), { ...opciones, stdio: 'inherit' });
process.exit(resultado.status ?? 1);

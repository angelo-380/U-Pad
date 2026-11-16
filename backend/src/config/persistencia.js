/**
 * Dónde vive la base SQLite (lo informa /health y se avisa en el arranque):
 * - 'Cloud Storage (Litestream)': scripts/arranque.sh restauró la base y la replica de forma continua.
 * - 'disco temporal': Cloud Run sin réplica; los datos se pierden al reiniciar o desplegar.
 * - 'local': fuera de Cloud Run (desarrollo).
 */
export const descripcionPersistencia = (env = process.env) => {
  if (env.LITESTREAM_ACTIVO === '1') return 'Cloud Storage (Litestream)';
  if (env.K_SERVICE) return 'disco temporal';
  return 'local';
};

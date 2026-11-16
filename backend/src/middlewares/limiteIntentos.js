/**
 * Límite de intentos en memoria por ventana deslizante (independiente de RATE_LIMIT_DISABLED).
 * Cada petición cuenta para todas sus claves (p. ej. cuenta e IP); si alguna llegó al máximo, responde 429.
 * Nota: en memoria por instancia de Cloud Run (suficiente para frenar la fuerza bruta en una instancia).
 */
export const crearLimiteIntentos = ({ ventanaMs, maximo, claves, codigo, mensaje }) => {
  const registros = new Map();

  const podar = (ahora) => {
    for (const [clave, marcas] of registros) {
      const vigentes = marcas.filter((t) => ahora - t < ventanaMs);
      if (vigentes.length === 0) registros.delete(clave);
      else registros.set(clave, vigentes);
    }
  };

  const middleware = (req, res, next) => {
    const ahora = Date.now();
    if (registros.size > 5000) podar(ahora);

    const lista = claves(req).filter(Boolean);
    const vigentes = lista.map((clave) => (registros.get(clave) || []).filter((t) => ahora - t < ventanaMs));
    const bloqueada = vigentes.findIndex((marcas) => marcas.length >= maximo);

    if (bloqueada !== -1) {
      const reintentarEn = Math.max(1, Math.ceil((vigentes[bloqueada][0] + ventanaMs - ahora) / 1000));
      res.set('Retry-After', String(reintentarEn));
      return res.status(429).json({
        success: false,
        message: mensaje,
        errors: { code: codigo, remainingSeconds: reintentarEn },
      });
    }

    lista.forEach((clave, i) => registros.set(clave, [...vigentes[i], ahora]));
    return next();
  };

  middleware.reiniciar = () => registros.clear();
  return middleware;
};

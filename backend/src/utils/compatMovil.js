/**
 * Modo de compatibilidad con el APK actual, que no envía token: la app se identifica con userId/parentId.
 * Activado salvo que MOBILE_SIN_TOKEN sea 'false'. Apagarlo cuando la app envíe `Authorization: Bearer`.
 */
export const compatibilidadMovilActiva = () => process.env.MOBILE_SIN_TOKEN !== 'false';

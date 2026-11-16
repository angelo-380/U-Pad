import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Compass,
  RefreshCw,
  MapPin,
  Tablet,
  Clock,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Loader2,
  Crosshair,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { devicesService } from '../../services/devicesService.js';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

// La app del niño envía su ubicación cada 5-10 s; la página la consulta cada 10 s
const INTERVALO_CONSULTA_MS = 10_000;
// Pasado este tiempo sin ubicación nueva, se avisa que puede estar desactualizada
const UBICACION_DESACTUALIZADA_MS = 2 * 60_000;
// Radio de la zona segura (punto 4 del docente: 200 m como máximo; igual que el backend)
const RADIO_MIN = 20;
const RADIO_MAX = 200;
const RADIO_POR_DEFECTO = 100;

/** Distancia en metros entre dos coordenadas (fórmula de Haversine). */
const distanciaMetros = (a, b) => {
  const R = 6371000;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const idDe = (d) => d?.deviceId || d?.device_id;

/**
 * Seguimiento GPS con datos reales: la ubicación que envía el teléfono del niño y la zona segura
 * (radio de 20 a 200 m) que define el tutor. Sin simulaciones ni valores de ejemplo.
 */
export const GpsPage = () => {
  const { t, language } = useLanguage();
  const toast = useToast();
  const navigate = useNavigate();
  const [hijos, setHijos] = useState([]);
  const [seleccionadoId, setSeleccionadoId] = useState('');
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState(null);
  const [ahora, setAhora] = useState(Date.now());
  const [radio, setRadio] = useState(RADIO_POR_DEFECTO);
  const [guardandoZona, setGuardandoZona] = useState(false);

  const cargarHijos = useCallback(async ({ silencioso = false } = {}) => {
    if (!silencioso) setActualizando(true);
    try {
      const lista = await devicesService.listar();
      const hijosValidos = Array.isArray(lista) ? lista : [];
      setHijos(hijosValidos);
      setError(null);
      setSeleccionadoId((actual) =>
        hijosValidos.some((h) => idDe(h) === actual) ? actual : idDe(hijosValidos[0]) || ''
      );
    } catch (e) {
      // El texto traducido se resuelve al renderizar (así esta función no depende de t)
      setError(e?.message || '');
    } finally {
      setCargando(false);
      setActualizando(false);
      setAhora(Date.now());
    }
  }, []);

  // Carga inicial y consulta periódica (tiempo real)
  useEffect(() => {
    cargarHijos();
    const consulta = setInterval(() => cargarHijos({ silencioso: true }), INTERVALO_CONSULTA_MS);
    const reloj = setInterval(() => setAhora(Date.now()), 5_000);
    return () => {
      clearInterval(consulta);
      clearInterval(reloj);
    };
  }, [cargarHijos]);

  const hijo = hijos.find((h) => idDe(h) === seleccionadoId) || null;
  const zona = hijo?.zonaSegura || null;

  // Al cambiar de hijo, el deslizador muestra el radio de su zona (o el valor por defecto)
  useEffect(() => {
    setRadio(zona?.radio || RADIO_POR_DEFECTO);
  }, [seleccionadoId, zona?.radio]);

  const tieneUbicacion =
    hijo && typeof hijo.lastLatitude === 'number' && typeof hijo.lastLongitude === 'number';
  const ubicacion = tieneUbicacion ? { latitude: hijo.lastLatitude, longitude: hijo.lastLongitude } : null;

  const actualizadaEnMs = hijo?.ubicacionActualizadaEn ? new Date(hijo.ubicacionActualizadaEn).getTime() : NaN;
  const segundosDesde = Number.isFinite(actualizadaEnMs) ? Math.max(0, Math.round((ahora - actualizadaEnMs) / 1000)) : null;
  const desactualizada = segundosDesde !== null && segundosDesde * 1000 > UBICACION_DESACTUALIZADA_MS;

  const formatoRelativo = new Intl.RelativeTimeFormat(language || 'es', { numeric: 'auto' });
  const haceCuanto = (seg) => {
    if (seg < 60) return formatoRelativo.format(-seg, 'second');
    if (seg < 3600) return formatoRelativo.format(-Math.round(seg / 60), 'minute');
    if (seg < 86400) return formatoRelativo.format(-Math.round(seg / 3600), 'hour');
    return formatoRelativo.format(-Math.round(seg / 86400), 'day');
  };

  const distanciaAZona = ubicacion && zona ? Math.round(distanciaMetros(ubicacion, zona)) : null;
  const dentroDeZona = distanciaAZona !== null && distanciaAZona <= zona.radio;

  const guardarZona = async (centro) => {
    if (!hijo || !centro) return;
    try {
      setGuardandoZona(true);
      await devicesService.guardarZonaSegura(idDe(hijo), { latitude: centro.latitude, longitude: centro.longitude, radio });
      toast.success(t('gps_zone_saved'));
      await cargarHijos({ silencioso: true });
    } catch (e) {
      toast.error(e?.message || t('gps_zone_error'));
    } finally {
      setGuardandoZona(false);
    }
  };

  const quitarZona = async () => {
    if (!hijo) return;
    try {
      setGuardandoZona(true);
      await devicesService.quitarZonaSegura(idDe(hijo));
      toast.success(t('gps_zone_removed'));
      await cargarHijos({ silencioso: true });
    } catch (e) {
      toast.error(e?.message || t('gps_zone_error'));
    } finally {
      setGuardandoZona(false);
    }
  };

  // Mapa de OpenStreetMap centrado en la ubicación real
  const delta = 0.004;
  const mapUrl = ubicacion
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${ubicacion.longitude - delta}%2C${ubicacion.latitude - delta}%2C${ubicacion.longitude + delta}%2C${ubicacion.latitude + delta}&layer=mapnik&marker=${ubicacion.latitude}%2C${ubicacion.longitude}`
    : null;
  const enlaceMapa = ubicacion
    ? `https://www.openstreetmap.org/?mlat=${ubicacion.latitude}&mlon=${ubicacion.longitude}#map=17/${ubicacion.latitude}/${ubicacion.longitude}`
    : null;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-tea-border">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-brand-50 text-brand-700">
            <Compass className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-tea-text tracking-tight">{t('gps_title')}</h1>
            <p className="text-sm text-tea-muted mt-0.5">{t('gps_subtitle')}</p>
          </div>
        </div>
        {hijos.length > 0 && (
          <button
            type="button"
            onClick={() => cargarHijos()}
            disabled={actualizando}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-tea-text bg-white border border-tea-border hover:bg-slate-50 transition-tea shadow-sm cursor-pointer disabled:opacity-50 self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${actualizando ? 'animate-spin text-brand-600' : ''}`} />
            <span>{t('gps_refresh')}</span>
          </button>
        )}
      </div>

      {error !== null && (
        <div className="p-3.5 rounded-2xl text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-800" role="alert">
          {error || t('gps_load_error')}
        </div>
      )}

      {cargando ? (
        <div className="flex justify-center py-16 text-tea-muted">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : hijos.length === 0 ? (
        /* Sin hijos vinculados: no hay nada que ubicar */
        <div className="bg-white rounded-3xl p-8 border border-tea-border shadow-soft-xs flex flex-col items-center text-center gap-3">
          <span className="p-3 rounded-2xl bg-brand-50 text-brand-600">
            <Tablet className="w-7 h-7" />
          </span>
          <h2 className="text-base font-extrabold text-tea-text">{t('gps_no_children_title')}</h2>
          <p className="text-xs text-tea-muted max-w-md">{t('gps_no_children_desc')}</p>
          <button
            type="button"
            onClick={() => navigate('/rutinas')}
            className="mt-1 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 transition-tea shadow-xs cursor-pointer"
          >
            <span>{t('perf_go_routines')}</span>
          </button>
        </div>
      ) : (
        <>
          {/* Selector de hijo (si hay varios) */}
          {hijos.length > 1 && (
            <div className="flex items-center gap-3">
              <label htmlFor="gps-hijo" className="text-xs font-bold text-tea-text">
                {t('gps_child_select')}
              </label>
              <select
                id="gps-hijo"
                value={seleccionadoId}
                onChange={(e) => setSeleccionadoId(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs font-semibold border border-tea-border bg-white text-tea-text focus:ring-2 focus:ring-brand-600 focus:outline-none"
              >
                {hijos.map((h) => (
                  <option key={idDe(h)} value={idDe(h)}>
                    {h.childName || h.child_name || t('child_unnamed')}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Estado real: hijo, última ubicación y zona segura */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-tea-border shadow-soft-xs flex items-center gap-3">
              <span className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">
                <Tablet className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-tea-subtle uppercase tracking-wider">{t('gps_child')}</p>
                <p className="text-sm font-extrabold text-tea-text truncate">
                  {hijo?.childName || hijo?.child_name || t('child_unnamed')}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-tea-border shadow-soft-xs flex items-center gap-3">
              <span className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${desactualizada ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                <Clock className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-tea-subtle uppercase tracking-wider">{t('gps_last_location')}</p>
                <p className="text-sm font-extrabold text-tea-text">
                  {segundosDesde === null ? t('gps_no_location_short') : haceCuanto(segundosDesde)}
                </p>
                {desactualizada && <p className="text-[11px] text-amber-700 font-semibold">{t('gps_stale')}</p>}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-tea-border shadow-soft-xs flex items-center gap-3">
              <span
                className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  distanciaAZona === null ? 'bg-slate-100 text-slate-500' : dentroDeZona ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                }`}
              >
                {distanciaAZona !== null && !dentroDeZona ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-tea-subtle uppercase tracking-wider">{t('gps_zone')}</p>
                <p className="text-sm font-extrabold text-tea-text">
                  {!zona
                    ? t('gps_zone_none')
                    : distanciaAZona === null
                      ? `${t('gps_zone_radius')}: ${zona.radio} m`
                      : dentroDeZona
                        ? t('gps_inside')
                        : `${t('gps_outside')} · ${distanciaAZona} m`}
                </p>
                {zona && distanciaAZona !== null && (
                  <p className="text-[11px] text-tea-muted">
                    {t('gps_zone_radius')}: {zona.radio} m
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Mapa con la ubicación real */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-tea-border shadow-soft-xs overflow-hidden">
              {ubicacion ? (
                <>
                  <div className="px-4 py-3 border-b border-tea-border flex items-center justify-between gap-3 text-xs">
                    <span className="font-mono text-tea-muted">
                      {ubicacion.latitude.toFixed(5)}, {ubicacion.longitude.toFixed(5)}
                    </span>
                    <a
                      href={enlaceMapa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-brand-700 hover:underline"
                    >
                      {t('gps_open_map')}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <iframe title={t('gps_map_title')} src={mapUrl} className="w-full h-[420px] border-0" loading="lazy" />
                </>
              ) : (
                <div className="h-[420px] flex flex-col items-center justify-center text-center gap-2 px-6 bg-slate-50">
                  <MapPin className="w-8 h-8 text-tea-subtle" />
                  <p className="text-sm font-bold text-tea-text">{t('gps_no_location_title')}</p>
                  <p className="text-xs text-tea-muted max-w-sm">{t('gps_no_location_desc')}</p>
                </div>
              )}
            </div>

            {/* Zona segura: centro en la ubicación actual del niño y radio de 20 a 200 m */}
            <div className="bg-white rounded-3xl p-6 border border-tea-border shadow-soft-xs space-y-4">
              <div>
                <h2 className="text-base font-extrabold text-tea-text flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-brand-600" />
                  {t('gps_zone_title')}
                </h2>
                <p className="text-xs text-tea-muted mt-1">{t('gps_zone_desc')}</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="gps-radio" className="font-bold text-tea-text">
                    {t('gps_zone_radius')}
                  </label>
                  <span className="font-extrabold text-brand-600 font-mono">{radio} m</span>
                </div>
                <input
                  id="gps-radio"
                  type="range"
                  min={RADIO_MIN}
                  max={RADIO_MAX}
                  step={10}
                  value={radio}
                  onChange={(e) => setRadio(Number(e.target.value))}
                  disabled={guardandoZona}
                  className="w-full accent-brand-600"
                />
                <div className="flex justify-between text-[10px] text-tea-subtle font-mono">
                  <span>{RADIO_MIN} m</span>
                  <span>{RADIO_MAX} m</span>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => guardarZona(ubicacion)}
                  disabled={!ubicacion || guardandoZona}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 transition-tea shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {guardandoZona ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
                  <span>{t('gps_zone_use_current')}</span>
                </button>
                {!ubicacion && <p className="text-[11px] text-tea-muted">{t('gps_zone_needs_location')}</p>}

                {zona && (
                  <>
                    <button
                      type="button"
                      onClick={() => guardarZona(zona)}
                      disabled={guardandoZona || radio === zona.radio}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-tea-text bg-white border border-tea-border hover:bg-slate-50 transition-tea cursor-pointer disabled:opacity-50"
                    >
                      <span>{t('gps_zone_save_radius')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={quitarZona}
                      disabled={guardandoZona}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t('gps_zone_remove')}</span>
                    </button>
                  </>
                )}
              </div>

              {zona && distanciaAZona !== null && !dentroDeZona && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2" role="alert">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    {t('gps_outside_alert')} ({distanciaAZona} m)
                  </span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default GpsPage;

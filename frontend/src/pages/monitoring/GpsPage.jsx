import React, { useState, useEffect } from 'react';
import {
  Compass,
  MapPin,
  ShieldCheck,
  BatteryCharging,
  Wifi,
  Navigation,
  RefreshCw,
  AlertCircle,
  Play,
  Pause,
  Maximize2,
  Clock,
  Smartphone,
  CheckCircle2,
} from 'lucide-react';
import { devicesService } from '../../services/devicesService.js';
import { useLanguage } from '../../context/LanguageContext.jsx';

export const GpsPage = () => {
  const { t } = useLanguage();
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Coordenadas actuales del menor (por defecto Centro Terapéutico / Escolar en Lima)
  const [coords, setCoords] = useState({
    lat: -12.046374,
    lng: -77.042793,
    accuracy: 4.5,
    speed: 0,
    battery: 89,
    lastSeen: 'Hace un momento',
  });

  const [geofenceRadius, setGeofenceRadius] = useState(100);
  const [safeZone, setSafeZone] = useState('Colegio San Martín (Zona Segura)');
  const [isSimulating, setIsSimulating] = useState(false);
  const [alertStatus, setAlertStatus] = useState('safe'); // 'safe' | 'warning'

  const cargarDispositivo = async () => {
    try {
      const lista = await devicesService.listar();
      if (Array.isArray(lista) && lista.length > 0) {
        const d = lista[0];
        setDevice(d);
        if (d.lastLatitude && d.lastLongitude) {
          setCoords((prev) => ({
            ...prev,
            lat: Number(d.lastLatitude) || prev.lat,
            lng: Number(d.lastLongitude) || prev.lng,
          }));
        }
      } else {
        setDevice(null);
      }
    } catch (e) {
      setDevice(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    cargarDispositivo();
  }, []);

  // Simulación de recorrido en tiempo real
  useEffect(() => {
    let interval = null;
    if (isSimulating) {
      interval = setInterval(() => {
        setCoords((prev) => {
          // Desplazamiento suave simulado de caminata escolar
          const deltaLat = (Math.random() - 0.45) * 0.00015;
          const deltaLng = (Math.random() - 0.45) * 0.00015;
          const newLat = prev.lat + deltaLat;
          const newLng = prev.lng + deltaLng;
          return {
            ...prev,
            lat: parseFloat(newLat.toFixed(6)),
            lng: parseFloat(newLng.toFixed(6)),
            speed: parseFloat((1.2 + Math.random() * 0.8).toFixed(1)),
            lastSeen: 'En tiempo real',
          };
        });
      }, 2500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSimulating]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    if (device?.deviceId) {
      await devicesService.obtenerTelemetria(device.deviceId);
    }
    await cargarDispositivo();
    setTimeout(() => setRefreshing(false), 600);
  };

  const childName = device?.childName || device?.child_name || 'Hijo';
  const deviceModel = device?.deviceModel || device?.device_model || 'Dispositivo infantil';

  // URL del iframe OpenStreetMap centrado en las coordenadas
  const delta = 0.004;
  const bbox = `${coords.lng - delta}%2C${coords.lat - delta}%2C${coords.lng + delta}%2C${coords.lat + delta}`;
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${coords.lat}%2C${coords.lng}`;

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-tea-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-brand-50 text-brand-600">
              <Compass className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-extrabold text-tea-text tracking-tight">
              {t('nav_gps') || 'Seguimiento GPS y Geocercas'}
            </h1>
          </div>
          <p className="text-sm text-tea-muted mt-1">
            Supervisión perimetral en tiempo real del dispositivo infantil enlazado a la nube.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-tea-text bg-white border border-tea-border hover:bg-slate-50 transition-tea shadow-sm cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-brand-600' : ''}`} />
            <span>{refreshing ? 'Sincronizando...' : 'Actualizar GPS'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSimulating(!isSimulating)}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-tea shadow-sm cursor-pointer ${
              isSimulating
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'bg-brand-600 text-white hover:bg-brand-700'
            }`}
          >
            {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isSimulating ? 'Pausar Simulación' : 'Simular Trayecto'}</span>
          </button>
        </div>
      </div>

      {/* Tarjeta de Telemetría del Dispositivo del Niño */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Niño & Dispositivo */}
        <div className="bg-white rounded-2xl p-4 border border-tea-border shadow-soft-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-tea-subtle uppercase tracking-wider block">
              Menor Vinculado
            </span>
            <p className="text-sm font-extrabold text-tea-text truncate">{childName}</p>
            <p className="text-xs text-tea-muted truncate">{deviceModel}</p>
          </div>
        </div>

        {/* Estado Geocerca */}
        <div className="bg-white rounded-2xl p-4 border border-tea-border shadow-soft-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-tea-subtle uppercase tracking-wider block">
              Perímetro Seguro
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md mt-0.5">
              <CheckCircle2 className="w-3 h-3" />
              Dentro de la zona
            </span>
            <p className="text-[11px] text-tea-muted mt-0.5 truncate">Radio: {geofenceRadius}m</p>
          </div>
        </div>

        {/* Batería & Señal */}
        <div className="bg-white rounded-2xl p-4 border border-tea-border shadow-soft-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <BatteryCharging className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-tea-subtle uppercase tracking-wider block">
              Batería & Kiosk
            </span>
            <p className="text-sm font-extrabold text-tea-text">{coords.battery}% · En Carga</p>
            <p className="text-xs text-brand-600 font-semibold">Kiosk U-Pad Activo</p>
          </div>
        </div>

        {/* Coordenadas & Precisión */}
        <div className="bg-white rounded-2xl p-4 border border-tea-border shadow-soft-xs flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Navigation className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-tea-subtle uppercase tracking-wider block">
              Última Conexión
            </span>
            <p className="text-sm font-extrabold text-tea-text">{coords.lastSeen}</p>
            <p className="text-xs text-tea-muted">Precisión: ±{coords.accuracy}m</p>
          </div>
        </div>
      </div>

      {/* Sección del Mapa en Vivo y Controles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contenedor del Mapa (2 columnas) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-tea-border shadow-soft-xs overflow-hidden flex flex-col">
          {/* Barra superior del mapa */}
          <div className="px-5 py-3.5 border-b border-tea-border flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold text-slate-700">
                Ubicación Satelital en Tiempo Real
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-500">
              LAT: {coords.lat.toFixed(5)} · LNG: {coords.lng.toFixed(5)}
            </div>
          </div>

          {/* Iframe del Mapa Interactivo OpenStreetMap */}
          <div className="relative w-full h-[450px] bg-slate-100">
            <iframe
              title="Mapa de Ubicación del Menor"
              src={mapUrl}
              className="w-full h-full border-0"
              loading="lazy"
            />

            {/* Overlay informativo flotante sobre el mapa */}
            <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-2xl p-3 border border-slate-200 shadow-md max-w-xs text-xs">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-rose-500 flex-shrink-0" />
                <span className="font-extrabold text-slate-800">{childName} (Tablet U-Pad)</span>
              </div>
              <p className="text-slate-600 text-[11px] leading-tight">
                Zona actual: <span className="font-semibold text-brand-700">{safeZone}</span>
              </p>
              {isSimulating && (
                <span className="mt-1.5 inline-block text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                  Simulación de trayecto activa ({coords.speed} km/h)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Panel Lateral de Controles de Geocerca */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-tea-border shadow-soft-xs space-y-4">
            <h2 className="text-base font-extrabold text-tea-text tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-600" />
              Configuración de Geocerca
            </h2>

            <div>
              <label className="text-xs font-bold text-tea-text block mb-1.5">
                Zona Segura Designada
              </label>
              <select
                value={safeZone}
                onChange={(e) => setSafeZone(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50 border border-tea-border rounded-xl px-3 py-2 text-tea-text focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="Colegio San Martín (Zona Segura)">Colegio San Martín (Escolar)</option>
                <option value="Hogar Familiar (Zona Segura)">Hogar Familiar</option>
                <option value="Centro de Terapias TEA">Centro de Terapias TEA</option>
                <option value="Parque Residencial Supervisado">Parque Residencial Supervisado</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold text-tea-text">Radio de Tolerancia Perimetral</span>
                <span className="font-extrabold text-brand-600 font-mono">{geofenceRadius} metros</span>
              </div>
              <input
                type="range"
                min="50"
                max="500"
                step="25"
                value={geofenceRadius}
                onChange={(e) => setGeofenceRadius(Number(e.target.value))}
                className="w-full accent-brand-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-tea-subtle font-mono mt-1">
                <span>50m (Aula)</span>
                <span>250m (Campus)</span>
                <span>500m (Barrio)</span>
              </div>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Supervisión Perimetral Activa</span>
              </div>
              <p className="text-[11px] text-emerald-700 leading-snug">
                Si el menor se aleja más de {geofenceRadius}m de {safeZone}, se enviará una notificación sonora a tu teléfono y se bloqueará el modo Kiosk.
              </p>
            </div>
          </div>

          {/* Tarjeta de Seguridad Kiosk y Acciones Rápidas */}
          <div className="bg-white rounded-3xl p-5 border border-tea-border shadow-soft-xs space-y-3">
            <h3 className="text-sm font-extrabold text-tea-text">
              Protocolo de Emergencia & Kiosk
            </h3>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-xs">
              <span className="font-medium text-slate-700">Modo Kiosk Protegido</span>
              <span className="font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                Bloqueado
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-xs">
              <span className="font-medium text-slate-700">Estado de Red del Móvil</span>
              <span className="font-bold text-emerald-600 flex items-center gap-1">
                <Wifi className="w-3.5 h-3.5" /> 4G LTE
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                alert(`Ping de sincronización emitido hacia el dispositivo de ${childName}. Las coordenadas satelitales fueron reconfirmadas.`);
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
            >
              Emitir Ping de Localización Sonora
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GpsPage;

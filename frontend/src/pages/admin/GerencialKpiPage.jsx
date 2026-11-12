import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  CalendarCheck,
  TrendingUp,
  Tablet,
  ShieldCheck,
  BarChart3,
  PieChart,
  FileText,
  Printer,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Clock,
  Lock,
  KeyRound,
  Copy,
  Check,
} from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { useLanguage } from '../../context/LanguageContext.jsx';

// Estado vacío: sin cifras inventadas. Mientras no haya datos reales todo se muestra en cero.
const KPIS_VACIOS = {
  totalEstudiantesInstitucion: 0,
  totalRutinasEstructuradas: 0,
  tasaCumplimientoAdherencia: 0,
  dispositivosKioskEnPerimetro: 0,
  distribucionTurnos: {
    manana: 0,
    tarde: 0,
    noche: 0,
    porcentajes: { manana: 0, tarde: 0, noche: 0 },
  },
  adherenciaSemanal: [],
  indicadoresCalidad: [],
};

export const GerencialKpiPage = () => {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [codigoCopiado, setCodigoCopiado] = useState(false);

  const fetchKpis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminService.obtenerKpisEmpresario();
      setData(res);
    } catch (e) {
      console.error('Error fetching KPIs:', e);
      setData(null);
      setError(e?.message || 'No se pudieron cargar las métricas de la institución.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKpis();
  }, []);

  const copiarCodigo = async () => {
    try {
      await navigator.clipboard.writeText(data.organizacion.codigo);
      setCodigoCopiado(true);
      setTimeout(() => setCodigoCopiado(false), 2000);
    } catch (e) {
      console.error('No se pudo copiar el código:', e);
    }
  };

  const kpis = data?.kpis || KPIS_VACIOS;
  const institucionNombre = data?.institucion || 'Tu institución';
  const codigoOrganizacion = data?.organizacion?.codigo || null;

  return (
    <div className="space-y-6">
      {/* Encabezado Directivo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-tea-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
              <Building2 className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-extrabold text-tea-text tracking-tight">
              Panel Gerencial & Métricas Directivas
            </h1>
          </div>
          <p className="text-sm text-tea-muted mt-1">
            {institucionNombre}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchKpis}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-tea-text bg-white border border-tea-border hover:bg-slate-50 transition-tea shadow-sm cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Actualizar Métricas</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-tea shadow-sm cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir Informe</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-800" role="alert">
          {error}
        </div>
      )}

      {/* Código de la organización: los tutores lo ingresan al registrarse para unirse a la institución */}
      {codigoOrganizacion && (
        <div className="p-4 bg-white border border-tea-border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-soft-xs">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <KeyRound className="w-5 h-5" />
            </span>
            <div>
              <p className="text-[11px] font-bold text-tea-subtle uppercase tracking-wider">{t('org_code_card_title')}</p>
              <p className="text-xl font-black font-mono tracking-widest text-tea-text">{codigoOrganizacion}</p>
              <p className="text-[11px] text-tea-muted">{t('org_code_card_hint')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={copiarCodigo}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-tea-text bg-white border border-tea-border hover:bg-slate-50 transition-tea shadow-sm cursor-pointer"
          >
            {codigoCopiado ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{codigoCopiado ? t('org_code_copied') : t('org_code_copy')}</span>
          </button>
        </div>
      )}

      {/* Tarjetas de KPIs Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Total Estudiantes / Usuarios de la Institución */}
        <div className="bg-white rounded-2xl p-5 border border-tea-border shadow-soft-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-tea-subtle uppercase tracking-wider">
              Población Estudiantil TEA
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-tea-text">
            {kpis.totalEstudiantesInstitucion}
          </p>
          <p className="text-[11px] text-tea-muted">
            Menores activos en la institución escolar
          </p>
        </div>

        {/* Total Rutinas Estructuradas */}
        <div className="bg-white rounded-2xl p-5 border border-tea-border shadow-soft-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-tea-subtle uppercase tracking-wider">
              Rutinas Institucionales
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <CalendarCheck className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-tea-text">
            {kpis.totalRutinasEstructuradas}
          </p>
          <p className="text-[11px] text-tea-muted">
            Secuencias visuales adaptadas
          </p>
        </div>
      </div>

      {/* Gráficos y Distribución Agregada */}
      <div className="grid grid-cols-1 gap-6">
        {/* Distribución de Rutinas por Horario / Turno */}
        <div className="bg-white rounded-3xl p-6 border border-tea-border shadow-soft-xs space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-tea-text flex items-center gap-2">
              <PieChart className="w-5 h-5 text-indigo-600" />
              Distribución Horaria de Rutinas Institucionales
            </h3>
            <span className="text-xs font-mono text-tea-muted">
              Total: {kpis.totalRutinasEstructuradas}
            </span>
          </div>

          {kpis.totalRutinasEstructuradas === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
              <p className="text-sm font-semibold text-slate-600">Sin rutinas registradas en la institución aún</p>
              <p className="text-xs text-slate-400 mt-1">
                Cuando los docentes o tutores registren rutinas, la distribución horaria se calculará automáticamente.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-tea-text">Mañana (Aula, Desayuno y Adaptación)</span>
                  <span className="text-indigo-700 font-mono">
                    {kpis.distribucionTurnos?.manana ?? 0} rutinas ({kpis.distribucionTurnos?.porcentajes?.manana ?? 0}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${kpis.distribucionTurnos?.porcentajes?.manana ?? 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-tea-text">Tarde (Terapias, Talleres y Almuerzo)</span>
                  <span className="text-purple-700 font-mono">
                    {kpis.distribucionTurnos?.tarde ?? 0} rutinas ({kpis.distribucionTurnos?.porcentajes?.tarde ?? 0}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-purple-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${kpis.distribucionTurnos?.porcentajes?.tarde ?? 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-tea-text">Noche (Preparación y Cierre de Jornada)</span>
                  <span className="text-amber-700 font-mono">
                    {kpis.distribucionTurnos?.noche ?? 0} rutinas ({kpis.distribucionTurnos?.porcentajes?.noche ?? 0}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-amber-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${kpis.distribucionTurnos?.porcentajes?.noche ?? 0}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GerencialKpiPage;

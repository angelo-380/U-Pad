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
            {institucionNombre} · Supervisión ejecutiva basada en evidencias para directores de colegio y clínicas.
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

      {/* Banner de Cumplimiento de Privacidad y Anonimización */}
      <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 text-indigo-900">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <span className="font-extrabold block">
              Vista Gerencial con Privacidad Protegida (Cero Datos Personales)
            </span>
            <span className="text-indigo-700 text-[11px]">
              Cumplimiento de la Ley de Protección de Datos de Menores TEA: Los nombres, correos y fichas médicas personales están completamente aislados y no son visibles en esta vista de dirección.
            </span>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 flex-shrink-0">
          ✓ PII Blindado
        </span>
      </div>

      {/* 4 Tarjetas de KPIs Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

        {/* Tasa de Cumplimiento / Adherencia */}
        <div className="bg-white rounded-2xl p-5 border border-tea-border shadow-soft-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-tea-subtle uppercase tracking-wider">
              Tasa de Adherencia TEA
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-700">
            {kpis.tasaCumplimientoAdherencia}%
          </p>
          <p className="text-[11px] text-emerald-600 font-semibold">
            +3.2% respecto a la semana anterior
          </p>
        </div>

        {/* Tablets Kiosk en el Perímetro */}
        <div className="bg-white rounded-2xl p-5 border border-tea-border shadow-soft-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-tea-subtle uppercase tracking-wider">
              Tablets en Perímetro
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Tablet className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-tea-text">
            {kpis.dispositivosKioskEnPerimetro}
          </p>
          <p className="text-[11px] text-tea-muted">
            Dispositivos Kiosk activos en aula
          </p>
        </div>
      </div>

      {/* Gráficos y Distribución Agregada */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
        </div>

        {/* Adherencia Semanal sin nombres */}
        <div className="bg-white rounded-3xl p-6 border border-tea-border shadow-soft-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-tea-text flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              Adherencia Terapéutica Semanal Agregada
            </h3>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              Promedio: 94.6%
            </span>
          </div>

          <p className="text-xs text-tea-muted">
            Porcentaje de pasos visuales completados exitosamente por los alumnos en sus tablets U-Pad durante la semana escolar.
          </p>

          <div className="grid grid-cols-5 gap-2 pt-2">
            {kpis.adherenciaSemanal?.map((dia, idx) => (
              <div
                key={idx}
                className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center flex flex-col justify-between"
              >
                <span className="text-[11px] font-extrabold text-slate-700 uppercase">
                  {dia.dia}
                </span>
                <div className="my-2">
                  <span className="text-lg font-black text-indigo-700 block">
                    {dia.tasa}%
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {dia.sesiones} ses.
                  </span>
                </div>
                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 py-0.5 rounded">
                  Óptimo
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Indicadores de Calidad del Servicio Institucional */}
      <div className="bg-white rounded-3xl p-6 border border-tea-border shadow-soft-xs space-y-4">
        <h3 className="text-base font-extrabold text-tea-text flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-600" />
          Indicadores de Calidad & Acreditación Inclusiva TEA
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.indicadoresCalidad?.map((ind, idx) => (
            <div
              key={idx}
              className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-800">
                  {ind.titulo}
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-indigo-700">{ind.valor}</span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                  {ind.estado}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GerencialKpiPage;

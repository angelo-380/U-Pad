import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  CalendarCheck,
  BarChart3,
  PieChart,
  Printer,
  RefreshCw,
  KeyRound,
  Copy,
  Check,
  HeartHandshake,
  ChevronRight,
  X,
} from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { cumplimientoService } from '../../services/cumplimientoService.js';
import { CumplimientoResumen } from '../../components/common/CumplimientoResumen.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';

// Estado vacío: sin cifras inventadas. Mientras no haya datos reales todo se muestra en cero.
const KPIS_VACIOS = {
  totalEstudiantesInstitucion: 0,
  totalRutinasEstructuradas: 0,
  totalTutoresInstitucion: 0,
  tutoresDetalle: [],
  distribucionTurnos: {
    manana: 0,
    tarde: 0,
    noche: 0,
    porcentajes: { manana: 0, tarde: 0, noche: 0 },
  },
};

export const GerencialKpiPage = () => {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [codigoCopiado, setCodigoCopiado] = useState(false);
  const [tutoresOpen, setTutoresOpen] = useState(false);
  const [cumplimiento, setCumplimiento] = useState(null);
  const [errorCumplimiento, setErrorCumplimiento] = useState(null);

  const fetchKpis = async () => {
    setLoading(true);
    setError(null);
    // Cumplimiento real de la organización (en paralelo; si falla, solo esa tarjeta muestra el error)
    cumplimientoService
      .obtener({ dias: 7 })
      .then((datos) => {
        setCumplimiento(datos);
        setErrorCumplimiento(null);
      })
      .catch((e) => {
        console.warn('Error cargando cumplimiento:', e);
        setErrorCumplimiento(e);
      });
    try {
      const res = await adminService.obtenerKpisEmpresario();
      setData(res);
    } catch (e) {
      console.error('Error fetching KPIs:', e);
      setData(null);
      setError(e?.message || t('gerencial_load_error'));
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
  const institucionNombre = data?.institucion || t('org_fallback_name');
  const codigoOrganizacion = data?.organizacion?.codigo || null;
  const tutores = Array.isArray(kpis.tutoresDetalle) ? kpis.tutoresDetalle : [];
  const totalTutores = kpis.totalTutoresInstitucion ?? tutores.length;

  useEffect(() => {
    if (!tutoresOpen) return undefined;
    const alPulsarTecla = (e) => {
      if (e.key === 'Escape') setTutoresOpen(false);
    };
    window.addEventListener('keydown', alPulsarTecla);
    return () => window.removeEventListener('keydown', alPulsarTecla);
  }, [tutoresOpen]);

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
              {t('gerencial_title')}
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
            <span>{t('gerencial_refresh')}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-tea shadow-sm cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{t('gerencial_print')}</span>
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

      {/* Tarjetas de KPIs principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Estudiantes / Usuarios de la Institución */}
        <div className="bg-white rounded-2xl p-5 border border-tea-border shadow-soft-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-tea-subtle uppercase tracking-wider">
              {t('gerencial_students')}
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-tea-text">
            {kpis.totalEstudiantesInstitucion}
          </p>
          <p className="text-[11px] text-tea-muted">
            {t('gerencial_students_desc')}
          </p>
        </div>

        {/* Total Rutinas Estructuradas */}
        <div className="bg-white rounded-2xl p-5 border border-tea-border shadow-soft-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-tea-subtle uppercase tracking-wider">
              {t('gerencial_routines')}
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <CalendarCheck className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-tea-text">
            {kpis.totalRutinasEstructuradas}
          </p>
          <p className="text-[11px] text-tea-muted">
            {t('gerencial_routines_desc')}
          </p>
        </div>

        {/* Padres y tutores de la institución (nombres solo para su director y el developer) */}
        <button
          type="button"
          onClick={() => setTutoresOpen(true)}
          className="text-left bg-white rounded-2xl p-5 border border-tea-border shadow-soft-xs space-y-2 hover:border-amber-300 hover:bg-amber-50/30 transition-tea focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-tea-subtle uppercase tracking-wider">
              {t('gerencial_tutors')}
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <HeartHandshake className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-tea-text">{totalTutores}</p>
          <p className="text-[11px] text-tea-muted flex items-center gap-1">
            {t('gerencial_tutors_desc')}
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </p>
        </button>
      </div>

      {/* Gráficos y Distribución Agregada */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribución de Rutinas por Horario / Turno */}
        <div className="bg-white rounded-3xl p-6 border border-tea-border shadow-soft-xs space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-tea-text flex items-center gap-2">
              <PieChart className="w-5 h-5 text-indigo-600" />
              {t('gerencial_shift_distribution')}
            </h3>
            <span className="text-xs font-mono text-tea-muted">
              {t('gerencial_total', { total: kpis.totalRutinasEstructuradas })}
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1.5">
                <span className="text-tea-text">{t('tab_morning')}</span>
                <span className="text-indigo-700 font-mono">
                  {t('gerencial_shift_count', { total: kpis.distribucionTurnos?.manana ?? 0, pct: kpis.distribucionTurnos?.porcentajes?.manana ?? 0 })}
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
                <span className="text-tea-text">{t('tab_afternoon')}</span>
                <span className="text-purple-700 font-mono">
                  {t('gerencial_shift_count', { total: kpis.distribucionTurnos?.tarde ?? 0, pct: kpis.distribucionTurnos?.porcentajes?.tarde ?? 0 })}
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
                <span className="text-tea-text">{t('tab_night')}</span>
                <span className="text-amber-700 font-mono">
                  {t('gerencial_shift_count', { total: kpis.distribucionTurnos?.noche ?? 0, pct: kpis.distribucionTurnos?.porcentajes?.noche ?? 0 })}
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

        {/* Adherencia semanal real: actividades completadas en los teléfonos de los niños de la organización */}
        <div className="bg-white rounded-3xl p-6 border border-tea-border shadow-soft-xs space-y-4">
          <h3 className="text-base font-extrabold text-tea-text flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            {t('gerencial_adherence_title')}
          </h3>
          <CumplimientoResumen datos={cumplimiento} loading={loading} error={errorCumplimiento} />
        </div>
      </div>

      {tutoresOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tutores-titulo"
          onClick={() => setTutoresOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-tea-border relative animate-scaleIn max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setTutoresOpen(false)}
              aria-label={t('profile_close')}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 id="tutores-titulo" className="text-lg font-extrabold text-tea-text flex items-center gap-2 pr-10">
              <HeartHandshake className="w-5 h-5 text-amber-600" />
              {t('gerencial_tutors_title', { total: totalTutores })}
            </h3>
            <p className="text-xs text-tea-muted mt-1 mb-4">{t('gerencial_tutors_privacy')}</p>

            {tutores.length === 0 ? (
              <div className="py-8 px-4 text-center rounded-2xl border border-dashed border-tea-border bg-slate-50">
                <p className="text-sm font-bold text-tea-text">{t('gerencial_tutors_empty_title')}</p>
                <p className="text-xs text-tea-muted mt-1">{t('gerencial_tutors_empty_desc')}</p>
              </div>
            ) : (
              <ul className="divide-y divide-tea-border border border-tea-border rounded-2xl overflow-hidden">
                {tutores.map((tutor) => (
                  <li key={tutor.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="w-8 h-8 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {(tutor.nombre || '?').charAt(0).toUpperCase()}
                      </span>
                      <span className="text-sm font-semibold text-tea-text truncate">{tutor.nombre}</span>
                    </span>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 whitespace-nowrap">
                      {t('gerencial_tutors_children', { total: tutor.cantidadNinos })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {totalTutores > tutores.length && (
              <p className="text-[11px] text-tea-muted mt-3">{t('gerencial_tutors_truncated', { total: tutores.length })}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GerencialKpiPage;

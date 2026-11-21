import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Sun,
  Sunset,
  Moon,
  Printer,
  RefreshCw,
  CalendarCheck,
  ListChecks,
  BarChart3,
  CheckCircle2,
  Clock,
  Check,
  Loader2,
} from 'lucide-react';
import { rutinasService } from '../../services/rutinasService.js';
import { cumplimientoService } from '../../services/cumplimientoService.js';
import { CumplimientoResumen } from '../../components/common/CumplimientoResumen.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

/**
 * Normaliza el turno guardado ('MANANA', 'Mañana', 'manana'...) a MANANA | TARDE | NOCHE.
 * Las rutinas creadas desde la web y desde la app se guardan como 'MANANA', no como 'mañana'.
 */
const normalizarTurno = (turno) =>
  String(turno || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const contarPasos = (rutina) => (Array.isArray(rutina?.pasos) ? rutina.pasos.length : 0);

/**
 * Análisis de desempeño: SOLO datos reales.
 * El cumplimiento sale de las actividades que el niño completa en su teléfono (GET /api/cumplimiento);
 * sin registros se muestra un estado vacío en lugar de cifras inventadas.
 */
export const DesempenoPage = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();
  const navigate = useNavigate();
  const [rutinas, setRutinas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cumplimiento, setCumplimiento] = useState(null);
  const [errorCumplimiento, setErrorCumplimiento] = useState(null);
  const [marcandoId, setMarcandoId] = useState(null);

  const handleMarcarCumplida = async (rutinaId) => {
    try {
      setMarcandoId(rutinaId);
      await cumplimientoService.registrarCumplimiento(rutinaId);
      toast.success(t('perf_mark_success'), t('perf_completed_today'));
      await cargarDatos();
    } catch (e) {
      toast.error(e?.message || 'Error');
    } finally {
      setMarcandoId(null);
    }
  };

  // Roles que tienen el módulo de Rutinas en su menú
  const puedeIrARutinas = user?.rol === 'tutor' || user?.rol === 'developer';

  const cargarDatos = async () => {
    try {
      setLoading(true);
      setError(null);
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
      const res = await rutinasService.listar({ limit: 100 });
      setRutinas(Array.isArray(res) ? res : res?.rutinas || []);
    } catch (e) {
      console.warn('Error cargando rutinas para desempeño:', e);
      setRutinas([]);
      setError(t('perf_load_error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const turnos = [
    { id: 'MANANA', label: t('tab_morning'), icon: Sun, color: 'bg-amber-100 text-amber-600' },
    { id: 'TARDE', label: t('tab_afternoon'), icon: Sunset, color: 'bg-emerald-100 text-emerald-600' },
    { id: 'NOCHE', label: t('tab_night'), icon: Moon, color: 'bg-indigo-100 text-indigo-600' },
  ].map((turno) => {
    const delTurno = rutinas.filter((r) => normalizarTurno(r.turno) === turno.id);
    return {
      ...turno,
      rutinas: delTurno.length,
      pasos: delTurno.reduce((total, r) => total + contarPasos(r), 0),
    };
  });

  const totalRutinas = rutinas.length;
  const totalPasos = rutinas.reduce((total, r) => total + contarPasos(r), 0);
  const sinRutinas = !loading && !error && totalRutinas === 0;

  const textoRutinas = (n) => `${n} ${n === 1 ? t('routine_single') : t('routine_plural')}`;
  const textoPasos = (n) => `${n} ${n === 1 ? t('visual_step_single') : t('visual_step_plural')}`;

  return (
    <div className="space-y-6 pb-12">
      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-tea-border">
        <div className="flex items-center gap-2.5">
          <span className="p-2.5 rounded-2xl bg-amber-100 text-amber-700 shadow-xs">
            <TrendingUp className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-2xl font-black text-tea-text tracking-tight">
              {t('perf_title')}
            </h1>
            <p className="text-xs text-tea-muted mt-0.5">
              {t('perf_subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-tea-border hover:bg-slate-50 transition-tea shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{t('perf_print')}</span>
          </button>
          <button
            type="button"
            onClick={cargarDatos}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 transition-tea shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{t('perf_refresh')}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-800" role="alert">
          {error}
        </div>
      )}

      {sinRutinas ? (
        /* Estado vacío: el usuario (o su institución) aún no tiene rutinas */
        <div className="bg-white rounded-3xl p-8 border border-tea-border shadow-soft-xs flex flex-col items-center text-center gap-3">
          <span className="p-3 rounded-2xl bg-amber-50 text-amber-600">
            <CalendarCheck className="w-7 h-7" />
          </span>
          <h2 className="text-base font-extrabold text-tea-text">{t('perf_empty_title')}</h2>
          <p className="text-xs text-tea-muted max-w-md">
            {puedeIrARutinas ? t('perf_empty_desc_create') : t('perf_empty_desc_org')}
          </p>
          {puedeIrARutinas && (
            <button
              type="button"
              onClick={() => navigate('/rutinas')}
              className="mt-1 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 transition-tea shadow-xs cursor-pointer"
            >
              <CalendarCheck className="w-3.5 h-3.5" />
              <span>{t('perf_go_routines')}</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Totales reales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-tea-border shadow-soft-xs flex items-center gap-3.5">
              <span className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                <CalendarCheck className="w-6 h-6" />
              </span>
              <div>
                <span className="text-[11px] font-bold text-tea-subtle uppercase tracking-wider block">
                  {t('perf_total_routines')}
                </span>
                <p className="text-2xl font-black text-tea-text">{loading ? '—' : totalRutinas}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-tea-border shadow-soft-xs flex items-center gap-3.5">
              <span className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                <ListChecks className="w-6 h-6" />
              </span>
              <div>
                <span className="text-[11px] font-bold text-tea-subtle uppercase tracking-wider block">
                  {t('perf_total_steps')}
                </span>
                <p className="text-2xl font-black text-tea-text">{loading ? '—' : totalPasos}</p>
              </div>
            </div>
          </div>

          {/* Rutinas por turno (datos reales) */}
          <div className="bg-white rounded-3xl p-6 border border-tea-border shadow-soft-xs space-y-4">
            <h2 className="text-base font-extrabold text-tea-text">{t('perf_by_shift_title')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {turnos.map((turno) => {
                const Icono = turno.icon;
                return (
                  <div key={turno.id} className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className={`p-2 rounded-xl ${turno.color}`}>
                      <Icono className="w-4 h-4" />
                    </span>
                    <div>
                      <span className="text-xs font-extrabold text-slate-800 block">{turno.label}</span>
                      <span className="text-[11px] text-slate-500 font-semibold block">
                        {loading ? '—' : textoRutinas(turno.rutinas)}
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        {loading ? '' : textoPasos(turno.pasos)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Registro interactivo de cumplimiento de rutinas (Punto 11) */}
          {rutinas.length > 0 && (
            <div className="bg-white rounded-3xl p-6 border border-tea-border shadow-soft-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-extrabold text-tea-text flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    {t('perf_quick_check_title')}
                  </h2>
                  <p className="text-xs text-tea-muted mt-0.5">
                    {t('perf_quick_check_desc')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {rutinas.map((r) => {
                  const isMarcando = marcandoId === r.id;

                  return (
                    <div
                      key={r.id}
                      className="p-4 rounded-2xl border border-tea-border bg-slate-50 flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-tea-text truncate">
                            {r.titulo}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                            {r.turno}
                          </span>
                        </div>
                        <p className="text-[11px] text-tea-muted mt-0.5">
                          {contarPasos(r)} {contarPasos(r) === 1 ? t('visual_step_single') : t('visual_step_plural')}
                          {r.duracionTotalMinutos ? ` • ${r.duracionTotalMinutos} min` : ''}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleMarcarCumplida(r.id)}
                        disabled={isMarcando}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs transition-colors disabled:opacity-50 flex-shrink-0 cursor-pointer"
                      >
                        {isMarcando ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>{t('perf_mark_completed')}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Cumplimiento real: actividades completadas en el teléfono del niño */}
      <div className="bg-white rounded-3xl p-6 border border-tea-border shadow-soft-xs space-y-4">
        <h2 className="text-base font-extrabold text-tea-text flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-amber-600" />
          {t('perf_compliance_title')}
        </h2>
        <CumplimientoResumen datos={cumplimiento} loading={loading} error={errorCumplimiento} />
      </div>
    </div>
  );
};

export default DesempenoPage;

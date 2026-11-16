import React from 'react';
import { ClipboardList, Sun, Sunset, Moon } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext.jsx';

/**
 * Cumplimiento real (GET /api/cumplimiento): actividades que el niño completó en su teléfono frente a las
 * rutinas activas de cada día. Sin registros muestra un estado vacío; nunca cifras inventadas.
 * Props: datos (respuesta del backend o null), loading, error.
 */
const ICONOS_TURNO = {
  MANANA: { icon: Sun, color: 'bg-amber-100 text-amber-600', clave: 'tab_morning' },
  TARDE: { icon: Sunset, color: 'bg-emerald-100 text-emerald-600', clave: 'tab_afternoon' },
  NOCHE: { icon: Moon, color: 'bg-indigo-100 text-indigo-600', clave: 'tab_night' },
};

// La fecha del backend es un día (YYYY-MM-DD): se lee como fecha local para no desplazarla por la zona horaria
const fechaDeDia = (fecha) => {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(a, m - 1, d);
};

const Barra = ({ porcentaje, color = 'bg-brand-600' }) => (
  <div className="w-full bg-slate-100 rounded-full h-2.5">
    <div className={`${color} h-2.5 rounded-full transition-all duration-500`} style={{ width: `${porcentaje ?? 0}%` }} />
  </div>
);

export const CumplimientoResumen = ({ datos, loading = false, error = null }) => {
  const { t, locale } = useLanguage();

  if (error) {
    return (
      <div className="p-3.5 rounded-2xl text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-800" role="alert">
        {t('compliance_load_error')}
      </div>
    );
  }

  if (loading && !datos) {
    return <p className="text-xs text-tea-muted py-6 text-center">…</p>;
  }

  if (!datos || !datos.hayRegistros) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-2 py-8 px-4 rounded-2xl border border-dashed border-tea-border bg-slate-50">
        <ClipboardList className="w-8 h-8 text-tea-subtle" />
        <p className="text-sm font-bold text-tea-text">{t('compliance_empty_title')}</p>
        <p className="text-xs text-tea-muted max-w-sm">{t('compliance_empty_desc')}</p>
      </div>
    );
  }

  const textoPorcentaje = (p) => (p === null || p === undefined ? '—' : `${p}%`);
  const textoDeDe = (fila) => t('compliance_done_of', { completadas: fila.completadas, esperadas: fila.esperadas });

  return (
    <div className="space-y-6">
      {/* Total del periodo */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
        <p className="text-4xl font-black text-tea-text">{textoPorcentaje(datos.total.porcentaje)}</p>
        <div className="pb-1">
          <p className="text-xs font-bold text-tea-text">{t('compliance_total', { dias: datos.dias.length })}</p>
          <p className="text-[11px] text-tea-muted">{textoDeDe(datos.total)}</p>
        </div>
      </div>

      {/* Por día: columnas con la altura del porcentaje */}
      <div className="space-y-2">
        <h3 className="text-xs font-extrabold text-tea-subtle uppercase tracking-wider">{t('compliance_by_day')}</h3>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${datos.dias.length}, minmax(0, 1fr))` }}>
          {datos.dias.map((dia) => (
            <div key={dia.fecha} className="flex flex-col items-center gap-1" title={textoDeDe(dia)}>
              <span className="text-[11px] font-bold text-tea-text">{textoPorcentaje(dia.porcentaje)}</span>
              <div className="w-full max-w-[44px] h-28 bg-slate-100 rounded-xl flex items-end overflow-hidden">
                <div className="w-full bg-brand-600 rounded-xl transition-all duration-500" style={{ height: `${dia.porcentaje ?? 0}%` }} />
              </div>
              <span className="text-[11px] text-tea-muted capitalize">
                {fechaDeDia(dia.fecha).toLocaleDateString(locale, { weekday: 'short', day: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Por turno */}
      <div className="space-y-3">
        <h3 className="text-xs font-extrabold text-tea-subtle uppercase tracking-wider">{t('compliance_by_shift')}</h3>
        {datos.porTurno.map((fila) => {
          const turno = ICONOS_TURNO[fila.turno];
          const Icono = turno.icon;
          return (
            <div key={fila.turno} className="flex items-center gap-3">
              <span className={`p-1.5 rounded-lg ${turno.color}`}>
                <Icono className="w-3.5 h-3.5" />
              </span>
              <div className="flex-1 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-tea-text">{t(turno.clave)}</span>
                  <span className="text-tea-muted">
                    {fila.esperadas > 0 ? `${textoPorcentaje(fila.porcentaje)} · ${textoDeDe(fila)}` : t('compliance_no_expected')}
                  </span>
                </div>
                <Barra porcentaje={fila.porcentaje} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Por hijo (solo el tutor lo recibe) */}
      {Array.isArray(datos.porHijo) && datos.porHijo.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-extrabold text-tea-subtle uppercase tracking-wider">{t('compliance_by_child')}</h3>
          {datos.porHijo.map((hijo) => (
            <div key={hijo.deviceId} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-bold text-tea-text">{hijo.nombre || t('compliance_child_unnamed')}</span>
                <span className="text-tea-muted">
                  {hijo.esperadas > 0 ? `${textoPorcentaje(hijo.porcentaje)} · ${textoDeDe(hijo)}` : t('compliance_no_expected')}
                </span>
              </div>
              <Barra porcentaje={hijo.porcentaje} color="bg-emerald-500" />
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-tea-muted">{t('compliance_how')}</p>
    </div>
  );
};

export default CumplimientoResumen;

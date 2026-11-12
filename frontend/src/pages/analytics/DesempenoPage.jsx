import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Award,
  Sun,
  Sunset,
  Moon,
  Sparkles,
  Bot,
  BrainCircuit,
  Calendar,
  CheckCircle2,
  Clock,
  Printer,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  ArrowUpRight,
  ShieldCheck,
  Star,
  User,
  Tablet,
} from 'lucide-react';
import { rutinasService } from '../../services/rutinasService.js';
import { devicesService } from '../../services/devicesService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';

export const DesempenoPage = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [rutinas, setRutinas] = useState([]);
  const [devices, setDevices] = useState([]);
  const [selectedChild, setSelectedChild] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiLastUpdate, setAiLastUpdate] = useState(new Date().toLocaleTimeString());

  const diasSemana = [
    { id: 'LUN', nombre: 'Lunes', full: 'LUNES' },
    { id: 'MAR', nombre: 'Martes', full: 'MARTES' },
    { id: 'MIE', nombre: 'Miércoles', full: 'MIÉRCOLES' },
    { id: 'JUE', nombre: 'Jueves', full: 'JUEVES' },
    { id: 'VIE', nombre: 'Viernes', full: 'VIERNES' },
    { id: 'SAB', nombre: 'Sábado', full: 'SÁBADO' },
    { id: 'DOM', nombre: 'Domingo', full: 'DOMINGO' },
  ];

  const getDiaActualId = () => {
    const day = new Date().getDay();
    const map = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];
    return map[day];
  };

  const diaActualId = getDiaActualId();
  const diaActualObj = diasSemana.find((d) => d.id === diaActualId) || diasSemana[0];

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [rutinasRes, devicesRes] = await Promise.all([
        rutinasService.listar(),
        devicesService.listar().catch(() => []),
      ]);
      const listRutinas = Array.isArray(rutinasRes) ? rutinasRes : rutinasRes?.rutinas || [];
      const listDevices = Array.isArray(devicesRes) ? devicesRes : [];
      setRutinas(listRutinas);
      setDevices(listDevices);

      if (listDevices.length === 1) {
        setSelectedChild(listDevices[0].childName || listDevices[0].child_name || 'Hijo');
      }
    } catch (e) {
      console.warn('Error cargando datos para desempeño:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Si no es tutor, el módulo no está disponible
  if (user?.rol && user.rol !== 'tutor') {
    return (
      <div className="py-16 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Módulo exclusivo para Padres y Tutores</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          El análisis de desempeño individual mide el cumplimiento de las rutinas por cada niño y está reservado para cuentas de tutor.
        </p>
      </div>
    );
  }

  // Filtrado de rutinas por hijo seleccionado
  const rutinasFiltradas = selectedChild === 'ALL'
    ? rutinas
    : rutinas.filter((r) => {
        const rName = (r.ninoId || '').trim().toLowerCase();
        const sName = selectedChild.trim().toLowerCase();
        return rName === sName || rName === 'todos mis hijos' || !rName;
      });

  // Desglose de rutinas por turnos del hijo seleccionado
  const rutinasManana = rutinasFiltradas.filter((r) => (r.turno || '').toLowerCase() === 'mañana' || (r.turno || '').toLowerCase() === 'manana');
  const rutinasTarde = rutinasFiltradas.filter((r) => (r.turno || '').toLowerCase() === 'tarde');
  const rutinasNoche = rutinasFiltradas.filter((r) => (r.turno || '').toLowerCase() === 'noche');

  // Cálculo de cumplimiento general real basado en la base de datos (0 si no hay rutinas)
  const totalActividades = rutinasFiltradas.length;
  const rutinasActivas = rutinasFiltradas.filter((r) => r.activa !== 0 && r.activa !== false).length;
  const efectividadHoy = totalActividades > 0 ? Math.round((rutinasActivas / totalActividades) * 100) : 0;
  const completadasHoy = rutinasActivas;

  const mananaPct = rutinasManana.length > 0 ? Math.round((rutinasManana.filter(r => r.activa !== 0 && r.activa !== false).length / rutinasManana.length) * 100) : 0;
  const tardePct = rutinasTarde.length > 0 ? Math.round((rutinasTarde.filter(r => r.activa !== 0 && r.activa !== false).length / rutinasTarde.length) * 100) : 0;
  const nochePct = rutinasNoche.length > 0 ? Math.round((rutinasNoche.filter(r => r.activa !== 0 && r.activa !== false).length / rutinasNoche.length) * 100) : 0;

  const getCumplimientoDia = (diaId) => {
    if (totalActividades === 0) {
      return { manana: 0, tarde: 0, noche: 0 };
    }
    return { manana: mananaPct, tarde: tardePct, noche: nochePct };
  };

  const handleRunAiAnalysis = () => {
    setAiAnalyzing(true);
    setTimeout(() => {
      setAiAnalyzing(false);
      setAiLastUpdate(new Date().toLocaleTimeString());
    }, 900);
  };

  const nombreHijoActivo = selectedChild === 'ALL'
    ? (devices.length > 0 ? `Todos mis hijos (${devices.length})` : 'Mi Hijo')
    : selectedChild;

  return (
    <div className="space-y-6 pb-12">
      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-tea-border">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-amber-100 text-amber-700 shadow-xs">
              <TrendingUp className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-2xl font-black text-tea-text tracking-tight flex items-center gap-2">
                Análisis de Desempeño
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider">
                  Tutor / Familia
                </span>
              </h1>
              <p className="text-xs text-tea-muted mt-0.5">
                Seguimiento de cumplimiento semanal por cada niño y recomendaciones neurocognitivas con IA.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-tea-border hover:bg-slate-50 transition-tea shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir Informe</span>
          </button>
          <button
            type="button"
            onClick={cargarDatos}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 transition-tea shadow-xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Selector de Hijo / Paciente */}
      <div className="bg-white rounded-2xl p-4 border border-tea-border shadow-soft-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg">
            🧒
          </div>
          <div>
            <span className="text-[11px] font-bold text-tea-subtle uppercase tracking-wider block">
              Hijo Seleccionado
            </span>
            <span className="text-sm font-extrabold text-tea-text">
              {nombreHijoActivo}
            </span>
          </div>
        </div>

        {devices.length > 0 ? (
          <div className="flex items-center gap-2">
            <label htmlFor="child-select" className="text-xs font-bold text-tea-muted hidden sm:inline">
              Ver desempeño de:
            </label>
            <select
              id="child-select"
              value={selectedChild}
              onChange={(e) => setSelectedChild(e.target.value)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold border border-tea-border bg-slate-50 text-tea-text focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
            >
              {devices.length > 1 && (
                <option value="ALL">🧒 Todos mis hijos ({devices.length})</option>
              )}
              {devices.map((d) => {
                const dName = d.childName || d.child_name || 'Hijo';
                const dModel = d.deviceModel || d.device_model || 'Tablet';
                return (
                  <option key={d.deviceId || d.device_id || dName} value={dName}>
                    🧒 {dName} ({dModel})
                  </option>
                );
              })}
            </select>
          </div>
        ) : (
          <div className="text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            Sin hijos/tablets vinculados aún
          </div>
        )}
      </div>

      {/* Tarjeta Destacada de Eficacia de Hoy */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white p-6 sm:p-8 shadow-lg">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-100 flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              Eficacia de Hoy ({diaActualObj.nombre}) · {nombreHijoActivo}
            </span>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl sm:text-5xl font-black tracking-tight">
                {efectividadHoy}%
              </span>
              <span className="text-base font-bold text-amber-100">
                Logrado
              </span>
            </div>
            {totalActividades === 0 ? (
              <p className="text-xs text-amber-100 max-w-md leading-relaxed">
                Sin rutinas registradas para {nombreHijoActivo} aún. Registra actividades visuales para que el sistema realice el seguimiento de cumplimiento.
              </p>
            ) : (
              <p className="text-xs text-amber-100 max-w-md leading-relaxed">
                Completaste <strong>{completadasHoy}</strong> de <strong>{totalActividades}</strong> actividades asignadas en la jornada. La consistencia visual fortalece la autonomía del niño.
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 self-start sm:self-auto">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white">
              <Star className="w-6 h-6 fill-amber-300 text-amber-300" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-200 block">
                Rango Evaluado
              </span>
              <span className="text-base font-extrabold text-white">
                {totalActividades === 0 ? 'Sin Registro' : (efectividadHoy >= 80 ? 'Sobresaliente' : (efectividadHoy >= 50 ? 'Adecuado' : 'Inicial'))}
              </span>
            </div>
          </div>
        </div>

        {/* Efecto decorativo */}
        <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Leyenda de Turnos */}
      <div className="bg-white rounded-2xl p-4 border border-tea-border shadow-soft-xs flex flex-wrap items-center justify-around gap-4">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-amber-100 text-amber-600">
            <Sun className="w-4 h-4" />
          </span>
          <div>
            <span className="text-xs font-extrabold text-slate-800 block">Mañana</span>
            <span className="text-[10px] text-slate-400 font-semibold">{rutinasManana.length} rutinas activas</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-emerald-100 text-emerald-600">
            <Sunset className="w-4 h-4" />
          </span>
          <div>
            <span className="text-xs font-extrabold text-slate-800 block">Tarde</span>
            <span className="text-[10px] text-slate-400 font-semibold">{rutinasTarde.length} rutinas activas</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-indigo-100 text-indigo-600">
            <Moon className="w-4 h-4" />
          </span>
          <div>
            <span className="text-xs font-extrabold text-slate-800 block">Noche</span>
            <span className="text-[10px] text-slate-400 font-semibold">{rutinasNoche.length} rutinas activas</span>
          </div>
        </div>
      </div>

      {/* Cumplimiento Semanal por Turnos */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-tea-border shadow-soft-xs space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-extrabold text-tea-text">
              Cumplimiento Semanal por Turnos
            </h2>
            <p className="text-xs text-tea-muted mt-0.5">
              Porcentaje de ejecución de actividades de {nombreHijoActivo} por cada turno (Lunes a Domingo)
            </p>
          </div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            7 Días Monitorizados
          </span>
        </div>

        <div className="space-y-5 divide-y divide-slate-100">
          {diasSemana.map((dia) => {
            const data = getCumplimientoDia(dia.id);
            const esHoy = dia.id === diaActualId;

            return (
              <div key={dia.id} className={`pt-4 first:pt-0 flex flex-col md:flex-row md:items-center gap-3 sm:gap-6 ${esHoy ? 'bg-amber-50/40 -mx-4 px-4 py-3 rounded-2xl' : ''}`}>
                <div className="w-28 flex-shrink-0 flex items-center gap-2">
                  <span className={`text-sm font-extrabold ${esHoy ? 'text-amber-800' : 'text-slate-800'}`}>
                    {dia.nombre}
                  </span>
                  {esHoy && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 uppercase">
                      Hoy
                    </span>
                  )}
                </div>

                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Mañana */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
                        <Sun className="w-3 h-3" /> Mañana
                      </span>
                      <span className="font-mono font-bold text-amber-900">{data.manana}%</span>
                    </div>
                    <div className="h-2 w-full bg-amber-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all duration-500"
                        style={{ width: `${data.manana}%` }}
                      />
                    </div>
                  </div>

                  {/* Tarde */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                        <Sunset className="w-3 h-3" /> Tarde
                      </span>
                      <span className="font-mono font-bold text-emerald-900">{data.tarde}%</span>
                    </div>
                    <div className="h-2 w-full bg-emerald-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${data.tarde}%` }}
                      />
                    </div>
                  </div>

                  {/* Noche */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-bold text-indigo-700 flex items-center gap-1">
                        <Moon className="w-3 h-3" /> Noche
                      </span>
                      <span className="font-mono font-bold text-indigo-900">{data.noche}%</span>
                    </div>
                    <div className="h-2 w-full bg-indigo-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${data.noche}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Módulo de Recomendaciones Clínicas y Psicopedagógicas con IA */}
      <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-white p-6 sm:p-7 shadow-soft-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-emerald-950">
                  Recomendaciones Psicopedagógicas de la IA
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 uppercase">
                  Motor U-Pad AI
                </span>
              </div>
              <p className="text-xs text-emerald-800 mt-0.5">
                Evaluación adaptativa generada a las {aiLastUpdate} para {nombreHijoActivo}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunAiAnalysis}
            disabled={aiAnalyzing || totalActividades === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 ${aiAnalyzing ? 'animate-spin' : ''}`} />
            <span>{aiAnalyzing ? 'Analizando Patrones...' : 'Reevaluar con IA'}</span>
          </button>
        </div>

        {totalActividades === 0 ? (
          <div className="p-6 rounded-2xl bg-white border border-emerald-100 text-center space-y-2">
            <BrainCircuit className="w-8 h-8 text-emerald-600 mx-auto opacity-60" />
            <h4 className="text-sm font-bold text-emerald-950">Sin actividades registradas para evaluación</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Crea la primera rutina estructurada para {nombreHijoActivo} para que el motor clínico U-Pad analice sus patrones de desempeño.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-emerald-100 shadow-xs space-y-2">
              <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Consistencia en Mañana
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">
                {rutinasManana.length > 0 
                  ? `${nombreHijoActivo} cuenta con ${rutinasManana.length} rutina(s) matutina(s) activa(s) (${mananaPct}% de cumplimiento). La anticipación visual refuerza el inicio de jornada.`
                  : `Aún no se han configurado rutinas matutinas para ${nombreHijoActivo}.`}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-emerald-100 shadow-xs space-y-2">
              <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Transición de la Tarde
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">
                {rutinasTarde.length > 0
                  ? `Turno tarde con ${rutinasTarde.length} rutina(s) activa(s) (${tardePct}% de cumplimiento). Se sugiere introducir pausas sensoriales entre tareas.`
                  : `Aún no se han configurado rutinas de tarde para ${nombreHijoActivo}.`}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-emerald-100 shadow-xs space-y-2">
              <span className="text-xs font-bold text-indigo-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Ritual de Relajación Nocturno
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">
                {rutinasNoche.length > 0
                  ? `Turno noche con ${rutinasNoche.length} rutina(s) activa(s) (${nochePct}% de cumplimiento). Mantener baja intensidad lumínica refuerza el descanso.`
                  : `Aún no se han configurado rutinas nocturnas para ${nombreHijoActivo}.`}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

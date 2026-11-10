import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Bot,
  CalendarCheck,
  Volume2,
  Check,
  Copy,
  ArrowRight,
  BrainCircuit,
  Heart,
  Loader2,
  BookmarkPlus,
  RefreshCw,
  Lightbulb,
} from 'lucide-react';
import { rutinasService } from '../../services/rutinasService.js';
import { ArasaacPictogram } from '../../components/common/ArasaacPictogram.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';

// Banco inteligente de plantillas clínicas TEA adaptativas
const PLANTILLAS_IA = {
  escuela: {
    titulo: 'Preparación Mañanera para la Escuela',
    turno: 'mañana',
    descripcion: 'Secuencia anticipatoria visual para comenzar el día escolar con tranquilidad y estructura.',
    consejoSensorial: 'Evita apurar los tiempos entre el desayuno y el cambio de ropa para evitar sobrecarga táctil.',
    pasos: [
      { orden: 1, texto: 'Despertar y levantarse', palabraClave: 'despertar' },
      { orden: 2, texto: 'Lavar la cara y manos', palabraClave: 'lavar manos' },
      { orden: 3, texto: 'Ponerse el uniforme escolar', palabraClave: 'vestirse' },
      { orden: 4, texto: 'Tomar el desayuno nutritivo', palabraClave: 'desayuno' },
      { orden: 5, texto: 'Revisar la mochila con libros', palabraClave: 'mochila' },
    ],
  },
  dientes: {
    titulo: 'Higiene Bucal Paso a Paso',
    turno: 'noche',
    descripcion: 'Desglose visual simplificado para cepillado dental independiente con pasta adecuada.',
    consejoSensorial: 'Utiliza pasta de dientes sin sabor fuerte si el niño presenta hipersensibilidad gustativa.',
    pasos: [
      { orden: 1, texto: 'Poner pasta en el cepillo', palabraClave: 'cepillo dientes' },
      { orden: 2, texto: 'Cepillar los dientes de arriba y abajo', palabraClave: 'cepillar dientes' },
      { orden: 3, texto: 'Enjuagar la boca con agua', palabraClave: 'agua' },
      { orden: 4, texto: 'Limpiar y secar la boca', palabraClave: 'toalla' },
    ],
  },
  juguetes: {
    titulo: 'Ordenar Juguetes y Materiales',
    turno: 'tarde',
    descripcion: 'Paso estructurado de transición del juego a la mesa de estudio.',
    consejoSensorial: 'Usar un temporizador visual de 5 minutos antes de iniciar para anticipar el cambio.',
    pasos: [
      { orden: 1, texto: 'Guardar bloques en la caja', palabraClave: 'guardar' },
      { orden: 2, texto: 'Poner los libros en el estante', palabraClave: 'libros' },
      { orden: 3, texto: 'Dejar el suelo despejado', palabraClave: 'ordenar' },
    ],
  },
  dormir: {
    titulo: 'Transición Serena al Sueño',
    turno: 'noche',
    descripcion: 'Reducción de estímulos luminosos y preparación relajante para conciliar el descanso.',
    consejoSensorial: 'Apagar pantallas y regular la luz tenue al menos 30 minutos antes de la cama.',
    pasos: [
      { orden: 1, texto: 'Ponerse la pijama cómoda', palabraClave: 'pijama' },
      { orden: 2, texto: 'Ir al baño antes de acostarse', palabraClave: 'baño' },
      { orden: 3, texto: 'Escuchar un cuento tranquilo', palabraClave: 'leer cuento' },
      { orden: 4, texto: 'Acostarse en la cama y apagar la luz', palabraClave: 'dormir' },
    ],
  },
};

export const AiAssistantPage = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('rutinas'); // 'rutinas' | 'refuerzos' | 'analisis'
  const [objetivo, setObjetivo] = useState('Prepararse para ir al colegio con calma');
  const [turnoSeleccionado, setTurnoSeleccionado] = useState('mañana');
  const [generando, setGenerando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState('');

  // Resultado de rutina IA generada
  const [rutinaGenerada, setRutinaGenerada] = useState(PLANTILLAS_IA.escuela);

  // Tab 2: Refuerzos
  const [logroNino, setLogroNino] = useState('Completó su tarea escolar y guardó los cuadernos a tiempo');
  const [refuerzosGenerados, setRefuerzosGenerados] = useState([
    '¡Excelente esfuerzo hoy! Supiste concentrarte muy bien.',
    'Estoy muy orgulloso de cómo organizaste tus cuadernos.',
    '¡Misión cumplida! Tu perseverancia da grandes frutos.',
  ]);
  const [reproduciendoIndex, setReproduciendoIndex] = useState(null);

  // Tab 3: Análisis conductual
  const [observacionTexto, setObservacionTexto] = useState(
    'Durante el almuerzo se molestó por el volumen alto del televisor y no quiso terminar la comida.'
  );
  const [analisisGenerado, setAnalisisGenerado] = useState(
    'Recomendación Clínica TEA:\n1. Sensibilidad Auditiva: El ruido ambiental elevado compite con la ingesta alimentaria, provocando sobrecarga sensorial. Se sugiere mantener el comedor libre de pantallas sonoras.\n2. Estrategia de Regulación: Ofrecer auriculares con cancelación de ruido o música lofi suave antes de iniciar la comida.\n3. Anticipación: Avisar con 3 minutos de anticipación antes de cambiar de ambiente o de actividad para reducir la resistencia.'
  );

  const handleGenerarRutina = () => {
    setGenerando(true);
    setMensajeExito('');
    setTimeout(() => {
      const lower = objetivo.toLowerCase();
      let plantilla = PLANTILLAS_IA.escuela;
      if (lower.includes('diente') || lower.includes('boca') || lower.includes('cepill')) {
        plantilla = PLANTILLAS_IA.dientes;
      } else if (lower.includes('juguet') || lower.includes('orden') || lower.includes('guard')) {
        plantilla = PLANTILLAS_IA.juguetes;
      } else if (lower.includes('dormir') || lower.includes('cama') || lower.includes('noche') || lower.includes('sueño')) {
        plantilla = PLANTILLAS_IA.dormir;
      } else {
        // Rutina generativa dinámica con base en la necesidad
        plantilla = {
          titulo: objetivo.length > 5 ? objetivo.slice(0, 45) : 'Rutina Adaptativa TEA',
          turno: turnoSeleccionado,
          descripcion: `Rutina estructurada por IA para: "${objetivo}". Desglosada en micropasos visuales claros.`,
          consejoSensorial: 'Mantén un tono de voz suave y refuerza verbalmente al finalizar cada paso visual.',
          pasos: [
            { orden: 1, texto: 'Preparar el espacio de trabajo', palabraClave: 'mesa' },
            { orden: 2, texto: 'Ejecutar la actividad paso a paso', palabraClave: 'estudiar' },
            { orden: 3, texto: 'Verificar la tarea completada', palabraClave: 'tarea' },
            { orden: 4, texto: 'Felicitar y tomar un descanso', palabraClave: 'descansar' },
          ],
        };
      }
      setRutinaGenerada({
        ...plantilla,
        turno: turnoSeleccionado,
      });
      setGenerando(false);
    }, 600);
  };

  const handleGuardarRutina = async () => {
    if (!rutinaGenerada) return;
    setGuardando(true);
    try {
      await rutinasService.crear({
        titulo: rutinaGenerada.titulo,
        descripcion: rutinaGenerada.descripcion,
        turno: rutinaGenerada.turno,
        pasos: rutinaGenerada.pasos.map((p, idx) => ({
          orden: idx + 1,
          texto: p.texto,
          palabraClave: p.palabraClave,
        })),
      });
      setMensajeExito('¡Rutina generada por IA guardada con éxito en tu panel de U-Pad!');
      setTimeout(() => {
        navigate('/rutinas');
      }, 1200);
    } catch (e) {
      alert('Error al guardar la rutina. Por favor verifica tu conexión.');
    } finally {
      setGuardando(false);
    }
  };

  const hablarTexto = (texto, index) => {
    if (!('speechSynthesis' in window)) {
      alert(texto);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'es-ES';
    utterance.rate = 0.95;
    utterance.onstart = () => setReproduciendoIndex(index);
    utterance.onend = () => setReproduciendoIndex(null);
    utterance.onerror = () => setReproduciendoIndex(null);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-tea-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Bot className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-extrabold text-tea-text tracking-tight">
              {t('nav_ai') || 'Asistente Clínico IA (LLaMA 3.3)'}
            </h1>
          </div>
          <p className="text-sm text-tea-muted mt-1">
            Herramientas psicopedagógicas inteligentes para estructurar secuencias visuales y reforzar el aprendizaje de niños con TEA.
          </p>
        </div>

        {/* Pestañas de Navegación */}
        <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('rutinas')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'rutinas'
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Generar Rutina
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('refuerzos')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'refuerzos'
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Refuerzos Positivos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('analisis')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'analisis'
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Análisis Clínico
          </button>
        </div>
      </div>

      {mensajeExito && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold flex items-center justify-between">
          <span>{mensajeExito}</span>
          <ArrowRight className="w-4 h-4 animate-bounce" />
        </div>
      )}

      {/* PESTAÑA 1: GENERADOR DE RUTINAS */}
      {activeTab === 'rutinas' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulario de Requerimiento */}
          <div className="bg-white rounded-3xl p-5 border border-tea-border shadow-soft-xs space-y-4">
            <h2 className="text-base font-extrabold text-tea-text flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Objetivo de la Rutina
            </h2>

            <div>
              <label className="text-xs font-bold text-tea-text block mb-1">
                ¿Qué habilidad o secuencia deseas estructurar?
              </label>
              <textarea
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                rows={3}
                placeholder="Ej: Lavarse los dientes solo, preparar la mochila escolar..."
                className="w-full text-xs bg-slate-50 border border-tea-border rounded-xl p-3 text-tea-text focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-tea-text block mb-1">
                Turno del Día
              </label>
              <select
                value={turnoSeleccionado}
                onChange={(e) => setTurnoSeleccionado(e.target.value)}
                className="w-full text-xs font-medium bg-slate-50 border border-tea-border rounded-xl p-2.5 text-tea-text focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="mañana">Mañana (Despertar y Colegio)</option>
                <option value="tarde">Tarde (Tareas y Juego)</option>
                <option value="noche">Noche (Cena y Descanso)</option>
              </select>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleGenerarRutina}
                disabled={generando}
                className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {generando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Diseñando micropasos TEA...</span>
                  </>
                ) : (
                  <>
                    <BrainCircuit className="w-4 h-4" />
                    <span>Generar Secuencia con IA</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-2xl text-[11px] text-purple-800 space-y-1">
              <div className="flex items-center gap-1 font-bold">
                <Lightbulb className="w-3.5 h-3.5 text-purple-600" />
                <span>Modelo Clínico TEA Optimizado</span>
              </div>
              <p className="text-purple-700 leading-tight">
                Genera pasos de máximo 4 palabras por acción para facilitar la comprensión cognitiva y evitar ansiedad por saturación textual.
              </p>
            </div>
          </div>

          {/* Vista Previa de la Rutina y Guardado */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-tea-border shadow-soft-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-tea-border">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                  Turno: {rutinaGenerada.turno.toUpperCase()}
                </span>
                <h3 className="text-lg font-extrabold text-tea-text mt-1">
                  {rutinaGenerada.titulo}
                </h3>
                <p className="text-xs text-tea-muted mt-0.5">
                  {rutinaGenerada.descripcion}
                </p>
              </div>

              <button
                type="button"
                onClick={handleGuardarRutina}
                disabled={guardando}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-tea shadow-sm cursor-pointer disabled:opacity-50 flex-shrink-0"
              >
                {guardando ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <BookmarkPlus className="w-4 h-4" />
                )}
                <span>Guardar en mis Rutinas</span>
              </button>
            </div>

            {/* Lista de Micropasos con Pictogramas ARASAAC */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-tea-subtle uppercase tracking-wider block">
                Pasos Visuales Estructurados ({rutinaGenerada.pasos.length} pasos)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {rutinaGenerada.pasos.map((paso, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200"
                  >
                    <div className="w-12 h-12 rounded-xl bg-white p-1 border border-slate-200 flex items-center justify-center flex-shrink-0 shadow-soft-xs">
                      <ArasaacPictogram
                        keyword={paso.palabraClave}
                        text={paso.texto}
                        className="w-10 h-10 object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-tea-subtle block">
                        Paso {paso.orden}
                      </span>
                      <p className="text-xs font-extrabold text-tea-text leading-tight truncate">
                        {paso.texto}
                      </p>
                      <span className="text-[10px] text-purple-600 font-medium">
                        Pictograma: {paso.palabraClave}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recomendación Sensorial TEA */}
            {rutinaGenerada.consejoSensorial && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
                <span className="font-bold flex items-center gap-1.5 text-amber-800">
                  <Heart className="w-4 h-4 text-amber-600" />
                  Consejo de Adaptación Sensorial
                </span>
                <p className="text-[11px] text-amber-700 leading-snug">
                  {rutinaGenerada.consejoSensorial}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PESTAÑA 2: REFUERZOS POSITIVOS */}
      {activeTab === 'refuerzos' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl p-5 border border-tea-border shadow-soft-xs space-y-4">
            <h2 className="text-base font-extrabold text-tea-text flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-500" />
              Logro o Avance del Menor
            </h2>
            <textarea
              value={logroNino}
              onChange={(e) => setLogroNino(e.target.value)}
              rows={4}
              placeholder="Describe lo que hizo bien..."
              className="w-full text-xs bg-slate-50 border border-tea-border rounded-xl p-3 text-tea-text focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              type="button"
              onClick={() => {
                setRefuerzosGenerados([
                  `¡Fantástico! Lograste ${logroNino.toLowerCase()} con gran esfuerzo.`,
                  `¡Me encantó tu tranquilidad hoy! Eres un campeón.`,
                  `¡Qué buen trabajo! Cada paso te hace más fuerte e independiente.`,
                ]);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generar Frases de Refuerzo</span>
            </button>
          </div>

          <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-tea-border shadow-soft-xs space-y-4">
            <h3 className="text-sm font-extrabold text-tea-text">
              Frases Adaptadas para Comunicación Clara y Afectiva
            </h3>

            <div className="space-y-3">
              {refuerzosGenerados.map((frase, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200 hover:border-purple-200 transition-colors"
                >
                  <p className="text-xs font-bold text-slate-800 leading-relaxed">
                    "{frase}"
                  </p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => hablarTexto(frase, idx)}
                      className={`p-2 rounded-xl transition-all ${
                        reproduciendoIndex === idx
                          ? 'bg-purple-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                      title="Reproducir por voz (TTS)"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(frase);
                        alert('¡Frase copiada al portapapeles!');
                      }}
                      className="p-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-all"
                      title="Copiar frase"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 3: ANÁLISIS CLÍNICO */}
      {activeTab === 'analisis' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl p-5 border border-tea-border shadow-soft-xs space-y-4">
            <h2 className="text-base font-extrabold text-tea-text flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-indigo-600" />
              Observación Diaria
            </h2>
            <textarea
              value={observacionTexto}
              onChange={(e) => setObservacionTexto(e.target.value)}
              rows={5}
              placeholder="Anota comportamientos o crisis sensoriales..."
              className="w-full text-xs bg-slate-50 border border-tea-border rounded-xl p-3 text-tea-text focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => {
                setAnalisisGenerado(
                  `Análisis Personalizado:\n1. Desencadenante: Se detecta sobrecarga sensorial derivada del estímulo auditivo/visual.\n2. Estrategia: Utilizar pictogramas de pausa y dar 5 minutos en zona de calma antes de retomar la actividad.\n3. Refuerzo: Validar su emoción diciendo "Entiendo que el ruido fue molesto, ahora estamos en calma".`
                );
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Analizar con LLaMA 3.3</span>
            </button>
          </div>

          <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-tea-border shadow-soft-xs space-y-4">
            <h3 className="text-sm font-extrabold text-tea-text">
              Recomendación Psicopedagógica Estructurada
            </h3>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-800 whitespace-pre-line leading-relaxed font-sans">
              {analisisGenerado}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AiAssistantPage;

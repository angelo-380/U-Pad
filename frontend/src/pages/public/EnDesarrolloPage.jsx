import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ImagePlaceholder } from '../../components/common/ImagePlaceholder.jsx';
import { Compass, Cpu, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const EnDesarrolloPage = () => {
  const location = useLocation();
  const isGps = location.pathname.includes('gps');

  const config = isGps
    ? {
        titulo: 'Módulo de Monitoreo y Geocercas GPS',
        icono: Compass,
        placeholderImage: 'pantalla-app-mapa.png',
        desc: 'Permite a tutores e instituciones visualizar en tiempo real la posición del niño con TEA y definir perímetros seguros de movilidad.',
        detalles: [
          'Integración nativa con Google Maps Platform y FusedLocationProviderClient.',
          'Notificaciones automáticas en caso de salida de zona segura.',
          'Sincronización en vivo con el dispositivo Android del menor.',
        ],
      }
    : {
        titulo: 'Generador Asistido por Inteligencia Artificial (Groq / LLaMA 3.3)',
        icono: Cpu,
        placeholderImage: 'pantalla-app-rutinas.png',
        desc: 'Algoritmo psicopedagógico entrenado para recomendar secuencias de actividades y frases de refuerzo positivo adaptadas a la necesidad específica del niño.',
        detalles: [
          'Procesamiento de Lenguaje Natural para convertir requerimientos en pasos simples.',
          'Búsqueda y mapeo automático de pictogramas de ARASAAC.',
          'Ajuste dinámico según el reporte de efectividad y estados emocionales.',
        ],
      };

  const IconComponent = config.icono;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-tea-border shadow-sm">
        <div className="flex items-center gap-2 text-brand-600 text-xs font-bold uppercase tracking-wider mb-2">
          <IconComponent className="w-4 h-4" />
          <span>Hoja de Ruta del Proyecto · Entrega del 25%</span>
        </div>

        <h1 className="text-2xl font-extrabold text-tea-text tracking-tight">
          {config.titulo}
        </h1>

        <p className="text-xs sm:text-sm text-tea-muted mt-2 leading-relaxed">
          {config.desc}
        </p>

        <div className="my-6">
          <ImagePlaceholder
            name={config.placeholderImage}
            alt={config.titulo}
            aspect="aspect-video"
          />
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-tea-text mb-2">
            Características Técnicas en Desarrollo:
          </h2>
          {config.detalles.map((detalle, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>{detalle}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-between items-center pt-4 border-t border-slate-100">
          <span className="text-[11px] text-tea-muted font-bold">
            Estado: Planificado para fase beta
          </span>
          <Link
            to="/rutinas"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 shadow-sm transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver a Rutinas</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

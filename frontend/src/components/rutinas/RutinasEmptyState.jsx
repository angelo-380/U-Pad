import React from 'react';
import { Plus, CalendarHeart, Sparkles } from 'lucide-react';

export const RutinasEmptyState = ({
  filtroTurno = '',
  onCrearRutina,
}) => {
  const getTurnoLabel = (turno) => {
    switch (turno) {
      case 'MANANA':
        return 'la mañana';
      case 'TARDE':
        return 'la tarde';
      case 'NOCHE':
        return 'la noche';
      default:
        return 'este turno';
    }
  };

  return (
    <div
      role="region"
      aria-label="Sin rutinas registradas"
      className="p-8 sm:p-12 bg-white rounded-3xl border border-slate-200/90 text-center flex flex-col items-center max-w-lg mx-auto shadow-xs"
    >
      <div className="w-16 h-16 rounded-3xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600 mb-4 shadow-xs">
        <CalendarHeart className="w-8 h-8" aria-hidden="true" />
      </div>

      <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
        {filtroTurno
          ? `Sin rutinas para ${getTurnoLabel(filtroTurno)}`
          : 'Aún no hay rutinas registradas'}
      </h3>

      <p className="text-xs sm:text-sm text-slate-600 mt-2 max-w-md leading-relaxed">
        {filtroTurno
          ? `No se han configurado secuencias visuales para el turno de ${getTurnoLabel(
              filtroTurno
            )}. Puedes crear una nueva ahora mismo.`
          : 'Las rutinas con pictogramas ARASAAC ayudan a anticipar actividades diarias y reducir la ansiedad en personas con TEA.'}
      </p>

      <button
        type="button"
        onClick={onCrearRutina}
        className="mt-6 inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 active:scale-98"
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
        <span>Crear Primera Rutina</span>
      </button>
    </div>
  );
};

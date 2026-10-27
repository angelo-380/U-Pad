import React from 'react';

export const RutinasSkeleton = ({ count = 3 }) => {
  return (
    <div
      role="status"
      aria-label="Cargando rutinas..."
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between animate-pulse motion-reduce:animate-none"
        >
          <div>
            {/* Cabecera skeleton: badge y fecha */}
            <div className="flex items-center justify-between mb-4">
              <div className="h-6 w-24 bg-slate-200 rounded-full" />
              <div className="h-4 w-20 bg-slate-200 rounded-md" />
            </div>

            {/* Título skeleton */}
            <div className="h-5 w-3/4 bg-slate-200 rounded-md mb-2" />
            <div className="h-4 w-1/2 bg-slate-200 rounded-md mb-4" />

            {/* Pasos visuales skeleton */}
            <div className="space-y-2.5 mb-5">
              <div className="h-3 w-28 bg-slate-200 rounded-md mb-2" />
              {[1, 2, 3].map((stepIdx) => (
                <div
                  key={stepIdx}
                  className="flex items-center gap-3 p-2 rounded-2xl bg-slate-50 border border-slate-100"
                >
                  <div className="w-6 h-6 rounded-lg bg-slate-200 flex-shrink-0" />
                  <div className="w-9 h-9 rounded-xl bg-slate-200 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-4/5 bg-slate-200 rounded-md" />
                    <div className="h-2.5 w-1/3 bg-slate-200 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer skeleton */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div className="h-3.5 w-16 bg-slate-200 rounded-md" />
            <div className="flex items-center gap-2">
              <div className="h-9 w-20 bg-slate-200 rounded-xl" />
              <div className="h-9 w-20 bg-slate-200 rounded-xl" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

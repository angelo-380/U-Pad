import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ImagePlaceholder } from '../../components/common/ImagePlaceholder.jsx';
import { RefreshCw, Home, ServerCrash, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

export const ServerErrorPage = () => {
  const location = useLocation();
  const [retrying, setRetrying] = useState(false);
  const [retryStatus, setRetryStatus] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const errorDetails = location.state?.error || {
    message: 'El servidor de U-Pad no respondió a tiempo o experimentó una interrupción temporal.',
    code: '500_INTERNAL_SERVER_ERROR',
    timestamp: new Date().toISOString(),
  };

  const handleRetry = async () => {
    setRetrying(true);
    setRetryStatus(null);
    try {
      const res = await fetch('/health', { method: 'GET' });
      if (res.ok) {
        setRetryStatus('success');
        setTimeout(() => {
          window.location.href = '/rutinas';
        }, 800);
      } else {
        setRetryStatus('error');
      }
    } catch (e) {
      setRetryStatus('error');
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-50">
      <div className="max-w-lg w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center">
        {/* Contenedor del Gato Negro Mascota */}
        <div className="w-56 h-56 mx-auto mb-4 relative flex items-center justify-center">
          <ImagePlaceholder
            name="500.png"
            fallbackNames={['servidor-caido.png', 'gato-negro-servidor.png', '404.png']}
            alt="Mascota gato negro tropezando con cables del servidor"
            aspect="aspect-square"
            className="border-none bg-transparent shadow-none"
          />
        </div>

        <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full uppercase tracking-wider">
          <ServerCrash className="w-3.5 h-3.5" />
          <span>Error 500 · Servidor Desconectado</span>
        </div>

        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight mt-3">
          ¡Miau! Nuestro servidor tropezó con un cable
        </h1>

        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
          Parece que el servicio de la nube tuvo una interrupción imprevista o se desconectó momentáneamente.
          No te preocupes, el equipo de desarrollo ya está restaurando los servicios.
        </p>

        {retryStatus === 'error' && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>El servidor aún no responde. Por favor espera unos segundos más.</span>
          </div>
        )}

        {retryStatus === 'success' && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-bold">
            ¡Conexión restaurada con éxito! Redirigiendo a tus rutinas...
          </div>
        )}

        {/* Acciones principales */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleRetry}
            disabled={retrying}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 shadow-sm transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
            <span>{retrying ? 'Verificando...' : 'Reintentar conexión'}</span>
          </button>

          <Link
            to="/rutinas"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Ir al inicio</span>
          </Link>
        </div>

        {/* Acordeón de detalles técnicos para desarrollador / soporte */}
        <div className="mt-6 pt-4 border-t border-slate-100 text-left">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between text-xs text-slate-600 font-semibold hover:text-slate-700"
          >
            <span>Detalles técnicos del incidente</span>
            {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showDetails && (
            <div className="mt-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-700 space-y-1">
              <div><strong className="text-slate-800">Estado:</strong> HTTP 500 Internal Server Error</div>
              <div><strong className="text-slate-800">Mensaje:</strong> {errorDetails.message}</div>
              <div><strong className="text-slate-800">Servicio:</strong> upad-backend (Cloud Run / Node.js)</div>
              <div><strong className="text-slate-800">Timestamp:</strong> {errorDetails.timestamp}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
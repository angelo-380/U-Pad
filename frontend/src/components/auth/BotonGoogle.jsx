import React, { useEffect, useRef, useState } from 'react';
import { authService } from '../../services/authService.js';
import { useLanguage } from '../../context/LanguageContext.jsx';

/**
 * Botón oficial de Google Identity Services («Continuar con Google»).
 * Pide el client ID al backend (GET /api/auth/config); si no está configurado, no muestra nada.
 * onCredential recibe la credencial (ID token) que el backend verifica.
 */
const GSI_SRC = 'https://accounts.google.com/gsi/client';
let cargaScript = null;

const cargarGoogle = () => {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (!cargaScript) {
    cargaScript = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.google);
      script.onerror = () => {
        cargaScript = null;
        reject(new Error('No se pudo cargar Google'));
      };
      document.head.appendChild(script);
    });
  }
  return cargaScript;
};

export const BotonGoogle = ({ onCredential, texto = 'continue_with', disabled = false, onError }) => {
  const { t, language } = useLanguage();
  const contenedor = useRef(null);
  const callbackRef = useRef(onCredential);
  const [clientId, setClientId] = useState(undefined); // undefined = cargando; null = no configurado
  const [falloCarga, setFalloCarga] = useState(false);

  callbackRef.current = onCredential;

  useEffect(() => {
    let activo = true;
    authService
      .obtenerConfig()
      .then((config) => activo && setClientId(config?.googleClientId || null))
      .catch(() => activo && setClientId(null));
    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    if (!clientId || !contenedor.current) return undefined;
    let activo = true;
    cargarGoogle()
      .then((google) => {
        if (!activo || !contenedor.current) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (respuesta) => {
            if (respuesta?.credential) callbackRef.current?.(respuesta.credential);
          },
          ux_mode: 'popup',
          cancel_on_tap_outside: true,
        });
        contenedor.current.innerHTML = '';
        google.accounts.id.renderButton(contenedor.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: texto,
          logo_alignment: 'center',
          width: Math.min(400, contenedor.current.offsetWidth || 320),
          locale: language === 'en' ? 'en' : 'es',
        });
      })
      .catch(() => {
        if (!activo) return;
        setFalloCarga(true);
        onError?.(t('google_load_error'));
      });
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, language, texto]);

  if (!clientId) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-tea-muted">
        <span className="flex-1 h-px bg-tea-border" />
        {t('or_separator')}
        <span className="flex-1 h-px bg-tea-border" />
      </div>
      {falloCarga ? (
        <p className="text-xs text-center text-tea-muted">{t('google_load_error')}</p>
      ) : (
        <div
          ref={contenedor}
          className={`w-full flex justify-center min-h-[44px] ${disabled ? 'pointer-events-none opacity-60' : ''}`}
          aria-busy={disabled}
        />
      )}
    </div>
  );
};

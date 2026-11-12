import React, { useState, useEffect } from 'react';
import { X, User, Mail, Shield, Building, Key, Copy, Check } from 'lucide-react';
import { organizacionesService } from '../../services/organizacionesService.js';
import { useToast } from '../../context/ToastContext.jsx';

export const ConfiguracionUsuarioModal = ({ isOpen, onClose, user }) => {
  const [orgData, setOrgData] = useState(null);
  const [loadingOrg, setLoadingOrg] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (isOpen && user) {
      if (user.rol === 'empresario' || (user.rol === 'tutor' && user.organizacionId)) {
        setLoadingOrg(true);
        organizacionesService
          .obtenerMia()
          .then((data) => setOrgData(data))
          .catch(() => setOrgData(null))
          .finally(() => setLoadingOrg(false));
      } else {
        setOrgData(null);
      }
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const isDeveloper = user.rol === 'developer';
  const isEmpresario = user.rol === 'empresario';
  const isTutor = user.rol === 'tutor';

  const roleLabel = isDeveloper
    ? 'Developer'
    : isEmpresario
    ? 'Director de Colegio / Empresario'
    : 'Tutor';

  const handleCopyCode = (codigo) => {
    if (!codigo) return;
    navigator.clipboard.writeText(codigo);
    setCopiedCode(true);
    toast.success('Código de organización copiado al portapapeles');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-tea-border relative animate-scaleIn">
        {/* Botón Cerrar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Cerrar configuración"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Encabezado */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700 font-extrabold text-xl shadow-xs">
            {user.nombre?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">
              Configuración de Usuario
            </h3>
            <p className="text-xs text-slate-500">
              Datos de perfil y credenciales de acceso
            </p>
          </div>
        </div>

        {/* Campos de Información */}
        <div className="space-y-3.5">
          {/* Nombre */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 flex-shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Nombre
              </span>
              <p className="text-sm font-extrabold text-slate-800 truncate">
                {user.nombre}
              </p>
            </div>
          </div>

          {/* Correo Electrónico */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 flex-shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Correo Electrónico
              </span>
              <p className="text-xs font-mono font-bold text-slate-700 truncate">
                {user.email}
              </p>
            </div>
          </div>

          {/* Rol del Usuario */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 flex-shrink-0">
              <Shield className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Rol
              </span>
              <p className="text-xs font-bold text-slate-800">
                {roleLabel}
              </p>
            </div>
          </div>

          {/* Caso 1: Si es Director/Empresario -> Código de la Organización */}
          {isEmpresario && (
            <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-2">
              <div className="flex items-center gap-2 text-indigo-900">
                <Building className="w-4 h-4 text-indigo-700" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Institución Educativa
                </span>
              </div>
              <p className="text-sm font-extrabold text-indigo-950">
                {orgData?.nombre || user.organizacionNombre || user.nombre}
              </p>

              {orgData?.codigo && (
                <div className="mt-2 pt-2 border-t border-indigo-200/60 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
                      Código para Tutores
                    </span>
                    <span className="text-base font-mono font-black text-indigo-900 tracking-wider">
                      {orgData.codigo}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(orgData.codigo)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-indigo-300 text-indigo-700 hover:bg-indigo-50 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Caso 2: Si es Tutor y pertenece a una organización */}
          {isTutor && user.organizacionId && (
            <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white border border-emerald-200 flex items-center justify-center text-emerald-700 flex-shrink-0">
                <Building className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">
                  Organización / Colegio Asociado
                </span>
                <p className="text-xs font-bold text-emerald-950 truncate">
                  {orgData?.nombre || user.organizacionNombre || user.organizacionId}
                </p>
              </div>
            </div>
          )}

          {/* Si es tutor sin organización, o si es developer, NO se muestra nada de organización (según especificación) */}
        </div>

        {/* Pie de modal */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

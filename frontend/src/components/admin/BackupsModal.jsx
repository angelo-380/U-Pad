import React, { useState, useEffect } from 'react';
import { backupsService } from '../../services/backupsService.js';
import { useToast } from '../../context/ToastContext.jsx';
import {
  X,
  Database,
  Download,
  Plus,
  Calendar,
  FileCheck,
  AlertCircle,
  Loader2,
  HardDrive,
} from 'lucide-react';

export const BackupsModal = ({ isOpen, onClose }) => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const toast = useToast();

  const cargarBackups = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await backupsService.listar();
      setBackups(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'No se pudo cargar la lista de copias de seguridad.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      cargarBackups();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCrearBackup = async () => {
    try {
      setCreating(true);
      const res = await backupsService.crear();
      toast.success(
        `Copia de seguridad "${res?.backup?.filename || 'upad_backup.db'}" generada exitosamente.`,
        'Backup en Caliente Realizado'
      );
      await cargarBackups();
    } catch (err) {
      toast.error(err.message || 'Error al generar la copia de seguridad.', 'Fallo en Backup');
    } finally {
      setCreating(false);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes && bytes !== 0) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-tea-border relative animate-scaleIn flex flex-col max-h-[90vh]">
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">
                Backups
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Acciones Rápidas */}
        <div className="my-4 flex items-center justify-end">
          <button
            type="button"
            onClick={handleCrearBackup}
            disabled={creating}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-60 cursor-pointer"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generando copia...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Crear Backup Ahora</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Lista de backups */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              <span className="text-xs">Consultando catálogo de backups...</span>
            </div>
          )}

          {!loading && backups.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <HardDrive className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold text-slate-600">No hay copias de seguridad creadas aún</p>
              <p className="text-xs text-slate-400 mt-1">
                Haz clic en "Crear Backup Ahora" para generar el primer snapshot atómico.
              </p>
            </div>
          )}

          {!loading &&
            backups.map((b, idx) => {
              const token = localStorage.getItem('upad_token') || '';
              const downloadUrl = `/api/admin/backups/${b.filename}?token=${encodeURIComponent(token)}`;
              return (
                <div
                  key={b.filename || idx}
                  className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-2xl hover:border-indigo-300 transition-colors shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                      <FileCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800 font-mono">
                        {b.filename}
                      </h5>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                        <span>{formatSize(b.size || b.sizeBytes)}</span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {b.fechaModificacion ? new Date(b.fechaModificacion).toLocaleString('es-PE') : 'Reciente'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <a
                    href={downloadUrl}
                    download={b.filename}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition-colors cursor-pointer"
                    title="Descargar copia de seguridad SQLite (.db)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar .db</span>
                  </a>
                </div>
              );
            })}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end items-center text-xs text-slate-500">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
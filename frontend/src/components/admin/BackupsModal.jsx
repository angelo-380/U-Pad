import React, { useState, useEffect } from 'react';
import { backupsService } from '../../services/backupsService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import {
  X,
  Database,
  Download,
  Plus,
  RefreshCw,
  HardDrive,
  ShieldCheck,
  Calendar,
  FileCheck,
  AlertCircle,
  Loader2,
  Terminal,
  Play,
  Table,
} from 'lucide-react';

export const BackupsModal = ({ isOpen, onClose }) => {
  const [tab, setTab] = useState('backups'); // 'backups' | 'sql'
  const [backups, setBackups] = useState([]);
  const [almacen, setAlmacen] = useState(null); // { almacenamiento, ubicacion }
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  // Estados de SQL Explorer
  const [sqlQuery, setSqlQuery] = useState('SELECT id, nombre, email, rol, activo, creadoEn FROM usuarios LIMIT 20;');
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResult, setQueryResult] = useState(null);
  const [queryError, setQueryError] = useState(null);

  const toast = useToast();
  const { t, locale } = useLanguage();

  const cargarBackups = async () => {
    try {
      setLoading(true);
      setError(null);
      const [data, info] = await Promise.all([backupsService.listar(), backupsService.info()]);
      setBackups(Array.isArray(data) ? data : []);
      setAlmacen(info);
    } catch (err) {
      setError(err.message || t('backup_load_error'));
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
      toast.success(t('backup_created', { archivo: res?.data?.filename || '' }), t('backup_created_title'));
      await cargarBackups();
    } catch (err) {
      toast.error(err.message || t('backup_create_error'), t('backup_create_error_title'));
    } finally {
      setCreating(false);
    }
  };

  const handleEjecutarSql = async (customSql) => {
    const q = customSql || sqlQuery;
    try {
      setQueryLoading(true);
      setQueryError(null);
      const res = await backupsService.ejecutarQuery(q);
      setQueryResult(res);
    } catch (err) {
      setQueryError(err.message || t('sql_error'));
    } finally {
      setQueryLoading(false);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes && bytes !== 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label={t('backup_title')}
    >
      <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-tea-border relative animate-scaleIn flex flex-col max-h-[90vh]">
        {/* Cabecera */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-extrabold text-slate-900">
                  {t('backup_title')}
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3 h-3" />
                  {t('backup_badge')}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {t('backup_subtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('btn_close')}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selector de pestañas */}
        <div className="flex items-center gap-2 mt-4 border-b border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => setTab('backups')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
              tab === 'backups'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>{t('backup_tab_backups')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('sql');
              if (!queryResult) handleEjecutarSql('SELECT id, nombre, email, rol, activo, creadoEn FROM usuarios LIMIT 20;');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
              tab === 'sql'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>{t('backup_tab_sql')}</span>
          </button>
        </div>

        {/* VISTA 1: BACKUPS */}
        {tab === 'backups' && (
          <>
            {/* Acciones Rápidas */}
            <div className="my-4 flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="text-xs text-slate-600">
                <p className="font-semibold text-slate-800">{t('backup_db_title')}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {almacen?.almacenamiento === 'cloud-storage'
                    ? t('backup_db_desc_cloud', { ubicacion: almacen.ubicacion })
                    : t('backup_db_desc')}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">{t('backup_auto_note')}</p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={cargarBackups}
                  disabled={loading || creating}
                  className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-white transition-colors"
                  title={t('backup_refresh')}
                  aria-label={t('backup_refresh')}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={handleCrearBackup}
                  disabled={creating}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t('backup_creating')}</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>{t('backup_create')}</span>
                    </>
                  )}
                </button>
              </div>
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
                  <span className="text-xs">{t('backup_loading')}</span>
                </div>
              )}

              {!loading && backups.length === 0 && (
                <div className="py-12 text-center text-slate-400">
                  <HardDrive className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-semibold text-slate-600">{t('backup_empty_title')}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {t('backup_empty_desc')}
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
                              {b.fechaModificacion ? new Date(b.fechaModificacion).toLocaleString(locale) : '—'}
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
                        title={t('backup_download_title')}
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{t('backup_download')}</span>
                      </a>
                    </div>
                  );
                })}
            </div>
          </>
        )}

        {/* VISTA 2: VISOR SQL CLOUD EN VIVO */}
        {tab === 'sql' && (
          <div className="flex-1 overflow-y-auto space-y-4 py-3">
            <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 font-mono text-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" />
                  {t('sql_console_readonly')}
                </span>
                <span className="text-[10px] text-slate-400">{t('sql_engine')}</span>
              </div>
              <textarea
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                rows={3}
                className="w-full bg-slate-800 text-white rounded-xl p-2.5 font-mono text-xs border border-slate-700 focus:outline-hidden focus:border-indigo-400 resize-none"
                placeholder={t('sql_placeholder')}
                aria-label={t('sql_placeholder')}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-800">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const q = 'SELECT id, nombre, email, rol, activo, creadoEn FROM usuarios;';
                      setSqlQuery(q);
                      handleEjecutarSql(q);
                    }}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-[11px] text-slate-300"
                  >
                    {t('sql_view_users')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const q = 'SELECT id, titulo, turno, ninoId, organizacionId, activa, creadoPor, creadoEn FROM rutinas ORDER BY creadoEn DESC LIMIT 20;';
                      setSqlQuery(q);
                      handleEjecutarSql(q);
                    }}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-[11px] text-slate-300"
                  >
                    {t('sql_view_routines')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const q = 'SELECT name FROM sqlite_master WHERE type="table";';
                      setSqlQuery(q);
                      handleEjecutarSql(q);
                    }}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-[11px] text-slate-300"
                  >
                    {t('sql_view_tables')}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleEjecutarSql()}
                  disabled={queryLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {queryLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  <span>{t('sql_run')}</span>
                </button>
              </div>
            </div>

            {queryError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{queryError}</span>
              </div>
            )}

            {queryResult && (
              <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Table className="w-3.5 h-3.5 text-indigo-600" />
                    {t('sql_results', { filas: queryResult?.rowCount || 0 })}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {queryResult?.executedAt ? new Date(queryResult.executedAt).toLocaleTimeString(locale) : ''}
                  </span>
                </div>

                {queryResult.rows && queryResult.rows.length > 0 ? (
                  <div className="overflow-x-auto max-h-56">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 sticky top-0">
                        <tr>
                          {Object.keys(queryResult.rows[0]).map((col) => (
                            <th key={col} className="p-2 border-b border-slate-200">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {queryResult.rows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            {Object.values(row).map((val, cIdx) => (
                              <td key={cIdx} className="p-2 whitespace-nowrap">
                                {val === null ? <span className="text-slate-300">NULL</span> : String(val)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    {t('sql_no_rows')}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
          <span className="text-[11px] text-slate-400">
            {t('backup_tip')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
          >
            {t('btn_close')}
          </button>
        </div>
      </div>
    </div>
  );
};
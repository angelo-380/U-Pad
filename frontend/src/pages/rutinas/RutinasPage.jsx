import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { rutinasService } from '../../services/rutinasService.js';
import { devicesService } from '../../services/devicesService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { RutinasSummaryStrip } from '../../components/rutinas/RutinasSummaryStrip.jsx';
import { RutinaShiftSection } from '../../components/rutinas/RutinaShiftSection.jsx';
import { RutinaDrawer } from '../../components/rutinas/RutinaDrawer.jsx';
import { DeleteConfirmDialog } from '../../components/rutinas/DeleteConfirmDialog.jsx';
import { RutinasSkeleton } from '../../components/rutinas/RutinasSkeleton.jsx';
import { RutinasEmptyState } from '../../components/rutinas/RutinasEmptyState.jsx';
import { RutinasErrorState } from '../../components/rutinas/RutinasErrorState.jsx';
import { VincularDispositivoModal } from '../../components/devices/VincularDispositivoModal.jsx';
import {
  Plus,
  RefreshCw,
  Tablet,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
  Users,
  Building2,
} from 'lucide-react';

export const RutinasPage = () => {
  const [rutinas, setRutinas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtroTurno, setFiltroTurno] = useState('');

  // Paginación
  const [page, setPage] = useState(1);
  const [limit] = useState(6);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 6,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });

  // Dispositivos y Sincronización Móvil
  const [devices, setDevices] = useState([]);
  const [linkDeviceModalOpen, setLinkDeviceModalOpen] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState('create');
  const [selectedRutina, setSelectedRutina] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rutinaToDelete, setRutinaToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const toast = useToast();
  const { t } = useLanguage();
  const { user } = useAuth();

  const cargarDispositivos = useCallback(async () => {
    try {
      const devs = await devicesService.listar();
      setDevices(Array.isArray(devs) ? devs : []);
    } catch (e) {
      // Dispositivos opcionales en caso de error de red
    }
  }, []);

  const cargarRutinas = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await rutinasService.listar({
        turno: filtroTurno || undefined,
        page,
        limit,
      });
      setRutinas(Array.isArray(res.rutinas) ? res.rutinas : []);
      if (res.pagination) {
        setPagination(res.pagination);
      }
    } catch (err) {
      const msg = err.message || 'Error al conectar con el servidor de rutinas.';
      setError(msg);
      toast.error(msg, 'Error de sincronización');
    } finally {
      setLoading(false);
    }
  }, [filtroTurno, page, limit, toast]);

  useEffect(() => {
    cargarDispositivos();
  }, [cargarDispositivos]);

  useEffect(() => {
    cargarRutinas();
  }, [cargarRutinas]);

  const handleSelectTurno = (turno) => {
    setFiltroTurno(turno);
    setPage(1); // Reiniciar a página 1 al cambiar filtro
  };

  const handleOpenCreate = (turnoDefault = 'MANANA') => {
    setDrawerMode('create');
    setSelectedRutina({ turno: turnoDefault, pasos: [{ orden: 1, texto: '', palabraClave: '' }] });
    setDrawerOpen(true);
  };

  const handleOpenEdit = (rutina) => {
    setDrawerMode('edit');
    setSelectedRutina(rutina);
    setDrawerOpen(true);
  };

  const handleDrawerSubmit = async (formData) => {
    try {
      setDrawerLoading(true);
      if (drawerMode === 'create') {
        await rutinasService.crear(formData);
        toast.success(`Rutina "${formData.titulo}" creada correctamente.`, 'Rutina Creada');
      } else if (drawerMode === 'edit' && selectedRutina) {
        await rutinasService.actualizar(selectedRutina.id, formData);
        toast.success(`Rutina "${formData.titulo}" actualizada con éxito.`, 'Cambios Guardados');
      }
      setDrawerOpen(false);
      await cargarRutinas();
    } catch (err) {
      toast.error(err.message || 'Error al procesar la solicitud.', 'No se pudo guardar');
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleOpenDelete = (rutina) => {
    setRutinaToDelete(rutina);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!rutinaToDelete) return;
    try {
      setDeleteLoading(true);
      await rutinasService.eliminar(rutinaToDelete.id);
      toast.success(
        `La rutina "${rutinaToDelete.titulo}" fue eliminada del sistema.`,
        'Rutina Eliminada'
      );
      setDeleteDialogOpen(false);
      setRutinaToDelete(null);
      await cargarRutinas();
    } catch (err) {
      toast.error(err.message || 'No fue posible eliminar la rutina.', 'Error al eliminar');
    } finally {
      setDeleteLoading(false);
    }
  };

  const rutinasManana = rutinas.filter((r) => r.turno === 'MANANA');
  const rutinasTarde = rutinas.filter((r) => r.turno === 'TARDE');
  const rutinasNoche = rutinas.filter((r) => r.turno === 'NOCHE');

  const showManana = filtroTurno === '' || filtroTurno === 'MANANA';
  const showTarde = filtroTurno === '' || filtroTurno === 'TARDE';
  const showNoche = filtroTurno === '' || filtroTurno === 'NOCHE';

  const rutinasFiltradas = rutinas.filter(
    (r) => filtroTurno === '' || r.turno === filtroTurno
  );

  return (
    <div className="space-y-8 pb-16">
      {/* Banner especial para Developer: acceso a auditoría de usuarios y sus rutinas */}
      {user?.rol === 'developer' && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-soft-xs">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-purple-600 text-white font-black text-xs">DEV</span>
            <div>
              <p className="font-extrabold text-purple-900">Modo Desarrollador Cloud Activo</p>
              <p className="text-purple-700 text-[11px]">
                Tienes acceso para auditar todos los usuarios del sistema ({pagination.total || 'miles'}) y ver qué rutinas tiene cada uno.
              </p>
            </div>
          </div>
          <Link
            to="/admin/usuarios"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors shadow-sm flex-shrink-0"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Abrir Auditoría de Usuarios</span>
          </Link>
        </div>
      )}

      {/* Banner especial para Empresario (Director de Colegio / Clínica) */}
      {user?.rol === 'empresario' && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-soft-xs">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-indigo-600 text-white font-black text-xs">DIR</span>
            <div>
              <p className="font-extrabold text-indigo-900">Panel Directivo Institucional ({user?.email?.includes('colegiosol') ? 'Colegio Sol' : 'Institución'})</p>
              <p className="text-indigo-700 text-[11px]">
                Accede a las métricas e indicadores clave (KPIs) de asistencia, adherencia y alumnos con privacidad protegida.
              </p>
            </div>
          </div>
          <Link
            to="/gerencial"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shadow-sm flex-shrink-0"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Ver Panel Gerencial</span>
          </Link>
        </div>
      )}

      {/* Cabecera Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-tea-text tracking-tight">
              {t('routines_title')}
            </h1>
            {devices.length > 0 ? (
              <button
                type="button"
                onClick={() => setLinkDeviceModalOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 transition-colors"
                title="Tablet infantil sincronizada con la app"
              >
                <Tablet className="w-3.5 h-3.5 text-emerald-600" />
                <span>🧒 Tablet {devices[0].childName || devices[0].child_name || 'Mi Hijo'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setLinkDeviceModalOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-200 text-xs font-bold hover:bg-brand-100 transition-colors"
                title="Vincular tablet de tu hijo"
              >
                <Tablet className="w-3.5 h-3.5 text-brand-600" />
                <span>+ Vincular Tablet</span>
              </button>
            )}
          </div>
          <p className="text-sm sm:text-base text-tea-muted mt-1 leading-relaxed">
            {t('routines_subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto flex-shrink-0">
          <button
            type="button"
            onClick={() => setLinkDeviceModalOpen(true)}
            className="sm:hidden inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl bg-tea-cardSubtle border border-tea-border text-xs font-bold text-tea-text"
          >
            <Tablet className="w-4 h-4 text-brand-600" />
            <span>{devices.length > 0 ? devices[0].child_name || 'Tablet' : 'Vincular'}</span>
          </button>

          <button
            type="button"
            onClick={cargarRutinas}
            disabled={loading}
            className="p-3 min-h-[44px] min-w-[44px] rounded-xl text-tea-muted hover:text-tea-text bg-white hover:bg-tea-cardSubtle border border-tea-border transition-tea flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 shadow-soft-xs cursor-pointer"
            title={t('reload_routines')}
            aria-label={t('reload_routines')}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => handleOpenCreate('MANANA')}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-98 text-white font-bold text-sm shadow-soft transition-tea focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>{t('new_routine')}</span>
          </button>
        </div>
      </div>

      {/* Pestañas de turno */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <RutinasSummaryStrip
          rutinas={rutinas}
          filtroTurno={filtroTurno}
          onSelectTurno={handleSelectTurno}
        />
      </div>

      {loading && <RutinasSkeleton count={3} />}

      {!loading && error && (
        <RutinasErrorState error={error} onRetry={cargarRutinas} />
      )}

      {!loading && !error && (rutinas.length === 0 || rutinasFiltradas.length === 0) && (
        <RutinasEmptyState
          filtroTurno={filtroTurno}
          onCrearRutina={() => handleOpenCreate(filtroTurno || 'MANANA')}
        />
      )}

      {!loading && !error && rutinas.length > 0 && rutinasFiltradas.length > 0 && (
        <div className="space-y-10 animate-fadeIn">
          {showManana && rutinasManana.length > 0 && (
            <RutinaShiftSection
              shiftKey="MANANA"
              rutinas={rutinasManana}
              onEditar={handleOpenEdit}
              onEliminar={handleOpenDelete}
              onCrearEnTurno={handleOpenCreate}
            />
          )}

          {showTarde && rutinasTarde.length > 0 && (
            <RutinaShiftSection
              shiftKey="TARDE"
              rutinas={rutinasTarde}
              onEditar={handleOpenEdit}
              onEliminar={handleOpenDelete}
              onCrearEnTurno={handleOpenCreate}
            />
          )}

          {showNoche && rutinasNoche.length > 0 && (
            <RutinaShiftSection
              shiftKey="NOCHE"
              rutinas={rutinasNoche}
              onEditar={handleOpenEdit}
              onEliminar={handleOpenDelete}
              onCrearEnTurno={handleOpenCreate}
            />
          )}
        </div>
      )}

      {/* Barra de Paginación */}
      {pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-tea-border">
          <span className="text-xs text-tea-muted font-medium">
            Página <strong>{pagination.page}</strong> de <strong>{pagination.totalPages}</strong> ({pagination.total} rutinas registradas)
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!pagination.hasPrev || loading}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-tea-border bg-white text-xs font-bold text-tea-text hover:bg-tea-cardSubtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setPage(num)}
                  disabled={loading}
                  className={`w-8 h-8 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    num === pagination.page
                      ? 'bg-brand-600 text-white shadow-soft-xs'
                      : 'text-tea-muted hover:bg-tea-cardSubtle'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={!pagination.hasNext || loading}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-tea-border bg-white text-xs font-bold text-tea-text hover:bg-tea-cardSubtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <span>Siguiente</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <RutinaDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleDrawerSubmit}
        initialData={selectedRutina}
        mode={drawerMode}
        loading={drawerLoading}
        onOpenLinkDevice={() => setLinkDeviceModalOpen(true)}
      />

      <VincularDispositivoModal
        isOpen={linkDeviceModalOpen}
        onClose={() => setLinkDeviceModalOpen(false)}
        onLinked={() => {
          cargarDispositivos();
          cargarRutinas();
        }}
      />

      <DeleteConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        title={t('delete_modal_title')}
        message={
          rutinaToDelete
            ? `${t('delete_modal_title')} "${rutinaToDelete.titulo}". ${t('delete_modal_msg')}`
            : t('delete_modal_msg')
        }
        loading={deleteLoading}
      />
    </div>
  );
};

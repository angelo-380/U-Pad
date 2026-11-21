import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { rutinasService } from '../../services/rutinasService.js';
import { devicesService } from '../../services/devicesService.js';
import { organizacionesService } from '../../services/organizacionesService.js';
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
import { Paginacion } from '../../components/common/Paginacion.jsx';
import {
  Plus,
  RefreshCw,
  Tablet,
  Layers,
  Sparkles,
  Users,
  Building2,
  Info,
} from 'lucide-react';

export const RutinasPage = () => {
  const [rutinas, setRutinas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtroTurno, setFiltroTurno] = useState('');
  const [organizacion, setOrganizacion] = useState(null);

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

  // Nombre real de la institución del empresario (para el banner del panel directivo)
  useEffect(() => {
    if (user?.rol !== 'empresario') return;
    organizacionesService.obtenerMia().then(setOrganizacion).catch(() => setOrganizacion(null));
  }, [user?.rol]);

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
      const msg = err.message || t('routines_load_error');
      setError(msg);
      toast.error(msg, t('routines_load_error_title'));
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
        toast.success(t('routine_created', { titulo: formData.titulo }), t('routine_created_title'));
      } else if (drawerMode === 'edit' && selectedRutina) {
        await rutinasService.actualizar(selectedRutina.id, formData);
        toast.success(t('routine_updated', { titulo: formData.titulo }), t('routine_updated_title'));
      }
      setDrawerOpen(false);
      await cargarRutinas();
    } catch (err) {
      toast.error(err.message || t('routine_save_error'), t('routine_save_error_title'));
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
    const targetId = rutinaToDelete.id;
    const targetTitle = rutinaToDelete.titulo;
    try {
      setDeleteLoading(true);
      await rutinasService.eliminar(targetId);
      setRutinas((prev) => prev.filter((r) => r.id !== targetId));
      toast.success(t('routine_deleted', { titulo: targetTitle }), t('routine_deleted_title'));
      setDeleteDialogOpen(false);
      setRutinaToDelete(null);
      await cargarRutinas();
    } catch (err) {
      toast.error(err.message || t('routine_delete_error'), t('routine_delete_error_title'));
    } finally {
      setDeleteLoading(false);
    }
  };

  // Nombres de los hijos vinculados, para mostrar a quién está asignada cada rutina
  const nombresHijos = Object.fromEntries(
    devices.map((d) => [d.deviceId || d.device_id, d.childName || d.child_name || t('child_unnamed')])
  );
  const resumenHijos =
    devices.length === 0
      ? t('children_link_cta')
      : devices.length === 1
        ? nombresHijos[devices[0].deviceId || devices[0].device_id]
        : `${devices.length} ${t('children_linked_plural')}`;

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
              <p className="font-extrabold text-purple-900">{t('routines_dev_banner_title')}</p>
              <p className="text-purple-700 text-[11px]">
                {t('routines_dev_banner_desc')}
              </p>
            </div>
          </div>
          <Link
            to="/admin/usuarios"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors shadow-sm flex-shrink-0"
          >
            <Users className="w-3.5 h-3.5" />
            <span>{t('routines_dev_banner_cta')}</span>
          </Link>
        </div>
      )}

      {/* Banner especial para Empresario (Director de Colegio / Clínica) */}
      {user?.rol === 'empresario' && (
        <div className="space-y-3">
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-soft-xs">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-indigo-600 text-white font-black text-xs">DIR</span>
              <div>
                <p className="font-extrabold text-indigo-900">{organizacion?.nombre || t('org_fallback_name')}</p>
                <p className="text-indigo-700 text-[11px]">
                  {t('routines_dir_banner_desc')}
                </p>
              </div>
            </div>
            <Link
              to="/gerencial"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shadow-sm flex-shrink-0"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>{t('routines_dir_banner_cta')}</span>
            </Link>
          </div>

          {/* Aclaración Punto 15: Modo Demostración / Capacitación para el Director */}
          <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-2xl flex items-start gap-3 text-xs shadow-soft-xs">
            <div className="p-1.5 rounded-xl bg-amber-500 text-white flex-shrink-0 mt-0.5">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <p className="font-extrabold text-amber-900 text-sm">
                {t('routines_dir_demo_title')}
              </p>
              <p className="text-amber-800 text-xs mt-0.5 leading-relaxed">
                {t('routines_dir_demo_desc')}
              </p>
            </div>
          </div>
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
                title={t('children_manage')}
              >
                <Tablet className="w-3.5 h-3.5 text-emerald-600" />
                <span>{resumenHijos}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setLinkDeviceModalOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-200 text-xs font-bold hover:bg-brand-100 transition-colors"
                title={t('children_link_cta')}
              >
                <Tablet className="w-3.5 h-3.5 text-brand-600" />
                <span>+ {resumenHijos}</span>
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
            <span>{resumenHijos}</span>
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
              nombresHijos={nombresHijos}
            />
          )}

          {showTarde && rutinasTarde.length > 0 && (
            <RutinaShiftSection
              shiftKey="TARDE"
              rutinas={rutinasTarde}
              onEditar={handleOpenEdit}
              onEliminar={handleOpenDelete}
              onCrearEnTurno={handleOpenCreate}
              nombresHijos={nombresHijos}
            />
          )}

          {showNoche && rutinasNoche.length > 0 && (
            <RutinaShiftSection
              shiftKey="NOCHE"
              rutinas={rutinasNoche}
              onEditar={handleOpenEdit}
              onEliminar={handleOpenDelete}
              onCrearEnTurno={handleOpenCreate}
              nombresHijos={nombresHijos}
            />
          )}
        </div>
      )}

      {/* Barra de Paginación (acotada: no genera un botón por cada página) */}
      <Paginacion
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        onChange={setPage}
        disabled={loading}
        etiquetaTotal={t('routine_plural')}
      />

      <RutinaDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleDrawerSubmit}
        initialData={selectedRutina}
        mode={drawerMode}
        loading={drawerLoading}
        onOpenLinkDevice={() => setLinkDeviceModalOpen(true)}
        devices={devices}
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
        rutina={rutinaToDelete}
        onCancel={() => setDeleteDialogOpen(false)}
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

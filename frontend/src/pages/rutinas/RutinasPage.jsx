import React, { useState, useEffect, useCallback } from 'react';
import { rutinasService } from '../../services/rutinasService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { RutinasSummaryStrip } from '../../components/rutinas/RutinasSummaryStrip.jsx';
import { RutinaShiftSection } from '../../components/rutinas/RutinaShiftSection.jsx';
import { RutinaDrawer } from '../../components/rutinas/RutinaDrawer.jsx';
import { DeleteConfirmDialog } from '../../components/rutinas/DeleteConfirmDialog.jsx';
import { RutinasSkeleton } from '../../components/rutinas/RutinasSkeleton.jsx';
import { RutinasEmptyState } from '../../components/rutinas/RutinasEmptyState.jsx';
import { RutinasErrorState } from '../../components/rutinas/RutinasErrorState.jsx';
import { Plus, RefreshCw } from 'lucide-react';

export const RutinasPage = () => {
  const [rutinas, setRutinas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtroTurno, setFiltroTurno] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState('create');
  const [selectedRutina, setSelectedRutina] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rutinaToDelete, setRutinaToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const toast = useToast();
  const { t } = useLanguage();

  const cargarRutinas = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await rutinasService.listar();
      setRutinas(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg = err.message || 'Error al conectar con el servidor de rutinas.';
      setError(msg);
      toast.error(msg, 'Error de sincronización');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    cargarRutinas();
  }, [cargarRutinas]);

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
      {/* Cabecera Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-tea-text tracking-tight">
            {t('routines_title')}
          </h1>
          <p className="text-sm sm:text-base text-tea-muted mt-1 leading-relaxed">
            {t('routines_subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto flex-shrink-0">
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
          onSelectTurno={(val) => setFiltroTurno(val)}
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

      <RutinaDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleDrawerSubmit}
        initialData={selectedRutina}
        mode={drawerMode}
        loading={drawerLoading}
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

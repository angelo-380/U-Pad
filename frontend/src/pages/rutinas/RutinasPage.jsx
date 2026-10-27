import React, { useState, useEffect, useCallback } from 'react';
import { rutinasService } from '../../services/rutinasService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { RutinasSummaryStrip } from '../../components/rutinas/RutinasSummaryStrip.jsx';
import { RutinaShiftSection } from '../../components/rutinas/RutinaShiftSection.jsx';
import { RutinaDrawer } from '../../components/rutinas/RutinaDrawer.jsx';
import { DeleteConfirmDialog } from '../../components/rutinas/DeleteConfirmDialog.jsx';
import { RutinasSkeleton } from '../../components/rutinas/RutinasSkeleton.jsx';
import { RutinasEmptyState } from '../../components/rutinas/RutinasEmptyState.jsx';
import { RutinasErrorState } from '../../components/rutinas/RutinasErrorState.jsx';
import {
  CalendarCheck,
  Plus,
  Filter,
  RefreshCw,
  Sun,
  Sunset,
  Moon,
  Layers,
} from 'lucide-react';

export const RutinasPage = () => {
  const [rutinas, setRutinas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtroTurno, setFiltroTurno] = useState('');

  // Estados del Drawer (Creación y Edición)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState('create'); // 'create' | 'edit'
  const [selectedRutina, setSelectedRutina] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Estados del Diálogo de Confirmación de Eliminación
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rutinaToDelete, setRutinaToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const toast = useToast();

  const cargarRutinas = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Listamos todas las rutinas para alimentar el resumen y agrupamiento
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

  // Manejo de apertura del Drawer
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

  // Guardado desde el Drawer (Crear o Actualizar)
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

  // Manejo de Eliminación
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

  // Rutinas divididas por turno
  const rutinasManana = rutinas.filter((r) => r.turno === 'MANANA');
  const rutinasTarde = rutinas.filter((r) => r.turno === 'TARDE');
  const rutinasNoche = rutinas.filter((r) => r.turno === 'NOCHE');

  // Determinar qué secciones mostrar según el filtro
  const showManana = filtroTurno === '' || filtroTurno === 'MANANA';
  const showTarde = filtroTurno === '' || filtroTurno === 'TARDE';
  const showNoche = filtroTurno === '' || filtroTurno === 'NOCHE';

  const filterChips = [
    { label: 'Todos los turnos', val: '', count: rutinas.length, icon: Layers },
    { label: 'Mañana', val: 'MANANA', count: rutinasManana.length, icon: Sun },
    { label: 'Tarde', val: 'TARDE', count: rutinasTarde.length, icon: Sunset },
    { label: 'Noche', val: 'NOCHE', count: rutinasNoche.length, icon: Moon },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Cabecera Principal de Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-tea-border shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-brand-600 text-xs font-bold uppercase tracking-wider mb-1">
            <CalendarCheck className="w-4 h-4" aria-hidden="true" />
            <span>Módulo de Agendas Visuales</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Gestión de Rutinas
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Diseña secuencias de actividades estructuradas con pictogramas ARASAAC para cada turno del día
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={cargarRutinas}
            disabled={loading}
            className="p-2.5 min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            title="Recargar rutinas del servidor"
            aria-label="Recargar rutinas del servidor"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => handleOpenCreate('MANANA')}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-xs hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 active:scale-98"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Nueva Rutina</span>
          </button>
        </div>
      </div>

      {/* Tira Resumen con conteo por turno */}
      <RutinasSummaryStrip
        rutinas={rutinas}
        filtroTurno={filtroTurno}
        onSelectTurno={(val) => setFiltroTurno(val)}
      />

      {/* Barra de Filtros por Turno (Chips) */}
      <div
        role="region"
        aria-label="Filtrar por turno"
        className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none"
      >
        <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5 mr-1 flex-shrink-0">
          <Filter className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Turno:</span>
        </span>

        {filterChips.map((chip) => {
          const Icon = chip.icon;
          const isSelected = filtroTurno === chip.val;

          return (
            <button
              key={chip.val || 'all'}
              type="button"
              onClick={() => setFiltroTurno(chip.val)}
              aria-pressed={isSelected}
              className={`inline-flex items-center gap-2 px-3.5 py-2 min-h-[44px] rounded-xl text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 flex-shrink-0 ${
                isSelected
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{chip.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {chip.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Estado de Error con Reintento */}
      {error && !loading && (
        <RutinasErrorState error={error} onRetry={cargarRutinas} />
      )}

      {/* Estado de Carga con Skeletons */}
      {loading && <RutinasSkeleton count={3} />}

      {/* Estado Vacío General (cuando no hay ninguna rutina en absoluto) */}
      {!loading && !error && rutinas.length === 0 && (
        <RutinasEmptyState
          filtroTurno={filtroTurno}
          onCrearRutina={() => handleOpenCreate('MANANA')}
        />
      )}

      {/* Secciones agrupadas por turno (Mañana, Tarde, Noche) */}
      {!loading && !error && rutinas.length > 0 && (
        <div className="space-y-6">
          {showManana && (
            <RutinaShiftSection
              shiftKey="MANANA"
              rutinas={rutinasManana}
              onEditar={handleOpenEdit}
              onEliminar={handleOpenDelete}
              onCrearEnTurno={(turno) => handleOpenCreate(turno)}
            />
          )}

          {showTarde && (
            <RutinaShiftSection
              shiftKey="TARDE"
              rutinas={rutinasTarde}
              onEditar={handleOpenEdit}
              onEliminar={handleOpenDelete}
              onCrearEnTurno={(turno) => handleOpenCreate(turno)}
            />
          )}

          {showNoche && (
            <RutinaShiftSection
              shiftKey="NOCHE"
              rutinas={rutinasNoche}
              onEditar={handleOpenEdit}
              onEliminar={handleOpenDelete}
              onCrearEnTurno={(turno) => handleOpenCreate(turno)}
            />
          )}
        </div>
      )}

      {/* Side Drawer para Crear y Editar Rutinas */}
      <RutinaDrawer
        isOpen={drawerOpen}
        mode={drawerMode}
        initialData={selectedRutina}
        loading={drawerLoading}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleDrawerSubmit}
      />

      {/* Diálogo de Confirmación para Eliminar */}
      <DeleteConfirmDialog
        isOpen={deleteDialogOpen}
        rutina={rutinaToDelete}
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setRutinaToDelete(null);
        }}
      />
    </div>
  );
};

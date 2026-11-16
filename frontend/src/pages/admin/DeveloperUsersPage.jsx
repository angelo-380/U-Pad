import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  Eye,
  CalendarCheck,
  ShieldCheck,
  Server,
  RefreshCw,
  X,
  Building,
  UserPlus,
  Edit,
  Trash2,
  Terminal,
  Play,
  AlertTriangle,
} from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { Paginacion } from '../../components/common/Paginacion.jsx';
import { ArasaacPictogram } from '../../components/common/ArasaacPictogram.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const TURNOS = ['MANANA', 'TARDE', 'NOCHE'];
const PICTOGRAMAS_EN_TABLA = 4;

export const DeveloperUsersPage = () => {
  const { t, locale } = useLanguage();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('users_table'); // 'users_table' | 'routines_table' | 'sql_console'
  const [users, setUsers] = useState([]);
  const [pageSize, setPageSize] = useState(25);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [jumpPageInput, setJumpPageInput] = useState('');

  // Modales
  const [selectedUserForRoutines, setSelectedUserForRoutines] = useState(null);
  const [userRoutines, setUserRoutines] = useState([]);
  const [loadingRoutines, setLoadingRoutines] = useState(false);

  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [createUserData, setCreateUserData] = useState({
    nombre: '',
    email: '',
    password: '',
    rol: 'tutor',
    organizacionId: '',
  });
  const [creatingUser, setCreatingUser] = useState(false);

  const [editUserModalOpen, setEditUserModalOpen] = useState(false);
  const [editUserData, setEditUserData] = useState(null);
  const [editingUser, setEditingUser] = useState(false);

  // Consola SQL
  const [sqlQuery, setSqlQuery] = useState('SELECT id, nombre, email, rol, organizacionId, creadoEn FROM usuarios ORDER BY creadoEn DESC LIMIT 15;');
  const [sqlResult, setSqlResult] = useState(null);
  const [sqlExecuting, setSqlExecuting] = useState(false);
  const [sqlError, setSqlError] = useState(null);

  // Pestaña Rutinas: todas las rutinas del sistema, de la más reciente a la más antigua
  const [rutinasAdmin, setRutinasAdmin] = useState([]);
  const [rutinasPagina, setRutinasPagina] = useState(1);
  const [rutinasPaginacion, setRutinasPaginacion] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [rutinasBusqueda, setRutinasBusqueda] = useState('');
  const [rutinasTurno, setRutinasTurno] = useState('');
  const [cargandoRutinas, setCargandoRutinas] = useState(false);

  const fetchRutinas = async (page = rutinasPagina) => {
    setCargandoRutinas(true);
    try {
      const res = await adminService.listarRutinas({ page, limit: 25, search: rutinasBusqueda.trim(), turno: rutinasTurno });
      setRutinasAdmin(res.rutinas);
      setRutinasPaginacion(res.pagination);
    } catch (e) {
      console.error('Error fetching routines:', e);
      toast.error(t('dev_routines_error'));
    } finally {
      setCargandoRutinas(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'routines_table') fetchRutinas(rutinasPagina);
  }, [activeTab, rutinasPagina, rutinasTurno]);

  const nombreTurno = (turno) => (
    turno === 'MANANA' ? t('tab_morning') : turno === 'TARDE' ? t('tab_afternoon') : turno === 'NOCHE' ? t('tab_night') : turno || '—'
  );

  const fetchUsers = async (page = 1, currentLimit = pageSize) => {
    setLoading(true);
    try {
      const res = await adminService.listarUsuarios({
        page,
        limit: currentLimit,
        search,
        role: selectedRole,
      });
      setUsers(res.users);
      setPagination(res.pagination);
      setJumpPageInput(String(page));
    } catch (e) {
      console.error('Error fetching users:', e);
      toast.error(t('dev_users_load_error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(1, pageSize);
  }, [selectedRole, pageSize]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchUsers(1);
  };

  const handleInspectUserRoutines = async (user) => {
    setSelectedUserForRoutines(user);
    setLoadingRoutines(true);
    try {
      const data = await adminService.obtenerRutinasUsuario(user.id);
      setUserRoutines(data.rutinas || []);
    } catch (e) {
      setUserRoutines([]);
    } finally {
      setLoadingRoutines(false);
    }
  };

  // Crear usuario (Poder Developer)
  const handleCreateUserSubmit = async (e) => {
    e.preventDefault();
    if (!createUserData.nombre || !createUserData.email || !createUserData.password) {
      toast.error(t('dev_required_fields'));
      return;
    }
    setCreatingUser(true);
    try {
      await adminService.crearUsuario(createUserData);
      toast.success(t('dev_user_created', { email: createUserData.email }));
      setCreateUserModalOpen(false);
      setCreateUserData({ nombre: '', email: '', password: '', rol: 'tutor', organizacionId: '' });
      fetchUsers(pagination.page);
    } catch (err) {
      toast.error(err.message || t('dev_user_create_error'));
    } finally {
      setCreatingUser(false);
    }
  };

  // Editar usuario (Poder Developer)
  const handleOpenEditUser = (user) => {
    setEditUserData({
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      organizacionId: user.organizacionId || '',
      organizacionNombreOriginal: user.organizacionNombre || '',
      organizacionNombre: user.organizacionNombre || '',
      activo: user.activo === 1,
      password: '',
    });
    setEditUserModalOpen(true);
  };

  const handleEditUserSubmit = async (e) => {
    e.preventDefault();
    setEditingUser(true);
    try {
      const { organizacionNombre, organizacionNombreOriginal, ...datosUsuario } = editUserData;
      await adminService.editarUsuario(editUserData.id, datosUsuario);
      // El nombre de la organización solo se cambia si la organización no cambió y el nombre sí
      const nombreNuevo = organizacionNombre.trim();
      const mismaOrganizacion = datosUsuario.organizacionId.trim() === (users.find((u) => u.id === editUserData.id)?.organizacionId || '');
      if (mismaOrganizacion && datosUsuario.organizacionId.trim() && nombreNuevo && nombreNuevo !== organizacionNombreOriginal) {
        await adminService.cambiarNombreOrganizacion(datosUsuario.organizacionId.trim(), nombreNuevo);
      }
      toast.success(t('dev_user_updated', { email: editUserData.email }));
      setEditUserModalOpen(false);
      fetchUsers(pagination.page);
    } catch (err) {
      toast.error(err.message || t('dev_user_update_error'));
    } finally {
      setEditingUser(false);
    }
  };

  // Eliminar usuario con poder absoluto
  const handleDeleteUser = async (user) => {
    const confirmMsg = t('dev_user_delete_confirm', { nombre: user.nombre, email: user.email });
    if (!window.confirm(confirmMsg)) return;

    try {
      await adminService.eliminarUsuario(user.id);
      toast.success(t('dev_user_deleted', { email: user.email }));
      fetchUsers(pagination.page);
    } catch (err) {
      toast.error(err.message || t('dev_user_delete_error'));
    }
  };

  // Ejecutar SQL Directo en Consola
  const handleExecuteSql = async () => {
    if (!sqlQuery.trim()) return;
    setSqlExecuting(true);
    setSqlError(null);
    setSqlResult(null);
    try {
      const res = await adminService.ejecutarSql(sqlQuery);
      setSqlResult(res);
      toast.success(t('sql_success'));
    } catch (err) {
      setSqlError(err.message || t('sql_error'));
    } finally {
      setSqlExecuting(false);
    }
  };

  const getRoleBadge = (rol) => {
    switch (rol) {
      case 'developer':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200">
            <Server className="w-3 h-3" />
            {t('role_developer')}
          </span>
        );
      case 'empresario':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200">
            <Building className="w-3 h-3" />
            {t('dev_role_empresario')}
          </span>
        );
      case 'tutor':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
            <ShieldCheck className="w-3 h-3" />
            {t('dev_role_tutor')}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-tea-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-100 text-purple-700">
              <Server className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-extrabold text-tea-text tracking-tight flex items-center gap-2">
              {t('nav_developer_center')}
            </h1>
          </div>
          <p className="text-sm text-tea-muted mt-1">
            {t('dev_center_subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCreateUserModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition-tea shadow-sm cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('dev_create_user')}</span>
          </button>
        </div>
      </div>

      {/* Pestañas de Vista para el Desarrollador */}
      <div className="flex items-center gap-2 border-b border-tea-border">
        <button
          type="button"
          onClick={() => setActiveTab('users_table')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors ${
            activeTab === 'users_table'
              ? 'bg-white border-t border-x border-tea-border text-purple-700 -mb-px'
              : 'text-tea-muted hover:text-tea-text'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{t('dev_tab_accounts')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('routines_table')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors ${
            activeTab === 'routines_table'
              ? 'bg-white border-t border-x border-tea-border text-purple-700 -mb-px'
              : 'text-tea-muted hover:text-tea-text'
          }`}
        >
          <CalendarCheck className="w-4 h-4" />
          <span>{t('dev_tab_routines')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sql_console')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors ${
            activeTab === 'sql_console'
              ? 'bg-white border-t border-x border-tea-border text-purple-700 -mb-px'
              : 'text-tea-muted hover:text-tea-text'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>{t('dev_tab_sql')}</span>
        </button>
      </div>

      {/* PESTAÑA 1: TABLA DE USUARIOS Y GESTIÓN CRUD */}
      {activeTab === 'users_table' && (
        <div className="space-y-6">
          {/* Tarjeta de métricas de auditoría */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-tea-border shadow-soft-xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-tea-subtle uppercase tracking-wider block">
                  {t('dev_users_total')}
                </span>
                <p className="text-xl font-black text-tea-text">
                  {pagination.total.toLocaleString(locale)} {t('dev_users_plural')}
                </p>
              </div>
            </div>
          </div>

          {/* Barra de Filtros y Búsqueda */}
          <div className="bg-white rounded-2xl p-4 border border-tea-border shadow-soft-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <form onSubmit={handleSearchSubmit} className="flex-1 w-full flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-tea-subtle absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('dev_users_search')}
                  aria-label={t('dev_users_search')}
                  className="w-full text-xs bg-slate-50 border border-tea-border rounded-xl pl-9 pr-3 py-2 text-tea-text focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition-colors cursor-pointer"
              >
                {t('dev_routines_search_btn')}
              </button>
            </form>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-tea-subtle" />
              <select
                value={selectedRole}
                aria-label={t('dev_filter_role')}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="text-xs font-medium bg-slate-50 border border-tea-border rounded-xl px-3 py-2 text-tea-text focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">{t('dev_all_roles')}</option>
                <option value="developer">{t('role_developer')}</option>
                <option value="empresario">{t('dev_role_empresario')}</option>
                <option value="tutor">{t('role_tutor')}</option>
              </select>
            </div>
          </div>

          {/* Tabla de Usuarios */}
          <div className="bg-white rounded-3xl border border-tea-border shadow-soft-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-tea-border text-tea-subtle font-extrabold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">{t('dev_col_user')}</th>
                    <th className="py-3.5 px-4">{t('dev_col_role')}</th>
                    <th className="py-3.5 px-4">{t('dev_routines_col_org')}</th>
                    <th className="py-3.5 px-4 text-center">{t('dev_tab_routines')}</th>
                    <th className="py-3.5 px-4">{t('dev_col_registered')}</th>
                    <th className="py-3.5 px-4 text-right">{t('dev_col_actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-tea-border text-tea-text">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-tea-muted">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-600 mb-2" />
                        <span>{t('dev_users_loading')}</span>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-tea-muted">
                        {t('dev_users_empty')}
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="hover:bg-purple-50/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="font-extrabold text-tea-text">{u.nombre}</span>
                            <span className="text-[11px] font-mono text-tea-muted">{u.email}</span>
                            <span className="text-[9px] font-mono text-slate-400">ID: {u.id}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">{getRoleBadge(u.rol)}</td>
                        <td className="py-3.5 px-4">
                          {u.organizacionId ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-[12px] text-tea-text">{u.organizacionNombre || u.organizacionId}</span>
                              <span className="font-mono text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded w-fit">
                                {u.organizacionId}
                              </span>
                            </div>
                          ) : (
                            <span className="text-tea-subtle italic text-[11px]">{t('dev_org_none')}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                            <CalendarCheck className="w-3.5 h-3.5 text-purple-600" />
                            {u.rutinasCount}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-tea-muted text-[11px]">
                          {u.creadoEn ? new Date(u.creadoEn).toLocaleDateString(locale) : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleInspectUserRoutines(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs transition-colors cursor-pointer"
                              title={t('dev_view_user_routines')}
                            >
                              <Eye className="w-3 h-3" />
                              <span>{t('dev_tab_routines')}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditUser(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs transition-colors cursor-pointer"
                              title={t('dev_edit_user')}
                            >
                              <Edit className="w-3 h-3" />
                              <span>{t('btn_edit')}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors cursor-pointer"
                              title={t('dev_delete_user')}
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>{t('btn_delete')}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación de usuarios: componente común + tamaño de página e «Ir a» */}
            <div className="px-4 pb-4 pt-3 border-t border-tea-border space-y-1">
              <div className="flex flex-wrap items-center justify-end gap-4 text-xs text-tea-muted">
                <label className="flex items-center gap-1.5">
                  <span className="text-[11px]">{t('pagination_per_page')}</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      const newSize = Number(e.target.value);
                      setPageSize(newSize);
                      fetchUsers(1, newSize);
                    }}
                    className="text-xs font-bold bg-slate-50 border border-tea-border rounded-lg px-2 py-1 text-tea-text"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </label>

                {pagination.totalPages > 1 && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const target = parseInt(jumpPageInput, 10);
                      if (target >= 1 && target <= pagination.totalPages) {
                        fetchUsers(target);
                      }
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <span className="text-[11px]">{t('pagination_go_to')}</span>
                    <input
                      type="number"
                      min={1}
                      max={pagination.totalPages}
                      value={jumpPageInput}
                      onChange={(e) => setJumpPageInput(e.target.value)}
                      aria-label={t('pagination_go_to')}
                      className="w-14 text-xs font-bold text-center bg-slate-50 border border-tea-border rounded-lg py-1 px-1 text-tea-text"
                    />
                    <button
                      type="submit"
                      className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-tea-text text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      {t('pagination_go')}
                    </button>
                  </form>
                )}
              </div>

              <Paginacion
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                onChange={(p) => fetchUsers(p)}
                disabled={loading}
                etiquetaTotal={t('dev_users_plural')}
              />
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: TODAS LAS RUTINAS (de la más reciente a la más antigua) */}
      {activeTab === 'routines_table' && (
        <div className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (rutinasPagina === 1) fetchRutinas(1);
              else setRutinasPagina(1);
            }}
            className="bg-white rounded-2xl p-4 border border-tea-border shadow-soft-xs flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-tea-subtle absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={rutinasBusqueda}
                onChange={(e) => setRutinasBusqueda(e.target.value)}
                placeholder={t('dev_routines_search')}
                aria-label={t('dev_routines_search')}
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs border border-tea-border focus:ring-2 focus:ring-purple-600 focus:outline-none"
              />
            </div>
            <select
              value={rutinasTurno}
              onChange={(e) => {
                setRutinasTurno(e.target.value);
                setRutinasPagina(1);
              }}
              aria-label={t('dev_routines_filter_shift')}
              className="px-3 py-2 rounded-xl text-xs font-semibold border border-tea-border bg-white focus:ring-2 focus:ring-purple-600 focus:outline-none cursor-pointer"
            >
              <option value="">{t('dev_routines_all_shifts')}</option>
              {TURNOS.map((turno) => (
                <option key={turno} value={turno}>{nombreTurno(turno)}</option>
              ))}
            </select>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition-tea cursor-pointer"
            >
              {t('dev_routines_search_btn')}
            </button>
          </form>

          <div className="bg-white rounded-2xl border border-tea-border shadow-soft-xs overflow-hidden">
            <p className="px-4 py-3 border-b border-tea-border text-[11px] text-tea-muted">{t('dev_routines_order_hint')}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold text-tea-subtle uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">{t('dev_routines_col_title')}</th>
                    <th className="px-4 py-3">{t('dev_routines_col_shift')}</th>
                    <th className="px-4 py-3">{t('dev_routines_col_creator')}</th>
                    <th className="px-4 py-3">{t('dev_routines_col_org')}</th>
                    <th className="px-4 py-3 text-center">{t('dev_routines_col_steps')}</th>
                    <th className="px-4 py-3">{t('dev_routines_col_created')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-tea-border">
                  {cargandoRutinas ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-tea-muted">
                        <RefreshCw className="w-5 h-5 animate-spin inline-block" />
                      </td>
                    </tr>
                  ) : rutinasAdmin.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-tea-muted">
                        {t('dev_routines_empty')}
                      </td>
                    </tr>
                  ) : (
                    rutinasAdmin.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-bold text-tea-text">{r.titulo}</td>
                        <td className="px-4 py-3">{nombreTurno(r.turno)}</td>
                        <td className="px-4 py-3">
                          <span className="block font-semibold text-tea-text">{r.creadorNombre || '—'}</span>
                          <span className="block text-[11px] text-tea-muted">{r.creadorEmail || r.creadoPor}</span>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-tea-muted">{r.organizacionNombre || r.organizacionId || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {(r.pasos || []).slice(0, PICTOGRAMAS_EN_TABLA).map((paso, i) => (
                              <ArasaacPictogram
                                key={`${r.id}-${i}`}
                                keyword={paso.palabraClave || paso.texto}
                                alt={paso.texto || ''}
                                size="xs"
                              />
                            ))}
                            <span className="ml-1 font-bold">
                              {r.pasosCount > PICTOGRAMAS_EN_TABLA ? `+${r.pasosCount - PICTOGRAMAS_EN_TABLA}` : r.pasosCount}
                            </span>
                            {r.duracionTotalMinutos > 0 && (
                              <span className="ml-1 text-[11px] text-tea-muted whitespace-nowrap">
                                · {t('routine_duration_minutes', { minutos: r.duracionTotalMinutos })}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-tea-muted whitespace-nowrap">
                          {r.creadoEn ? new Date(r.creadoEn).toLocaleString(locale) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-4">
              <Paginacion
                page={rutinasPaginacion.page}
                totalPages={rutinasPaginacion.totalPages}
                total={rutinasPaginacion.total}
                onChange={setRutinasPagina}
                disabled={cargandoRutinas}
                etiquetaTotal={t('routine_plural')}
              />
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 3: CONSOLA SQL DIRECTA */}
      {activeTab === 'sql_console' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-tea-border shadow-soft-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-tea-text flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-purple-600" />
                  {t('dev_sql_title')}
                </h3>
                <p className="text-xs text-tea-muted mt-0.5">
                  {t('dev_sql_desc')}
                </p>
              </div>

              {/* Botones de plantillas rápidas */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSqlQuery('SELECT * FROM usuarios LIMIT 10;')}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-mono font-bold"
                >
                  SELECT usuarios
                </button>
                <button
                  type="button"
                  onClick={() => setSqlQuery('SELECT * FROM rutinas LIMIT 10;')}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-mono font-bold"
                >
                  SELECT rutinas
                </button>
                <button
                  type="button"
                  onClick={() => setSqlQuery('SELECT * FROM child_devices LIMIT 10;')}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-mono font-bold"
                >
                  SELECT devices
                </button>
              </div>
            </div>

            <div className="relative">
              <textarea
                rows={4}
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                placeholder={t('dev_sql_placeholder')}
                aria-label={t('dev_sql_placeholder')}
                className="w-full p-4 rounded-2xl bg-slate-900 text-emerald-400 font-mono text-xs border border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-mono">
                {t('sql_engine')}
              </span>
              <button
                type="button"
                onClick={handleExecuteSql}
                disabled={sqlExecuting || !sqlQuery.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 ${sqlExecuting ? 'animate-spin' : ''}`} />
                <span>{sqlExecuting ? t('dev_sql_running') : t('dev_sql_run')}</span>
              </button>
            </div>

            {sqlError && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2 font-mono">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{sqlError}</span>
              </div>
            )}

            {sqlResult && (
              <div className="p-4 rounded-2xl bg-slate-900 text-slate-200 font-mono text-xs overflow-x-auto max-h-96">
                <div className="pb-2 border-b border-slate-700 mb-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{t('dev_sql_result', { tipo: sqlResult.type, total: sqlResult.rowCount ?? sqlResult.changes ?? 0 })}</span>
                                  </div>
                <pre className="text-emerald-300 overflow-x-auto text-[11px]">
                  {JSON.stringify(sqlResult.data || sqlResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL CREAR USUARIO (PODER ABSOLUTO) */}
      {createUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-tea-border relative animate-scaleIn">
            <button
              type="button"
              onClick={() => setCreateUserModalOpen(false)}
              aria-label={t('btn_close')}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-tea-text">{t('dev_create_title')}</h3>
                <p className="text-xs text-tea-muted">{t('dev_create_desc')}</p>
              </div>
            </div>

            <form onSubmit={handleCreateUserSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('dev_field_name')}</label>
                <input
                  type="text"
                  required
                  value={createUserData.nombre}
                  onChange={(e) => setCreateUserData({ ...createUserData, nombre: e.target.value })}
                  placeholder={t('dev_field_name_placeholder')}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('dev_field_email')}</label>
                <input
                  type="email"
                  required
                  value={createUserData.email}
                  onChange={(e) => setCreateUserData({ ...createUserData, email: e.target.value })}
                  placeholder={t('dev_field_email_placeholder')}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('dev_field_password')}</label>
                <input
                  type="password"
                  required
                  value={createUserData.password}
                  onChange={(e) => setCreateUserData({ ...createUserData, password: e.target.value })}
                  placeholder={t('dev_field_password_placeholder')}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t('dev_col_role')}</label>
                  <select
                    value={createUserData.rol}
                    onChange={(e) => setCreateUserData({ ...createUserData, rol: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none bg-slate-50"
                  >
                    <option value="tutor">{t('dev_role_tutor')}</option>
                    <option value="empresario">{t('dev_role_empresario')}</option>
                    <option value="developer">{t('role_developer')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t('dev_field_org_optional')}</label>
                  <input
                    type="text"
                    value={createUserData.organizacionId}
                    onChange={(e) => setCreateUserData({ ...createUserData, organizacionId: e.target.value })}
                    placeholder={t('dev_field_org_placeholder')}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  {t('btn_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm disabled:opacity-50"
                >
                  {creatingUser ? t('dev_saving') : t('dev_create_submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR USUARIO (PODER ABSOLUTO) */}
      {editUserModalOpen && editUserData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-tea-border relative animate-scaleIn">
            <button
              type="button"
              onClick={() => setEditUserModalOpen(false)}
              aria-label={t('btn_close')}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Edit className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-tea-text">{t('dev_edit_title')}</h3>
                <p className="text-xs text-tea-muted font-mono">{editUserData.id}</p>
              </div>
            </div>

            <form onSubmit={handleEditUserSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('dev_field_name')}</label>
                <input
                  type="text"
                  required
                  value={editUserData.nombre}
                  onChange={(e) => setEditUserData({ ...editUserData, nombre: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('dev_field_email')}</label>
                <input
                  type="email"
                  required
                  value={editUserData.email}
                  onChange={(e) => setEditUserData({ ...editUserData, email: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('dev_field_reset_password')}</label>
                <input
                  type="password"
                  value={editUserData.password}
                  onChange={(e) => setEditUserData({ ...editUserData, password: e.target.value })}
                  placeholder={t('dev_field_reset_password_placeholder')}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t('dev_col_role')}</label>
                  <select
                    value={editUserData.rol}
                    onChange={(e) => setEditUserData({ ...editUserData, rol: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none bg-slate-50"
                  >
                    <option value="tutor">{t('dev_role_tutor')}</option>
                    <option value="empresario">{t('dev_role_empresario')}</option>
                    <option value="developer">{t('role_developer')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t('dev_routines_col_org')}</label>
                  <input
                    type="text"
                    value={editUserData.organizacionId}
                    onChange={(e) => setEditUserData({ ...editUserData, organizacionId: e.target.value })}
                    placeholder={t('dev_field_org_placeholder')}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              {editUserData.organizacionNombreOriginal && (
                <div>
                  <label htmlFor="edit-org-nombre" className="block text-xs font-bold text-slate-700 mb-1">{t('dev_field_org_name')}</label>
                  <input
                    id="edit-org-nombre"
                    type="text"
                    value={editUserData.organizacionNombre}
                    maxLength={100}
                    onChange={(e) => setEditUserData({ ...editUserData, organizacionNombre: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-tea-muted mt-1">{t('dev_field_org_name_hint')}</p>
                </div>
              )}

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editUserData.activo}
                    onChange={(e) => setEditUserData({ ...editUserData, activo: e.target.checked })}
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-xs font-bold text-slate-700">{t('dev_field_active')}</span>
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  {t('btn_cancel')}
                </button>
                <button
                  type="submit"
                  disabled={editingUser}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm disabled:opacity-50"
                >
                  {editingUser ? t('dev_saving') : t('dev_edit_submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VER RUTINAS DEL USUARIO SELECCIONADO */}
      {selectedUserForRoutines && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-tea-border relative animate-scaleIn max-h-[85vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setSelectedUserForRoutines(null)}
              aria-label={t('btn_close')}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-tea-border">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-tea-text">
                  {t('dev_user_routines_title', { nombre: selectedUserForRoutines.nombre })}
                </h3>
                <p className="text-xs text-tea-muted font-mono">{selectedUserForRoutines.email}</p>
              </div>
            </div>

            {loadingRoutines ? (
              <div className="py-12 text-center text-tea-muted">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-600 mb-2" />
                <span>{t('dev_user_routines_loading')}</span>
              </div>
            ) : userRoutines.length === 0 ? (
              <div className="py-10 text-center text-tea-muted">
                {t('dev_user_routines_empty')}
              </div>
            ) : (
              <div className="space-y-5">
                {[...TURNOS, 'OTRO'].map((turno) => {
                  const delTurno = userRoutines.filter((r) => (TURNOS.includes(r.turno) ? r.turno : 'OTRO') === turno);
                  if (delTurno.length === 0) return null;
                  return (
                    <section key={turno} aria-label={turno === 'OTRO' ? t('dev_user_routines_other_shift') : nombreTurno(turno)}>
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-800 mb-2">
                        {turno === 'OTRO' ? t('dev_user_routines_other_shift') : nombreTurno(turno)} ({delTurno.length})
                      </h4>
                      <div className="space-y-3">
                        {delTurno.map((r) => {
                          const pasos = Array.isArray(r.pasos) ? r.pasos : [];
                          return (
                            <div key={r.id} className="p-4 rounded-2xl bg-slate-50 border border-tea-border">
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <CalendarCheck className="w-4 h-4 text-purple-600 flex-shrink-0" />
                                  <h5 className="text-sm font-bold text-tea-text truncate">{r.titulo}</h5>
                                </div>
                                <span className="text-[11px] text-slate-400 whitespace-nowrap">
                                  {r.creadoEn ? new Date(r.creadoEn).toLocaleDateString(locale) : '—'}
                                </span>
                              </div>
                              {pasos.length === 0 ? (
                                <p className="text-[11px] text-tea-muted">{t('dev_user_routine_steps', { total: 0 })}</p>
                              ) : (
                                <ol className="flex flex-wrap gap-2">
                                  {pasos.map((paso, i) => (
                                    <li key={`${r.id}-${i}`} className="flex flex-col items-center w-20 p-2 rounded-xl bg-white border border-slate-200">
                                      <ArasaacPictogram keyword={paso.palabraClave || paso.texto} alt={paso.texto || ''} size="sm" />
                                      <span className="mt-1 text-[10px] text-center text-tea-text leading-tight line-clamp-2">
                                        {paso.orden || i + 1}. {paso.texto}
                                      </span>
                                      {Number(paso.duracionMinutos) > 0 && (
                                        <span className="text-[10px] text-tea-muted">
                                          {t('routine_duration_minutes', { minutos: Number(paso.duracionMinutos) })}
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ol>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

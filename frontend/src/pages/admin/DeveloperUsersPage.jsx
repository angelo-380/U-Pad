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
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  Sparkles,
  Database,
  Building,
  UserPlus,
  Edit,
  Trash2,
  Terminal,
  Play,
  CheckCircle2,
  AlertTriangle,
  KeyRound,
  FileCode,
} from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { ArasaacPictogram } from '../../components/common/ArasaacPictogram.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export const DeveloperUsersPage = () => {
  const { t } = useLanguage();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('users_table'); // 'users_table' | 'sql_console'
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
      toast.error('Error al consultar usuarios desde la base de datos');
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
      toast.error('Por favor completa todos los campos requeridos.');
      return;
    }
    setCreatingUser(true);
    try {
      await adminService.crearUsuario(createUserData);
      toast.success(`Usuario ${createUserData.email} creado con éxito en la base de datos.`);
      setCreateUserModalOpen(false);
      setCreateUserData({ nombre: '', email: '', password: '', rol: 'tutor', organizacionId: '' });
      fetchUsers(pagination.page);
    } catch (err) {
      toast.error(err.message || 'Error creando usuario');
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
      activo: user.activo === 1,
      password: '',
    });
    setEditUserModalOpen(true);
  };

  const handleEditUserSubmit = async (e) => {
    e.preventDefault();
    setEditingUser(true);
    try {
      await adminService.editarUsuario(editUserData.id, editUserData);
      toast.success(`Usuario ${editUserData.email} actualizado exitosamente.`);
      setEditUserModalOpen(false);
      fetchUsers(pagination.page);
    } catch (err) {
      toast.error(err.message || 'Error actualizando usuario');
    } finally {
      setEditingUser(false);
    }
  };

  // Eliminar usuario con poder absoluto
  const handleDeleteUser = async (user) => {
    const confirmMsg = `¿ESTÁS ABSOLUTAMENTE SEGURO de eliminar a:\n\n${user.nombre} (${user.email})?\n\nEsta acción ejecutará un DELETE definitivo en la base de datos de Google Cloud purgando en cascada todas sus rutinas, dispositivos vinculados y tokens.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await adminService.eliminarUsuario(user.id);
      toast.success(`Usuario ${user.email} eliminado definitivamente del sistema.`);
      fetchUsers(pagination.page);
    } catch (err) {
      toast.error(err.message || 'No se pudo eliminar el usuario.');
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
      toast.success('Consulta ejecutada con éxito en Google Cloud Engine.');
    } catch (err) {
      setSqlError(err.message || 'Error de sintaxis o violación de integridad SQL.');
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
            Developer
          </span>
        );
      case 'empresario':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200">
            <Building className="w-3 h-3" />
            Empresario / Colegio
          </span>
        );
      case 'tutor':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
            <ShieldCheck className="w-3 h-3" />
            Tutor
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
              Developer Center
              <span className="text-[10px] font-mono font-bold bg-purple-700 text-white px-2 py-0.5 rounded uppercase">
                Root Access
              </span>
            </h1>
          </div>
          <p className="text-sm text-tea-muted mt-1">
            Supervisión integral de usuarios, ejecución directa SQL, edición de registros y auditoría de rutinas en Google Cloud.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCreateUserModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition-tea shadow-sm cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Crear Usuario</span>
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
          <span>Gestión de Cuentas</span>
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
          <span>Consola SQL Directa</span>
        </button>
      </div>

      {/* PESTAÑA 1: TABLA DE USUARIOS Y GESTIÓN CRUD */}
      {activeTab === 'users_table' && (
        <div className="space-y-6">
          {/* Tarjetas de Métricas de Auditoría */}
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-tea-border shadow-soft-xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-tea-subtle uppercase tracking-wider block">
                  Total de Usuarios Registrados
                </span>
                <p className="text-xl font-black text-tea-text">
                  {pagination.total.toLocaleString()} usuarios
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
                  placeholder="Buscar por email, nombre o ID de usuario..."
                  className="w-full text-xs bg-slate-50 border border-tea-border rounded-xl pl-9 pr-3 py-2 text-tea-text focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition-colors cursor-pointer"
              >
                Buscar
              </button>
            </form>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-tea-subtle" />
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="text-xs font-medium bg-slate-50 border border-tea-border rounded-xl px-3 py-2 text-tea-text focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Todos los Roles</option>
                <option value="developer">Developer</option>
                <option value="empresario">Empresario / Colegio</option>
                <option value="tutor">Tutor / Familiar</option>
              </select>
            </div>
          </div>

          {/* Tabla de Usuarios */}
          <div className="bg-white rounded-3xl border border-tea-border shadow-soft-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-tea-border text-tea-subtle font-extrabold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Usuario</th>
                    <th className="py-3.5 px-4">Rol</th>
                    <th className="py-3.5 px-4">Organización</th>
                    <th className="py-3.5 px-4 text-center">Rutinas</th>
                    <th className="py-3.5 px-4">Registrado</th>
                    <th className="py-3.5 px-4 text-right">Acciones de Desarrollador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-tea-border text-tea-text">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-tea-muted">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-600 mb-2" />
                        <span>Consultando base de datos en Google Cloud...</span>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-tea-muted">
                        No se encontraron usuarios con los criterios seleccionados.
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
                            <span className="font-mono text-[11px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                              {u.organizacionId}
                            </span>
                          ) : (
                            <span className="text-tea-subtle italic text-[11px]">- Ninguna -</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                            <CalendarCheck className="w-3.5 h-3.5 text-purple-600" />
                            {u.rutinasCount}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-tea-muted text-[11px]">
                          {u.creadoEn ? new Date(u.creadoEn).toLocaleDateString() : 'Reciente'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleInspectUserRoutines(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs transition-colors cursor-pointer"
                              title="Ver rutinas del usuario"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Rutinas</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditUser(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs transition-colors cursor-pointer"
                              title="Editar usuario"
                            >
                              <Edit className="w-3 h-3" />
                              <span>Editar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors cursor-pointer"
                              title="Eliminar usuario definitivamente"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Eliminar</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación Profesional Avanzada */}
            <div className="p-4 border-t border-tea-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-tea-muted">
              <div className="flex items-center gap-3">
                <span>
                  Página <strong className="text-tea-text">{pagination.page}</strong> de{' '}
                  <strong className="text-tea-text">{pagination.totalPages}</strong> (
                  <strong className="text-purple-700">{pagination.total.toLocaleString()}</strong> usuarios totales)
                </span>

                <div className="flex items-center gap-1.5 pl-3 border-l border-tea-border">
                  <span className="text-[11px]">Por página:</span>
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
                </div>
              </div>

              <div className="flex items-center gap-2">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const target = parseInt(jumpPageInput, 10);
                    if (target >= 1 && target <= pagination.totalPages) {
                      fetchUsers(target);
                    }
                  }}
                  className="flex items-center gap-1.5 pr-2"
                >
                  <span className="text-[11px]">Ir a:</span>
                  <input
                    type="number"
                    min={1}
                    max={pagination.totalPages}
                    value={jumpPageInput}
                    onChange={(e) => setJumpPageInput(e.target.value)}
                    className="w-14 text-xs font-bold text-center bg-slate-50 border border-tea-border rounded-lg py-1 px-1 text-tea-text"
                  />
                  <button
                    type="submit"
                    className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-tea-text text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    Ir
                  </button>
                </form>

                <button
                  type="button"
                  onClick={() => fetchUsers(1)}
                  disabled={pagination.page === 1 || loading}
                  className="p-1.5 rounded-lg border border-tea-border hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none"
                  title="Primera página"
                >
                  «
                </button>
                <button
                  type="button"
                  onClick={() => fetchUsers(pagination.page - 1)}
                  disabled={pagination.page <= 1 || loading}
                  className="p-1.5 rounded-lg border border-tea-border hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none"
                  title="Página anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => fetchUsers(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages || loading}
                  className="p-1.5 rounded-lg border border-tea-border hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none"
                  title="Página siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => fetchUsers(pagination.totalPages)}
                  disabled={pagination.page === pagination.totalPages || loading}
                  className="p-1.5 rounded-lg border border-tea-border hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none"
                  title="Última página"
                >
                  »
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: CONSOLA SQL DIRECTA */}
      {activeTab === 'sql_console' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-tea-border shadow-soft-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-tea-text flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-purple-600" />
                  Terminal SQL Directo U-Pad
                </h3>
                <p className="text-xs text-tea-muted mt-0.5">
                  Ejecuta consultas SQL directas sobre la base de datos de Google Cloud en producción.
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
                placeholder="Escribe tu consulta SQL aquí (ej. SELECT * FROM usuarios;)..."
                className="w-full p-4 rounded-2xl bg-slate-900 text-emerald-400 font-mono text-xs border border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-mono">
                Motor: SQLite3 WAL con Google Cloud KMS Encryption
              </span>
              <button
                type="button"
                onClick={handleExecuteSql}
                disabled={sqlExecuting || !sqlQuery.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 ${sqlExecuting ? 'animate-spin' : ''}`} />
                <span>{sqlExecuting ? 'Ejecutando...' : 'Ejecutar Consulta'}</span>
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
                  <span>Resultado: {sqlResult.type} ({sqlResult.rowCount ?? sqlResult.changes ?? 0} registros)</span>
                  <span>Status: 200 OK</span>
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
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-tea-text">Crear Nuevo Usuario</h3>
                <p className="text-xs text-tea-muted">Inserción directa en base de datos Google Cloud</p>
              </div>
            </div>

            <form onSubmit={handleCreateUserSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={createUserData.nombre}
                  onChange={(e) => setCreateUserData({ ...createUserData, nombre: e.target.value })}
                  placeholder="Ej. Juan Pérez"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={createUserData.email}
                  onChange={(e) => setCreateUserData({ ...createUserData, email: e.target.value })}
                  placeholder="usuario@dominio.com"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Contraseña</label>
                <input
                  type="password"
                  required
                  value={createUserData.password}
                  onChange={(e) => setCreateUserData({ ...createUserData, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Rol</label>
                  <select
                    value={createUserData.rol}
                    onChange={(e) => setCreateUserData({ ...createUserData, rol: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none bg-slate-50"
                  >
                    <option value="tutor">Tutor</option>
                    <option value="empresario">Empresario / Colegio</option>
                    <option value="developer">Developer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Organización (Opcional)</label>
                  <input
                    type="text"
                    value={createUserData.organizacionId}
                    onChange={(e) => setCreateUserData({ ...createUserData, organizacionId: e.target.value })}
                    placeholder="Id de una organización existente (org_…)"
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
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm disabled:opacity-50"
                >
                  {creatingUser ? 'Guardando en BD...' : 'Crear Usuario'}
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
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Edit className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-tea-text">Editar Usuario en BD</h3>
                <p className="text-xs text-tea-muted font-mono">{editUserData.id}</p>
              </div>
            </div>

            <form onSubmit={handleEditUserSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre</label>
                <input
                  type="text"
                  required
                  value={editUserData.nombre}
                  onChange={(e) => setEditUserData({ ...editUserData, nombre: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={editUserData.email}
                  onChange={(e) => setEditUserData({ ...editUserData, email: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Resetear Contraseña (Opcional)</label>
                <input
                  type="password"
                  value={editUserData.password}
                  onChange={(e) => setEditUserData({ ...editUserData, password: e.target.value })}
                  placeholder="Dejar en blanco para mantener la actual"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Rol</label>
                  <select
                    value={editUserData.rol}
                    onChange={(e) => setEditUserData({ ...editUserData, rol: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none bg-slate-50"
                  >
                    <option value="tutor">Tutor</option>
                    <option value="empresario">Empresario / Colegio</option>
                    <option value="developer">Developer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Organización</label>
                  <input
                    type="text"
                    value={editUserData.organizacionId}
                    onChange={(e) => setEditUserData({ ...editUserData, organizacionId: e.target.value })}
                    placeholder="Id de una organización existente (org_…)"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editUserData.activo}
                    onChange={(e) => setEditUserData({ ...editUserData, activo: e.target.checked })}
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-xs font-bold text-slate-700">Cuenta activa</span>
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editingUser}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm disabled:opacity-50"
                >
                  {editingUser ? 'Guardando...' : 'Actualizar Usuario'}
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
                  Rutinas de {selectedUserForRoutines.nombre}
                </h3>
                <p className="text-xs text-tea-muted font-mono">{selectedUserForRoutines.email}</p>
              </div>
            </div>

            {loadingRoutines ? (
              <div className="py-12 text-center text-tea-muted">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-600 mb-2" />
                <span>Cargando rutinas del usuario...</span>
              </div>
            ) : userRoutines.length === 0 ? (
              <div className="py-10 text-center text-tea-muted">
                Este usuario aún no tiene rutinas registradas.
              </div>
            ) : (
              <div className="space-y-3">
                {userRoutines.map((r) => (
                  <div key={r.id} className="p-4 rounded-2xl bg-slate-50 border border-tea-border flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                        {r.pictogramaUrl ? (
                          <img src={r.pictogramaUrl} alt={r.nombre} className="w-full h-full object-contain p-1" />
                        ) : (
                          <CalendarCheck className="w-6 h-6 text-purple-600" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-tea-text">{r.nombre}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                            {r.turno || 'General'}
                          </span>
                          <span className="text-[11px] text-tea-muted font-mono">{r.horaInicio || '08:00'}</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">ID: {r.id.substring(0, 8)}...</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

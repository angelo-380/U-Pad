import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  Eye,
  CalendarCheck,
  ShieldAlert,
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
} from 'lucide-react';
import { adminService } from '../../services/adminService.js';
import { ArasaacPictogram } from '../../components/common/ArasaacPictogram.jsx';
import { useLanguage } from '../../context/LanguageContext.jsx';

export const DeveloperUsersPage = () => {
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('');

  // Modal para ver rutinas del usuario seleccionado
  const [selectedUserForRoutines, setSelectedUserForRoutines] = useState(null);
  const [userRoutines, setUserRoutines] = useState([]);
  const [loadingRoutines, setLoadingRoutines] = useState(false);

  const fetchUsers = async (page = 1) => {
    setLoading(true);
    try {
      const res = await adminService.listarUsuarios({
        page,
        limit: 15,
        search,
        role: selectedRole,
      });
      setUsers(res.users);
      setPagination(res.pagination);
    } catch (e) {
      console.error('Error fetching users:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(1);
  }, [selectedRole]);

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

  const getRoleBadge = (rol) => {
    switch (rol) {
      case 'developer':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200">
            <Server className="w-3 h-3" />
            Developer
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
            <ShieldAlert className="w-3 h-3" />
            Admin
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
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-tea-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-100 text-purple-700">
              <Users className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-extrabold text-tea-text tracking-tight">
              Panel Developer: Auditoría Global de Usuarios
            </h1>
          </div>
          <p className="text-sm text-tea-muted mt-1">
            Supervisión técnica de cuentas, aislamiento de rutinas y acceso a datos de la base de datos en Google Cloud.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchUsers(pagination.page)}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-tea-text bg-white border border-tea-border hover:bg-slate-50 transition-tea shadow-sm cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-600' : ''}`} />
          <span>Refrescar Lista</span>
        </button>
      </div>

      {/* Tarjetas de Métricas de Auditoría */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

        <div className="bg-white rounded-2xl p-4 border border-tea-border shadow-soft-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-tea-subtle uppercase tracking-wider block">
              Persistencia Cloud Run
            </span>
            <p className="text-xl font-black text-indigo-700">
              Google Cloud KMS Activo
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-tea-border shadow-soft-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-tea-subtle uppercase tracking-wider block">
              Modo de Aislamiento RBAC
            </span>
            <p className="text-xl font-black text-emerald-700">
              Estricto por Rol & Org
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
              placeholder="Buscar por email o nombre..."
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
            <option value="admin">Administrador</option>
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
                <th className="py-3.5 px-4 text-center">Rutinas Creadas</th>
                <th className="py-3.5 px-4">Registrado</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-tea-border text-tea-text">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-tea-muted">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-600 mb-2" />
                    <span>Cargando usuarios de la base de datos...</span>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-tea-muted">
                    No se encontraron usuarios con los criterios de búsqueda.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-purple-50/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className="font-extrabold text-tea-text">{u.nombre}</span>
                        <span className="text-[11px] font-mono text-tea-muted">{u.email}</span>
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
                      <button
                        type="button"
                        onClick={() => handleInspectUserRoutines(u)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs transition-colors cursor-pointer"
                        title="Ver qué rutinas tiene este usuario"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver Rutinas</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="p-4 border-t border-tea-border flex items-center justify-between text-xs text-tea-muted">
          <span>
            Mostrando página <strong className="text-tea-text">{pagination.page}</strong> de{' '}
            <strong className="text-tea-text">{pagination.totalPages}</strong> ({pagination.total} usuarios)
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchUsers(pagination.page - 1)}
              disabled={!pagination.hasPrev || loading}
              className="p-1.5 rounded-lg border border-tea-border hover:bg-slate-50 transition-colors disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => fetchUsers(pagination.page + 1)}
              disabled={!pagination.hasNext || loading}
              className="p-1.5 rounded-lg border border-tea-border hover:bg-slate-50 transition-colors disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Inspección de Rutinas del Usuario */}
      {selectedUserForRoutines && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 animate-fadeIn">
            <div className="p-5 border-b border-tea-border flex items-center justify-between bg-slate-50/70 rounded-t-3xl">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-tea-text">
                    Rutinas de {selectedUserForRoutines.nombre}
                  </h3>
                  <p className="text-xs font-mono text-tea-muted">
                    {selectedUserForRoutines.email} · Rol: {selectedUserForRoutines.rol}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserForRoutines(null)}
                className="p-2 rounded-xl text-tea-muted hover:text-tea-text hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {loadingRoutines ? (
                <div className="py-12 text-center text-tea-muted">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-600 mb-2" />
                  <span>Cargando rutinas del usuario...</span>
                </div>
              ) : userRoutines.length === 0 ? (
                <div className="py-12 text-center text-tea-muted space-y-2">
                  <CalendarCheck className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="font-bold text-sm text-slate-700">Sin rutinas asociadas</p>
                  <p className="text-xs text-slate-500">Este usuario aún no ha creado ninguna rutina en su cuenta.</p>
                </div>
              ) : (
                userRoutines.map((rutina) => (
                  <div
                    key={rutina.id}
                    className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-brand-50 text-brand-700">
                          {rutina.turno}
                        </span>
                        <h4 className="text-sm font-extrabold text-tea-text">{rutina.titulo}</h4>
                      </div>
                      <span className="text-[10px] text-tea-muted font-mono">
                        ID: {rutina.id}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {rutina.pasos?.map((paso, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200 text-xs"
                        >
                          <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
                            <ArasaacPictogram
                              keyword={paso.palabraClave}
                              text={paso.texto}
                              className="w-6 h-6 object-contain"
                            />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-tea-subtle block">
                              Paso {paso.orden || idx + 1}
                            </span>
                            <p className="font-extrabold text-tea-text truncate text-xs">
                              {paso.texto}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-tea-border bg-slate-50/50 rounded-b-3xl text-right">
              <button
                type="button"
                onClick={() => setSelectedUserForRoutines(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeveloperUsersPage;

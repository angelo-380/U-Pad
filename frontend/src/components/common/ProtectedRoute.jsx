import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Loader2 } from 'lucide-react';

export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-tea-calm p-4">
        <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
          <p className="text-sm font-semibold text-tea-muted">Verificando sesión segura...</p>
        </div>
      </div>
    );
  }

  // Si no está autenticado, redirige al login recordando la ruta de origen
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Si se definieron roles permitidos y el usuario no cuenta con ese rol
  // Nota: El rol 'admin' cuenta con autorización global de acceso a rutas protegidas
  if (allowedRoles && Array.isArray(allowedRoles)) {
    if (user?.rol !== 'admin' && !allowedRoles.includes(user?.rol)) {
      return <Navigate to="/403" replace />;
    }
  }

  return children;
};

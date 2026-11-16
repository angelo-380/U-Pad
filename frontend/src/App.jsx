import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { LanguageProvider } from './context/LanguageContext.jsx';
import { ProtectedRoute } from './components/common/ProtectedRoute.jsx';
import { AppLayout } from './components/layout/AppLayout.jsx';
import { LoginPage } from './pages/auth/LoginPage.jsx';
import { RegisterPage } from './pages/auth/RegisterPage.jsx';
import { RutinasPage } from './pages/rutinas/RutinasPage.jsx';
import { DesempenoPage } from './pages/analytics/DesempenoPage.jsx';
import { GpsPage } from './pages/monitoring/GpsPage.jsx';
import { AiAssistantPage } from './pages/ai/AiAssistantPage.jsx';
import { DeveloperUsersPage } from './pages/admin/DeveloperUsersPage.jsx';
import { GerencialKpiPage } from './pages/admin/GerencialKpiPage.jsx';
import { ForbiddenPage } from './pages/errors/ForbiddenPage.jsx';
import { NotFoundPage } from './pages/errors/NotFoundPage.jsx';
import { ServerErrorPage } from './pages/errors/ServerErrorPage.jsx';
import { useAuth } from './context/AuthContext.jsx';

// Roles con acceso a la app (las rutas por rol se protegen también en el backend, que es la autoridad)
const ROLES_APP = ['tutor', 'empresario', 'developer'];

// Si la API responde 403 por rol (FORBIDDEN_ROLE), se muestra la página 403 en lugar del mensaje del servidor
const RedirigirSiProhibido = () => {
  const navigate = useNavigate();
  React.useEffect(() => {
    const irA403 = () => navigate('/403', { replace: true });
    window.addEventListener('upad:forbidden', irA403);
    return () => window.removeEventListener('upad:forbidden', irA403);
  }, [navigate]);
  return null;
};

const HomeRedirect = () => {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.rol === 'developer') return <Navigate to="/admin/usuarios" replace />;
  if (user?.rol === 'empresario') return <Navigate to="/gerencial" replace />;
  return <Navigate to="/rutinas" replace />;
};

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <ToastProvider>
          <RedirigirSiProhibido />
          <Routes>
            {/* Rutas Públicas de Autenticación */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Rutas Privadas / Protegidas con JWT */}
            <Route
              path="/rutinas"
              element={
                <ProtectedRoute allowedRoles={ROLES_APP}>
                  <AppLayout>
                    <RutinasPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Módulo de Análisis de Desempeño Clínico TEA */}
            <Route
              path="/desempeno"
              element={
                <ProtectedRoute allowedRoles={ROLES_APP}>
                  <AppLayout>
                    <DesempenoPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Secciones funcionales de GPS e IA protegidas dentro del layout */}
            <Route
              path="/gps"
              element={
                <ProtectedRoute allowedRoles={['tutor', 'developer']}>
                  <AppLayout>
                    <GpsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ia"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <AiAssistantPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Vista Especial Developer: Auditoría Global de Usuarios y Rutinas */}
            <Route
              path="/admin/usuarios"
              element={
                <ProtectedRoute allowedRoles={['developer']}>
                  <AppLayout>
                    <DeveloperUsersPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Vista Gerencial Directiva: KPIs agregados sin datos personales */}
            <Route
              path="/gerencial"
              element={
                <ProtectedRoute allowedRoles={['empresario', 'developer']}>
                  <AppLayout>
                    <GerencialKpiPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Páginas de Error y Fallback */}
            <Route path="/403" element={<ForbiddenPage />} />
            <Route path="/404" element={<NotFoundPage />} />
            <Route path="/500" element={<ServerErrorPage />} />

            {/* Redirección inteligente de inicio según rol (Developer -> /admin/usuarios, Empresario -> /gerencial, Tutor -> /rutinas) */}
            <Route path="/" element={<HomeRedirect />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </LanguageProvider>
  </BrowserRouter>
  );
}

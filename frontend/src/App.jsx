import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

const HomeRedirect = () => {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.rol === 'developer' || user?.rol === 'admin') return <Navigate to="/admin/usuarios" replace />;
  if (user?.rol === 'empresario') return <Navigate to="/gerencial" replace />;
  return <Navigate to="/rutinas" replace />;
};

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <ToastProvider>
          <Routes>
            {/* Rutas Públicas de Autenticación */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Rutas Privadas / Protegidas con JWT */}
            <Route
              path="/rutinas"
              element={
                <ProtectedRoute>
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
                <ProtectedRoute>
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
                <ProtectedRoute>
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
                <ProtectedRoute>
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
                <ProtectedRoute>
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

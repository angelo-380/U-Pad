import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { ProtectedRoute } from './components/common/ProtectedRoute.jsx';
import { AppLayout } from './components/layout/AppLayout.jsx';
import { LoginPage } from './pages/auth/LoginPage.jsx';
import { RegisterPage } from './pages/auth/RegisterPage.jsx';
import { RutinasPage } from './pages/rutinas/RutinasPage.jsx';
import { EnDesarrolloPage } from './pages/public/EnDesarrolloPage.jsx';
import { ForbiddenPage } from './pages/errors/ForbiddenPage.jsx';
import { NotFoundPage } from './pages/errors/NotFoundPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
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

            {/* Secciones en Desarrollo (GPS e IA) protegidas dentro del layout */}
            <Route
              path="/gps"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <EnDesarrolloPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/ia"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <EnDesarrolloPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Páginas de Error y Fallback */}
            <Route path="/403" element={<ForbiddenPage />} />
            <Route path="/404" element={<NotFoundPage />} />

            {/* Redirección raíz y rutas inexistentes (404) */}
            <Route path="/" element={<Navigate to="/rutinas" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

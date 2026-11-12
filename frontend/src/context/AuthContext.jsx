import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService.js';
import { api } from '../services/apiClient.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => api.getToken());
  const [loading, setLoading] = useState(true);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false);

  // Inicializar o restaurar sesión activa al cargar la aplicación
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = api.getToken();
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const usuarioActual = await authService.getMe();
        setUser(usuarioActual);
        setToken(storedToken);
      } catch (err) {
        // Token expirado o inválido
        api.setToken(null);
        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Escuchar evento global emitido por apiClient en caso de respuesta 401
    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
      setSessionExpiredNotice(true);
    };

    window.addEventListener('upad:unauthorized', handleUnauthorized);
    window.addEventListener('focus', initAuth);
    return () => {
      window.removeEventListener('upad:unauthorized', handleUnauthorized);
      window.removeEventListener('focus', initAuth);
    };
  }, []);

  const refreshUser = async () => {
    try {
      const storedToken = api.getToken();
      if (!storedToken) return null;
      const usuarioActual = await authService.getMe();
      setUser(usuarioActual);
      return usuarioActual;
    } catch (e) {
      return null;
    }
  };

  const login = async (email, password) => {
    const result = await authService.login({ email, password });
    setUser(result.usuario);
    setToken(result.token);
    setSessionExpiredNotice(false);
    return result;
  };

  const register = async (userData) => {
    const result = await authService.register(userData);
    setUser(result.usuario);
    setToken(result.token);
    setSessionExpiredNotice(false);
    return result;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setToken(null);
  };

  const clearSessionNotice = () => setSessionExpiredNotice(false);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        loading,
        sessionExpiredNotice,
        clearSessionNotice,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};

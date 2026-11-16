import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService.js';
import { api } from '../services/apiClient.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => api.getToken());
  const [loading, setLoading] = useState(true);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false);
  // Registro con Google pendiente de completar: { credential, perfil }. Solo en memoria (no se guarda).
  const [registroGooglePendiente, setRegistroGooglePendiente] = useState(null);

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
    return () => {
      window.removeEventListener('upad:unauthorized', handleUnauthorized);
    };
  }, []);

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

  /**
   * Entrar con Google. Si la cuenta no existe, guarda el registro pendiente y devuelve { requiereRegistro: true }.
   */
  const loginConGoogle = async (credential) => {
    const result = await authService.loginGoogle(credential);
    if (result?.requiereRegistro) {
      setRegistroGooglePendiente({ credential, perfil: result.perfil });
      return result;
    }
    setRegistroGooglePendiente(null);
    setUser(result.usuario);
    setToken(result.token);
    setSessionExpiredNotice(false);
    return result;
  };

  const registrarConGoogle = async ({ rol, nombreInstitucion, codigoOrganizacion }) => {
    if (!registroGooglePendiente) throw new Error('No hay un registro con Google pendiente.');
    const result = await authService.registroGoogle({
      credential: registroGooglePendiente.credential,
      rol,
      nombreInstitucion,
      codigoOrganizacion,
    });
    setRegistroGooglePendiente(null);
    setUser(result.usuario);
    setToken(result.token);
    setSessionExpiredNotice(false);
    return result;
  };

  const cancelarRegistroGoogle = () => setRegistroGooglePendiente(null);

  const logout = () => {
    authService.logout();
    setUser(null);
    setToken(null);
  };

  const clearSessionNotice = () => setSessionExpiredNotice(false);

  /** Vuelve a leer la cuenta del servidor (nombre, rol u organización pudieron cambiar). */
  const refreshUser = async () => {
    const usuarioActual = await authService.getMe();
    if (usuarioActual) setUser(usuarioActual);
    return usuarioActual;
  };

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
        loginConGoogle,
        registrarConGoogle,
        registroGooglePendiente,
        cancelarRegistroGoogle,
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

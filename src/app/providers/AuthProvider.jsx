import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '@/shared/infrastructure/auth/firebaseAuth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = authService.subscribeToAuthChanges((domainUser) => {
      setAuthError(null);
      setUser(domainUser);
      setIsAuthenticated(Boolean(domainUser));
      setIsLoadingAuth(false);
    }, (error) => {
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({ type: 'auth_error', message: error?.message || 'No se pudo validar la sesión.' });
      setIsLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback((email, password) => authService.login(email, password), []);

  const logout = useCallback(async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    await authService.logout();

    if (shouldRedirect && typeof window !== 'undefined') {
      window.location.assign('/');
    }
  }, []);

  const value = useMemo(() => ({
    user,
    isAuthenticated,
    isLoadingAuth,
    authError,
    login,
    logout,
  }), [authError, isAuthenticated, isLoadingAuth, login, logout, user]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return ctx;
};

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '@/shared/infrastructure/auth/firebaseAuth';
import { AUTH_STATES, INITIAL_AUTH_SESSION, resolvedAuthSession } from '@/app/providers/authState';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [authSession, setAuthSession] = useState(INITIAL_AUTH_SESSION);

  useEffect(() => {
    const unsubscribe = authService.subscribeToAuthChanges((domainUser) => {
      setAuthSession(resolvedAuthSession(domainUser));
    }, (error) => {
      setAuthSession(resolvedAuthSession(null, {
        type: 'auth_error',
        message: error?.message || 'No se pudo validar la sesión.',
      }));
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback((email, password) => authService.login(email, password), []);

  const logout = useCallback(async (shouldRedirect = true) => {
    // Close the private tree before waiting for Firebase/network teardown.
    setAuthSession(resolvedAuthSession(null));
    await authService.logout();

    if (shouldRedirect && typeof window !== 'undefined') {
      window.location.assign('/login');
    }
  }, []);

  const value = useMemo(() => ({
    user: authSession.user,
    authStatus: authSession.status,
    isAuthenticated: authSession.status === AUTH_STATES.AUTHENTICATED,
    isLoadingAuth: authSession.status === AUTH_STATES.LOADING,
    isAuthStateResolved: authSession.status !== AUTH_STATES.LOADING,
    authError: authSession.error,
    login,
    logout,
  }), [authSession, login, logout]);

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

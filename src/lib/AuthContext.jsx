import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { auth } from '@/api/firebaseClient';
import { onAuthStateChanged } from 'firebase/auth';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setAuthError(null);

      if (currentUser) {
        setUser({
          id: currentUser.uid,
          email: currentUser.email,
          fullName: currentUser.displayName,
          role: 'user',
        });
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
      setIsLoadingAuth(false);
    }, (error) => {
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({ type: 'auth_error', message: error?.message || 'No se pudo validar la sesión.' });
      setIsLoadingAuth(false);
    });

    return unsubscribe;
  }, []);

  const navigateToLogin = useCallback(() => {
    window.location.href = '/';
  }, []);

  const logout = useCallback(async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    await auth.signOut();
    if (shouldRedirect) {
      navigateToLogin();
    }
  }, [navigateToLogin]);

  const value = useMemo(() => ({
    user,
    isAuthenticated,
    isLoadingAuth,
    isLoadingPublicSettings: false,
    authError,
    navigateToLogin,
    logout,
  }), [authError, isAuthenticated, isLoadingAuth, logout, navigateToLogin, user]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

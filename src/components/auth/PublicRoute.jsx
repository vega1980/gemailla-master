import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import AuthErrorPage from '@/components/auth/AuthErrorPage';
import LoadingState from '@/components/shared/LoadingState';

export default function PublicRoute() {
  const { isAuthenticated, isAuthStateResolved, authError } = useAuth();

  // Avoid rendering either route tree from an optimistic/default auth value.
  if (isAuthStateResolved !== true) {
    return <LoadingState label="Cargando GEMAILLA AI..." size="md" variant="fullscreen" />;
  }

  if (authError && authError.type !== 'user_not_registered') {
    return <AuthErrorPage message={authError.message} />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

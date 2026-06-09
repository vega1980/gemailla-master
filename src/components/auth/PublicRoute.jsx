import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import AuthErrorPage from '@/components/auth/AuthErrorPage';

const LoadingScreen = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span className="text-sm text-muted-foreground">Cargando GEMAILLA AI...</span>
    </div>
  </div>
);

export default function PublicRoute() {
  const { isAuthenticated, isLoadingAuth, authError } = useAuth();

  if (isLoadingAuth) return <LoadingScreen />;

  if (authError && authError.type !== 'user_not_registered') {
    return <AuthErrorPage message={authError.message} />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

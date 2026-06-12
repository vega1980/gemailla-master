import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { CompanyProvider } from '@/lib/companyContext';
import { SubscriptionProvider } from '@/lib/subscriptionContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AuthErrorPage from '@/components/auth/AuthErrorPage';

const LoadingScreen = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span className="text-sm text-muted-foreground">Cargando GEMAILLA AI...</span>
    </div>
  </div>
);

export default function ProtectedRoute() {
  const { isAuthenticated, isLoadingAuth, authError } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) return <LoadingScreen />;

  if (authError?.type === 'user_not_registered') return <UserNotRegisteredError />;

  if (authError) return <AuthErrorPage message={authError.message} />;

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return (
    <SubscriptionProvider>
      <CompanyProvider>
        <Outlet />
      </CompanyProvider>
    </SubscriptionProvider>
  );
}

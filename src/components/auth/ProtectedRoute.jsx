import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { CompanyProvider } from '@/lib/companyContext';
import { SubscriptionProvider } from '@/lib/subscriptionContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AuthErrorPage from '@/components/auth/AuthErrorPage';
import LoadingState from '@/components/shared/LoadingState';
import { AUTH_STATES } from '@/app/providers/authState';

export default function ProtectedRoute() {
  const { authStatus, authError } = useAuth();
  const location = useLocation();

  // No private provider may mount until Firebase has emitted its first auth state.
  if (authStatus === AUTH_STATES.LOADING) {
    return <LoadingState label="Cargando GEMAILLA AI..." size="md" variant="fullscreen" />;
  }

  if (authError?.type === 'user_not_registered') return <UserNotRegisteredError />;

  if (authError) return <AuthErrorPage message={authError.message} />;

  if (authStatus === AUTH_STATES.UNAUTHENTICATED) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Fail closed if a provider ever supplies an unknown state.
  if (authStatus !== AUTH_STATES.AUTHENTICATED) return null;

  return (
    <SubscriptionProvider>
      <CompanyProvider>
        <Outlet />
      </CompanyProvider>
    </SubscriptionProvider>
  );
}

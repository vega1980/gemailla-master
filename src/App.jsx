import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppProviders } from '@/app/providers';
import { appRoutes, publicRoutes } from '@/app/routes';

const AppLayout = lazy(() => import('@/components/layout/AppLayout'));
const PageNotFound = lazy(() => import('@/lib/PageNotFound'));
const ProtectedRoute = lazy(() => import('@/components/auth/ProtectedRoute'));
const PublicRoute = lazy(() => import('@/components/auth/PublicRoute'));

const RouteLoadingScreen = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span className="text-sm text-muted-foreground">Cargando módulo...</span>
    </div>
  </div>
);

const AppRoutes = () => (
  <Suspense fallback={<RouteLoadingScreen />}>
    <Routes>
      <Route element={<PublicRoute />}>
        {publicRoutes.map(({ path, element }) => (
          <Route key={path} path={path} element={element} />
        ))}
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          {appRoutes.map(({ path, element }) => (
            <Route key={path} path={path} element={element} />
          ))}
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  </Suspense>
);

function App() {
  return (
    <AppProviders>
      <AppRoutes />
    </AppProviders>
  );
}

export default App;

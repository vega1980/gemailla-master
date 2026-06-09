import { lazy, Suspense } from 'react';

// Spinner sutil para transiciones de submódulos dentro del Layout principal
const ModuleLoader = (Component) => (
  <Suspense
    fallback={
      <div className="flex h-[50vh] w-full items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }
  >
    <Component />
  </Suspense>
);

// Importaciones diferidas (Lazy Loading) - Versión entrante optimizada
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Documents = lazy(() => import('@/pages/Documents'));
const ERP = lazy(() => import('@/pages/ERP'));
const Audit = lazy(() => import('@/pages/Audit'));
const AIAssistant = lazy(() => import('@/pages/AIAssistant'));
const Companies = lazy(() => import('@/pages/Companies'));
const ActivityLog = lazy(() => import('@/pages/ActivityLog'));
const Subscriptions = lazy(() => import('@/pages/Subscriptions'));
const PredictiveAnalysis = lazy(() => import('@/pages/PredictiveAnalysis'));
const FinancialHub = lazy(() => import('@/pages/FinancialHub'));
const ClientPanel = lazy(() => import('@/pages/ClientPanel'));
const Operations = lazy(() => import('@/pages/Operations'));
const CRM = lazy(() => import('@/pages/CRM'));
const HumanResources = lazy(() => import('@/pages/HumanResources'));

// Pantalla estática de acceso denegado / requerido
import AuthRequiredPage from '@/components/auth/AuthRequiredPage';

// Definición de Rutas Públicas
export const publicRoutes = [
  {
    path: '/',
    element: <AuthRequiredPage />,
  },
];

// Definición de Rutas Protegidas (Módulos de negocio)
export const appRoutes = [
  { path: '/dashboard', element: ModuleLoader(Dashboard) },
  { path: '/documents', element: ModuleLoader(Documents) },
  { path: '/erp', element: ModuleLoader(ERP) },
  { path: '/audit', element: ModuleLoader(Audit) },
  { path: '/ai-assistant', element: ModuleLoader(AIAssistant) },
  { path: '/companies', element: ModuleLoader(Companies) },
  { path: '/activity-log', element: ModuleLoader(ActivityLog) },
  { path: '/subscriptions', element: ModuleLoader(Subscriptions) },
  { path: '/predictive-analysis', element: ModuleLoader(PredictiveAnalysis) },
  { path: '/financial-hub', element: ModuleLoader(FinancialHub) },
  { path: '/client-panel', element: ModuleLoader(ClientPanel) },
  { path: '/operations', element: ModuleLoader(Operations) },
  { path: '/crm', element: ModuleLoader(CRM) },
  { path: '/hr', element: ModuleLoader(HumanResources) },
];

export const publicRoutes = [
  { path: '/', element: <AuthRequiredPage /> },
];

export const appRoutes = [
  { path: '/dashboard', element: <Dashboard /> },
  { path: '/documents', element: <Documents /> },
  { path: '/erp', element: <ERP /> },
  { path: '/audit', element: <Audit /> },
  { path: '/ai', element: <AIAssistant /> },
  { path: '/companies', element: <Companies /> },
  { path: '/activity', element: <ActivityLog /> },
  { path: '/subscriptions', element: <Subscriptions /> },
  { path: '/predictive', element: <PredictiveAnalysis /> },
  { path: '/finance', element: <FinancialHub /> },
  { path: '/client', element: <ClientPanel /> },
  { path: '/operations', element: <Operations /> },
  { path: '/crm', element: <CRM /> },
  { path: '/hr', element: <HumanResources /> },
];

import { lazy, Suspense } from 'react';

// Fuente única de rutas de la aplicación: no crear un router paralelo.

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

// Importaciones diferidas (Lazy Loading)
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Documents = lazy(() => import('@/modules/documents/pages/DocumentsPage'));
const ERP = lazy(() => import('@/pages/ERP'));
const Audit = lazy(() => import('@/pages/Audit'));
const AIAssistant = lazy(() => import('@/pages/AIAssistant'));
const Companies = lazy(() => import('@/modules/companies/pages/CompaniesPage'));
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
  { path: '/', element: <AuthRequiredPage /> },
];

// Definición de Rutas Protegidas (Módulos de negocio)
export const appRoutes = [
  { path: '/dashboard', element: ModuleLoader(Dashboard) },
  { path: '/documents', element: ModuleLoader(Documents) },
  { path: '/erp', element: ModuleLoader(ERP) },
  { path: '/audit', element: ModuleLoader(Audit) },
  { path: '/ai', element: ModuleLoader(AIAssistant) },
  { path: '/ai-assistant', element: ModuleLoader(AIAssistant) },
  { path: '/companies', element: ModuleLoader(Companies) },
  { path: '/activity', element: ModuleLoader(ActivityLog) },
  { path: '/activity-log', element: ModuleLoader(ActivityLog) },
  { path: '/subscriptions', element: ModuleLoader(Subscriptions) },
  { path: '/predictive', element: ModuleLoader(PredictiveAnalysis) },
  { path: '/predictive-analysis', element: ModuleLoader(PredictiveAnalysis) },
  { path: '/finance', element: ModuleLoader(FinancialHub) },
  { path: '/financial-hub', element: ModuleLoader(FinancialHub) },
  { path: '/client', element: ModuleLoader(ClientPanel) },
  { path: '/client-panel', element: ModuleLoader(ClientPanel) },
  { path: '/operations', element: ModuleLoader(Operations) },
  { path: '/crm', element: ModuleLoader(CRM) },
  { path: '/hr', element: ModuleLoader(HumanResources) },
];

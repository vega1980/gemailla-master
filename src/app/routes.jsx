import { lazy, Suspense } from 'react';
import { CompanyProvider } from '@/lib/companyContext';

// Fuente única de rutas de la aplicación: no crear un router paralelo.
// Las rutas cargan exclusivamente páginas reales publicadas por módulos.

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
const Dashboard = lazy(() => import('@modules/dashboard/pages/DashboardPage'));
const Documents = lazy(() => import('@modules/documents/pages/DocumentsPage'));
const ERP = lazy(() => import('@modules/erp/pages/ERPPage'));
const Audit = lazy(() => import('@modules/audit/pages/AuditPage'));
const AIAssistant = lazy(() => import('@modules/ai/pages/AIAssistantPage'));
const Companies = lazy(() => import('@modules/companies/pages/CompaniesPage'));
const ActivityLog = lazy(() => import('@modules/activity/pages/ActivityLogPage'));
const Subscriptions = lazy(() => import('@modules/subscriptions/pages/SubscriptionsPage'));
const PredictiveAnalysis = lazy(() => import('@modules/predictions/pages/PredictiveAnalysisPage'));
const FinancialHub = lazy(() => import('@modules/finance/pages/FinancialHubPage'));
const ClientPanel = lazy(() => import('@modules/client/pages/ClientPanelPage'));
const Operations = lazy(() => import('@modules/operations/pages/OperationsPage'));
const CRM = lazy(() => import('@modules/crm/pages/CRMPage'));
const HumanResources = lazy(() => import('@modules/hr/pages/HumanResourcesPage'));

// Definición de Rutas Públicas
export const publicRoutes = [
  {
    path: '/',
    element: (
      <CompanyProvider>
        {ModuleLoader(Dashboard)}
      </CompanyProvider>
    ),
  },
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

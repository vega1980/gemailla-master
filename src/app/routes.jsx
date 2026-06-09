import Dashboard from '@/pages/Dashboard';
import Documents from '@/pages/Documents';
import ERP from '@/pages/ERP';
import Audit from '@/pages/Audit';
import AIAssistant from '@/pages/AIAssistant';
import Companies from '@/pages/Companies';
import ActivityLog from '@/pages/ActivityLog';
import Subscriptions from '@/pages/Subscriptions';
import PredictiveAnalysis from '@/pages/PredictiveAnalysis';
import FinancialHub from '@/pages/FinancialHub';
import ClientPanel from '@/pages/ClientPanel';
import Operations from '@/pages/Operations';
import CRM from '@/pages/CRM';
import HumanResources from '@/pages/HumanResources';
import AuthRequiredPage from '@/components/auth/AuthRequiredPage';

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

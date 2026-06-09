import { lazy } from 'react';
import AuthRequiredPage from '@/components/auth/AuthRequiredPage';

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

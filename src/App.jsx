import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import AppLayout from '@/components/layout/AppLayout';
import Dashboard from './pages/GemaillaDashboard';
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
import { SubscriptionProvider } from '@/lib/subscriptionContext';

const AuthenticatedApp = () => {
  const { isLoadingAuth, authError } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Cargando GEMAILLA AI...</span>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      window.location.href = '/';
      return null;
    }
  }

  return (
    <SubscriptionProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/erp" element={<ERP />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/ai" element={<AIAssistant />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/activity" element={<ActivityLog />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/predictive" element={<PredictiveAnalysis />} />
          <Route path="/finance" element={<FinancialHub />} />
          <Route path="/client" element={<ClientPanel />} />
          <Route path="/operations" element={<Operations />} />
          <Route path="/crm" element={<CRM />} />
          <Route path="/hr" element={<HumanResources />} />
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </SubscriptionProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
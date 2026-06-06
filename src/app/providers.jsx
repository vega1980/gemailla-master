import { BrowserRouter as Router } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/lib/AuthContext';
import { CompanyProvider } from '@/lib/companyContext';
import { queryClientInstance } from '@/lib/query-client';
import { SubscriptionProvider } from '@/lib/subscriptionContext';

export function AppProviders({ children }) {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <SubscriptionProvider>
            <CompanyProvider>
              {children}
            </CompanyProvider>
          </SubscriptionProvider>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

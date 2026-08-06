import React from 'react';
import { BrowserRouter as Router, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/components/ui/use-toast';
import { AuthProvider } from '@/app/providers/AuthProvider';
import { queryClientInstance } from '@/lib/query-client';
import { AppErrorBoundary } from '@/components/shared/AppErrorBoundary';


function ToastRouteCleaner() {
  const location = useLocation();
  const { clearToasts } = useToast();

  React.useEffect(() => {
    clearToasts();
  }, [clearToasts, location.pathname]);

  return null;
}

export function AppProviders({ children }) {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <ToastRouteCleaner />
            {children}
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}

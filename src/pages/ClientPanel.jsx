import React, { useMemo } from 'react';
import { useCompany } from '@/lib/companyContext';
import { useQuery } from '@tanstack/react-query';
import { firebase } from '@/api/firebaseClient';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, BarChart3, AlertTriangle, Users, CreditCard } from 'lucide-react';
import { format, subMonths, startOfMonth } from 'date-fns';
import TrendsPanel from '@/components/client/TrendsPanel';
import StockAlerts from '@/components/client/StockAlerts';
import ChurnPanel from '@/components/client/ChurnPanel';
import MyPlan from '@/components/client/MyPlan';

export default function ClientPanel() {
  const { activeCompany, loading: companyLoading } = useCompany();
  const { user } = useAuth();

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', activeCompany?.id],
    queryFn: () => firebase.entities.Transaction.filter({ companyId: activeCompany.id }),
    enabled: !!activeCompany,
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['subscriptions-all'],
    queryFn: () => firebase.entities.Subscription.filter({}),
    enabled: !!activeCompany,
  });

  const monthlyData = useMemo(() => {
    const data = [];
    for (let i = 11; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(new Date(), i));
      const monthStr = format(monthStart, 'yyyy-MM');
      const monthLabel = format(monthStart, 'MMM yy');
      const inc = transactions.filter(t => t.type === 'ingreso' && t.date?.startsWith(monthStr)).reduce((s, t) => s + (t.amount || 0), 0);
      const exp = transactions.filter(t => t.type === 'gasto' && t.date?.startsWith(monthStr)).reduce((s, t) => s + (t.amount || 0), 0);
      data.push({ month: monthLabel, monthStr, ingresos: inc, gastos: exp });
    }
    return data;
  }, [transactions]);

  if (companyLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!activeCompany) {
    return (
      <EmptyState
        icon={Building2}
        title="Selecciona una empresa"
        description="Necesitas una empresa activa para ver el panel de cliente."
      />
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Panel de Cliente"
        description="Tendencias, alertas y análisis de tu negocio en tiempo real."
      />

      <Tabs defaultValue="trends" className="space-y-6">
        <TabsList className="bg-card border border-border p-1 rounded-xl flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="trends" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
            <BarChart3 className="w-4 h-4" /> Tendencias
          </TabsTrigger>
          <TabsTrigger value="alerts" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
            <AlertTriangle className="w-4 h-4" /> Alertas
          </TabsTrigger>
          <TabsTrigger value="churn" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
            <Users className="w-4 h-4" /> Fuga de Clientes
          </TabsTrigger>
          <TabsTrigger value="plan" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
            <CreditCard className="w-4 h-4" /> Mi Plan
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trends">
          <TrendsPanel transactions={transactions} monthlyData={monthlyData} company={activeCompany} />
        </TabsContent>

        <TabsContent value="alerts">
          <StockAlerts transactions={transactions} monthlyData={monthlyData} />
        </TabsContent>

        <TabsContent value="churn">
          <ChurnPanel subscriptions={subscriptions} transactions={transactions} />
        </TabsContent>

        <TabsContent value="plan">
          <MyPlan />
        </TabsContent>
      </Tabs>
    </div>
  );
}
import React, { useMemo } from 'react';
import { useCompany } from '@/lib/companyContext';
import { useQuery } from '@tanstack/react-query';
import { firebase } from '@/api/firebaseClient';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import PredictionGate from '@/components/subscription/PredictionGate';
import DemandForecast from '@/components/predictive/DemandForecast';
import AnomalyDetector from '@/components/predictive/AnomalyDetector';
import ChurnPredictor from '@/components/predictive/ChurnPredictor';
import WhatIfAdvanced from '@/components/predictive/WhatIfAdvanced';
import { Building2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, subMonths, startOfMonth } from 'date-fns';

export default function PredictiveAnalysis() {
  const { activeCompany, loading: companyLoading } = useCompany();

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', activeCompany?.id],
    queryFn: () => firebase.entities.Transaction.filter({ companyId: activeCompany.id }),
    enabled: !!activeCompany,
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['subscriptions', activeCompany?.id],
    queryFn: () => firebase.entities.Subscription.filter({ companyId: activeCompany.id }),
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
        description="Necesitas una empresa activa para usar el análisis predictivo."
      />
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Análisis Predictivo"
        description="Motor de inteligencia artificial para anticipar tendencias, detectar riesgos y simular escenarios."
      />

      <PredictionGate requiredPlan="pro" featureName="Análisis Predictivo con IA">
        <Tabs defaultValue="forecast" className="space-y-6">
          <TabsList className="bg-card border border-border p-1 rounded-xl">
            <TabsTrigger value="forecast" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              📈 Pronóstico
            </TabsTrigger>
            <TabsTrigger value="anomalies" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              🔍 Anomalías
            </TabsTrigger>
            <TabsTrigger value="churn" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              ⚠️ Fuga de Clientes
            </TabsTrigger>
            <TabsTrigger value="whatif" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              🧪 Simulador What-If
            </TabsTrigger>
          </TabsList>

          <TabsContent value="forecast">
            <DemandForecast transactions={transactions} monthlyData={monthlyData} />
          </TabsContent>

          <TabsContent value="anomalies">
            <AnomalyDetector transactions={transactions} monthlyData={monthlyData} />
          </TabsContent>

          <TabsContent value="churn">
            <ChurnPredictor subscriptions={subscriptions} transactions={transactions} />
          </TabsContent>

          <TabsContent value="whatif">
            <WhatIfAdvanced transactions={transactions} monthlyData={monthlyData} />
          </TabsContent>
        </Tabs>
      </PredictionGate>
    </div>
  );
}
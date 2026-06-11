import React, { useMemo } from 'react';
import { useCompany } from '@/lib/companyContext';
import { useCompanyTransactions } from '@/lib/companyEntityQueries';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2 } from 'lucide-react';
import { format, subMonths, startOfMonth } from 'date-fns';
import FinancialStatements from '@/components/finance/FinancialStatements';
import RiskManagement from '@/components/finance/RiskManagement';
import BudgetPlanner from '@/components/finance/BudgetPlanner';
import ReportDownloader from '@/components/finance/ReportDownloader';

export default function FinancialHub() {
  const { activeCompany, loading: companyLoading } = useCompany();

  const { data: transactions = [] } = useCompanyTransactions(activeCompany);

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
        description="Necesitas una empresa activa para acceder al Hub Financiero."
      />
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Hub Financiero"
        description="Estados financieros, gestión de riesgos y planificación de presupuestos en tiempo real."
        actions={<ReportDownloader transactions={transactions} company={activeCompany} />}
      />

      <Tabs defaultValue="statements" className="space-y-6">
        <TabsList className="bg-card border border-border p-1 rounded-xl flex-wrap h-auto gap-1">
          <TabsTrigger value="statements" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm">
            📊 Estados Financieros
          </TabsTrigger>
          <TabsTrigger value="risks" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm">
            🛡️ Gestión de Riesgos
          </TabsTrigger>
          <TabsTrigger value="budget" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-sm">
            💰 Presupuesto & Flujo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="statements">
          <FinancialStatements transactions={transactions} company={activeCompany} />
        </TabsContent>

        <TabsContent value="risks">
          <RiskManagement transactions={transactions} monthlyData={monthlyData} company={activeCompany} />
        </TabsContent>

        <TabsContent value="budget">
          <BudgetPlanner transactions={transactions} monthlyData={monthlyData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
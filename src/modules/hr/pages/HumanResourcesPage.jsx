import React from 'react';
import { useCompany } from '@/lib/companyContext';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import PageHeader from '@/components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Users, DollarSign, Star } from 'lucide-react';
import EmployeeDirectory from '@/features/hr/components/EmployeeDirectory';
import PayrollManager from '@/features/hr/components/PayrollManager';
import PerformanceManager from '@/features/hr/components/PerformanceManager';

export default function HumanResources() {
  const { activeCompany, loading } = useCompany();

  if (loading) return <LoadingState />;

  if (!activeCompany) {
    return (
      <EmptyState
        icon={Building2}
        title="Selecciona una empresa"
        description="Necesitas una empresa activa para usar Recursos Humanos."
      />
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Recursos Humanos y Talento"
        description="Gestión de empleados, nóminas, formación y evaluación del desempeño."
      />
      <Tabs defaultValue="employees" className="space-y-6">
        <TabsList className="bg-card border border-border p-1 rounded-xl flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="employees" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
            <Users className="w-4 h-4" /> Directorio
          </TabsTrigger>
          <TabsTrigger value="payroll" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
            <DollarSign className="w-4 h-4" /> Nóminas
          </TabsTrigger>
          <TabsTrigger value="performance" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
            <Star className="w-4 h-4" /> Evaluaciones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees"><EmployeeDirectory company={activeCompany} /></TabsContent>
        <TabsContent value="payroll"><PayrollManager company={activeCompany} /></TabsContent>
        <TabsContent value="performance"><PerformanceManager company={activeCompany} /></TabsContent>
      </Tabs>
    </div>
  );
}
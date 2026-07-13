import React from 'react';
import { useCompany } from '@/lib/companyContext';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import PageHeader from '@/components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Users, PieChart, TrendingUp } from 'lucide-react';
import ClientList from '@/features/crm/components/ClientList';
import ClientSegments from '@/features/crm/components/ClientSegments';
import DealPipeline from '@/features/crm/components/DealPipeline';
import ClientImporter from '@/features/crm/components/ClientImporter';

export default function CRM() {
  const { activeCompany, loading } = useCompany();

  if (loading) return <LoadingState />;

  if (!activeCompany) {
    return (
      <EmptyState
        icon={Building2}
        title="Selecciona una empresa"
        description="Necesitas una empresa activa para usar el CRM."
      />
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="CRM — Gestión de Clientes"
        description="Historial de interacciones, segmentación de mercado y seguimiento comercial en un solo lugar."
      />
      <Tabs defaultValue="clients" className="space-y-6">
        <TabsList className="bg-card border border-border p-1 rounded-xl flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="clients" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
            <Users className="w-4 h-4" /> Clientes
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
            <TrendingUp className="w-4 h-4" /> Pipeline Comercial
          </TabsTrigger>
          <TabsTrigger value="segments" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
            <PieChart className="w-4 h-4" /> Segmentación
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clients">
          <div className="space-y-6">
            <ClientImporter />
            <ClientList company={activeCompany} />
          </div>
        </TabsContent>
        <TabsContent value="pipeline"><DealPipeline company={activeCompany} /></TabsContent>
        <TabsContent value="segments"><ClientSegments company={activeCompany} /></TabsContent>
      </Tabs>
    </div>
  );
}
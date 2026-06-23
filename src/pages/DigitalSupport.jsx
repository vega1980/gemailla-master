import React from 'react';
import { useCompany } from '@/lib/companyContext';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import PageHeader from '@/components/shared/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, MessageCircle, BarChart3, FileOutput } from 'lucide-react';
import SupportChatbot from '@/features/support/components/SupportChatbot';
import ClientDashboardShare from '@/features/support/components/ClientDashboardShare';
import AutoReports from '@/features/support/components/AutoReports';

export default function DigitalSupport() {
  const { activeCompany, loading } = useCompany();

  if (loading) return <LoadingState />;

  if (!activeCompany) {
    return (
      <EmptyState
        icon={Building2}
        title="Selecciona una empresa"
        description="Necesitas una empresa activa para usar Consultoría Digital."
      />
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Consultoría Digital y Soporte"
        description="Asistente virtual 24/7, datos en tiempo real para clientes y automatización de documentos."
      />
      <Tabs defaultValue="chatbot" className="space-y-6">
        <TabsList className="bg-card border border-border p-1 rounded-xl flex flex-wrap gap-1 h-auto">
          <TabsTrigger value="chatbot" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
            <MessageCircle className="w-4 h-4" /> Asistente Virtual
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
            <BarChart3 className="w-4 h-4" /> Indicadores en Tiempo Real
          </TabsTrigger>
          <TabsTrigger value="reports" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
            <FileOutput className="w-4 h-4" /> Reportes Automáticos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chatbot"><SupportChatbot company={activeCompany} /></TabsContent>
        <TabsContent value="dashboard"><ClientDashboardShare company={activeCompany} /></TabsContent>
        <TabsContent value="reports"><AutoReports company={activeCompany} /></TabsContent>
      </Tabs>
    </div>
  );
}
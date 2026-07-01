import React, { useState } from 'react';
import { useCompany } from '@/lib/companyContext';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import { Building2, Target, GitBranch, FolderKanban } from 'lucide-react';
import StrategicKPIs from '@/features/operations/components/StrategicKPIs';
import ProcessOptimizer from '@/features/operations/components/ProcessOptimizer';
import ProjectTracker from '@/features/operations/components/ProjectTracker';
import ProjectImporter from '@/features/operations/components/ProjectImporter';

export default function Operations() {
  const [activeTab, setActiveTab] = useState('kpis');
  const { activeCompany, loading } = useCompany();

  if (loading) return <LoadingState />;

  return (
    <div className="animate-fade-in" style={{background: '#050505', minHeight: '100vh'}}>
      {/* Header con branding dorado */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-display font-bold" style={{
              background: 'linear-gradient(135deg, #f0d080 0%, #c5a059 50%, #e8c97a 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>Estrategia y Operaciones</h1>
            <p className="text-sm mt-1" style={{color: activeCompany ? 'rgba(197,160,89,0.6)' : 'rgba(197,160,89,0.4)'}}>
              {activeCompany ? activeCompany.name : 'Selecciona una empresa para comenzar'}
            </p>
          </div>
        </div>
        <div className="h-px w-full" style={{
          background: 'linear-gradient(90deg, transparent, rgba(197,160,89,0.3), rgba(197,160,89,0.5), rgba(197,160,89,0.3), transparent)'
        }} />
      </div>

      {/* Tabs personalizados */}
      <div className="mb-6">
        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'kpis', label: 'Planeación Estratégica', icon: Target },
            { id: 'processes', label: 'Optimización de Procesos', icon: GitBranch },
            { id: 'projects', label: 'Gestión de Proyectos', icon: FolderKanban }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
              style={activeTab === tab.id ? {
                background: 'rgba(197,160,89,0.15)',
                color: '#c5a059',
                border: '1px solid rgba(197,160,89,0.3)',
                boxShadow: '0 2px 8px rgba(197,160,89,0.1)'
              } : {
                background: 'rgba(197,160,89,0.05)',
                color: 'rgba(200,190,170,0.6)',
                border: '1px solid rgba(197,160,89,0.1)'
              }}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido de tabs */}
      <div className="space-y-6">
        {activeTab === 'kpis' && <StrategicKPIs company={activeCompany} />}
        {activeTab === 'processes' && <ProcessOptimizer company={activeCompany} />}
        {activeTab === 'projects' && (
          <div className="space-y-6">
            <ProjectImporter />
            <ProjectTracker company={activeCompany} />
          </div>
        )}
      </div>

      {/* Empty state overlay cuando no hay empresa */}
      {!activeCompany && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <EmptyState
            icon={Building2}
            title="Sin empresa seleccionada"
            description="Ve a la sección Empresas y crea o selecciona una empresa para usar todas las funcionalidades."
          />
        </div>
      )}
    </div>
  );
}
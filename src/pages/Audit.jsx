import React, { useState } from 'react';
import { useCompanyTransactions } from '@/lib/companyEntityQueries';
import { useCompany } from '@/lib/companyContext';
import { useAuth } from '@/app/providers/AuthProvider';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import EmptyState from '@/components/shared/EmptyState';
import { logAction } from '@/lib/auditLogger';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Shield, TrendingUp, AlertTriangle, CheckCircle, Loader2, BarChart3 } from 'lucide-react';
import ReportGenerator from '@/features/reports/components/ReportGenerator';
import { motion } from 'framer-motion';

import { askLLM } from '@modules/ai/services/aiService';
export default function Audit() {
  const { activeCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState(null);

  const { data: transactions = [] } = useCompanyTransactions(activeCompany);

  const runAudit = async () => {
    setRunning(true);
    const totalIngresos = transactions.filter(t => t.type === 'ingreso').reduce((s, t) => s + (t.amount || 0), 0);
    const totalGastos = transactions.filter(t => t.type === 'gasto').reduce((s, t) => s + (t.amount || 0), 0);
    const balance = totalIngresos - totalGastos;
    const margin = totalIngresos > 0 ? (balance / totalIngresos) * 100 : 0;

    const txSummary = JSON.stringify({
      total_ingresos: totalIngresos,
      total_gastos: totalGastos,
      balance,
      margin: margin.toFixed(2),
      num_transactions: transactions.length,
      categories: transactions.reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + (t.amount || 0);
        return acc;
      }, {})
    });

    const result = await askLLM({
      companyId: activeCompany.id,
      prompt: `Eres un auditor financiero experto. Analiza estos datos financieros de la empresa "${activeCompany.name}" y genera un diagnóstico completo:

Datos:
${txSummary}

Genera un informe de auditoría que incluya:
1. Validación de ecuación contable (Activo = Pasivo + Capital, basado en ingresos/gastos)
2. Cálculo e interpretación de: margen de utilidad, ratio de eficiencia operativa, tendencia de gastos
3. Diagnóstico de salud financiera (escala 1-100)
4. Alertas y riesgos identificados
5. Recomendaciones específicas y accionables (mínimo 3)
6. Calificación general`,
      response_json_schema: {
        type: 'object',
        properties: {
          health_score: { type: 'number' },
          health_label: { type: 'string' },
          margin_percent: { type: 'number' },
          efficiency_ratio: { type: 'number' },
          equation_valid: { type: 'boolean' },
          equation_note: { type: 'string' },
          alerts: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string' }, message: { type: 'string' } } } },
          recommendations: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, priority: { type: 'string' } } } },
          diagnosis: { type: 'string' },
          summary: { type: 'string' }
        }
      }
    });

    setReport(result);
    setRunning(false);

    await logAction({
      companyId: activeCompany.id, userEmail: user.email, userName: user.fullName,
      action: 'audit_run', entityType: 'Company', entityId: activeCompany.id,
      details: `Score: ${result.health_score}/100`
    });

    toast({ title: 'Auditoría completada', description: `Puntuación: ${result.health_score}/100` });
  };

  if (!activeCompany) return <EmptyState icon={Shield} title="Selecciona una empresa" description="Necesitas una empresa activa." />;

  const totalIngresos = transactions.filter(t => t.type === 'ingreso').reduce((s, t) => s + (t.amount || 0), 0);
  const totalGastos = transactions.filter(t => t.type === 'gasto').reduce((s, t) => s + (t.amount || 0), 0);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Auditoría Financiera"
        description="Diagnóstico automatizado de la salud de tu empresa."
        actions={
          <div className="flex items-center gap-3">
            <ReportGenerator company={activeCompany} transactions={transactions} documents={[]} auditReport={report} />
            <Button onClick={runAudit} disabled={running || transactions.length === 0} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
              Ejecutar Auditoría
            </Button>
          </div>
        }
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard title="Ingresos" value={`$${totalIngresos.toLocaleString()}`} icon={TrendingUp} />
        <StatCard title="Gastos" value={`$${totalGastos.toLocaleString()}`} icon={BarChart3} />
        <StatCard title="Transacciones" value={transactions.length} icon={Shield} />
      </div>

      {/* Audit Report */}
      {report ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Health Score */}
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <div className="w-24 h-24 rounded-full border-4 border-primary mx-auto flex items-center justify-center mb-4">
              <span className="text-3xl font-bold text-primary">{report.health_score}</span>
            </div>
            <p className="text-lg font-semibold text-foreground">{report.health_label}</p>
            <p className="text-sm text-muted-foreground mt-1">{report.summary}</p>
          </div>

          {/* KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Margen</p>
              <p className="text-xl font-bold text-foreground">{report.margin_percent?.toFixed(1)}%</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Eficiencia</p>
              <p className="text-xl font-bold text-foreground">{report.efficiency_ratio?.toFixed(1)}%</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Ecuación Contable</p>
              <p className={`text-xl font-bold ${report.equation_valid ? 'text-emerald-400' : 'text-red-400'}`}>
                {report.equation_valid ? 'Válida' : 'Discrepancia'}
              </p>
              {report.equation_note && <p className="text-xs text-muted-foreground mt-1">{report.equation_note}</p>}
            </div>
          </div>

          {/* Diagnosis */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Diagnóstico</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{report.diagnosis}</p>
          </div>

          {/* Alerts */}
          {report.alerts?.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Alertas</h3>
              <div className="space-y-2">
                {report.alerts.map((a, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${a.severity === 'high' ? 'bg-red-500/10 border border-red-500/20' : a.severity === 'medium' ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-blue-500/10 border border-blue-500/20'}`}>
                    <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${a.severity === 'high' ? 'text-red-400' : a.severity === 'medium' ? 'text-yellow-400' : 'text-blue-400'}`} />
                    <p className="text-sm">{a.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {report.recommendations?.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Recomendaciones</h3>
              <div className="space-y-3">
                {report.recommendations.map((r, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{r.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary ml-auto shrink-0">{r.priority}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      ) : (
        <EmptyState icon={Shield} title="Ejecuta una auditoría" description="Analiza la salud financiera de tu empresa con IA. Necesitas al menos transacciones registradas." />
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { useCompanyData } from '@/hooks/useCompanyData';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileOutput, Loader2, Download, Sparkles, FileText, BarChart3, Shield, Receipt } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { format, subMonths, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

import { askLLM } from '@modules/ai/services/aiService';
const REPORT_TYPES = [
  { id: 'executive',    label: 'Informe Ejecutivo Mensual',        icon: BarChart3,  desc: 'Resumen completo de KPIs financieros, tendencias y alertas.' },
  { id: 'fiscal',       label: 'Reporte Fiscal / Cumplimiento',    icon: Shield,      desc: 'Estado fiscal, obligaciones pendientes y recomendaciones.' },
  { id: 'cashflow',     label: 'Estado de Flujo de Caja',          icon: Receipt,     desc: 'Análisis detallado de entradas, salidas y proyección.' },
  { id: 'operational',  label: 'Reporte Operacional',              icon: FileText,    desc: 'Desempeño de procesos, proyectos y KPIs estratégicos.' },
];

const fmt = (n) => `$${(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;

export default function AutoReports({ company }) {
  const [reportType, setReportType] = useState('executive');
  const [period, setPeriod] = useState('current');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const { transactions, documents, kpis, projects } = useCompanyData(company?.id, {
    queryNames: ['transactions', 'documents', 'kpis', 'projects'],
  });

  const generateReport = async () => {
    setLoading(true);
    setReport(null);

    const offset = period === 'current' ? 0 : period === 'last' ? 1 : 3;
    const periodStart = format(startOfMonth(subMonths(new Date(), offset)), 'yyyy-MM');
    const periodLabel = format(startOfMonth(subMonths(new Date(), offset)), "MMMM yyyy", { locale: es });

    const periodTxs = period === 'all' ? transactions : transactions.filter(t => t.date?.startsWith(periodStart));
    const ingresos = periodTxs.filter(t => t.type === 'ingreso').reduce((s, t) => s + (t.amount || 0), 0);
    const gastos = periodTxs.filter(t => t.type === 'gasto').reduce((s, t) => s + (t.amount || 0), 0);
    const balance = ingresos - gastos;

    const catBreakdown = periodTxs.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});

    const typeMeta = REPORT_TYPES.find(r => r.id === reportType);

    const prompts = {
      executive: `Genera un **Informe Ejecutivo Mensual** completo y profesional para la empresa "${company.name}" correspondiente a ${periodLabel}.

DATOS FINANCIEROS:
- Ingresos: ${fmt(ingresos)}
- Gastos: ${fmt(gastos)}
- Balance: ${fmt(balance)}
- Margen: ${ingresos > 0 ? ((balance/ingresos)*100).toFixed(1) : 0}%
- Desglose por categoría: ${JSON.stringify(Object.fromEntries(Object.entries(catBreakdown).map(([k,v]) => [k, fmt(v)])))}

KPIs: ${kpis.slice(0, 5).map(k => `${k.name}: ${k.current}/${k.target} ${k.unit} (${k.status})`).join(', ') || 'No definidos'}
DOCUMENTOS: ${documents.length} total, ${documents.filter(d => d.status === 'analyzed').length} analizados

El informe debe incluir:
# Informe Ejecutivo — ${company.name} — ${periodLabel}
## 1. Resumen Ejecutivo
## 2. Resultados Financieros
## 3. Análisis de KPIs
## 4. Alertas y Riesgos
## 5. Recomendaciones Estratégicas
## 6. Próximos Pasos

Usa formato Markdown profesional con tablas donde sea útil.`,

      fiscal: `Genera un **Reporte Fiscal y de Cumplimiento** para la empresa "${company.name}" — ${periodLabel}.

MOVIMIENTOS FINANCIEROS:
- Ingresos gravables estimados: ${fmt(ingresos)}
- Gastos deducibles estimados: ${fmt(gastos)}
- Utilidad fiscal estimada: ${fmt(balance)}
- Industria: ${company.industry || 'no especificada'}
- RFC: ${company.rfc || 'no registrado'}

El reporte debe incluir:
# Reporte Fiscal — ${company.name} — ${periodLabel}
## 1. Situación Fiscal del Período
## 2. Obligaciones Pendientes (ISR, IVA, IMSS)
## 3. Gastos Deducibles por Categoría
## 4. Alertas de Cumplimiento
## 5. Calendario de Obligaciones Fiscales
## 6. Recomendaciones de Optimización Fiscal

Incluye cifras estimadas de ISR e IVA. Usa formato Markdown profesional.`,

      cashflow: `Genera un **Estado de Flujo de Caja** para la empresa "${company.name}" — ${periodLabel}.

DATOS:
- Total ingresos: ${fmt(ingresos)}
- Total gastos: ${fmt(gastos)}
- Flujo neto: ${fmt(balance)}
- Desglose ingresos: ${JSON.stringify(Object.fromEntries(Object.entries(catBreakdown).filter(([k]) => ['ventas','servicios','inversiones','otros_ingresos'].includes(k)).map(([k,v]) => [k, fmt(v)])))}
- Desglose gastos: ${JSON.stringify(Object.fromEntries(Object.entries(catBreakdown).filter(([k]) => !['ventas','servicios','inversiones','otros_ingresos'].includes(k)).map(([k,v]) => [k, fmt(v)])))}

El estado debe incluir:
# Estado de Flujo de Caja — ${company.name} — ${periodLabel}
## 1. Flujo de Actividades Operativas
## 2. Flujo de Actividades de Inversión  
## 3. Flujo de Actividades de Financiamiento
## 4. Análisis de Liquidez
## 5. Proyección Próximo Mes
## 6. Recomendaciones de Gestión de Caja`,

      operational: `Genera un **Reporte Operacional** para la empresa "${company.name}" — ${periodLabel}.

KPIs: ${kpis.map(k => `${k.name}: ${k.current}/${k.target} ${k.unit} (${k.status}, ${k.category})`).join('; ') || 'No definidos'}
PROYECTOS: ${projects.map(p => `${p.name}: ${p.status}, ${p.progress}% avance`).join('; ') || 'No hay proyectos'}
DOCUMENTOS PROCESADOS: ${documents.filter(d => d.status === 'analyzed').length}

El reporte debe incluir:
# Reporte Operacional — ${company.name} — ${periodLabel}
## 1. Resumen de KPIs Estratégicos
## 2. Estado de Proyectos
## 3. Eficiencia Operacional
## 4. Riesgos Identificados
## 5. Logros del Período
## 6. Plan de Acción Siguiente Período`,
    };

    const res = await askLLM({
      companyId: company.id,
      prompt: prompts[reportType] + '\n\nResponde en español. Formato Markdown profesional y detallado.',
      model: 'claude_sonnet_4_6',
    });

    setReport({ content: res, type: typeMeta, period: periodLabel, generatedAt: new Date() });
    setLoading(false);
  };

  const downloadReport = () => {
    if (!report) return;
    const blob = new Blob([report.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${company.name}-${report.type.id}-${format(report.generatedAt, 'yyyy-MM-dd')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Config panel */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-sm font-semibold text-foreground mb-4">Configurar Reporte</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Tipo de reporte</label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map(r => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Período</label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Mes actual</SelectItem>
                <SelectItem value="last">Mes anterior</SelectItem>
                <SelectItem value="all">Acumulado total</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={generateReport} disabled={loading} className="bg-primary text-primary-foreground gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Generando...' : 'Generar Reporte'}
          </Button>
        </div>

        {/* Report type cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {REPORT_TYPES.map(r => {
            const Icon = r.icon;
            return (
              <button key={r.id} onClick={() => setReportType(r.id)}
                className={`p-3 rounded-xl border text-left transition-all ${reportType === r.id ? 'border-primary/50 bg-primary/10' : 'border-border bg-secondary/40 hover:border-border/80'}`}>
                <Icon className={`w-4 h-4 mb-2 ${reportType === r.id ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className={`text-xs font-medium ${reportType === r.id ? 'text-primary' : 'text-foreground'}`}>{r.label}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm">Generando reporte con IA...</p>
          <p className="text-xs text-muted-foreground/60">Esto puede tomar unos segundos</p>
        </div>
      )}

      {/* Generated report */}
      {report && !loading && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30">
            <div className="flex items-center gap-2">
              <FileOutput className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">{report.type.label}</p>
              <span className="text-xs text-muted-foreground">— {report.period}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Generado: {format(report.generatedAt, "d MMM, HH:mm", { locale: es })}
              </span>
              <Button size="sm" variant="outline" onClick={downloadReport} className="gap-2 h-7 text-xs border-border">
                <Download className="w-3 h-3" /> Descargar
              </Button>
            </div>
          </div>
          <div className="p-6 prose prose-sm prose-invert max-w-none text-sm leading-relaxed overflow-auto max-h-[600px]">
            <ReactMarkdown>{report.content}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

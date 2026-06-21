import React, { useState } from 'react';
import { useCompanyData } from '@/hooks/useCompanyData';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2, GitBranch, Clock, TrendingDown, CheckCircle2, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import { askLLM } from '@/modules/ai/aiService';
const fmt = (n) => `$${(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;

const PROCESSES = [
  { id: 'supply_chain', label: 'Cadena de Suministro', icon: '🔗' },
  { id: 'manufacturing', label: 'Manufactura / Producción', icon: '🏭' },
  { id: 'sales', label: 'Proceso Comercial / Ventas', icon: '💼' },
  { id: 'finance', label: 'Proceso Financiero / Contable', icon: '💰' },
  { id: 'hr', label: 'Gestión de Talento (RRHH)', icon: '👥' },
  { id: 'customer', label: 'Atención al Cliente', icon: '🎯' },
];

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-xl p-3 text-xs shadow-xl">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>)}
    </div>
  );
};

export default function ProcessOptimizer({ company }) {
  const [selectedProcess, setSelectedProcess] = useState('supply_chain');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const { transactions, kpis } = useCompanyData(company?.id, {
    queryNames: ['transactions', 'kpis'],
  });

  const displayTransactions = company ? transactions : [];
  const displayKPIs = company ? kpis : [];

  // Cost breakdown by category
  const catCosts = displayTransactions.filter(t => t.type === 'gasto').reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + (t.amount || 0);
    return acc;
  }, {});
  const chartData = Object.entries(catCosts).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([cat, total]) => ({ cat, total }));

  const totalCost = Object.values(catCosts).reduce((s, v) => s + v, 0);

  const analyze = async () => {
    setLoading(true);
    setResult(null);
    const proc = PROCESSES.find(p => p.id === selectedProcess);

    const res = await askLLM({
      companyId: company.id,
      prompt: `Eres un experto en optimización de procesos y cadena de suministro para PyMEs mexicanas.

EMPRESA: ${company?.name || 'Empresa sin seleccionar'} | Industria: ${company?.industry || 'tecnología'}
PROCESO A ANALIZAR: ${proc?.label}

COSTOS OPERATIVOS REALES:
${Object.entries(catCosts).map(([cat, amt]) => `- ${cat}: ${fmt(amt)}`).join('\n')}
Total gastos: ${fmt(totalCost)}

KPIs OPERACIONALES:
${displayKPIs.filter(k => k.category === 'operacional').map(k => `- ${k.name}: ${k.current}/${k.target} ${k.unit}`).join('\n') || 'No definidos'}

Genera un análisis detallado del proceso "${proc?.label}" incluyendo:
1. 🔍 Diagnóstico: 3 ineficiencias probables basadas en los datos
2. ⏱️ Impacto en tiempo: cuellos de botella típicos y su costo estimado
3. 💰 Oportunidades de ahorro: 3 acciones con ahorro potencial en MXN o % de costo
4. ✅ Mejores prácticas: 4 acciones concretas para optimizar este proceso
5. 📊 KPIs recomendados para medir el desempeño del proceso
6. 🗓️ Plan de implementación: 3 fases (30/60/90 días) con actividades específicas

Responde en español, tono profesional de consultor senior, con datos y cifras concretas.`,
      response_json_schema: {
        type: 'object',
        properties: {
          inefficiencies: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, estimatedCost: { type: 'string' } } } },
          savings_opportunities: { type: 'array', items: { type: 'object', properties: { action: { type: 'string' }, saving: { type: 'string' }, effort: { type: 'string', enum: ['bajo', 'medio', 'alto'] } } } },
          best_practices: { type: 'array', items: { type: 'string' } },
          recommended_kpis: { type: 'array', items: { type: 'string' } },
          implementation_plan: { type: 'array', items: { type: 'object', properties: { phase: { type: 'string' }, activities: { type: 'array', items: { type: 'string' } } } } },
          executive_summary: { type: 'string' },
        }
      }
    });
    setResult(res);
    setLoading(false);
  };

  const effortColor = { bajo: 'text-emerald-400', medio: 'text-yellow-400', alto: 'text-red-400' };

  return (
    <div className="space-y-6">
      {/* Cost overview chart con estilo dorado */}
      {chartData.length > 0 && (
        <div className="rounded-2xl p-5" style={{
          background: 'linear-gradient(135deg, rgba(197,160,89,0.06) 0%, rgba(197,160,89,0.02) 100%)',
          border: '1px solid rgba(197,160,89,0.15)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.3)'
        }}>
          <p className="text-sm font-semibold mb-4" style={{color: '#c5a059'}}>Distribución de Costos Operativos</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 14%)" />
              <XAxis type="number" tick={{ fill: 'hsl(0 0% 50%)', fontSize: 10 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="cat" tick={{ fill: 'hsl(0 0% 50%)', fontSize: 10 }} width={90} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="total" name="Gasto" fill="hsl(43 72% 53%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Process selector + analyze con estilo dorado */}
      <div className="rounded-2xl p-5" style={{
        background: 'linear-gradient(135deg, rgba(197,160,89,0.06) 0%, rgba(197,160,89,0.02) 100%)',
        border: '1px solid rgba(197,160,89,0.15)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.3)'
      }}>
        <p className="text-sm font-semibold mb-4 flex items-center gap-2" style={{color: '#c5a059'}}>
          <GitBranch className="w-4 h-4" /> Análisis de Proceso
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-48">
            <Label className="text-xs text-muted-foreground mb-1 block">Selecciona el proceso a analizar</Label>
            <Select value={selectedProcess} onValueChange={setSelectedProcess}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROCESSES.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.icon} {p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={analyze} disabled={loading || !company} className="gap-2" style={{
            background: 'linear-gradient(135deg, #f0d080 0%, #c5a059 100%)',
            color: '#050505',
            boxShadow: '0 2px 8px rgba(197,160,89,0.3)',
            opacity: !company ? 0.5 : 1
          }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" style={{color: '#050505'}} /> : <Sparkles className="w-4 h-4" style={{color: '#050505'}} />}
            {loading ? 'Analizando...' : (!company ? 'Selecciona empresa' : 'Analizar con IA')}
          </Button>
        </div>
      </div>

      {/* Results */}
      {loading && (
        <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-sm">Analizando proceso y generando recomendaciones...</span>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-4">
          {/* Summary */}
          {result.executive_summary && (
            <div className="p-4 rounded-2xl" style={{
              background: 'linear-gradient(135deg, rgba(197,160,89,0.12) 0%, rgba(197,160,89,0.05) 100%)',
              border: '1px solid rgba(197,160,89,0.25)',
              boxShadow: '0 2px 12px rgba(197,160,89,0.1)'
            }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{color: '#c5a059'}}>Resumen Ejecutivo</p>
              <p className="text-sm" style={{color: '#e8d5a3'}}>{result.executive_summary}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Inefficiencies */}
            {result.inefficiencies?.length > 0 && (
              <div className="rounded-2xl p-4" style={{
                background: 'linear-gradient(135deg, rgba(197,160,89,0.06) 0%, rgba(197,160,89,0.02) 100%)',
                border: '1px solid rgba(197,160,89,0.15)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.3)'
              }}>
                <p className="text-sm font-semibold flex items-center gap-2 mb-3" style={{color: '#c5a059'}}>
                  <AlertTriangle className="w-4 h-4" style={{color: '#f0d080'}} /> Ineficiencias Detectadas
                </p>
                <div className="space-y-3">
                  {result.inefficiencies.map((item, i) => (
                    <div key={i} className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                      {item.estimatedCost && <p className="text-xs text-yellow-400 mt-1">💰 {item.estimatedCost}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Savings */}
            {result.savings_opportunities?.length > 0 && (
              <div className="rounded-2xl p-4" style={{
                background: 'linear-gradient(135deg, rgba(197,160,89,0.06) 0%, rgba(197,160,89,0.02) 100%)',
                border: '1px solid rgba(197,160,89,0.15)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.3)'
              }}>
                <p className="text-sm font-semibold flex items-center gap-2 mb-3" style={{color: '#c5a059'}}>
                  <TrendingDown className="w-4 h-4" style={{color: '#c5a059'}} /> Oportunidades de Ahorro
                </p>
                <div className="space-y-3">
                  {result.savings_opportunities.map((item, i) => (
                    <div key={i} className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-foreground">{item.action}</p>
                        <span className={`text-xs shrink-0 ${effortColor[item.effort]}`}>Esfuerzo: {item.effort}</span>
                      </div>
                      <p className="text-xs text-emerald-400 mt-1">✅ {item.saving}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Best practices */}
          {result.best_practices?.length > 0 && (
            <div className="rounded-2xl p-4" style={{
              background: 'linear-gradient(135deg, rgba(197,160,89,0.06) 0%, rgba(197,160,89,0.02) 100%)',
              border: '1px solid rgba(197,160,89,0.15)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.3)'
            }}>
              <p className="text-sm font-semibold flex items-center gap-2 mb-3" style={{color: '#c5a059'}}>
                <CheckCircle2 className="w-4 h-4" style={{color: '#c5a059'}} /> Mejores Prácticas Recomendadas
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {result.best_practices.map((bp, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 bg-secondary/40 rounded-xl">
                    <span className="text-primary font-bold text-xs mt-0.5 shrink-0">{i + 1}.</span>
                    <p className="text-sm text-muted-foreground">{bp}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Implementation plan */}
          {result.implementation_plan?.length > 0 && (
            <div className="rounded-2xl p-4" style={{
              background: 'linear-gradient(135deg, rgba(197,160,89,0.06) 0%, rgba(197,160,89,0.02) 100%)',
              border: '1px solid rgba(197,160,89,0.15)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.3)'
            }}>
              <p className="text-sm font-semibold flex items-center gap-2 mb-3" style={{color: '#c5a059'}}>
                <Clock className="w-4 h-4" style={{color: '#c5a059'}} /> Plan de Implementación
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {result.implementation_plan.map((phase, i) => (
                  <div key={i} className="p-3 bg-secondary/40 rounded-xl">
                    <p className="text-xs font-semibold text-primary mb-2">{phase.phase}</p>
                    <ul className="space-y-1">
                      {(phase.activities || []).map((act, j) => (
                        <li key={j} className="text-xs text-muted-foreground flex items-start gap-1">
                          <span className="text-primary mt-0.5">•</span> {act}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended KPIs */}
          {result.recommended_kpis?.length > 0 && (
            <div className="rounded-2xl p-4" style={{
              background: 'linear-gradient(135deg, rgba(197,160,89,0.06) 0%, rgba(197,160,89,0.02) 100%)',
              border: '1px solid rgba(197,160,89,0.15)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.3)'
            }}>
              <p className="text-sm font-semibold mb-3" style={{color: '#c5a059'}}>📊 KPIs Recomendados para este Proceso</p>
              <div className="flex flex-wrap gap-2">
                {result.recommended_kpis.map((kpi, i) => (
                  <span key={i} className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs text-primary">{kpi}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Label({ className, children }) {
  return <label className={className}>{children}</label>;
}

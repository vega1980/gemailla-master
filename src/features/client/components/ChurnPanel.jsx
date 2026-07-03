import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Loader2, Sparkles, TrendingDown, UserCheck, UserX } from 'lucide-react';

import { askLLM } from '@modules/ai/services/aiService';
const fmt = (n) => `$${(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;

const riskConfig = {
  alto: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', bar: 'bg-red-500', badge: 'bg-red-500 text-white' },
  medio: { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', bar: 'bg-yellow-500', badge: 'bg-yellow-500 text-white' },
  bajo: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', bar: 'bg-emerald-500', badge: 'bg-emerald-500 text-white' },
};

export default function ChurnPanel({ subscriptions, transactions }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const activeCount = subscriptions.filter(s => s.status === 'active').length;
  const cancelledCount = subscriptions.filter(s => s.status === 'cancelled').length;
  const expiredCount = subscriptions.filter(s => s.status === 'expired').length;
  const totalSubs = subscriptions.length || 1;
  const churnRate = totalSubs > 0 ? (((cancelledCount + expiredCount) / totalSubs) * 100).toFixed(1) : 0;

  const analyzeChurn = async () => {
    setLoading(true);
    const clientData = subscriptions.map(s => ({
      user: s.userEmail?.split('@')[0] || 'cliente',
      plan: s.plan,
      status: s.status,
      billing: s.billingCycle,
      start: s.startDate,
      end: s.endDate,
    }));

    const res = await askLLM({
      companyId: company.id,
      prompt: `Eres un experto en retención de clientes y análisis de churn para SaaS/servicios de suscripción.

DATOS DE SUSCRIPCIONES:
- Total clientes: ${totalSubs}
- Activos: ${activeCount}
- Cancelados: ${cancelledCount}
- Expirados: ${expiredCount}
- Tasa de churn estimada: ${churnRate}%

DETALLE:
${JSON.stringify(clientData.slice(0, 15), null, 2)}

CONTEXTO FINANCIERO:
- Transacciones totales: ${transactions.length}
- Ingresos de suscripciones (estimado): ${fmt(transactions.filter(t => t.type === 'ingreso').reduce((s, t) => s + (t.amount || 0), 0))}

Analiza y devuelve:
1. Evaluación del riesgo de churn general
2. Segmentos de clientes con mayor riesgo (por plan, ciclo, estado)
3. Causas probables de cancelaciones
4. 5 estrategias concretas de retención con pasos específicos
5. KPI objetivo de churn para los próximos 3 meses

Incluye métricas estimadas y acciones accionables. Responde en español.`,
      response_json_schema: {
        type: 'object',
        properties: {
          churn_risk_level: { type: 'string', enum: ['alto', 'medio', 'bajo'] },
          churn_rate_estimated: { type: 'number' },
          high_risk_segments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                segment: { type: 'string' },
                risk: { type: 'string', enum: ['alto', 'medio', 'bajo'] },
                reason: { type: 'string' },
                recommendation: { type: 'string' },
              }
            }
          },
          retention_strategies: {
            type: 'array',
            items: { type: 'string' }
          },
          kpi_target: { type: 'string' },
          executive_summary: { type: 'string' },
        }
      }
    });
    setResult(res);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Clientes Activos', value: activeCount, icon: UserCheck, color: 'text-emerald-400' },
          { label: 'Cancelaciones', value: cancelledCount, icon: UserX, color: 'text-red-400' },
          { label: 'Expirados', value: expiredCount, icon: TrendingDown, color: 'text-yellow-400' },
          { label: 'Tasa de Churn', value: `${churnRate}%`, icon: Users, color: parseFloat(churnRate) > 10 ? 'text-red-400' : 'text-emerald-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
            <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Status Breakdown */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-sm font-semibold text-foreground mb-4">Distribución de Suscripciones</p>
        {[
          { label: 'Activos', count: activeCount, color: 'bg-emerald-500' },
          { label: 'Cancelados', count: cancelledCount, color: 'bg-red-500' },
          { label: 'Expirados', count: expiredCount, color: 'bg-yellow-500' },
        ].map(({ label, count, color }) => (
          <div key={label} className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">{label}</span>
              <span className="text-foreground font-medium">{count} ({totalSubs > 0 ? ((count / totalSubs) * 100).toFixed(0) : 0}%)</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div className={`h-full ${color} rounded-full`} style={{ width: `${totalSubs > 0 ? (count / totalSubs) * 100 : 0}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* AI Churn Analysis */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Análisis de Fuga de Clientes con IA
          </p>
          <Button size="sm" onClick={analyzeChurn} disabled={loading || subscriptions.length === 0} className="bg-primary text-primary-foreground gap-2">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {loading ? 'Analizando...' : result ? 'Re-analizar' : 'Analizar Churn'}
          </Button>
        </div>

        {subscriptions.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground">No hay datos de suscripciones para analizar.</p>
        )}
        {!result && !loading && subscriptions.length > 0 && (
          <p className="text-sm text-muted-foreground">Haz clic para que la IA analice el riesgo de fuga de clientes y genere estrategias de retención personalizadas.</p>
        )}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" /> Analizando patrones de churn...
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {/* Risk level */}
            {result.churn_risk_level && (
              <div className={`p-4 rounded-xl border ${riskConfig[result.churn_risk_level]?.bg || ''}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">Nivel de Riesgo de Churn</p>
                  <Badge className={riskConfig[result.churn_risk_level]?.badge || ''}>
                    {result.churn_risk_level?.toUpperCase()}
                  </Badge>
                </div>
                {result.executive_summary && <p className="text-sm text-muted-foreground mt-2">{result.executive_summary}</p>}
                {result.kpi_target && <p className="text-xs text-primary mt-2">🎯 Meta: {result.kpi_target}</p>}
              </div>
            )}

            {/* High risk segments */}
            {result.high_risk_segments?.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-foreground mb-3">Segmentos de Alto Riesgo</p>
                <div className="space-y-2">
                  {result.high_risk_segments.map((seg, i) => {
                    const cfg = riskConfig[seg.risk] || riskConfig.bajo;
                    return (
                      <div key={i} className={`p-3 rounded-xl border ${cfg.bg}`}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-foreground">{seg.segment}</p>
                          <Badge className={`${cfg.badge} text-xs`}>{seg.risk}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{seg.reason}</p>
                        {seg.recommendation && <p className="text-xs text-primary mt-1">→ {seg.recommendation}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Retention strategies */}
            {result.retention_strategies?.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-foreground mb-3">💡 Estrategias de Retención</p>
                <div className="space-y-2">
                  {result.retention_strategies.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 bg-secondary/40 rounded-xl">
                      <span className="text-primary font-bold text-xs shrink-0 mt-0.5">{i + 1}.</span>
                      <p className="text-sm text-muted-foreground">{s}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

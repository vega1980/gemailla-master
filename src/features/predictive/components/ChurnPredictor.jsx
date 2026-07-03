import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { UserX, Sparkles, Loader2, Shield, User } from 'lucide-react';

import { askLLM } from '@modules/ai/services/aiService';
const riskConfig = {
  alto: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', bar: 'bg-red-500', label: 'RIESGO ALTO' },
  medio: { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', bar: 'bg-yellow-500', label: 'RIESGO MEDIO' },
  bajo: { color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30', bar: 'bg-green-500', label: 'RIESGO BAJO' },
};

export default function ChurnPredictor({ subscriptions, transactions }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Build client summary from subscriptions + transactions
  const clientData = useMemo(() => {
    return subscriptions.map(sub => {
      const clientTx = transactions.filter(t => t.created_by === sub.userEmail || t.description?.includes(sub.userEmail));
      const totalSpent = clientTx.reduce((s, t) => s + (t.amount || 0), 0);
      const lastTx = clientTx.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      const daysSinceLastActivity = lastTx
        ? Math.round((Date.now() - new Date(lastTx.date)) / (1000 * 60 * 60 * 24))
        : null;
      const startDate = sub.startDate ? new Date(sub.startDate) : new Date(sub.createdAt);
      const monthsActive = Math.max(1, Math.round((Date.now() - startDate) / (1000 * 60 * 60 * 24 * 30)));
      return {
        email: sub.userEmail,
        plan: sub.plan,
        status: sub.status,
        billingCycle: sub.billingCycle,
        months_active: monthsActive,
        total_spent: totalSpent,
        last_activity_days: daysSinceLastActivity,
        transaction_count: clientTx.length,
      };
    });
  }, [subscriptions, transactions]);

  const runChurnAnalysis = async () => {
    if (loading) return;
    setLoading(true);

    const res = await askLLM({
      companyId: company.id,
      prompt: `Eres un experto en análisis de churn (fuga de clientes) para SaaS. Analiza los siguientes datos de suscriptores y predice cuáles están en riesgo de cancelar.

Datos de clientes/suscriptores:
${JSON.stringify(clientData.length > 0 ? clientData : [{ email: 'ejemplo@empresa.com', plan: 'basic', months_active: 8, total_spent: 0, last_activity_days: 45, transaction_count: 2 }], null, 2)}

Factores de churn a considerar:
- Días sin actividad (> 30 = riesgo)
- Meses activos con bajo engagement
- Transacciones muy bajas o nulas
- Plan básico con poca actividad (candidato a abandonar)
- Ciclo de facturación mensual = mayor riesgo vs anual

Para cada cliente, calcula:
- Probabilidad de churn (0-100%)
- Nivel de riesgo (alto/medio/bajo)
- Factores específicos que indican el riesgo
- Acción recomendada para retenerlos

Adicionalmente, genera 3 estrategias globales de retención.`,
      response_json_schema: {
        type: 'object',
        properties: {
          clients: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                email: { type: 'string' },
                plan: { type: 'string' },
                churn_probability: { type: 'number' },
                risk_level: { type: 'string', enum: ['alto', 'medio', 'bajo'] },
                risk_factors: { type: 'array', items: { type: 'string' } },
                recommended_action: { type: 'string' },
              }
            }
          },
          high_risk_count: { type: 'number' },
          overall_churn_rate: { type: 'number' },
          retention_strategies: { type: 'array', items: { type: 'string' } },
          executive_summary: { type: 'string' },
        }
      }
    });

    setResult(res);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Predicción de Fuga de Clientes (Churn)</h2>
            <p className="text-sm text-muted-foreground">Identifica qué clientes están a punto de cancelar antes de que suceda.</p>
          </div>
          <Button
            onClick={runChurnAnalysis}
            disabled={loading}
            className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Analizando...' : result ? 'Re-analizar' : 'Analizar Churn'}
          </Button>
        </div>

        {result && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-secondary/50 rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Clientes Analizados</p>
                <p className="text-3xl font-bold text-foreground">{result.clients?.length ?? 0}</p>
              </div>
              <div className="bg-secondary/50 rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Alto Riesgo</p>
                <p className="text-3xl font-bold text-red-400">{result.high_risk_count ?? 0}</p>
              </div>
              <div className="bg-secondary/50 rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Tasa Churn Estimada</p>
                <p className="text-3xl font-bold text-yellow-400">{result.overall_churn_rate?.toFixed(1)}%</p>
              </div>
            </div>

            {/* Summary */}
            {result.executive_summary && (
              <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-xl">
                <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">Resumen Ejecutivo</p>
                <p className="text-sm text-foreground">{result.executive_summary}</p>
              </div>
            )}

            {/* Client list */}
            {result.clients?.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-foreground mb-3">Clientes por Riesgo de Fuga</h3>
                <div className="space-y-3">
                  {result.clients.sort((a, b) => b.churn_probability - a.churn_probability).map((client, i) => {
                    const cfg = riskConfig[client.risk_level] || riskConfig.bajo;
                    return (
                      <div key={i} className={`rounded-xl border p-4 ${cfg.bg}`}>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-background/50 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                              <div>
                                <p className="text-sm font-medium text-foreground truncate">{client.email}</p>
                                <p className="text-xs text-muted-foreground capitalize">Plan {client.plan}</p>
                              </div>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-background/50 ${cfg.color}`}>
                                {cfg.label}
                              </span>
                            </div>

                            {/* Churn probability bar */}
                            <div className="mb-2">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-muted-foreground">Probabilidad de fuga</span>
                                <span className={`font-bold ${cfg.color}`}>{client.churn_probability?.toFixed(0)}%</span>
                              </div>
                              <div className="w-full bg-background/50 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${cfg.bar}`}
                                  style={{ width: `${Math.min(100, client.churn_probability || 0)}%` }}
                                />
                              </div>
                            </div>

                            {client.risk_factors?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {client.risk_factors.map((f, j) => (
                                  <span key={j} className="text-xs bg-background/40 text-muted-foreground px-2 py-0.5 rounded-full">{f}</span>
                                ))}
                              </div>
                            )}

                            <p className="text-xs text-primary/80 bg-primary/5 rounded-lg px-3 py-1.5">
                              💡 {client.recommended_action}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Retention strategies */}
            {result.retention_strategies?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Estrategias de Retención Recomendadas</h3>
                <div className="space-y-2">
                  {result.retention_strategies.map((s, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-secondary/40 rounded-xl">
                      <Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <p className="text-sm text-foreground">{s}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!result && !loading && (
          <div className="py-12 text-center">
            <UserX className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground">Analiza el riesgo de fuga de tus clientes con IA.</p>
            {subscriptions.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">El análisis usará datos de suscripciones registradas en el sistema.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Sparkles, Loader2, CheckCircle, Info } from 'lucide-react';

import { askLLM } from '@modules/ai/services/aiService';
const severityConfig = {
  alta: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', icon: AlertTriangle, dot: '#ef4444' },
  media: { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', icon: Info, dot: '#eab308' },
  baja: { color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30', icon: Info, dot: '#3b82f6' },
};

export default function AnomalyDetector({ transactions, monthlyData }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const runDetection = async () => {
    if (!transactions.length || loading) return;
    setLoading(true);

    const sample = transactions.slice(-100).map(t => ({
      date: t.date,
      type: t.type,
      category: t.category,
      amount: t.amount,
    }));

    const monthlySummary = monthlyData.map(d => ({
      month: d.month,
      ingresos: d.ingresos,
      gastos: d.gastos,
      balance: d.ingresos - d.gastos,
    }));

    const res = await askLLM({
      companyId: company.id,
      prompt: `Eres un experto en detección de anomalías financieras. Analiza las transacciones y datos mensuales y encuentra desviaciones estadísticas importantes.

Transacciones recientes (muestra):
${JSON.stringify(sample, null, 2)}

Resumen mensual:
${JSON.stringify(monthlySummary, null, 2)}

Detecta:
1. Transacciones individuales que sean outliers (muy por encima o por debajo del promedio de su categoría)
2. Meses con variación inusual en ingresos o gastos (más del 30% de desviación del promedio)
3. Patrones irregulares (gastos duplicados sospechosos, días con muchas transacciones, etc.)

Para cada anomalía, indica: descripción, tipo, monto involucrado, fecha/periodo, severidad (alta/media/baja) y recomendación de acción.`,
      response_json_schema: {
        type: 'object',
        properties: {
          anomalies: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                type: { type: 'string' },
                amount: { type: 'number' },
                period: { type: 'string' },
                severity: { type: 'string', enum: ['alta', 'media', 'baja'] },
                recommendation: { type: 'string' },
              }
            }
          },
          health_score: { type: 'number' },
          summary: { type: 'string' },
          total_anomalies_found: { type: 'number' },
        }
      }
    });

    setResult(res);
    setLoading(false);
  };

  const healthColor = result ? (result.health_score >= 80 ? 'text-green-400' : result.health_score >= 60 ? 'text-yellow-400' : 'text-red-400') : '';

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Detección de Anomalías</h2>
            <p className="text-sm text-muted-foreground">Identifica desviaciones estadísticas y patrones irregulares en tus finanzas.</p>
          </div>
          <Button
            onClick={runDetection}
            disabled={loading || transactions.length === 0}
            className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Analizando...' : result ? 'Re-analizar' : 'Detectar Anomalías'}
          </Button>
        </div>

        {result && (
          <>
            {/* Health score */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-secondary/50 rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Salud Financiera</p>
                <p className={`text-3xl font-bold ${healthColor}`}>{result.health_score}<span className="text-sm font-normal">/100</span></p>
              </div>
              <div className="bg-secondary/50 rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Anomalías Detectadas</p>
                <p className="text-3xl font-bold text-foreground">{result.total_anomalies_found ?? result.anomalies?.length ?? 0}</p>
              </div>
              <div className="bg-secondary/50 rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Alta Severidad</p>
                <p className="text-3xl font-bold text-red-400">{result.anomalies?.filter(a => a.severity === 'alta').length ?? 0}</p>
              </div>
            </div>

            {/* Summary */}
            {result.summary && (
              <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-xl">
                <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">Resumen IA</p>
                <p className="text-sm text-foreground">{result.summary}</p>
              </div>
            )}

            {/* Anomaly list */}
            {result.anomalies?.length > 0 ? (
              <div className="space-y-3">
                {result.anomalies.map((a, i) => {
                  const cfg = severityConfig[a.severity] || severityConfig.baja;
                  const Icon = cfg.icon;
                  return (
                    <div key={i} className={`rounded-xl border p-4 ${cfg.bg}`}>
                      <div className="flex items-start gap-3">
                        <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${cfg.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                            <p className="text-sm font-semibold text-foreground">{a.title}</p>
                            <div className="flex items-center gap-2">
                              {a.period && <span className="text-xs text-muted-foreground">{a.period}</span>}
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-background/50 ${cfg.color}`}>
                                {a.severity?.toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{a.description}</p>
                          {a.amount > 0 && <p className="text-xs text-foreground mb-2">Monto: <strong>${a.amount.toLocaleString()}</strong></p>}
                          <p className="text-xs text-primary/80 bg-primary/5 rounded-lg px-3 py-1.5">
                            💡 {a.recommendation}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-3 p-6 bg-green-500/10 border border-green-500/30 rounded-xl">
                <CheckCircle className="w-6 h-6 text-green-400" />
                <div>
                  <p className="text-sm font-semibold text-green-400">Sin anomalías detectadas</p>
                  <p className="text-xs text-muted-foreground">Tus finanzas muestran un comportamiento normal y predecible.</p>
                </div>
              </div>
            )}
          </>
        )}

        {!result && !loading && (
          <div className="py-12 text-center">
            <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground">Haz clic en "Detectar Anomalías" para analizar tus datos con IA.</p>
          </div>
        )}
      </div>
    </div>
  );
}

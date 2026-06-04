import React, { useState } from 'react';
import { firebase } from '@/api/firebaseClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, Loader2, Brain, AlertTriangle, CheckCircle2, TrendingDown, Scale, RefreshCw } from 'lucide-react';

const RISK_COLORS = {
  alto: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', badge: 'bg-red-500/20 text-red-400 border-red-500/30' },
  medio: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  bajo: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
};

const RISK_ICONS = { alto: AlertTriangle, medio: TrendingDown, bajo: CheckCircle2 };

export default function RiskManagement({ transactions, monthlyData, company }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const analyzeRisks = async () => {
    setLoading(true);
    setResult(null);

    const totalIngresos = transactions.filter(t => t.type === 'ingreso').reduce((s, t) => s + (t.amount || 0), 0);
    const totalGastos = transactions.filter(t => t.type === 'gasto').reduce((s, t) => s + (t.amount || 0), 0);
    const balance = totalIngresos - totalGastos;
    const margen = totalIngresos > 0 ? ((balance / totalIngresos) * 100).toFixed(1) : 0;

    const catGastos = {};
    transactions.filter(t => t.type === 'gasto').forEach(t => {
      catGastos[t.category] = (catGastos[t.category] || 0) + (t.amount || 0);
    });

    const lastMonths = monthlyData.slice(-3);
    const trendIngresos = lastMonths.length >= 2
      ? ((lastMonths[lastMonths.length - 1].ingresos - lastMonths[0].ingresos) / (lastMonths[0].ingresos || 1) * 100).toFixed(1)
      : 0;

    const prompt = `Eres un experto en gestión de riesgos financieros y cumplimiento normativo para empresas mexicanas (SAT, IMSS, INFONAVIT, Ley General de Sociedades Mercantiles).

Analiza los siguientes datos financieros de la empresa "${company?.name}" y genera un análisis completo de riesgos:

DATOS FINANCIEROS:
- Ingresos totales: $${totalIngresos.toLocaleString()} MXN
- Gastos totales: $${totalGastos.toLocaleString()} MXN  
- Balance neto: $${balance.toLocaleString()} MXN
- Margen operativo: ${margen}%
- Tendencia ingresos últimos 3 meses: ${trendIngresos}%
- Top categorías de gasto: ${Object.entries(catGastos).sort((a,b) => b[1]-a[1]).slice(0,5).map(([k,v]) => `${k}: $${v.toLocaleString()}`).join(', ')}
- Meses con flujo negativo: ${monthlyData.filter(m => m.ingresos - m.gastos < 0).length} de ${monthlyData.length}

Responde ÚNICAMENTE con un JSON con esta estructura exacta:
{
  "resumen_ejecutivo": "párrafo de 2-3 oraciones con el estado general de riesgo",
  "nivel_riesgo_global": "alto|medio|bajo",
  "riesgos": [
    {
      "categoria": "Liquidez|Fiscal|Cumplimiento|Operacional|Concentración|Tendencia",
      "titulo": "...",
      "descripcion": "...",
      "nivel": "alto|medio|bajo",
      "impacto": "...",
      "mitigacion": "acción concreta recomendada"
    }
  ],
  "acciones_inmediatas": ["acción 1", "acción 2", "acción 3"],
  "cumplimiento_normativo": {
    "sat": "observación sobre obligaciones SAT",
    "imss": "observación sobre obligaciones IMSS/INFONAVIT",
    "general": "observación general de cumplimiento"
  }
}`;

    const data = await firebase.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          resumen_ejecutivo: { type: 'string' },
          nivel_riesgo_global: { type: 'string' },
          riesgos: { type: 'array', items: { type: 'object' } },
          acciones_inmediatas: { type: 'array', items: { type: 'string' } },
          cumplimiento_normativo: { type: 'object' },
        }
      }
    });
    setResult(data);
    setLoading(false);
  };

  const globalColors = result ? RISK_COLORS[result.nivel_riesgo_global] || RISK_COLORS.medio : null;

  return (
    <div className="space-y-6">
      {/* CTA */}
      {!result && !loading && (
        <div className="text-center py-16 border border-dashed border-border rounded-2xl bg-secondary/20">
          <ShieldAlert className="w-12 h-12 text-primary mx-auto mb-4 opacity-70" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Análisis de Riesgos con IA</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            La IA analizará tus datos financieros para detectar amenazas de liquidez, riesgos fiscales, cumplimiento normativo (SAT, IMSS) y más.
          </p>
          <Button onClick={analyzeRisks} className="bg-primary text-primary-foreground gap-2">
            <Brain className="w-4 h-4" /> Analizar Riesgos Ahora
          </Button>
        </div>
      )}

      {loading && (
        <div className="text-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Analizando riesgos financieros y normativos...</p>
        </div>
      )}

      {result && (
        <div className="space-y-5">
          {/* Refresh */}
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={analyzeRisks} className="gap-2 border-border">
              <RefreshCw className="w-3.5 h-3.5" /> Re-analizar
            </Button>
          </div>

          {/* Nivel global */}
          <div className={`p-5 rounded-2xl border ${globalColors?.bg} ${globalColors?.border}`}>
            <div className="flex items-center gap-3 mb-2">
              <ShieldAlert className={`w-6 h-6 ${globalColors?.text}`} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nivel de Riesgo Global</p>
                <div className="flex items-center gap-2">
                  <span className={`text-xl font-bold capitalize ${globalColors?.text}`}>{result.nivel_riesgo_global}</span>
                  <Badge className={`${globalColors?.badge} border text-xs`}>{result.riesgos?.length || 0} riesgos identificados</Badge>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{result.resumen_ejecutivo}</p>
          </div>

          {/* Riesgos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.riesgos?.map((r, i) => {
              const colors = RISK_COLORS[r.nivel] || RISK_COLORS.medio;
              const Icon = RISK_ICONS[r.nivel] || AlertTriangle;
              return (
                <div key={i} className={`p-4 rounded-xl border ${colors.bg} ${colors.border}`}>
                  <div className="flex items-start gap-3">
                    <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${colors.text}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{r.titulo}</span>
                        <Badge className={`${colors.badge} border text-xs capitalize`}>{r.nivel}</Badge>
                        <span className="text-xs text-muted-foreground">{r.categoria}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{r.descripcion}</p>
                      <div className="bg-background/50 rounded-lg p-2.5">
                        <p className="text-xs font-medium text-foreground mb-0.5">Impacto:</p>
                        <p className="text-xs text-muted-foreground">{r.impacto}</p>
                        <p className="text-xs font-medium text-primary mt-2 mb-0.5">Mitigación:</p>
                        <p className="text-xs text-muted-foreground">{r.mitigacion}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Acciones inmediatas */}
          {result.acciones_inmediatas?.length > 0 && (
            <div className="p-5 bg-primary/5 border border-primary/20 rounded-2xl">
              <p className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Acciones Inmediatas Recomendadas
              </p>
              <ol className="space-y-2">
                {result.acciones_inmediatas.map((a, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    {a}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Cumplimiento normativo */}
          {result.cumplimiento_normativo && (
            <div className="p-5 bg-card border border-border rounded-2xl">
              <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Scale className="w-4 h-4 text-primary" /> Cumplimiento Normativo
              </p>
              <div className="space-y-3">
                {Object.entries(result.cumplimiento_normativo).map(([k, v]) => (
                  <div key={k}>
                    <span className="text-xs font-semibold uppercase tracking-wide text-primary">{k.toUpperCase()}</span>
                    <p className="text-sm text-muted-foreground mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
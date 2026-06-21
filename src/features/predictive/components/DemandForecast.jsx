import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, addMonths, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

import { askLLM } from '@/modules/ai/aiService';
const trendIcon = { positiva: TrendingUp, negativa: TrendingDown, estable: Minus };
const trendColor = { positiva: 'text-green-400', negativa: 'text-red-400', estable: 'text-yellow-400' };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-xl text-xs space-y-1">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: ${Number(p.value).toLocaleString()}</p>
      ))}
    </div>
  );
};

export default function DemandForecast({ transactions, monthlyData }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const runForecast = async () => {
    if (!transactions.length || loading) return;
    setLoading(true);
    const monthlySummary = monthlyData.map(d => ({ month: d.month, ingresos: d.ingresos, gastos: d.gastos }));
    const next6 = [1, 2, 3, 4, 5, 6].map(i => format(addMonths(startOfMonth(new Date()), i), 'MMM yy', { locale: es }));

    const res = await askLLM({
      companyId: company.id,
      prompt: `Eres un experto en forecasting de ventas. Analiza los datos históricos mensuales y genera un pronóstico para los próximos 6 meses.

Datos históricos (${monthlySummary.length} meses):
${JSON.stringify(monthlySummary, null, 2)}

Meses a predecir: ${next6.join(', ')}

Instrucciones:
- Detecta tendencia, estacionalidad y ciclos.
- Genera predicciones realistas con intervalos de confianza (optimista y pesimista).
- Calcula tasa de crecimiento promedio mensual.
- Identifica el mes pico y el mes valle del pronóstico.
- Escribe un insight ejecutivo de 2 oraciones.`,
      response_json_schema: {
        type: 'object',
        properties: {
          predictions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                month: { type: 'string' },
                ingresos_pred: { type: 'number' },
                gastos_pred: { type: 'number' },
                ingresos_optimista: { type: 'number' },
                ingresos_pesimista: { type: 'number' },
                confidence: { type: 'number' },
              }
            }
          },
          trend: { type: 'string', enum: ['positiva', 'negativa', 'estable'] },
          growth_rate: { type: 'number' },
          peak_month: { type: 'string' },
          valley_month: { type: 'string' },
          insight: { type: 'string' },
        }
      }
    });

    const mapped = (res.predictions || []).map((p, i) => ({
      month: next6[i] || p.month,
      ingresos_pred: Math.round(p.ingresos_pred || 0),
      gastos_pred: Math.round(p.gastos_pred || 0),
      ingresos_optimista: Math.round(p.ingresos_optimista || 0),
      ingresos_pesimista: Math.round(p.ingresos_pesimista || 0),
      confidence: p.confidence,
      isPrediction: true,
    }));
    setResult({ ...res, predictions: mapped });
    setLoading(false);
  };

  const chartData = [
    ...monthlyData.slice(-6).map(d => ({ ...d, tipo: 'histórico' })),
    ...(result?.predictions || []),
  ];

  const TrendIcon = result ? (trendIcon[result.trend] || Minus) : null;

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Pronóstico de Demanda / Ventas</h2>
            <p className="text-sm text-muted-foreground">Proyección IA de ingresos y gastos para los próximos 6 meses.</p>
          </div>
          <Button
            onClick={runForecast}
            disabled={loading || transactions.length === 0}
            className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Analizando...' : result ? 'Actualizar Pronóstico' : 'Generar Pronóstico'}
          </Button>
        </div>

        {result && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-secondary/50 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">Tendencia</p>
              <div className="flex items-center gap-1">
                {TrendIcon && <TrendIcon className={`w-4 h-4 ${trendColor[result.trend]}`} />}
                <span className={`text-sm font-semibold capitalize ${trendColor[result.trend]}`}>{result.trend}</span>
              </div>
            </div>
            <div className="bg-secondary/50 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">Crecimiento Mensual</p>
              <p className="text-sm font-semibold text-foreground">{result.growth_rate > 0 ? '+' : ''}{result.growth_rate?.toFixed(1)}%</p>
            </div>
            <div className="bg-secondary/50 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">Mes Pico</p>
              <p className="text-sm font-semibold text-green-400">{result.peak_month}</p>
            </div>
            <div className="bg-secondary/50 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">Mes Valle</p>
              <p className="text-sm font-semibold text-red-400">{result.valley_month}</p>
            </div>
          </div>
        )}

        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 14%)" />
            <XAxis dataKey="month" tick={{ fill: 'hsl(0 0% 50%)', fontSize: 11 }} />
            <YAxis tick={{ fill: 'hsl(0 0% 50%)', fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {chartData.findIndex(d => d.tipo === 'histórico') !== -1 && (
              <ReferenceLine x={chartData.filter(d => d.tipo === 'histórico').at(-1)?.month} stroke="hsl(43 72% 53%)" strokeDasharray="4 4" label={{ value: 'Hoy', fill: 'hsl(43 72% 53%)', fontSize: 10 }} />
            )}
            <Bar dataKey="ingresos" name="Ingresos Históricos" fill="hsl(160 60% 45%)" fillOpacity={0.8} radius={[4,4,0,0]} />
            <Bar dataKey="gastos" name="Gastos Históricos" fill="hsl(0 72% 50%)" fillOpacity={0.8} radius={[4,4,0,0]} />
            <Line dataKey="ingresos_pred" name="Ingresos Proyectados" stroke="hsl(43 72% 53%)" strokeWidth={2.5} strokeDasharray="6 3" dot={{ fill: 'hsl(43 72% 53%)', r: 4 }} />
            <Line dataKey="ingresos_optimista" name="Escenario Optimista" stroke="hsl(160 60% 45%)" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
            <Line dataKey="ingresos_pesimista" name="Escenario Pesimista" stroke="hsl(0 72% 50%)" strokeWidth={1.5} strokeDasharray="3 3" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>

        {result?.insight && (
          <div className="mt-4 p-4 bg-primary/10 border border-primary/20 rounded-xl">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">Insight IA</p>
            <p className="text-sm text-foreground">{result.insight}</p>
          </div>
        )}

        {!result && transactions.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">Agrega transacciones para generar el pronóstico.</p>
        )}
      </div>
    </div>
  );
}

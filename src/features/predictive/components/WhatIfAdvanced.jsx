import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Sparkles, Loader2, FlaskConical, RefreshCw, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { askLLM } from '@modules/ai/services/aiService';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts';
import { format, addMonths, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

const variables = [
  { key: 'precio', label: 'Precio de Venta', emoji: '💰', min: -30, max: 50, unit: '%', defaultVal: 0 },
  { key: 'volumen', label: 'Volumen de Ventas', emoji: '📦', min: -30, max: 50, unit: '%', defaultVal: 0 },
  { key: 'costos', label: 'Costos Operativos', emoji: '⚙️', min: -20, max: 40, unit: '%', defaultVal: 0 },
  { key: 'nuevos_clientes', label: 'Nuevos Clientes/Mes', emoji: '👥', min: -50, max: 100, unit: '%', defaultVal: 0 },
  { key: 'retencion', label: 'Tasa de Retención', emoji: '🔄', min: -20, max: 20, unit: '%', defaultVal: 0 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-xl text-xs space-y-1">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: ${Number(p.value || 0).toLocaleString()}</p>
      ))}
    </div>
  );
};

export default function WhatIfAdvanced({ transactions, monthlyData }) {
  const [vars, setVars] = useState(() => Object.fromEntries(variables.map(v => [v.key, v.defaultVal])));
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const hasChanges = useMemo(() => variables.some(v => vars[v.key] !== 0), [vars]);

  const avgIngresos = useMemo(() => {
    const months = monthlyData.filter(d => d.ingresos > 0);
    return months.length ? months.reduce((s, d) => s + d.ingresos, 0) / months.length : 0;
  }, [monthlyData]);

  const avgGastos = useMemo(() => {
    const months = monthlyData.filter(d => d.gastos > 0);
    return months.length ? months.reduce((s, d) => s + d.gastos, 0) / months.length : 0;
  }, [monthlyData]);

  const runSimulation = async () => {
    if (!hasChanges || loading) return;
    setLoading(true);

    const variableDescriptions = variables.map(v => `${v.label}: ${vars[v.key] > 0 ? '+' : ''}${vars[v.key]}%`).join(', ');
    const next6 = [1, 2, 3, 4, 5, 6].map(i => format(addMonths(startOfMonth(new Date()), i), 'MMM yy', { locale: es }));

    const res = await askLLM({
      companyId: company.id,
      prompt: `Eres un consultor financiero experto en simulación de escenarios de negocio. 

Datos base actuales:
- Ingresos promedio mensual: $${Math.round(avgIngresos).toLocaleString()}
- Gastos promedio mensual: $${Math.round(avgGastos).toLocaleString()}
- Utilidad neta promedio: $${Math.round(avgIngresos - avgGastos).toLocaleString()}
- Margen neto: ${avgIngresos > 0 ? ((avgIngresos - avgGastos) / avgIngresos * 100).toFixed(1) : 0}%

Cambios propuestos por el usuario:
${variableDescriptions}

Meses a proyectar: ${next6.join(', ')}

Simula el impacto de TODOS los cambios combinados y genera:
1. Proyección mensual de ingresos y gastos simulados para los 6 meses.
2. Comparativa con la línea base (sin cambios).
3. Impacto total en utilidad neta (absoluto y porcentual).
4. Punto de equilibrio si aplica.
5. Riesgos y oportunidades clave de este escenario.
6. Recomendación ejecutiva: ¿Vale la pena implementar estos cambios?

Sé específico con los números. Si hay efectos secundarios (ej. subir precio puede bajar volumen), califícalos.`,
      response_json_schema: {
        type: 'object',
        properties: {
          projections: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                month: { type: 'string' },
                ingresos_base: { type: 'number' },
                gastos_base: { type: 'number' },
                ingresos_simulado: { type: 'number' },
                gastos_simulado: { type: 'number' },
              }
            }
          },
          total_impact_amount: { type: 'number' },
          total_impact_percent: { type: 'number' },
          breakeven_month: { type: 'string' },
          risks: { type: 'array', items: { type: 'string' } },
          opportunities: { type: 'array', items: { type: 'string' } },
          recommendation: { type: 'string' },
          verdict: { type: 'string', enum: ['positivo', 'negativo', 'neutral'] },
        }
      }
    });

    const mapped = (res.projections || []).map((p, i) => ({
      month: next6[i] || p.month,
      ingresos_base: Math.round(p.ingresos_base || avgIngresos),
      gastos_base: Math.round(p.gastos_base || avgGastos),
      ingresos_simulado: Math.round(p.ingresos_simulado || 0),
      gastos_simulado: Math.round(p.gastos_simulado || 0),
      utilidad_base: Math.round((p.ingresos_base || avgIngresos) - (p.gastos_base || avgGastos)),
      utilidad_simulado: Math.round((p.ingresos_simulado || 0) - (p.gastos_simulado || 0)),
    }));
    setResult({ ...res, projections: mapped });
    setLoading(false);
  };

  const verdictConfig = {
    positivo: { color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30', icon: TrendingUp },
    negativo: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', icon: TrendingDown },
    neutral: { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', icon: DollarSign },
  };
  const verdictCfg = result ? (verdictConfig[result.verdict] || verdictConfig.neutral) : null;

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Simulador de Escenarios What-If</h2>
            <p className="text-sm text-muted-foreground">Ajusta variables de negocio y predice el impacto en tu utilidad con IA.</p>
          </div>
          <FlaskConical className="w-6 h-6 text-primary shrink-0 mt-1" />
        </div>

        {/* Variable sliders */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          {variables.map(v => (
            <div key={v.key} className="bg-secondary/40 rounded-xl p-4">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{v.emoji}</span>
                  <span className="text-sm font-medium text-foreground">{v.label}</span>
                </div>
                <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${vars[v.key] > 0 ? 'text-green-400 bg-green-500/10' : vars[v.key] < 0 ? 'text-red-400 bg-red-500/10' : 'text-muted-foreground bg-secondary'}`}>
                  {vars[v.key] > 0 ? '+' : ''}{vars[v.key]}{v.unit}
                </span>
              </div>
              <Slider
                min={v.min}
                max={v.max}
                step={1}
                value={[vars[v.key]]}
                onValueChange={([val]) => {
                  setVars(prev => ({ ...prev, [v.key]: val }));
                  setResult(null);
                }}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                <span>{v.min}%</span>
                <span>0%</span>
                <span>+{v.max}%</span>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mb-6">
          <Button
            onClick={runSimulation}
            disabled={loading || !hasChanges || transactions.length === 0}
            className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 flex-1"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Simulando...' : 'Simular Escenario'}
          </Button>
          <Button
            variant="outline"
            onClick={() => { setVars(Object.fromEntries(variables.map(v => [v.key, 0]))); setResult(null); }}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Reiniciar
          </Button>
        </div>

        {/* Results */}
        {result && (
          <>
            {/* Verdict */}
            {verdictCfg && (
              <div className={`rounded-xl border p-4 mb-6 ${verdictCfg.bg}`}>
                <div className="flex items-start gap-3">
                  <verdictCfg.icon className={`w-5 h-5 mt-0.5 ${verdictCfg.color}`} />
                  <div>
                    <p className={`text-sm font-semibold mb-1 ${verdictCfg.color}`}>
                      Escenario {result.verdict?.charAt(0).toUpperCase() + result.verdict?.slice(1)} —
                      Impacto: {result.total_impact_amount >= 0 ? '+' : ''}${Math.round(result.total_impact_amount || 0).toLocaleString()} ({result.total_impact_percent >= 0 ? '+' : ''}{result.total_impact_percent?.toFixed(1)}%)
                    </p>
                    <p className="text-sm text-foreground">{result.recommendation}</p>
                    {result.breakeven_month && (
                      <p className="text-xs text-muted-foreground mt-1">📍 Punto de equilibrio estimado: <strong>{result.breakeven_month}</strong></p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Chart */}
            {result.projections?.length > 0 && (
              <div className="mb-6">
                <p className="text-sm font-medium text-foreground mb-3">Proyección: Base vs Simulado</p>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={result.projections}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 14%)" />
                    <XAxis dataKey="month" tick={{ fill: 'hsl(0 0% 50%)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'hsl(0 0% 50%)', fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="ingresos_base" name="Ingresos Base" fill="hsl(0 0% 25%)" radius={[3,3,0,0]} />
                    <Bar dataKey="ingresos_simulado" name="Ingresos Simulados" fill="hsl(43 72% 53%)" radius={[3,3,0,0]} />
                    <Line dataKey="utilidad_base" name="Utilidad Base" stroke="hsl(160 60% 45%)" strokeWidth={2} dot={false} strokeDasharray="4 3" />
                    <Line dataKey="utilidad_simulado" name="Utilidad Simulada" stroke="hsl(43 72% 70%)" strokeWidth={2.5} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Risks & Opportunities */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {result.risks?.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-red-400 mb-2">⚠️ Riesgos</p>
                  <div className="space-y-1.5">
                    {result.risks.map((r, i) => (
                      <p key={i} className="text-xs text-muted-foreground bg-secondary/40 rounded-lg px-3 py-2">{r}</p>
                    ))}
                  </div>
                </div>
              )}
              {result.opportunities?.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-green-400 mb-2">✅ Oportunidades</p>
                  <div className="space-y-1.5">
                    {result.opportunities.map((o, i) => (
                      <p key={i} className="text-xs text-muted-foreground bg-secondary/40 rounded-lg px-3 py-2">{o}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {!result && !loading && !hasChanges && (
          <div className="py-8 text-center">
            <FlaskConical className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground">Ajusta las variables con los sliders para simular un escenario.</p>
          </div>
        )}
      </div>
    </div>
  );
}

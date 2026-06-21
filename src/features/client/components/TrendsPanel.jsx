import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { askLLM } from '@/modules/ai/aiService';
import { AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import ReactMarkdown from 'react-markdown';

const fmt = (n) => `$${(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-xl p-3 text-xs shadow-xl">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>)}
    </div>
  );
};

export default function TrendsPanel({ transactions, monthlyData, company }) {
  const [aiInsight, setAiInsight] = useState(null);
  const [loading, setLoading] = useState(false);

  const last3 = monthlyData.slice(-3);
  const prev3 = monthlyData.slice(-6, -3);
  const last3Inc = last3.reduce((s, m) => s + m.ingresos, 0);
  const prev3Inc = prev3.reduce((s, m) => s + m.ingresos, 0);
  const last3Exp = last3.reduce((s, m) => s + m.gastos, 0);
  const prev3Exp = prev3.reduce((s, m) => s + m.gastos, 0);
  const incTrend = prev3Inc > 0 ? ((last3Inc - prev3Inc) / prev3Inc * 100).toFixed(1) : 0;
  const expTrend = prev3Exp > 0 ? ((last3Exp - prev3Exp) / prev3Exp * 100).toFixed(1) : 0;
  const margin = last3Inc > 0 ? (((last3Inc - last3Exp) / last3Inc) * 100).toFixed(1) : 0;

  // Category breakdown
  const catSpend = {};
  transactions.filter(t => t.type === 'gasto').forEach(t => {
    catSpend[t.category] = (catSpend[t.category] || 0) + (t.amount || 0);
  });
  const topCats = Object.entries(catSpend).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cat, amt]) => ({ cat, amt }));
  const totalSpend = topCats.reduce((s, c) => s + c.amt, 0);

  const getAIStrategicInsight = async () => {
    setLoading(true);
    setAiInsight(null);
    const res = await askLLM({
      companyId: company.id,
      prompt: `Eres un consultor financiero experto en PyMEs mexicanas. Analiza las siguientes tendencias financieras de la empresa "${company.name}" y proporciona recomendaciones estratégicas.

TENDENCIAS (últimos 3 meses vs 3 meses anteriores):
- Ingresos: ${fmt(last3Inc)} (${incTrend > 0 ? '+' : ''}${incTrend}% vs período anterior)
- Gastos: ${fmt(last3Exp)} (${expTrend > 0 ? '+' : ''}${expTrend}% vs período anterior)
- Margen neto: ${margin}%

TOP CATEGORÍAS DE GASTO:
${topCats.map(c => `- ${c.cat}: ${fmt(c.amt)}`).join('\n')}

DATOS MENSUALES (12 meses):
${monthlyData.map(m => `${m.month}: Ingresos ${fmt(m.ingresos)}, Gastos ${fmt(m.gastos)}`).join('\n')}

Proporciona:
1. ✅ 2 puntos positivos del negocio
2. ⚠️ 2 alertas o riesgos a vigilar
3. 💡 3 recomendaciones estratégicas concretas con pasos accionables
4. 📊 Una proyección cualitativa para el próximo trimestre

Responde en español, de forma concisa y profesional.`,
    });
    setAiInsight(res);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Ingresos (3M)', value: fmt(last3Inc), trend: incTrend, up: incTrend >= 0 },
          { label: 'Gastos (3M)', value: fmt(last3Exp), trend: expTrend, up: expTrend <= 0 },
          { label: 'Margen Neto', value: `${margin}%`, trend: null },
          { label: 'Balance Neto', value: fmt(last3Inc - last3Exp), trend: null, up: (last3Inc - last3Exp) >= 0 },
        ].map(({ label, value, trend, up }) => (
          <div key={label} className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-xl font-bold font-mono ${up === false ? 'text-red-400' : up === true ? 'text-emerald-400' : 'text-foreground'}`}>{value}</p>
            {trend !== null && (
              <div className={`flex items-center gap-1 mt-1 text-xs ${parseFloat(trend) >= 0 ? (up ? 'text-emerald-400' : 'text-red-400') : (up ? 'text-emerald-400' : 'text-red-400')}`}>
                {parseFloat(trend) >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {trend > 0 ? '+' : ''}{trend}% vs período anterior
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Income vs Expense Chart */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-sm font-semibold text-foreground mb-4">Tendencia de Ingresos vs. Gastos (12 meses)</p>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={monthlyData}>
            <defs>
              <linearGradient id="gradInc" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradExp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 14%)" />
            <XAxis dataKey="month" tick={{ fill: 'hsl(0 0% 50%)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'hsl(0 0% 50%)', fontSize: 10 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#10b981" fill="url(#gradInc)" strokeWidth={2} />
            <Area type="monotone" dataKey="gastos" name="Gastos" stroke="#ef4444" fill="url(#gradExp)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Top Categories */}
      {topCats.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-sm font-semibold text-foreground mb-4">Top Categorías de Gasto</p>
          <div className="space-y-3">
            {topCats.map(({ cat, amt }) => (
              <div key={cat}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground capitalize">{cat}</span>
                  <span className="text-foreground font-medium">{fmt(amt)} ({totalSpend > 0 ? ((amt / totalSpend) * 100).toFixed(1) : 0}%)</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${totalSpend > 0 ? (amt / totalSpend) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Strategic Insight */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Análisis Estratégico IA
          </p>
          <Button size="sm" onClick={getAIStrategicInsight} disabled={loading} className="bg-primary text-primary-foreground gap-2">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {loading ? 'Analizando...' : aiInsight ? 'Re-analizar' : 'Obtener Estrategia'}
          </Button>
        </div>
        {!aiInsight && !loading && (
          <p className="text-sm text-muted-foreground">Haz clic en "Obtener Estrategia" para recibir recomendaciones personalizadas basadas en tus datos reales.</p>
        )}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="w-4 h-4 animate-spin text-primary" /> Consultando IA con tus datos...
          </div>
        )}
        {aiInsight && (
          <div className="prose prose-sm prose-invert max-w-none text-sm text-muted-foreground leading-relaxed">
            <ReactMarkdown>{aiInsight}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

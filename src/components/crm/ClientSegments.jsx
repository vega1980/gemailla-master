import React, { useState } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useCompanyCrmClients, useCompanyCrmDeals, useCompanyCrmInteractions } from '@/lib/companyEntityQueries';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, PieChart } from 'lucide-react';
import { PieChart as RePieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import ReactMarkdown from 'react-markdown';

const SEGMENT_COLORS = {
  premium: '#f59e0b', recurrente: '#3b82f6', nuevo: '#10b981', inactivo: '#6b7280', prospecto: '#8b5cf6',
};

const fmt = (n) => `$${(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;

const ChartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-xl p-3 text-xs shadow-xl">
      <p className="font-semibold text-foreground">{payload[0].name}</p>
      <p className="text-muted-foreground">{payload[0].value} clientes</p>
    </div>
  );
};

export default function ClientSegments({ company }) {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(false);

  const { data: clients = [] } = useCompanyCrmClients(company);

  const { data: deals = [] } = useCompanyCrmDeals(company);

  const { data: interactions = [] } = useCompanyCrmInteractions(company);

  // Segment distribution
  const segCounts = clients.reduce((acc, c) => { acc[c.segment] = (acc[c.segment] || 0) + 1; return acc; }, {});
  const pieData = Object.entries(segCounts).map(([name, value]) => ({ name, value }));

  // Revenue by segment
  const segRevenue = clients.reduce((acc, c) => { acc[c.segment] = (acc[c.segment] || 0) + (c.total_revenue || 0); return acc; }, {});
  const barData = Object.entries(segRevenue).map(([seg, total]) => ({ seg, total }));

  // Interaction frequency
  const intByClient = interactions.reduce((acc, i) => { acc[i.clientId] = (acc[i.clientId] || 0) + 1; return acc; }, {});
  const avgInteractions = clients.length > 0 ? (interactions.length / clients.length).toFixed(1) : 0;

  const analyzeSegments = async () => {
    if (!clients.length) return;
    setLoading(true);
    setInsight(null);

    const clientSummary = clients.map(c => ({
      name: c.name, segment: c.segment, status: c.status,
      revenue: c.total_revenue || 0, interactions: intByClient[c.id] || 0,
    }));

    const res = await firebase.integrations.Core.InvokeLLM({
      companyId: company.id,
      prompt: `Eres un experto en CRM y segmentación de mercado para PyMEs mexicanas.

EMPRESA: ${company.name}
CLIENTES (${clients.length} total):
${clientSummary.slice(0, 20).map(c => `- ${c.name}: segmento=${c.segment}, status=${c.status}, revenue=${fmt(c.revenue)}, interacciones=${c.interactions}`).join('\n')}

DISTRIBUCIÓN POR SEGMENTO: ${JSON.stringify(segCounts)}
REVENUE POR SEGMENTO: ${JSON.stringify(Object.fromEntries(Object.entries(segRevenue).map(([k, v]) => [k, fmt(v)])))}
PIPELINE ACTIVO: ${deals.filter(d => !['ganado','perdido'].includes(d.stage)).length} negocios por ${fmt(deals.filter(d => !['ganado','perdido'].includes(d.stage)).reduce((s, d) => s + (d.amount || 0), 0))}

Analiza la base de clientes y proporciona:
1. 🎯 Diagnóstico de la segmentación actual y distribución
2. 💎 Estrategia para el segmento premium: cómo retenerlos y hacer upsell
3. 🔄 Plan de reactivación para clientes inactivos
4. 🌱 Estrategia de conversión de prospectos a clientes activos
5. 📊 3 KPIs de CRM que deben monitorear mensualmente
6. 💡 Oportunidades de cross-sell/upsell basadas en los segmentos

Responde en español, tono de consultor senior, con acciones concretas y métricas.`,
    });
    setInsight(res);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {clients.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <PieChart className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Agrega clientes para ver la segmentación.</p>
        </div>
      ) : (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Clientes', val: clients.length },
              { label: 'Promedio Interacciones', val: avgInteractions },
              { label: 'Segmentos activos', val: Object.keys(segCounts).length },
              { label: 'Deals activos', val: deals.filter(d => !['ganado','perdido'].includes(d.stage)).length },
            ].map(({ label, val }) => (
              <div key={label} className="bg-card border border-border rounded-2xl p-4">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className="text-xl font-bold font-mono text-foreground">{val}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-sm font-semibold text-foreground mb-4">Distribución por Segmento</p>
              <ResponsiveContainer width="100%" height={220}>
                <RePieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name" label={({ name, value }) => `${name}: ${value}`} labelLine={false} fontSize={11}>
                    {pieData.map((entry, i) => <Cell key={i} fill={SEGMENT_COLORS[entry.name] || '#6b7280'} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </RePieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-sm font-semibold text-foreground mb-4">Revenue por Segmento</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 14%)" />
                  <XAxis dataKey="seg" tick={{ fill: 'hsl(0 0% 50%)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'hsl(0 0% 50%)', fontSize: 10 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Bar dataKey="total" name="Revenue" fill="hsl(43 72% 53%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Segment detail cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Object.entries(segCounts).map(([seg, count]) => (
              <div key={seg} className="bg-card border border-border rounded-2xl p-4 text-center">
                <div className="w-3 h-3 rounded-full mx-auto mb-2" style={{ background: SEGMENT_COLORS[seg] || '#6b7280' }} />
                <p className="text-xs text-muted-foreground capitalize mb-1">{seg}</p>
                <p className="text-2xl font-bold text-foreground">{count}</p>
                {segRevenue[seg] > 0 && <p className="text-xs text-amber-400 mt-1">{fmt(segRevenue[seg])}</p>}
              </div>
            ))}
          </div>

          {/* AI Analysis */}
          <div className="flex justify-end">
            <Button size="sm" onClick={analyzeSegments} disabled={loading} className="bg-primary text-primary-foreground gap-2">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Análisis IA de Segmentos
            </Button>
          </div>

          {(insight || loading) && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary" /> Estrategia de Segmentación IA
              </p>
              {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin text-primary" /> Analizando segmentos...</div>}
              {insight && <div className="prose prose-sm prose-invert max-w-none text-sm text-muted-foreground leading-relaxed"><ReactMarkdown>{insight}</ReactMarkdown></div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
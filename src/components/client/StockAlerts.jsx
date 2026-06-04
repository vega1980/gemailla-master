import React, { useState } from 'react';
import { firebase } from '@/api/firebaseClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingDown, Loader2, Sparkles, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { format, subMonths } from 'date-fns';

const fmt = (n) => `$${(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;

export default function StockAlerts({ transactions, monthlyData }) {
  const [alerts, setAlerts] = useState(null);
  const [loading, setLoading] = useState(false);

  // Derive alerts from financial data
  const currentMonth = format(new Date(), 'yyyy-MM');
  const prevMonth = format(subMonths(new Date(), 1), 'yyyy-MM');

  const currInc = transactions.filter(t => t.type === 'ingreso' && t.date?.startsWith(currentMonth)).reduce((s, t) => s + (t.amount || 0), 0);
  const currExp = transactions.filter(t => t.type === 'gasto' && t.date?.startsWith(currentMonth)).reduce((s, t) => s + (t.amount || 0), 0);
  const prevInc = transactions.filter(t => t.type === 'ingreso' && t.date?.startsWith(prevMonth)).reduce((s, t) => s + (t.amount || 0), 0);
  const prevExp = transactions.filter(t => t.type === 'gasto' && t.date?.startsWith(prevMonth)).reduce((s, t) => s + (t.amount || 0), 0);

  const balance = currInc - currExp;
  const incDrop = prevInc > 0 ? ((currInc - prevInc) / prevInc * 100) : 0;
  const expIncrease = prevExp > 0 ? ((currExp - prevExp) / prevExp * 100) : 0;

  const staticAlerts = [];
  if (balance < 0) staticAlerts.push({ level: 'critical', icon: XCircle, msg: `Balance negativo este mes: ${fmt(balance)}. Los gastos superan los ingresos.` });
  if (incDrop < -15) staticAlerts.push({ level: 'warning', icon: TrendingDown, msg: `Caída de ingresos del ${Math.abs(incDrop).toFixed(1)}% vs mes anterior.` });
  if (expIncrease > 20) staticAlerts.push({ level: 'warning', icon: AlertTriangle, msg: `Gastos aumentaron ${expIncrease.toFixed(1)}% respecto al mes anterior.` });
  if (currExp / (currInc || 1) > 0.85) staticAlerts.push({ level: 'warning', icon: AlertTriangle, msg: `Ratio gastos/ingresos muy alto: ${((currExp / (currInc || 1)) * 100).toFixed(1)}%.` });
  if (staticAlerts.length === 0) staticAlerts.push({ level: 'ok', icon: CheckCircle2, msg: 'Los indicadores financieros del mes están dentro de rangos saludables.' });

  const getAIAlerts = async () => {
    setLoading(true);
    const res = await firebase.integrations.Core.InvokeLLM({
      prompt: `Eres un CFO experto. Analiza los datos financieros y genera alertas críticas para el negocio.

MES ACTUAL:
- Ingresos: ${fmt(currInc)}
- Gastos: ${fmt(currExp)}
- Balance: ${fmt(balance)}

MES ANTERIOR:
- Ingresos: ${fmt(prevInc)}
- Gastos: ${fmt(prevExp)}

TENDENCIA 12 MESES:
${monthlyData.map(m => `${m.month}: I=${fmt(m.ingresos)}, G=${fmt(m.gastos)}`).join(' | ')}

Genera entre 3 y 6 alertas priorizadas (crítica/advertencia/info) con:
- El problema específico detectado
- El impacto potencial
- La acción inmediata recomendada

Responde en español, formato de lista clara con emojis.`,
      response_json_schema: {
        type: 'object',
        properties: {
          alerts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                level: { type: 'string', enum: ['critical', 'warning', 'info'] },
                title: { type: 'string' },
                description: { type: 'string' },
                action: { type: 'string' },
              }
            }
          },
          summary: { type: 'string' }
        }
      }
    });
    setAlerts(res);
    setLoading(false);
  };

  const levelConfig = {
    critical: { color: 'bg-red-500/10 border-red-500/30 text-red-400', badge: 'bg-red-500 text-white', icon: XCircle },
    warning: { color: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400', badge: 'bg-yellow-500 text-white', icon: AlertTriangle },
    info: { color: 'bg-blue-500/10 border-blue-500/30 text-blue-400', badge: 'bg-blue-500 text-white', icon: Clock },
  };

  return (
    <div className="space-y-6">
      {/* Static quick alerts */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-sm font-semibold text-foreground mb-4">🚦 Estado Financiero Actual</p>
        <div className="space-y-3">
          {staticAlerts.map((a, i) => {
            const Icon = a.icon;
            return (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${a.level === 'critical' ? 'bg-red-500/10 border-red-500/30' : a.level === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
                <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${a.level === 'critical' ? 'text-red-400' : a.level === 'ok' ? 'text-emerald-400' : 'text-yellow-400'}`} />
                <p className="text-sm text-foreground">{a.msg}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI-powered alerts */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Alertas Inteligentes IA
          </p>
          <Button size="sm" onClick={getAIAlerts} disabled={loading} className="bg-primary text-primary-foreground gap-2">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {loading ? 'Analizando...' : alerts ? 'Actualizar' : 'Generar Alertas IA'}
          </Button>
        </div>

        {!alerts && !loading && (
          <p className="text-sm text-muted-foreground">Haz clic para que la IA detecte riesgos ocultos en tus datos financieros y te dé acciones específicas.</p>
        )}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" /> Detectando riesgos con IA...
          </div>
        )}

        {alerts && (
          <div className="space-y-3">
            {alerts.summary && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl text-sm text-foreground mb-4">
                {alerts.summary}
              </div>
            )}
            {(alerts.alerts || []).map((a, i) => {
              const cfg = levelConfig[a.level] || levelConfig.info;
              const Icon = cfg.icon;
              return (
                <div key={i} className={`p-4 rounded-xl border ${cfg.color}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 shrink-0" />
                      <p className="text-sm font-semibold text-foreground">{a.title}</p>
                    </div>
                    <Badge className={`${cfg.badge} text-xs capitalize shrink-0`}>{a.level}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2 ml-6">{a.description}</p>
                  {a.action && (
                    <div className="ml-6 flex items-start gap-1 text-xs">
                      <span className="text-primary font-medium shrink-0">→ Acción:</span>
                      <span className="text-foreground">{a.action}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
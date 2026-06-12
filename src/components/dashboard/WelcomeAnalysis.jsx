import React, { useState, useEffect } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Sparkles, X, TrendingUp, AlertTriangle, Calendar, ChevronRight, Loader2 } from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

const LOCAL_KEY = 'gemailla_welcome_dismissed';

// Checks if we should show the welcome banner this session
function shouldShow() {
  const dismissed = localStorage.getItem(LOCAL_KEY);
  if (!dismissed) return true;
  // Show again if it's a new month
  const today = new Date().toISOString().slice(0, 7);
  return dismissed !== today;
}

export default function WelcomeAnalysis({ company, transactions, monthlyData }) {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (company && transactions.length > 0 && shouldShow()) {
      setVisible(true);
      generateAnalysis();
    }
  }, [company?.id, transactions.length]);

  const dismiss = () => {
    const today = new Date().toISOString().slice(0, 7);
    localStorage.setItem(LOCAL_KEY, today);
    setVisible(false);
  };

  const generateAnalysis = async () => {
    setLoading(true);

    const currentMonth = format(new Date(), 'MMMM yyyy', { locale: es });
    const currentMonthStr = new Date().toISOString().slice(0, 7);

    const thisMonthInc = transactions
      .filter(t => t.type === 'ingreso' && t.date?.startsWith(currentMonthStr))
      .reduce((s, t) => s + (t.amount || 0), 0);
    const thisMonthExp = transactions
      .filter(t => t.type === 'gasto' && t.date?.startsWith(currentMonthStr))
      .reduce((s, t) => s + (t.amount || 0), 0);

    // Category breakdown for expenses this month
    const expByCategory = {};
    transactions
      .filter(t => t.type === 'gasto' && t.date?.startsWith(currentMonthStr))
      .forEach(t => { expByCategory[t.category || 'otro'] = (expByCategory[t.category || 'otro'] || 0) + (t.amount || 0); });
    const topExpCategory = Object.entries(expByCategory).sort(([, a], [, b]) => b - a)[0];

    // Last month vs current month trend
    const lastMonthStr = subMonths(new Date(), 1).toISOString().slice(0, 7);
    const lastMonthExpByCategory = {};
    transactions
      .filter(t => t.type === 'gasto' && t.date?.startsWith(lastMonthStr))
      .forEach(t => { lastMonthExpByCategory[t.category || 'otro'] = (lastMonthExpByCategory[t.category || 'otro'] || 0) + (t.amount || 0); });

    const topCatLastMonth = topExpCategory ? (lastMonthExpByCategory[topExpCategory[0]] || 0) : 0;
    const topCatTrend = topExpCategory && topCatLastMonth > 0
      ? (((topExpCategory[1] - topCatLastMonth) / topCatLastMonth) * 100).toFixed(1)
      : null;

    const fixedExpRatio = thisMonthInc > 0 ? ((thisMonthExp / thisMonthInc) * 100).toFixed(1) : 0;
    const totalIngresos = transactions.filter(t => t.type === 'ingreso').reduce((s, t) => s + (t.amount || 0), 0);
    const totalGastos = transactions.filter(t => t.type === 'gasto').reduce((s, t) => s + (t.amount || 0), 0);

    const res = await firebase.integrations.Core.InvokeLLM({
      companyId: company.id,
      prompt: `Eres GEMAILLA, un asistente financiero inteligente para PyMEs mexicanas. 
Genera un mensaje de bienvenida PERSONALIZADO y CONCISO (máximo 4 secciones cortas) para el cliente de la empresa "${company.name}".
El nombre del usuario es "${user?.fullName || 'Cliente'}".

DATOS FINANCIEROS REALES (${currentMonth}):
- Ingresos este mes: $${thisMonthInc.toLocaleString('es-MX')} MXN
- Gastos este mes: $${thisMonthExp.toLocaleString('es-MX')} MXN
- Los gastos representan el ${fixedExpRatio}% de los ingresos este mes
- Ingresos totales históricos: $${totalIngresos.toLocaleString('es-MX')} MXN
- Gastos totales históricos: $${totalGastos.toLocaleString('es-MX')} MXN
- Categoría con más gasto este mes: ${topExpCategory ? `${topExpCategory[0]} ($${topExpCategory[1].toLocaleString('es-MX')})` : 'N/D'}
${topCatTrend ? `- Tendencia de esa categoría vs mes anterior: ${topCatTrend > 0 ? '+' : ''}${topCatTrend}%` : ''}

HISTORIAL ÚLTIMOS 6 MESES:
${monthlyData.map(m => `- ${m.month}: Ingresos $${m.ingresos.toLocaleString('es-MX')} | Gastos $${m.gastos.toLocaleString('es-MX')}`).join('\n')}

Responde ÚNICAMENTE con un JSON con esta estructura exacta (no añadas texto extra):
{
  "saludo": "Frase de bienvenida corta y cálida con el nombre del cliente y el mes",
  "salud_financiera": "2-3 líneas sobre el % de gastos vs ingresos y la tendencia de la categoría con más gasto",
  "prediccion_flujo": "1-2 líneas: basado en los datos, si el flujo de caja seguirá positivo y por cuántos meses estimados",
  "accion_recomendada": "1-2 líneas: acción concreta y urgente para mejorar liquidez (menciona una fecha aproximada si detectas pico de gastos)",
  "nivel_salud": "bueno | regular | critico",
  "categoria_alerta": "${topExpCategory ? topExpCategory[0] : 'N/D'}"
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          saludo: { type: 'string' },
          salud_financiera: { type: 'string' },
          prediccion_flujo: { type: 'string' },
          accion_recomendada: { type: 'string' },
          nivel_salud: { type: 'string' },
          categoria_alerta: { type: 'string' },
        },
      },
    });

    setAnalysis(res);
    setLoading(false);
  };

  if (!visible) return null;

  const healthColors = {
    bueno:   { bar: 'bg-emerald-500', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', label: 'Salud Buena' },
    regular: { bar: 'bg-amber-500',   badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',       label: 'Salud Regular' },
    critico: { bar: 'bg-red-500',     badge: 'bg-red-500/15 text-red-400 border-red-500/30',             label: 'Atención Requerida' },
  };
  const healthCfg = healthColors[analysis?.nivel_salud] || healthColors.regular;

  return (
    <div className="relative mb-6 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card overflow-hidden">
      {/* Gold accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-primary via-amber-300 to-primary" />

      {/* Dismiss */}
      <button onClick={dismiss} className="absolute top-3 right-3 p-1 text-muted-foreground hover:text-foreground transition-colors">
        <X className="w-4 h-4" />
      </button>

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Asistente GEMAILLA</p>
            <p className="text-sm font-semibold text-foreground">
              Análisis del mes — {format(new Date(), 'MMMM yyyy', { locale: es })}
            </p>
          </div>
          {analysis?.nivel_salud && (
            <span className={`ml-auto text-xs font-medium px-2.5 py-1 rounded-lg border ${healthCfg.badge}`}>
              {healthCfg.label}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-3 py-6 justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Procesando tus datos financieros...</span>
          </div>
        ) : analysis ? (
          <div className="space-y-4">
            {/* Saludo */}
            <p className="text-sm text-foreground leading-relaxed font-medium">{analysis.saludo}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Salud financiera */}
              <div className="bg-secondary/60 rounded-xl p-3.5 space-y-1.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" /> Salud Financiera
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">{analysis.salud_financiera}</p>
                {analysis.categoria_alerta && analysis.categoria_alerta !== 'N/D' && (
                  <span className="inline-block text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md px-2 py-0.5">
                    📈 {analysis.categoria_alerta}
                  </span>
                )}
              </div>

              {/* Predicción de flujo */}
              <div className="bg-secondary/60 rounded-xl p-3.5 space-y-1.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Sparkles className="w-3.5 h-3.5 text-primary" /> Predicción de Flujo
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">{analysis.prediccion_flujo}</p>
              </div>

              {/* Acción recomendada */}
              <div className="bg-secondary/60 rounded-xl p-3.5 space-y-1.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Acción Recomendada
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">{analysis.accion_recomendada}</p>
              </div>
            </div>

            {/* CTA */}
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground/60 flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                Actualizado {format(new Date(), "d 'de' MMMM", { locale: es })}
              </p>
              <button onClick={dismiss} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                Entendido <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
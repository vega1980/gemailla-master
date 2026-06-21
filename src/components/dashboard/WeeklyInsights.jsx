import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, ChevronDown, ChevronUp, RefreshCw, CalendarDays } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { format, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

import { askLLM } from '@/modules/ai/aiService';
const CACHE_KEY = 'gemailla_weekly_insight';
const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function getCached(companyId) {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY}_${companyId}`);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return data;
  } catch { return null; }
}

function setCache(companyId, data) {
  try {
    localStorage.setItem(`${CACHE_KEY}_${companyId}`, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

export default function WeeklyInsights({ company, transactions, monthlyData }) {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [generatedAt, setGeneratedAt] = useState(null);

  useEffect(() => {
    if (!company?.id) return;
    const cached = getCached(company.id);
    if (cached) {
      setInsight(cached.text);
      setGeneratedAt(cached.ts);
    }
  }, [company?.id]);

  const generateInsight = async () => {
    if (loading) return;
    setLoading(true);

    const totalIngresos = transactions.filter(t => t.type === 'ingreso').reduce((s, t) => s + (t.amount || 0), 0);
    const totalGastos = transactions.filter(t => t.type === 'gasto').reduce((s, t) => s + (t.amount || 0), 0);
    const utilidad = totalIngresos - totalGastos;
    const margen = totalIngresos > 0 ? ((utilidad / totalIngresos) * 100).toFixed(1) : 0;

    // Last 4 months trend
    const trend = monthlyData.slice(-4).map(m =>
      `${m.month}: Ingresos $${Math.round(m.ingresos).toLocaleString()}, Gastos $${Math.round(m.gastos).toLocaleString()}, Utilidad $${Math.round(m.ingresos - m.gastos).toLocaleString()}`
    ).join('\n');

    // Top categories
    const categoryMap = {};
    transactions.forEach(t => {
      if (!categoryMap[t.category]) categoryMap[t.category] = { ingreso: 0, gasto: 0 };
      categoryMap[t.category][t.type] = (categoryMap[t.category][t.type] || 0) + (t.amount || 0);
    });

    const topExpenses = Object.entries(categoryMap)
      .filter(([, v]) => v.gasto > 0)
      .sort(([, a], [, b]) => b.gasto - a.gasto)
      .slice(0, 3)
      .map(([k, v]) => `${k}: $${Math.round(v.gasto).toLocaleString()}`)
      .join(', ');

    const weekLabel = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "'Semana del' d 'de' MMMM yyyy", { locale: es });

    const res = await askLLM({
      companyId: company?.id,
      prompt: `Eres el consultor financiero de ${company?.name || 'la empresa'}. Genera el resumen semanal de inteligencia financiera para ${weekLabel}.

DATOS FINANCIEROS:
- Ingresos totales: $${Math.round(totalIngresos).toLocaleString()} MXN
- Gastos totales: $${Math.round(totalGastos).toLocaleString()} MXN
- Utilidad neta: $${Math.round(utilidad).toLocaleString()} MXN
- Margen neto: ${margen}%
- Principales gastos por categoría: ${topExpenses || 'Sin datos'}

TENDENCIA ÚLTIMOS MESES:
${trend || 'Sin datos históricos suficientes'}

INSTRUCCIONES PARA EL RESUMEN:
Escribe un resumen ejecutivo semanal en lenguaje natural, claro y amigable (NO técnico). Debe incluir exactamente estas secciones con emojis:

📊 **Panorama General**
Explica en 2-3 oraciones simples cómo está el negocio esta semana. Usa analogías cotidianas si es útil.

📈 **Lo que va bien**
2-3 puntos positivos específicos con datos.

⚠️ **Áreas de atención**
2-3 alertas o riesgos concretos que el dueño debe atender.

💡 **3 Acciones para esta semana**
Tres recomendaciones concretas, accionables y numeradas con fechas o plazos específicos.

🔮 **Predicción próxima semana**
Una predicción breve sobre qué esperar la próxima semana basada en los datos.

Tono: Como un amigo experto en finanzas que te habla directamente, sin jerga. Máx 400 palabras.`,
    });

    const text = typeof res === 'string' ? res : res?.text || res?.content || JSON.stringify(res);
    setInsight(text);
    setGeneratedAt(Date.now());
    if (company?.id) setCache(company.id, { text, ts: Date.now() });
    setLoading(false);
  };

  const weekLabel = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "'Semana del' d 'de' MMMM", { locale: es });

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-secondary/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
            <Sparkles className="w-4.5 h-4.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Resumen Semanal IA</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="w-3 h-3" />
              {weekLabel}
              {generatedAt && <span>· Generado {format(new Date(generatedAt), "HH:mm")}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(insight || !loading) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={e => { e.stopPropagation(); generateInsight(true); }}
              disabled={loading}
              className="text-muted-foreground hover:text-foreground h-7 px-2 gap-1.5"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              <span className="text-xs">{insight ? 'Actualizar' : 'Generar'}</span>
            </Button>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <div className="px-5 pb-5">
              {loading && (
                <div className="flex items-center gap-3 py-6 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <p className="text-sm">Analizando tu semana financiera...</p>
                </div>
              )}

              {!loading && !insight && (
                <div className="py-6 text-center">
                  <Sparkles className="w-8 h-8 text-primary/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Obtén un resumen semanal inteligente de tus finanzas explicado en lenguaje simple.
                  </p>
                  <Button
                    onClick={() => generateInsight()}
                    disabled={transactions.length === 0}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generar Resumen
                  </Button>
                  {transactions.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-2">Necesitas transacciones registradas para generar el resumen.</p>
                  )}
                </div>
              )}

              {!loading && insight && (
                <div className="prose prose-sm prose-invert max-w-none [&_p]:text-muted-foreground [&_p]:leading-relaxed [&_strong]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_ul]:text-muted-foreground [&_li]:my-1 [&_h2]:text-base [&_h3]:text-sm pt-1">
                  <ReactMarkdown>{insight}</ReactMarkdown>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

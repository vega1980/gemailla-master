import { useState } from 'react';
import { format, addMonths, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

import { askLLM } from '@/modules/ai/aiService';
export function useCashFlowPrediction() {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);

  const predict = async (transactions, historicalData, company = null) => {
    if (!transactions.length || loading) return;
    setLoading(true);

    const monthlySummary = historicalData.map(d => ({
      month: d.month,
      ingresos: d.ingresos,
      gastos: d.gastos,
      balance: d.ingresos - d.gastos,
    }));

    const categoryBreakdown = transactions.reduce((acc, t) => {
      if (!acc[t.type]) acc[t.type] = {};
      acc[t.type][t.category] = (acc[t.type][t.category] || 0) + (t.amount || 0);
      return acc;
    }, {});

    const next3Months = [1, 2, 3].map(i =>
      format(addMonths(startOfMonth(new Date()), i), 'MMM yy', { locale: es })
    );

    try {
      const result = await askLLM({
        companyId: company?.id,
        prompt: `Eres un experto en análisis financiero y predicción de flujos de caja.

Resumen mensual histórico:
${JSON.stringify(monthlySummary, null, 2)}

Desglose por categoría:
${JSON.stringify(categoryBreakdown, null, 2)}

Genera predicciones para los próximos 3 meses con ingresos_pred, gastos_pred y confidence.`,
        response_json_schema: {
          type: 'object',
          properties: {
            predictions: { type: 'array' },
            methodology: { type: 'string' },
            trend: { type: 'string' },
            trend_note: { type: 'string' },
          }
        }
      });

      const mapped = (result.predictions || []).map((p, i) => ({
        month: next3Months[i] || p.month,
        ingresos_pred: Math.round(p.ingresos_pred || 0),
        gastos_pred: Math.round(p.gastos_pred || 0),
        confidence: p.confidence,
      }));

      setPrediction({ ...result, predictions: mapped });
      setLoading(false);
      return { ...result, predictions: mapped };
    } catch (error) {
      console.error('Error generating prediction:', error);
      setLoading(false);
      return null;
    }
  };

  return { prediction, loading, predict };
}

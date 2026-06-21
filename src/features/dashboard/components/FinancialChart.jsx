import React from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    const isPredicted = payload.some(p => p.dataKey?.includes('_pred'));
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-xl min-w-[160px]">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs text-muted-foreground">{label}</p>
          {isPredicted && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
              Proyectado
            </span>
          )}
        </div>
        {payload.map((p, i) => {
          if (!p.value && p.value !== 0) return null;
          const labels = {
            ingresos: 'Ingresos',
            gastos: 'Gastos',
            ingresos_pred: 'Ingresos Est.',
            gastos_pred: 'Gastos Est.',
          };
          return (
            <p key={i} className="text-sm font-semibold" style={{ color: p.color }}>
              {labels[p.dataKey] || p.name}: ${p.value?.toLocaleString('es-MX')}
            </p>
          );
        })}
      </div>
    );
  }
  return null;
};

const CustomLegend = ({ trend }) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 justify-end">
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="w-6 h-0.5 bg-[hsl(43,72%,53%)] inline-block rounded" />Ingresos
    </span>
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="w-6 h-0.5 bg-[hsl(0,72%,50%)] inline-block rounded" />Gastos
    </span>
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="w-6 border-t-2 border-dashed border-[hsl(43,90%,70%)] inline-block" />Ingresos Est.
    </span>
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="w-6 border-t-2 border-dashed border-[hsl(0,72%,65%)] inline-block" />Gastos Est.
    </span>
    {trend && (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 ${
        trend === 'positiva' ? 'bg-emerald-500/15 text-emerald-400' :
        trend === 'negativa' ? 'bg-red-500/15 text-red-400' :
        'bg-muted text-muted-foreground'
      }`}>
        Tendencia {trend}
      </span>
    )}
  </div>
);

export default function FinancialChart({ data, title, prediction }) {
  // Merge historical data with predictions
  const chartData = [...data];
  if (prediction?.predictions?.length) {
    prediction.predictions.forEach(p => {
      chartData.push({
        month: p.month,
        ingresos_pred: p.ingresos_pred,
        gastos_pred: p.gastos_pred,
      });
    });
  }

  // Index where predictions start (for reference line)
  const splitIndex = data.length;
  const splitMonth = chartData[splitIndex]?.month;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between mb-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <CustomLegend trend={prediction?.trend} />
      <div className="h-64 mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(43, 72%, 53%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(43, 72%, 53%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorGastos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(0, 72%, 50%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(0, 72%, 50%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 14%)" />
            <XAxis dataKey="month" tick={{ fill: 'hsl(0, 0%, 50%)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'hsl(0, 0%, 50%)', fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <Tooltip content={<CustomTooltip />} />
            {splitMonth && (
              <ReferenceLine x={splitMonth} stroke="hsl(43, 72%, 53%)" strokeDasharray="4 4" strokeOpacity={0.5}
                label={{ value: 'Proyección →', position: 'insideTopRight', fill: 'hsl(43, 72%, 53%)', fontSize: 10 }} />
            )}
            {/* Historical areas */}
            <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="hsl(43, 72%, 53%)" fill="url(#colorIngresos)" strokeWidth={2} dot={false} connectNulls />
            <Area type="monotone" dataKey="gastos" name="Gastos" stroke="hsl(0, 72%, 50%)" fill="url(#colorGastos)" strokeWidth={2} dot={false} connectNulls />
            {/* Prediction lines */}
            <Line type="monotone" dataKey="ingresos_pred" name="Ingresos Est." stroke="hsl(43, 90%, 70%)" strokeWidth={2}
              strokeDasharray="6 3" dot={{ fill: 'hsl(43, 90%, 70%)', r: 3 }} connectNulls />
            <Line type="monotone" dataKey="gastos_pred" name="Gastos Est." stroke="hsl(0, 72%, 65%)" strokeWidth={2}
              strokeDasharray="6 3" dot={{ fill: 'hsl(0, 72%, 65%)', r: 3 }} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {prediction?.trend_note && (
        <p className="text-xs text-muted-foreground mt-3 leading-relaxed border-t border-border pt-3">
          <span className="text-primary font-medium">Análisis IA: </span>{prediction.trend_note}
        </p>
      )}
    </div>
  );
}
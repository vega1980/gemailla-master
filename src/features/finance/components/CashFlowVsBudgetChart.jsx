import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';
import { format, subMonths, startOfMonth } from 'date-fns';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const GOLD = '#0891a0';
const GOLD_LIGHT = '#8a6500';
const DARK_BAR = '#d9eef1';

function fmt(n) {
  return `$${(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#ffffff', border: '1px solid rgba(8,145,160,0.25)', borderRadius: 10 }} className="p-3 text-xs shadow-xl">
      <p className="font-semibold mb-2" style={{ color: GOLD_LIGHT }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.fill || p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-mono text-slate-900">{fmt(p.value)}</span>
        </div>
      ))}
      {payload.length >= 2 && (
        <div className="mt-2 border-t border-cyan-100 pt-2">
          <span className="text-slate-500">Diferencia: </span>
          <span
            className="font-mono font-semibold"
            style={{ color: (payload[0]?.value - payload[1]?.value) >= 0 ? '#34d399' : '#f87171' }}
          >
            {fmt(payload[0]?.value - payload[1]?.value)}
          </span>
        </div>
      )}
    </div>
  );
}

function SummaryBadge({ label, value, positive }) {
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  const color = value > 0 ? '#34d399' : value < 0 ? '#f87171' : '#a0a0a0';
  return (
    <div
      className="flex flex-col gap-1 rounded-lg p-3 flex-1 min-w-[110px]"
      style={{ background: '#f4fbfc', border: '1px solid rgba(8,145,160,0.15)' }}
    >
      <span className="text-xs font-semibold uppercase tracking-widest text-amber-700">{label}</span>
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-base font-bold font-mono" style={{ color }}>{fmt(value)}</span>
      </div>
      {positive !== undefined && (
        <span className="text-xs text-slate-500">
          {positive ? '✓ Superávit' : '✗ Déficit'}
        </span>
      )}
    </div>
  );
}

export default function CashFlowVsBudgetChart({ transactions, budgetItems }) {
  const [view, setView] = useState('flujo'); // 'flujo' | 'ingresos' | 'gastos'

  // Build real monthly cash flow for last 6 months
  const chartData = useMemo(() => {
    const totalBudgetIngresos = budgetItems?.filter(i => i.type === 'ingreso').reduce((s, i) => s + (i.budgeted || 0), 0) || 0;
    const totalBudgetGastos = budgetItems?.filter(i => i.type === 'gasto').reduce((s, i) => s + (i.budgeted || 0), 0) || 0;
    const budgetFlujo = totalBudgetIngresos - totalBudgetGastos;

    return Array.from({ length: 6 }, (_, i) => {
      const monthStart = startOfMonth(subMonths(new Date(), 5 - i));
      const monthStr = format(monthStart, 'yyyy-MM');
      const label = format(monthStart, 'MMM yy');
      const realIngresos = transactions.filter(t => t.type === 'ingreso' && t.date?.startsWith(monthStr)).reduce((s, t) => s + (t.amount || 0), 0);
      const realGastos = transactions.filter(t => t.type === 'gasto' && t.date?.startsWith(monthStr)).reduce((s, t) => s + (t.amount || 0), 0);
      const realFlujo = realIngresos - realGastos;

      return {
        month: label,
        realFlujo,
        presupuestoFlujo: budgetFlujo,
        realIngresos,
        presupuestoIngresos: totalBudgetIngresos,
        realGastos,
        presupuestoGastos: totalBudgetGastos,
      };
    });
  }, [transactions, budgetItems]);

  const totalReal = chartData.reduce((s, d) => s + d.realFlujo, 0);
  const totalPpto = chartData.reduce((s, d) => s + d.presupuestoFlujo, 0);
  const avgVariance = totalReal - totalPpto;

  const views = [
    { key: 'flujo', label: 'Flujo Neto', real: 'realFlujo', ppto: 'presupuestoFlujo' },
    { key: 'ingresos', label: 'Ingresos', real: 'realIngresos', ppto: 'presupuestoIngresos' },
    { key: 'gastos', label: 'Gastos', real: 'realGastos', ppto: 'presupuestoGastos' },
  ];
  const activeView = views.find(v => v.key === view);

  return (
    <div
      className="rounded-xl p-5 space-y-5"
      style={{ background: '#ffffff', border: '1px solid rgba(8,145,160,0.2)', boxShadow: '0 14px 35px rgba(15,43,58,0.07)' }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold" style={{ color: GOLD_LIGHT }}>
            Flujo de Caja Real vs. Presupuesto
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Últimos 6 meses — comparativa mensual
          </p>
        </div>
        {/* View toggle */}
        <div className="flex gap-1 rounded-lg border border-cyan-100 bg-cyan-50 p-1">
          {views.map(v => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className="px-3 py-1 rounded-md text-xs font-medium transition-all duration-200"
              style={view === v.key
                ? { background: '#ffffff', color: '#087f8c', border: '1px solid rgba(8,145,160,0.3)' }
                : { color: '#64748b', border: '1px solid transparent' }
              }
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="flex flex-wrap gap-3">
        <SummaryBadge label="Real acumulado" value={totalReal} positive={totalReal >= 0} />
        <SummaryBadge label="Presupuesto" value={totalPpto} />
        <SummaryBadge label="Varianza total" value={avgVariance} positive={avgVariance >= 0} />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: GOLD }} />
          Real
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: DARK_BAR, border: '1px solid rgba(8,145,160,0.3)' }} />
          Presupuesto
        </div>
      </div>

      {/* Bar chart */}
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} barCategoryGap="28%" barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(8,145,160,0.10)" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => `$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
            width={55}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(8,145,160,0.04)' }} />
          <ReferenceLine y={0} stroke="rgba(15,43,58,0.18)" strokeDasharray="4 4" />

          {/* Real bars — gold, colored red if negative */}
          <Bar dataKey={activeView.real} name="Real" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={index}
                fill={entry[activeView.real] >= 0 ? GOLD : '#f87171'}
                fillOpacity={0.9}
              />
            ))}
          </Bar>

          {/* Budget bars — dark with gold border */}
          <Bar dataKey={activeView.ppto} name="Presupuesto" radius={[4, 4, 0, 0]} fill={DARK_BAR} stroke="rgba(8,145,160,0.34)" strokeWidth={1} />
        </BarChart>
      </ResponsiveContainer>

      {/* Footer insight */}
      <p className="text-center text-xs text-slate-500">
        {avgVariance >= 0
          ? `✓ El flujo real supera el presupuesto por ${fmt(avgVariance)} en el período.`
          : `⚠ El flujo real está ${fmt(Math.abs(avgVariance))} por debajo del presupuesto acumulado.`}
      </p>
    </div>
  );
}

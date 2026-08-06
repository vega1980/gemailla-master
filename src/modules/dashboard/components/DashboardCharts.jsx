import React from 'react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const formatAxis = (value) => {
  const amount = Number(value) || 0;
  if (Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toFixed(0)}M`;
  if (Math.abs(amount) >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return String(amount);
};

const formatMoney = (value) => new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
}).format(Number(value) || 0);

export function DashboardIncomeExpenseChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={275}>
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="dashboardIncome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4fdbe4" />
            <stop offset="100%" stopColor="#0799a8" />
          </linearGradient>
          <linearGradient id="dashboardExpenses" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f5c14b" />
            <stop offset="100%" stopColor="#d48b09" />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#dbeff1" strokeDasharray="0" vertical={false} />
        <XAxis dataKey="month" tick={{ fill: '#526777', fontSize: 12 }} axisLine={{ stroke: '#b9dfe3' }} tickLine={false} />
        <YAxis tickFormatter={formatAxis} tick={{ fill: '#526777', fontSize: 12 }} axisLine={false} tickLine={false} width={44} />
        <Tooltip formatter={(value) => formatMoney(value)} contentStyle={{ borderRadius: 12, border: '1px solid #b9dfe3', boxShadow: '0 10px 25px rgba(11,52,68,0.12)' }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
        <Bar name="Ingresos" dataKey="income" fill="url(#dashboardIncome)" radius={[5, 5, 0, 0]} maxBarSize={30} />
        <Bar name="Gastos" dataKey="expenses" fill="url(#dashboardExpenses)" radius={[5, 5, 0, 0]} maxBarSize={30} />
        <Line name="Balance" type="monotone" dataKey="balance" stroke="#087f8c" strokeWidth={3} dot={{ r: 4, fill: '#ffffff', stroke: '#087f8c', strokeWidth: 2 }} activeDot={{ r: 6 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function DashboardDistributionChart({ data, total }) {
  const hasValues = data.some((item) => item.value > 0);
  const chartData = hasValues ? data : [
    { name: 'Sin movimientos', value: 1, color: '#dbeff1' },
  ];

  return (
    <div className="grid min-h-[275px] items-center gap-4 sm:grid-cols-[1fr_0.9fr]">
      <div className="relative h-[270px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius="58%"
              outerRadius="84%"
              paddingAngle={2}
              stroke="#ffffff"
              strokeWidth={2}
            >
              {chartData.map((item) => <Cell key={item.name} fill={item.color} />)}
            </Pie>
            <Tooltip formatter={(value) => hasValues ? formatMoney(value) : 'Sin movimientos'} contentStyle={{ borderRadius: 12, border: '1px solid #b9dfe3' }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="font-display text-2xl font-bold text-[#12344f]">{formatAxis(total)}</p>
          <p className="text-xs text-slate-500">Total</p>
        </div>
      </div>
      <div className="space-y-4">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full shadow-sm" style={{ background: item.color }} />
            <span className="flex-1 text-sm font-semibold text-slate-600">{item.name}</span>
            <span className="font-display text-lg font-bold text-[#12344f]">{formatAxis(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSparkline({ data, color }) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <ComposedChart data={data}>
        <Line type="monotone" dataKey="value" stroke={color} dot={false} strokeWidth={2} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function DashboardRealtimePie() {
  return (
    <div className="flex h-[180px] w-full items-center justify-center" role="img" aria-label="Análisis completado al 92 por ciento">
      <div className="relative h-36 w-36 rounded-full shadow-[0_12px_28px_rgba(15,43,58,0.08)]" style={{ background: 'conic-gradient(#d9aa2b 0deg 331.2deg, #d7eef1 331.2deg 360deg)' }}>
        <div className="absolute inset-5 rounded-full border border-cyan-100 bg-white" />
      </div>
    </div>
  );
}

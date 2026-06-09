import React, { useMemo } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useQuery } from '@tanstack/react-query';
import { format, subMonths, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, FileText, Target, BarChart3 } from 'lucide-react';

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

export default function ClientDashboardShare({ company }) {
  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', company.id],
    queryFn: () => firebase.entities.Transaction.filter({ companyId: company.id }),
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', company.id],
    queryFn: () => firebase.entities.Document.filter({ companyId: company.id }),
  });

  const { data: kpis = [] } = useQuery({
    queryKey: ['kpis', company.id],
    queryFn: () => firebase.entities.KPI.filter({ companyId: company.id }),
  });

  const monthlyData = useMemo(() => {
    const data = [];
    for (let i = 11; i >= 0; i--) {
      const m = startOfMonth(subMonths(new Date(), i));
      const monthStr = format(m, 'yyyy-MM');
      const label = format(m, 'MMM yy', { locale: es });
      const inc = transactions.filter(t => t.type === 'ingreso' && t.date?.startsWith(monthStr)).reduce((s, t) => s + (t.amount || 0), 0);
      const exp = transactions.filter(t => t.type === 'gasto' && t.date?.startsWith(monthStr)).reduce((s, t) => s + (t.amount || 0), 0);
      data.push({ label, ingresos: inc, gastos: exp, balance: inc - exp });
    }
    return data;
  }, [transactions]);

  const totalIngresos = transactions.filter(t => t.type === 'ingreso').reduce((s, t) => s + (t.amount || 0), 0);
  const totalGastos = transactions.filter(t => t.type === 'gasto').reduce((s, t) => s + (t.amount || 0), 0);
  const balance = totalIngresos - totalGastos;
  const margin = totalIngresos > 0 ? ((balance / totalIngresos) * 100).toFixed(1) : 0;

  const currentMonth = format(new Date(), 'yyyy-MM');
  const currentIngresos = transactions.filter(t => t.type === 'ingreso' && t.date?.startsWith(currentMonth)).reduce((s, t) => s + (t.amount || 0), 0);
  const currentGastos = transactions.filter(t => t.type === 'gasto' && t.date?.startsWith(currentMonth)).reduce((s, t) => s + (t.amount || 0), 0);

  const lastMonth = format(subMonths(new Date(), 1), 'yyyy-MM');
  const lastIngresos = transactions.filter(t => t.type === 'ingreso' && t.date?.startsWith(lastMonth)).reduce((s, t) => s + (t.amount || 0), 0);
  const ingChange = lastIngresos > 0 ? (((currentIngresos - lastIngresos) / lastIngresos) * 100).toFixed(1) : null;

  return (
    <div className="space-y-6">
      {/* Live indicator */}
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <p className="text-xs text-emerald-400 font-medium">Dashboard en tiempo real — {format(new Date(), "d 'de' MMMM yyyy, HH:mm", { locale: es })}</p>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Ingresos Totales', val: fmt(totalIngresos), icon: TrendingUp, color: 'text-emerald-400', sub: ingChange ? `${ingChange > 0 ? '+' : ''}${ingChange}% vs mes anterior` : '' },
          { label: 'Gastos Totales', val: fmt(totalGastos), icon: TrendingDown, color: 'text-red-400', sub: `Este mes: ${fmt(currentGastos)}` },
          { label: 'Balance Neto', val: fmt(balance), icon: DollarSign, color: balance >= 0 ? 'text-emerald-400' : 'text-red-400', sub: `Margen ${margin}%` },
          { label: 'Documentos', val: documents.length, icon: FileText, color: 'text-foreground', sub: `${documents.filter(d => d.status === 'analyzed').length} analizados` },
        ].map(({ label, val, icon: Icon, color, sub }) => (
          <div key={label} className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">{label}</p>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className={`text-xl font-bold font-mono ${color}`}>{val}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
        ))}
      </div>

      {/* 12-month trend */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" /> Tendencia 12 Meses
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={monthlyData}>
            <defs>
              <linearGradient id="ingGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(43 72% 53%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(43 72% 53%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gasGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(0 72% 50%)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="hsl(0 72% 50%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 14%)" />
            <XAxis dataKey="label" tick={{ fill: 'hsl(0 0% 50%)', fontSize: 10 }} />
            <YAxis tick={{ fill: 'hsl(0 0% 50%)', fontSize: 10 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="hsl(43 72% 53%)" fill="url(#ingGrad)" strokeWidth={2} />
            <Area type="monotone" dataKey="gastos" name="Gastos" stroke="hsl(0 72% 50%)" fill="url(#gasGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* KPIs summary */}
      {kpis.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-primary" /> KPIs Estratégicos
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {kpis.slice(0, 6).map(kpi => {
              const pct = kpi.target > 0 ? Math.min(Math.round((kpi.current / kpi.target) * 100), 100) : 0;
              return (
                <div key={kpi.id} className="p-3 bg-secondary/40 rounded-xl">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm text-foreground">{kpi.name}</p>
                    <span className="text-xs text-muted-foreground">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-muted-foreground">{kpi.current ?? '—'} {kpi.unit}</span>
                    <span className="text-xs text-muted-foreground">Meta: {kpi.target} {kpi.unit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly comparison */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <p className="text-sm font-semibold text-foreground mb-4">Comparativa Mensual (Balance)</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={monthlyData.slice(-6)}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 14%)" />
            <XAxis dataKey="label" tick={{ fill: 'hsl(0 0% 50%)', fontSize: 10 }} />
            <YAxis tick={{ fill: 'hsl(0 0% 50%)', fontSize: 10 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="balance" name="Balance" radius={[4, 4, 0, 0]}
              fill="hsl(43 72% 53%)"
              label={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
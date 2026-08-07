import React, { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  DollarSign,
  FileText,
  Scale,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import LoadingState from '@/components/shared/LoadingState';
import DashboardLoginDialog from '@/components/auth/DashboardLoginDialog';
import { useAuth } from '@/app/providers/AuthProvider';
import { useCompanyData } from '@/hooks/useCompanyData';
import { useCompany } from '@/lib/companyContext';
import {
  buildFinancialDistribution,
  buildMonthlyTrends,
  isExpenseTransaction,
} from '@modules/dashboard/domain/dashboardMetrics';

const DashboardIncomeExpenseChart = lazy(() => import('@modules/dashboard/components/DashboardCharts').then((module) => ({ default: module.DashboardIncomeExpenseChart })));
const DashboardDistributionChart = lazy(() => import('@modules/dashboard/components/DashboardCharts').then((module) => ({ default: module.DashboardDistributionChart })));

const TURQUOISE = '#0799a8';
const GOLD = '#d89a16';

function formatCurrency(value) {
  const amount = Number(value) || 0;
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function shortCurrency(value) {
  const amount = Number(value) || 0;
  if (Math.abs(amount) >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (Math.abs(amount) >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return formatCurrency(amount);
}

function monthLabel(monthKey) {
  const [year, month] = String(monthKey || '').split('-').map(Number);
  if (!year || !month) return '';
  return new Intl.DateTimeFormat('es-MX', { month: 'short' })
    .format(new Date(year, month - 1, 1))
    .replace('.', '')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function buildMonthlyData(monthlyMetrics = []) {
  const buckets = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - index));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return { key, month: monthLabel(key), income: 0, expenses: 0, balance: 0 };
  });

  const byMonth = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  monthlyMetrics.forEach((metric) => {
    const bucket = byMonth.get(metric.month);
    if (!bucket) return;
    bucket.income = Math.max(Number(metric.totalIncome) || 0, 0);
    bucket.expenses = Math.max(Number(metric.totalExpenses) || 0, 0);
    bucket.balance = Number(metric.netCashFlow) || 0;
  });

  return buckets;
}

function buildRecentActivity(documents = [], transactions = []) {
  const documentItems = documents.slice(0, 2).map((document) => ({
    id: `document-${document.id}`,
    title: document.name || document.fileName || 'Documento empresarial',
    description: 'Documento agregado al expediente seguro',
    icon: FileText,
  }));
  const transactionItems = transactions.slice(0, 1).map((transaction) => {
    const isExpense = isExpenseTransaction(transaction);
    return {
      id: `transaction-${transaction.id}`,
      title: transaction.description || transaction.concept || 'Movimiento financiero',
      description: `${isExpense ? 'Gasto' : 'Ingreso'} registrado`,
      icon: isExpense ? TrendingDown : TrendingUp,
    };
  });

  const items = [...documentItems, ...transactionItems];
  if (items.length) return items;

  return [
    { id: 'secure', title: 'Datos protegidos', description: 'Expediente empresarial seguro', icon: ShieldCheck },
    { id: 'ready', title: 'Panel actualizado', description: 'Listo para recibir información', icon: CheckCircle2 },
  ];
}

function PublicBrandHeader({ onLoginRequest }) {
  return (
    <header className="circuit-header relative mb-7 flex min-h-[132px] items-center justify-between rounded-2xl px-7 sm:px-10">
      <div>
        <h1 className="font-display text-3xl font-bold text-[#12344f] sm:text-4xl">Dashboard</h1>
        <p className="mt-3 font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a66f08] sm:text-[13px]">La evolución de la asesoría empresarial</p>
      </div>
      <img src="/assets/logo-emblem-metallic.png" alt="GEMAILLA IA" className="absolute left-1/2 hidden h-32 w-32 -translate-x-1/2 object-contain drop-shadow-[0_8px_8px_rgba(105,67,0,0.35)] sm:block" />
      <button type="button" onClick={() => onLoginRequest('/dashboard')} className="embossed-button rounded-xl px-4 py-2.5 text-sm font-semibold text-white">
        Iniciar sesión
      </button>
    </header>
  );
}

function OverviewCard({ label, value, change, icon: Icon, tone = 'cyan', positiveWhen = 'up', comparisonLabel = 'Sin datos del mes anterior' }) {
  const color = tone === 'gold' ? GOLD : TURQUOISE;
  const hasChange = Number.isFinite(change);
  const isNeutral = change === 0;
  const isDecrease = hasChange && change < 0;
  const isFavorable = positiveWhen === 'down' ? change < 0 : change > 0;
  const trendColor = isNeutral ? 'text-slate-500' : isFavorable ? 'text-cyan-700' : 'text-red-600';
  const trendSymbol = isNeutral ? '→' : isDecrease ? '↓' : '↑';
  const formattedChange = hasChange
    ? `${Math.abs(change).toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
    : null;

  return (
    <article className="enterprise-card group flex min-h-[142px] items-center gap-4 rounded-2xl p-5 transition-all duration-200 hover:-translate-y-1">
      <div className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-full border border-amber-300/70 bg-gradient-to-br from-white to-cyan-50 shadow-[0_7px_16px_rgba(11,52,68,0.13),inset_0_1px_0_white]">
        <Icon className="h-9 w-9" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="font-display text-lg font-semibold text-[#17334b]">{label}</p>
        <p className="mt-1 truncate font-display text-[38px] font-bold leading-none text-[#12344f]">{value}</p>
        <p className={`mt-3 text-xs font-semibold ${hasChange ? trendColor : 'text-slate-500'}`}>
          {hasChange ? (
            <>{trendSymbol} {formattedChange} <span className="font-medium text-slate-500">vs. mes anterior</span></>
          ) : comparisonLabel}
        </p>
      </div>
    </article>
  );
}

function PanelTitle({ children }) {
  return (
    <div className="mb-4 border-b border-slate-200 pb-3">
      <h2 className="font-display text-xl font-bold text-[#17334b]">{children}</h2>
      <span className="mt-2 block h-0.5 w-16 bg-gradient-to-r from-amber-500 to-amber-200" />
    </div>
  );
}

function ActivityPanel({ items }) {
  return (
    <section className="enterprise-panel rounded-2xl p-6">
      <div className="mb-3 flex items-center justify-between">
        <PanelTitle>Actividad reciente</PanelTitle>
        <Link to="/activity" className="text-xs font-semibold text-cyan-700 underline decoration-amber-400 underline-offset-4">Ver todo</Link>
      </div>
      <div className="divide-y divide-cyan-100">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-4 py-3">
            <span className="rounded-xl border border-cyan-200 bg-cyan-50 p-2.5 shadow-sm">
              <item.icon className="h-5 w-5 text-cyan-700" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#17334b]">{item.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FinancialSummary({ income, expenses, balance }) {
  const margin = income > 0 ? (balance / income) * 100 : 0;
  const liquidity = expenses > 0 ? income / expenses : 0;
  const debt = income > 0 ? (expenses / income) * 100 : 0;
  const metrics = [
    ['Margen de ganancia', `${margin.toFixed(1)}%`, TrendingUp],
    ['Liquidez', liquidity.toFixed(2), WalletCards],
    ['Compromiso de ingresos', `${debt.toFixed(1)}%`, Activity],
  ];

  return (
    <section className="enterprise-panel rounded-2xl p-6">
      <PanelTitle>Resumen financiero</PanelTitle>
      <div className="grid gap-3 sm:grid-cols-3">
        {metrics.map(([label, value, Icon]) => (
          <div key={label} className="rounded-xl border border-cyan-100 bg-white/75 p-4 text-center shadow-[inset_0_1px_0_white]">
            <Icon className="mx-auto h-7 w-7 text-cyan-700" />
            <p className="mt-2 text-xs font-semibold text-slate-500">{label}</p>
            <p className="mt-2 font-display text-3xl font-bold text-[#12344f]">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Dashboard() {
  const { isAuthenticated } = useAuth();
  const [loginDestination, setLoginDestination] = useState(null);
  const { activeCompany, loading: companyLoading, companies = [] } = useCompany();
  const {
    transactions,
    documents,
    companyMetrics,
    companyMonthlyMetrics,
  } = useCompanyData(activeCompany?.id, {
    queryNames: ['transactions', 'documents', 'companyMetrics', 'companyMonthlyMetrics'],
    limit: 100,
  });

  const companyMetric = companyMetrics?.[0] || {};
  const income = Number(companyMetric.totalIncome) || 0;
  const expenses = Number(companyMetric.totalExpenses) || 0;
  const balance = Number(companyMetric.netCashFlow) || 0;
  const monthlyData = useMemo(() => buildMonthlyData(companyMonthlyMetrics), [companyMonthlyMetrics]);
  const monthlyTrends = useMemo(() => buildMonthlyTrends(companyMonthlyMetrics), [companyMonthlyMetrics]);
  const activityItems = useMemo(() => buildRecentActivity(documents, transactions), [documents, transactions]);
  const distributionData = useMemo(() => buildFinancialDistribution(income, expenses).map((item) => ({
    ...item,
    color: item.name === 'Ingresos' ? TURQUOISE : GOLD,
  })), [expenses, income]);
  const distributionTotal = useMemo(
    () => distributionData.reduce((total, item) => total + item.value, 0),
    [distributionData],
  );

  if (companyLoading) return <LoadingState variant="screen" />;

  const overviewCards = [
    { label: 'Empresas activas', value: companies.length, change: null, comparisonLabel: 'Total actual', icon: Building2 },
    { label: 'Ingresos', value: shortCurrency(income), change: monthlyTrends.income, icon: DollarSign },
    { label: 'Gastos', value: shortCurrency(expenses), change: monthlyTrends.expenses, icon: WalletCards, tone: 'gold', positiveWhen: 'down' },
    { label: 'Balance', value: shortCurrency(balance), change: monthlyTrends.balance, icon: Scale },
  ];

  return (
    <div className="relative">
      {!isAuthenticated && <PublicBrandHeader onLoginRequest={setLoginDestination} />}

      <section className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-4" aria-label="Indicadores principales">
        {overviewCards.map((card) => <OverviewCard key={card.label} {...card} />)}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="enterprise-panel min-h-[360px] rounded-2xl p-6">
          <PanelTitle>Ingresos y gastos</PanelTitle>
          <Suspense fallback={<div className="h-[270px] animate-pulse rounded-xl bg-cyan-50" />}>
            <DashboardIncomeExpenseChart data={monthlyData} />
          </Suspense>
        </div>
        <div className="enterprise-panel min-h-[360px] rounded-2xl p-6">
          <PanelTitle>Distribución financiera</PanelTitle>
          <Suspense fallback={<div className="h-[270px] animate-pulse rounded-xl bg-cyan-50" />}>
            <DashboardDistributionChart data={distributionData} total={distributionTotal} />
          </Suspense>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <ActivityPanel items={activityItems} />
        <FinancialSummary income={income} expenses={expenses} balance={balance} />
      </section>

      {balance < 0 && (
        <section className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 shadow-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">Balance negativo</p>
            <p className="text-sm">Revisa los gastos del periodo para recuperar el equilibrio financiero.</p>
          </div>
        </section>
      )}

      <DashboardLoginDialog
        open={Boolean(loginDestination)}
        destinationPath={loginDestination}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setLoginDestination(null);
        }}
      />
    </div>
  );
}

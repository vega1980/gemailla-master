import React, { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Brain,
  Briefcase,
  Building2,
  Calculator,
  CheckCircle,
  Clock,
  DatabaseZap,
  DollarSign,
  FileText,
  HelpCircle,
  PieChart as PieChartIcon,
  Search,
  Shield,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import LoadingState from '@/components/shared/LoadingState';
import DashboardLoginDialog from '@/components/auth/DashboardLoginDialog';
import { useAuth } from '@/app/providers/AuthProvider';
import { useCompanyData } from '@/hooks/useCompanyData';
import { useCompany } from '@/lib/companyContext';

const DashboardSparkline = lazy(() => import('@modules/dashboard/components/DashboardCharts').then((module) => ({ default: module.DashboardSparkline })));
const DashboardRealtimePie = lazy(() => import('@modules/dashboard/components/DashboardCharts').then((module) => ({ default: module.DashboardRealtimePie })));

const GOLD = '#087f8c';
const DARK_BACKGROUND = '#f7fbfc';
const MUTED_GOLD = '#7c3aed';
const SOFT_GOLD = '#b4860b';

const PANEL_STYLE = {
  background: 'linear-gradient(145deg, rgba(255,255,255,0.98) 0%, rgba(243,251,252,0.95) 100%)',
  border: '1px solid rgba(8,145,160,0.2)',
  boxShadow: '0 18px 45px rgba(15,43,58,0.07), inset 0 1px 0 rgba(255,255,255,0.9)',
};

const CARD_STYLE = {
  background: 'linear-gradient(145deg, #ffffff 0%, #f4fbfc 100%)',
  border: '1px solid rgba(8,145,160,0.18)',
  boxShadow: '0 14px 35px rgba(15,43,58,0.07)',
};

const QUICK_MODULES = [
  { path: '/erp', label: 'ERP', icon: Calculator, color: GOLD },
  { path: '/audit', label: 'Auditoría', icon: Shield, color: MUTED_GOLD },
  { path: '/documents', label: 'Documentos', icon: FileText, color: SOFT_GOLD },
  { path: '/finance', label: 'Finanzas', icon: TrendingUp, color: GOLD },
  { path: '/crm', label: 'CRM', icon: Users, color: MUTED_GOLD },
  { path: '/hr', label: 'Recursos Humanos', icon: Briefcase, color: SOFT_GOLD },
  { path: '/operations', label: 'Operaciones', icon: BarChart3, color: GOLD },
  { path: '/predictive', label: 'Análisis Predictivo', icon: PieChartIcon, color: MUTED_GOLD },
];

const ALERTS = [
  { type: 'warning', title: 'Riesgo Tributario Alto', desc: 'Declaración IVA' },
  { type: 'info', title: 'Inconsistencia detectada', desc: 'Logística Andina S.A.C.' },
];

const STREAMING_STAGES = [
  { label: 'Webhook pago', detail: 'Banco → evento interno' },
  { label: 'XML/PDF < 15MB', detail: 'Storage privado' },
  { label: 'IA fiscal', detail: 'Categoriza e impuestos' },
  { label: 'Balance vivo', detail: 'Caja y proyección' },
];

const RECENT_ACTIVITY = [
  { label: 'Análisis completados', value: '15 hoy', icon: CheckCircle },
  { label: 'Documentos cargados', value: 'Estudios Q1.pdf', icon: FileText },
  { label: 'Alerta emitida', value: 'Riesgo Tributario', icon: AlertTriangle },
  { label: 'Reporte generado', value: 'Resumen Mayo 2025', icon: BarChart3 },
];

const ChartFallback = ({ height = 40 }) => (
  <div className="w-full rounded-lg bg-cyan-50" style={{ height }} aria-hidden="true" />
);

function formatCurrency(value) {
  const number = Number(value) || 0;
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(number);
}

function buildMonthlyData(monthlyMetrics) {
  const buckets = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    const month = date.toISOString().slice(0, 7);
    return {
      key: month,
      value: 0,
    };
  });

  const bucketByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  monthlyMetrics.forEach((metric) => {
    const bucket = bucketByKey.get(metric.month);
    if (!bucket) return;
    bucket.value = Math.max(Number(metric.netCashFlow) || 0, 0);
  });

  return buckets.map((bucket) => ({ value: bucket.value }));
}

function getDashboardMetrics({ companies, documents, transactions, companyMetric }) {
  const alertCount = Number(companyMetric?.criticalKpiCount) || 0;
  const processingTasks = transactions.filter((transaction) => transaction.status === 'pending').length;
  const documentCount = Number(companyMetric?.documentCount) || documents.length;

  return [
    { label: 'EMPRESAS ACTIVAS', value: companies.length, change: '+18%', icon: Building2, color: GOLD },
    { label: 'DOCUMENTOS PROCESADOS', value: documentCount, change: 'Agregado backend', icon: BarChart3, color: MUTED_GOLD },
    { label: 'FLUJO NETO', value: formatCurrency(companyMetric?.netCashFlow), change: 'Agregado backend', icon: Zap, color: SOFT_GOLD },
    { label: 'ALERTAS ACTIVAS', value: alertCount, change: '-5%', icon: AlertTriangle, color: GOLD },
    { label: 'TAREAS EN PROCESO', value: processingTasks, change: '+7%', icon: Clock, color: MUTED_GOLD },
    { label: 'INGRESOS', value: formatCurrency(companyMetric?.totalIncome), change: 'Agregado backend', icon: DollarSign, color: SOFT_GOLD },
  ];
}

function getStreamingAccountingMetrics({ documents, companyMetric }) {
  const pendingDocuments = Number(companyMetric?.pendingDocumentCount) || documents.filter((document) => document.status === 'pending' || document.status === 'processing').length;
  const internalStorageDocuments = documents.filter((document) => {
    const storagePath = String(document.storagePath || '');
    return storagePath.startsWith('companies/') && !storagePath.startsWith('http');
  }).length;
  const processedToday = documents.filter((document) => {
    const rawDate = document.updatedAt || document.createdAt;
    const date = rawDate ? new Date(rawDate) : null;
    if (!date || Number.isNaN(date.getTime())) return false;

    const now = new Date();
    return date.toDateString() === now.toDateString();
  }).length;

  return {
    pendingDocuments,
    processedToday,
    secureDocuments: internalStorageDocuments,
    syncLagSeconds: Math.max(5, pendingDocuments * 7 + 5),
    netCashFlow: formatCurrency(companyMetric?.netCashFlow),
    totalIncome: formatCurrency(companyMetric?.totalIncome),
    totalExpenses: formatCurrency(companyMetric?.totalExpenses),
  };
}

function DashboardHeader({ isAuthenticated, onLoginRequest }) {
  return (
    <div className="border-b bg-white/80 backdrop-blur-xl" style={{ borderColor: 'rgba(8,145,160,0.14)' }}>
      <div className="flex items-center justify-between gap-2 px-3 py-3 sm:px-6 sm:py-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
          <button className="text-muted-foreground hover:text-foreground" type="button" aria-label="Abrir menú">☰</button>
          <div className="relative w-[150px] sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-700" />
            <input
              type="text"
              placeholder="Buscar..."
              className="w-full rounded-xl border border-cyan-100 bg-cyan-50/60 py-2 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <button className="relative" type="button" aria-label="Ver notificaciones">
            <Bell className="w-5 h-5" style={{ color: GOLD }} />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
          </button>
          <button type="button" aria-label="Abrir ayuda" className="hidden sm:block"><HelpCircle className="w-5 h-5 text-muted-foreground" /></button>
          <div className="flex items-center gap-2 border-l border-cyan-100 pl-2 sm:pl-4">
            <span className="hidden text-sm font-semibold text-slate-700 lg:inline">GEMAILLA IA</span>
            {isAuthenticated ? (
              <span className="text-xs" style={{ color: '#34d399' }}>● Conectado</span>
            ) : (
              <button
                type="button"
                className="rounded-lg border px-2 py-2 text-[10px] font-semibold sm:px-3 sm:text-xs"
                style={{ borderColor: 'rgba(180,134,11,0.4)', color: '#8a6500' }}
                onClick={() => onLoginRequest('/dashboard')}
              >
                Iniciar sesión
              </button>
            )}
            <div className="hidden h-8 w-8 rounded-full sm:block" style={{ background: `linear-gradient(135deg, ${GOLD}, ${MUTED_GOLD})` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children, id }) {
  return <h2 id={id} className="text-lg font-bold mb-4" style={{ color: GOLD, letterSpacing: '0.05em' }}>{children}</h2>;
}

function EnterpriseHero() {
  const principles = [
    { label: 'Cumplimiento', icon: Shield },
    { label: 'Datos protegidos', icon: CheckCircle },
    { label: 'Eficiencia inteligente', icon: Zap },
  ];

  return (
    <section
      className="relative mb-8 overflow-hidden rounded-3xl border border-cyan-200 bg-white px-5 py-7 shadow-[0_18px_48px_rgba(15,43,58,0.08)] sm:px-8"
      aria-labelledby="enterprise-hero-title"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(8,145,160,0.12),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(180,134,11,0.11),transparent_28%),linear-gradient(rgba(8,145,160,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(8,145,160,0.03)_1px,transparent_1px)] bg-[size:auto,auto,34px_34px,34px_34px]" aria-hidden="true" />
      <div className="relative grid items-center gap-6 lg:grid-cols-[1fr_1.5fr_1fr]">
        <div className="order-2 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-5 lg:order-1">
          <Brain className="mb-3 h-8 w-8 text-cyan-700" />
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-800">IA analítica</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">Procesamiento inteligente de datos empresariales para decisiones más claras.</p>
        </div>

        <div className="order-1 text-center lg:order-2">
          <img src="/assets/logo-emblem.png" alt="Emblema de GEMAILLA IA" className="mx-auto h-24 w-24 object-contain drop-shadow-[0_10px_18px_rgba(180,134,11,0.25)] sm:h-28 sm:w-28" />
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Inteligencia que transforma</p>
          <h1 id="enterprise-hero-title" className="gold-title mt-2 font-display text-3xl font-bold tracking-[0.08em] sm:text-4xl">GEMAILLA IA</h1>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 sm:text-sm">La evolución de la asesoría empresarial</p>
        </div>

        <div className="order-3 space-y-2 rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-amber-800">Gobernanza empresarial</p>
          {principles.map((principle) => (
            <div key={principle.label} className="flex items-center gap-3 rounded-xl bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700">
              <principle.icon className="h-4 w-4 text-cyan-700" />
              {principle.label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function QuickAccessModules({ isAuthenticated, onLoginRequest }) {
  return (
    <section className="mb-8" aria-labelledby="quick-access-title">
      <SectionTitle id="quick-access-title">ACCESOS DIRECTOS</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {QUICK_MODULES.map((module) => (
          <Link
            key={module.path}
            to={module.path}
            className="group"
            onClick={(event) => {
              if (isAuthenticated) return;
              event.preventDefault();
              onLoginRequest(module.path);
            }}
          >
            <div
              className="rounded-xl p-3 text-center transition-all duration-300 hover:-translate-y-1"
              style={{
                background: 'linear-gradient(145deg, #ffffff 0%, #eef9fa 100%)',
                border: '1px solid rgba(8,145,160,0.2)',
                boxShadow: '0 10px 26px rgba(15,43,58,0.07)',
              }}
            >
              <module.icon className="w-6 h-6 mx-auto mb-2" style={{ color: module.color }} />
              <p className="text-xs font-semibold text-slate-700">{module.label}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function StatsCards({ cards, monthlyData }) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4 mb-6" aria-label="Indicadores principales">
      {cards.map((card) => (
        <div key={card.label} className="rounded-2xl p-5" style={CARD_STYLE}>
          <div className="flex items-start justify-between mb-4">
            <span className="text-xs font-bold uppercase text-amber-700" style={{ letterSpacing: '0.05em' }}>{card.label}</span>
            <card.icon className="w-4 h-4" style={{ color: card.color, opacity: 0.6 }} />
          </div>
          <p className="text-3xl font-bold mb-3" style={{ color: card.color }}>{card.value}</p>
          <Suspense fallback={<ChartFallback />}>
            <DashboardSparkline data={monthlyData} color={card.color} />
          </Suspense>
          <div className="mt-3 flex justify-between items-center text-xs">
            <span className="text-slate-500">Este mes</span>
            <span className="text-emerald-700">{card.change}</span>
          </div>
        </div>
      ))}
    </section>
  );
}

function StreamingAccountingPanel({ metrics }) {
  return (
    <section className="mb-6 rounded-2xl p-6" style={PANEL_STYLE} aria-labelledby="streaming-accounting-title">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-3 flex items-center gap-3">
            <span className="rounded-full p-2" style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)' }}>
              <DatabaseZap className="h-5 w-5" style={{ color: '#34d399' }} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase" style={{ color: '#34d399', letterSpacing: '0.08em' }}>Contabilidad líquida · cero cierres de mes</p>
              <h3 id="streaming-accounting-title" className="text-2xl font-bold" style={{ color: GOLD }}>Balance vivo con datos de hace {metrics.syncLagSeconds}s</h3>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-slate-600">
            El panel muestra totales financieros desde agregados backend. Las consultas acotadas del cliente se conservan solo para actividad reciente.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-right sm:grid-cols-5 lg:min-w-[620px]">
          {[
            ['Flujo neto', metrics.netCashFlow],
            ['Ingresos', metrics.totalIncome],
            ['Gastos', metrics.totalExpenses],
            ['Docs seguros', metrics.secureDocuments],
            ['Hoy', metrics.processedToday],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl p-3" style={{ background: 'rgba(236,249,250,0.9)', border: '1px solid rgba(8,145,160,0.16)' }}>
              <p className="text-[11px] font-semibold uppercase text-amber-700">{label}</p>
              <p className="mt-1 text-xl font-bold" style={{ color: SOFT_GOLD }}>{value}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {STREAMING_STAGES.map((stage, index) => (
          <div key={stage.label} className="rounded-xl p-4" style={{ background: 'rgba(236,249,250,0.9)', border: '1px solid rgba(8,145,160,0.16)' }}>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold" style={{ background: `linear-gradient(135deg, ${GOLD}, ${MUTED_GOLD})`, color: DARK_BACKGROUND }}>{index + 1}</span>
              <p className="text-sm font-semibold text-slate-800">{stage.label}</p>
            </div>
            <p className="text-xs text-slate-500">{stage.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CompaniesPanel({ companies }) {
  return (
    <section className="xl:col-span-2 rounded-2xl p-6" style={PANEL_STYLE} aria-labelledby="companies-title">
      <div className="flex items-center justify-between mb-4">
        <h3 id="companies-title" className="text-sm font-bold uppercase" style={{ color: GOLD, letterSpacing: '0.05em' }}>EMPRESAS</h3>
        <div className="flex gap-2">
          <Link to="/companies" className="text-xs" style={{ color: GOLD, textDecoration: 'underline' }}>Ver todas</Link>
          <Link to="/companies" className="text-xs px-3 py-1.5 rounded-lg" style={{ background: `linear-gradient(135deg, ${GOLD}, ${MUTED_GOLD})`, color: DARK_BACKGROUND, fontWeight: '600' }}>+ Nueva</Link>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: '2px solid rgba(8,145,160,0.2)' }}>
              {['EMPRESA', 'SECTOR', 'ESTADO', 'RIESGO', 'ÚLTIMO ANÁLISIS'].map((heading, index) => (
                <th key={heading} className={`py-3 text-left ${index > 0 ? 'hidden sm:table-cell' : ''}`} style={{ color: GOLD, fontWeight: '600' }}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {companies.slice(0, 4).map((company) => (
              <tr key={company.id} style={{ borderBottom: '1px solid rgba(8,145,160,0.1)' }}>
                <td className="py-3 font-semibold text-slate-800">{company.name}</td>
                <td className="hidden text-slate-600 sm:table-cell">{company.industry || '-'}</td>
                <td className="hidden sm:table-cell"><StatusPill label="Activa" /></td>
                <td className="hidden sm:table-cell"><StatusPill label="Bajo" /></td>
                <td className="hidden text-slate-500 sm:table-cell">Hoy, 09:15 AM</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatusPill({ label }) {
  return (
    <span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: 'rgba(16,185,129,0.1)', color: '#047857', border: '1px solid rgba(16,185,129,0.26)' }}>
      {label}
    </span>
  );
}

function RealtimeAnalysisPanel() {
  return (
    <section className="rounded-2xl p-6" style={PANEL_STYLE} aria-labelledby="realtime-title">
      <h3 id="realtime-title" className="text-sm font-bold uppercase mb-4" style={{ color: GOLD, letterSpacing: '0.05em' }}>ANÁLISIS EN TIEMPO REAL</h3>
      <div className="flex w-full flex-col items-center">
        <Suspense fallback={<ChartFallback height={180} />}>
          <DashboardRealtimePie />
        </Suspense>
        <p className="mt-3 text-center text-3xl font-bold" style={{ color: GOLD }}>92%</p>
        <p className="text-xs text-slate-500">Tiempo: 00:21:24</p>
      </div>
      <div className="mt-4 space-y-2 text-xs">
        {['Saturación de datos', 'Validación documentaria', 'Análisis financiero'].map((item) => (
          <div key={item} className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" style={{ color: '#34d399' }} />
            <span className="text-slate-600">{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function AlertsPanel() {
  return (
    <section className="rounded-2xl p-6" style={PANEL_STYLE} aria-labelledby="alerts-title">
      <div className="flex items-center justify-between mb-4">
        <h3 id="alerts-title" className="text-sm font-bold uppercase" style={{ color: GOLD, letterSpacing: '0.05em' }}>ALERTAS ACTIVAS</h3>
        <Link to="/audit" className="text-xs" style={{ color: GOLD, textDecoration: 'underline' }}>Ver todas</Link>
      </div>
      <div className="space-y-3 text-xs">
        {ALERTS.map((alert) => (
          <div key={alert.title} className="flex gap-2 rounded-xl p-3" style={{ background: 'rgba(236,249,250,0.9)', border: '1px solid rgba(8,145,160,0.16)' }}>
            <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: alert.type === 'warning' ? '#f44336' : '#2196f3' }} />
            <div>
              <p className="font-semibold text-slate-800">{alert.title}</p>
              <p className="text-slate-500">{alert.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentActivityPanel() {
  return (
    <section className="mt-6 rounded-2xl p-6" style={PANEL_STYLE} aria-labelledby="activity-title">
      <div className="flex items-center justify-between mb-4">
        <h3 id="activity-title" className="text-sm font-bold uppercase" style={{ color: GOLD, letterSpacing: '0.05em' }}>ACTIVIDAD RECIENTE</h3>
        <Link to="/activity" className="text-xs" style={{ color: GOLD, textDecoration: 'underline' }}>Ver todas</Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 text-xs text-center">
        {RECENT_ACTIVITY.map((item) => (
          <div key={item.label} className="rounded-xl p-4" style={{ background: 'rgba(236,249,250,0.9)', border: '1px solid rgba(8,145,160,0.15)' }}>
            <item.icon className="w-5 h-5 mx-auto mb-2" style={{ color: MUTED_GOLD }} />
            <p className="font-semibold text-slate-800">{item.label}</p>
            <p className="mt-1 text-xs text-slate-500">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DashboardFooter() {
  return (
    <footer className="flex flex-col gap-2 border-t border-cyan-100 bg-white/70 px-6 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
      <p>GEMAILLA IA © {new Date().getFullYear()}</p>
      <div className="flex gap-4">
        <span>Última sync: Hoy, 03:15 AM</span>
        <span>Soporte 24/7</span>
      </div>
    </footer>
  );
}

export default function Dashboard() {
  const { isAuthenticated } = useAuth();
  const [loginDestination, setLoginDestination] = useState(null);
  const { activeCompany, loading: companyLoading, companies = [] } = useCompany();
  const dashboardDataLimit = 100;
  const {
    transactions,
    documents,
    companyMetrics,
    companyMonthlyMetrics,
  } = useCompanyData(activeCompany?.id, {
    queryNames: ['transactions', 'documents', 'companyMetrics', 'companyMonthlyMetrics'],
    limit: dashboardDataLimit,
  });
  const companyMetric = companyMetrics?.[0] || null;
  const monthlyData = useMemo(() => buildMonthlyData(companyMonthlyMetrics || []), [companyMonthlyMetrics]);
  const metricCards = useMemo(
    () => getDashboardMetrics({ companies, documents, transactions, companyMetric }),
    [companies, documents, transactions, companyMetric],
  );
  const streamingAccountingMetrics = useMemo(
    () => getStreamingAccountingMetrics({ documents, companyMetric }),
    [documents, companyMetric],
  );

  if (companyLoading) return <LoadingState variant="screen" style={{ background: DARK_BACKGROUND }} />;

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: DARK_BACKGROUND }}>
      <div className="pointer-events-none fixed inset-0" aria-hidden="true" style={{ background: 'radial-gradient(circle at 12% 8%, rgba(8,145,160,0.10), transparent 27%), radial-gradient(circle at 88% 6%, rgba(180,134,11,0.09), transparent 26%), linear-gradient(rgba(8,145,160,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(8,145,160,0.028) 1px, transparent 1px)', backgroundSize: 'auto, auto, 42px 42px, 42px 42px' }} />
      <div className="relative z-10">
      <DashboardHeader
        isAuthenticated={isAuthenticated}
        onLoginRequest={setLoginDestination}
      />
      <main className="p-3 sm:p-6">
        <EnterpriseHero />
        <QuickAccessModules
          isAuthenticated={isAuthenticated}
          onLoginRequest={setLoginDestination}
        />
        <StreamingAccountingPanel metrics={streamingAccountingMetrics} />
        <StatsCards cards={metricCards} monthlyData={monthlyData} />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <CompaniesPanel companies={companies} />
          <div className="space-y-6">
            <RealtimeAnalysisPanel />
            <AlertsPanel />
          </div>
        </div>
        <RecentActivityPanel />
      </main>
      <DashboardFooter />
      </div>
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

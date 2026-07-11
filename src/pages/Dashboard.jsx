import React, { lazy, Suspense, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Bell,
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
import { useCompanyData } from '@/hooks/useCompanyData';
import { useCompany } from '@/lib/companyContext';

const DashboardSparkline = lazy(() => import('@/pages/dashboard/DashboardCharts').then((module) => ({ default: module.DashboardSparkline })));
const DashboardRealtimePie = lazy(() => import('@/pages/dashboard/DashboardCharts').then((module) => ({ default: module.DashboardRealtimePie })));

const GOLD = '#f0d080';
const DARK_BACKGROUND = '#050505';
const MUTED_GOLD = '#c5a059';
const SOFT_GOLD = '#e8c97a';

const PANEL_STYLE = {
  background: 'linear-gradient(135deg, rgba(197,160,89,0.08) 0%, rgba(197,160,89,0.03) 100%)',
  border: '1px solid rgba(197,160,89,0.25)',
  boxShadow: '0 4px 24px rgba(197,160,89,0.1)',
};

const CARD_STYLE = {
  background: 'linear-gradient(135deg, rgba(197,160,89,0.08) 0%, rgba(197,160,89,0.02) 100%)',
  border: '1px solid rgba(197,160,89,0.2)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
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
  <div className="w-full rounded-lg bg-black/20" style={{ height }} aria-hidden="true" />
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

function DashboardHeader() {
  return (
    <div className="border-b" style={{ borderColor: 'rgba(197,160,89,0.2)' }}>
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4 flex-1">
          <button className="text-muted-foreground hover:text-foreground" type="button" aria-label="Abrir menú">☰</button>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(197,160,89,0.5)' }} />
            <input
              type="text"
              placeholder="Buscar empresas, documentos..."
              className="w-full bg-secondary border pl-10 pr-4 py-2 rounded-lg text-sm"
              style={{ borderColor: 'rgba(197,160,89,0.2)', color: 'rgba(200,190,170,0.7)' }}
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="relative" type="button" aria-label="Ver notificaciones">
            <Bell className="w-5 h-5" style={{ color: GOLD }} />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
          </button>
          <button type="button" aria-label="Abrir ayuda"><HelpCircle className="w-5 h-5 text-muted-foreground" /></button>
          <div className="flex items-center gap-2 pl-4 border-l" style={{ borderColor: 'rgba(197,160,89,0.2)' }}>
            <span className="text-sm" style={{ color: 'rgba(232,213,163,0.8)' }}>GEMAILLA IA</span>
            <span className="text-xs" style={{ color: 'rgba(197,160,89,0.6)' }}>● Conectado</span>
            <div className="w-8 h-8 rounded-full" style={{ background: `linear-gradient(135deg, ${GOLD}, ${MUTED_GOLD})` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children, id }) {
  return <h2 id={id} className="text-lg font-bold mb-4" style={{ color: GOLD, letterSpacing: '0.05em' }}>{children}</h2>;
}

function QuickAccessModules() {
  return (
    <section className="mb-8" aria-labelledby="quick-access-title">
      <SectionTitle id="quick-access-title">ACCESOS DIRECTOS</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {QUICK_MODULES.map((module) => (
          <Link key={module.path} to={module.path} className="group">
            <div
              className="rounded-xl p-3 text-center transition-all duration-300 hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, rgba(197,160,89,0.1) 0%, rgba(197,160,89,0.05) 100%)',
                border: '1px solid rgba(197,160,89,0.2)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              <module.icon className="w-6 h-6 mx-auto mb-2" style={{ color: module.color }} />
              <p className="text-xs font-semibold" style={{ color: 'rgba(232,213,163,0.9)' }}>{module.label}</p>
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
            <span className="text-xs font-bold uppercase" style={{ color: 'rgba(197,160,89,0.7)', letterSpacing: '0.05em' }}>{card.label}</span>
            <card.icon className="w-4 h-4" style={{ color: card.color, opacity: 0.6 }} />
          </div>
          <p className="text-3xl font-bold mb-3" style={{ color: card.color }}>{card.value}</p>
          <Suspense fallback={<ChartFallback />}>
            <DashboardSparkline data={monthlyData} color={card.color} />
          </Suspense>
          <div className="mt-3 flex justify-between items-center text-xs">
            <span style={{ color: 'rgba(200,190,170,0.5)' }}>Este mes</span>
            <span style={{ color: '#4caf50' }}>{card.change}</span>
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
            <span className="rounded-full p-2" style={{ background: 'rgba(76,175,80,0.16)', border: '1px solid rgba(76,175,80,0.3)' }}>
              <DatabaseZap className="h-5 w-5" style={{ color: '#4caf50' }} />
            </span>
            <div>
              <p className="text-xs font-bold uppercase" style={{ color: '#4caf50', letterSpacing: '0.08em' }}>Contabilidad líquida · cero cierres de mes</p>
              <h3 id="streaming-accounting-title" className="text-2xl font-bold" style={{ color: GOLD }}>Balance vivo con datos de hace {metrics.syncLagSeconds}s</h3>
            </div>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(232,213,163,0.78)' }}>
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
            <div key={label} className="rounded-xl p-3" style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(197,160,89,0.18)' }}>
              <p className="text-[11px] uppercase" style={{ color: 'rgba(197,160,89,0.68)' }}>{label}</p>
              <p className="mt-1 text-xl font-bold" style={{ color: SOFT_GOLD }}>{value}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {STREAMING_STAGES.map((stage, index) => (
          <div key={stage.label} className="rounded-xl p-4" style={{ background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.16)' }}>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold" style={{ background: `linear-gradient(135deg, ${GOLD}, ${MUTED_GOLD})`, color: DARK_BACKGROUND }}>{index + 1}</span>
              <p className="text-sm font-semibold" style={{ color: '#e8d5a3' }}>{stage.label}</p>
            </div>
            <p className="text-xs" style={{ color: 'rgba(200,190,170,0.62)' }}>{stage.detail}</p>
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
            <tr style={{ borderBottom: '2px solid rgba(197,160,89,0.3)' }}>
              {['EMPRESA', 'SECTOR', 'ESTADO', 'RIESGO', 'ÚLTIMO ANÁLISIS'].map((heading) => (
                <th key={heading} className="text-left py-3" style={{ color: GOLD, fontWeight: '600' }}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {companies.slice(0, 4).map((company) => (
              <tr key={company.id} style={{ borderBottom: '1px solid rgba(197,160,89,0.15)' }}>
                <td className="py-3 font-semibold" style={{ color: '#e8d5a3' }}>{company.name}</td>
                <td style={{ color: 'rgba(200,190,170,0.8)' }}>{company.industry || '-'}</td>
                <td><StatusPill label="Activa" /></td>
                <td><StatusPill label="Bajo" /></td>
                <td style={{ color: 'rgba(200,190,170,0.6)' }}>Hoy, 09:15 AM</td>
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
    <span className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: 'rgba(76,175,80,0.25)', color: '#4caf50', border: '1px solid rgba(76,175,80,0.3)' }}>
      {label}
    </span>
  );
}

function RealtimeAnalysisPanel() {
  return (
    <section className="rounded-2xl p-6" style={PANEL_STYLE} aria-labelledby="realtime-title">
      <h3 id="realtime-title" className="text-sm font-bold uppercase mb-4" style={{ color: GOLD, letterSpacing: '0.05em' }}>ANÁLISIS EN TIEMPO REAL</h3>
      <div className="flex flex-col items-center">
        <Suspense fallback={<ChartFallback height={180} />}>
          <DashboardRealtimePie />
        </Suspense>
        <p className="text-center text-3xl font-bold mt-3" style={{ color: GOLD, textShadow: '0 0 20px rgba(240,208,128,0.3)' }}>92%</p>
        <p className="text-xs" style={{ color: 'rgba(200,190,170,0.7)' }}>Tiempo: 00:21:24</p>
      </div>
      <div className="mt-4 space-y-2 text-xs">
        {['Saturación de datos', 'Validación documentaria', 'Análisis financiero'].map((item) => (
          <div key={item} className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" style={{ color: '#4caf50' }} />
            <span style={{ color: 'rgba(200,190,170,0.9)' }}>{item}</span>
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
          <div key={alert.title} className="flex gap-2 p-3 rounded-xl" style={{ background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.2)' }}>
            <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: alert.type === 'warning' ? '#f44336' : '#2196f3' }} />
            <div>
              <p className="font-semibold" style={{ color: '#e8d5a3' }}>{alert.title}</p>
              <p style={{ color: 'rgba(200,190,170,0.6)' }}>{alert.desc}</p>
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
          <div key={item.label} className="rounded-xl p-4" style={{ background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.15)' }}>
            <item.icon className="w-5 h-5 mx-auto mb-2" style={{ color: MUTED_GOLD }} />
            <p className="font-semibold" style={{ color: '#e8d5a3' }}>{item.label}</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(200,190,170,0.6)' }}>{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DashboardFooter() {
  return (
    <footer className="flex justify-between items-center px-6 py-4 border-t text-xs" style={{ borderColor: 'rgba(197,160,89,0.1)', color: 'rgba(200,190,170,0.5)' }}>
      <p>GEMAILLA IA © {new Date().getFullYear()}</p>
      <div className="flex gap-4">
        <span>Última sync: Hoy, 03:15 AM</span>
        <span>Soporte 24/7</span>
      </div>
    </footer>
  );
}

export default function Dashboard() {
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
    <div className="min-h-screen" style={{ background: DARK_BACKGROUND }}>
      <DashboardHeader />
      <main className="p-6">
        <QuickAccessModules />
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
  );
}

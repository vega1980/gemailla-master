import React, { lazy, Suspense, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle,
  Clock,
  FileText,
  HelpCircle,
  Search,
} from 'lucide-react';
import LoadingState from '@/components/shared/LoadingState';
import { buildMonthlyData, getDashboardMetrics } from '@/features/dashboard/dashboardMetrics';
import { useCompanyData } from '@/hooks/useCompanyData';
import { useCompany } from '@/lib/companyContext';
import { QUICK_MODULES } from '@/pages/dashboard/dashboardStaticData';
import '@/styles/dashboardExecutive.css';

const DashboardSparkline = lazy(() => import('@/pages/dashboard/DashboardCharts').then((module) => ({ default: module.DashboardSparkline })));
const DashboardRealtimePie = lazy(() => import('@/pages/dashboard/DashboardCharts').then((module) => ({ default: module.DashboardRealtimePie })));

const GOLD_LIGHT = '#F8E7A2';
const GOLD = '#E8C76A';
const GOLD_MEDIUM = '#CFA63A';
const GOLD_DARK = '#8D6A17';
const DARK_BACKGROUND = 'linear-gradient(180deg, #070707 0%, #0B0B0D 45%, #111111 100%)';
const CHARCOAL_PANEL = 'linear-gradient(160deg, rgba(18,18,18,0.95) 0%, rgba(11,11,11,0.98) 100%)';

const PANEL_STYLE = {
  background: CHARCOAL_PANEL,
  border: '1px solid rgba(207,166,58,0.35)',
  boxShadow: '0 14px 34px rgba(0,0,0,0.45), inset 0 1px 0 rgba(248,231,162,0.08)',
  backdropFilter: 'blur(2px)',
};

const CARD_STYLE = {
  background: 'linear-gradient(150deg, rgba(17,17,17,0.96) 0%, rgba(12,12,12,0.98) 100%)',
  border: '1px solid rgba(207,166,58,0.3)',
  boxShadow: '0 10px 28px rgba(0,0,0,0.42), inset 0 1px 0 rgba(248,231,162,0.07)',
};

const ChartFallback = ({ height = 40 }) => (
  <div className="w-full rounded-lg executive-chart-fallback" style={{ height }} aria-hidden="true" />
);

function buildDashboardAlerts({ kpis = [], transactions = [], documents = [] }) {
  const kpiAlerts = kpis
    .filter((kpi) => kpi.status === 'critico' || kpi.status === 'en_riesgo')
    .slice(0, 3)
    .map((kpi) => ({
      type: kpi.status === 'critico' ? 'warning' : 'info',
      title: kpi.title || kpi.name || 'Riesgo detectado',
      desc: kpi.description || 'Revisar indicadores financieros y operativos.',
    }));

  const obligacionesPendientes = transactions.filter((transaction) => transaction.status === 'pending').length;
  if (obligacionesPendientes > 0) {
    kpiAlerts.push({
      type: 'warning',
      title: 'Obligaciones próximas',
      desc: `${obligacionesPendientes} movimientos requieren seguimiento hoy.`,
    });
  }

  const documentosPendientes = documents.filter((document) => {
    const status = String(document.status || '').toLowerCase();
    return status === 'pending' || status === 'pendiente' || status === 'review';
  }).length;
  if (documentosPendientes > 0) {
    kpiAlerts.push({
      type: 'info',
      title: 'Documentos por revisar',
      desc: `${documentosPendientes} documentos pendientes de validación.`,
    });
  }

  if (kpiAlerts.length === 0) {
    return [{
      type: 'info',
      title: 'Sin alertas críticas',
      desc: 'No se detectaron señales urgentes en este momento.',
    }];
  }

  return kpiAlerts.slice(0, 4);
}

function buildRecentActivity({ transactions = [], documents = [] }) {
  const transactionEvents = transactions
    .slice()
    .sort((left, right) => {
      const leftDate = new Date(left.updatedAt || left.date || left.createdAt || 0).getTime();
      const rightDate = new Date(right.updatedAt || right.date || right.createdAt || 0).getTime();
      return rightDate - leftDate;
    })
    .slice(0, 3)
    .map((transaction) => ({
      label: transaction.type === 'gasto' ? 'Gasto registrado' : 'Ingreso registrado',
      value: `$${Number(transaction.amount || 0).toLocaleString()}`,
      icon: BarChart3,
    }));

  const documentosPendientes = documents.filter((document) => {
    const status = String(document.status || '').toLowerCase();
    return status === 'pending' || status === 'pendiente' || status === 'review';
  }).length;

  if (documentosPendientes > 0) {
    transactionEvents.push({
      label: 'Documentos pendientes',
      value: `${documentosPendientes} por validar`,
      icon: FileText,
    });
  }

  if (transactionEvents.length === 0) {
    return [{
      label: 'Actividad en preparación',
      value: 'Sin movimientos recientes',
      icon: Clock,
    }];
  }

  return transactionEvents.slice(0, 4);
}

function DashboardHeader() {
  return (
    <div className="border-b executive-header-shell" style={{ borderColor: 'rgba(207,166,58,0.23)' }}>
      <div className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-4 flex-1">
          <button className="text-muted-foreground hover:text-foreground transition-colors duration-300" type="button" aria-label="Abrir menú">☰</button>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(248,231,162,0.58)' }} />
            <input
              type="text"
              placeholder="Buscar empresas, documentos..."
              className="w-full border pl-10 pr-4 py-2.5 rounded-xl text-sm executive-search"
              style={{ borderColor: 'rgba(207,166,58,0.24)', color: 'rgba(235,224,195,0.88)' }}
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="relative executive-action-btn" type="button" aria-label="Ver notificaciones">
            <Bell className="w-5 h-5" style={{ color: GOLD }} />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
          </button>
          <button className="executive-action-btn" type="button" aria-label="Abrir ayuda"><HelpCircle className="w-5 h-5" style={{ color: 'rgba(240,230,205,0.75)' }} /></button>
          <div className="flex items-center gap-2 pl-4 border-l" style={{ borderColor: 'rgba(207,166,58,0.2)' }}>
            <span className="text-sm" style={{ color: 'rgba(248,231,162,0.92)' }}>GEMAILLA IA</span>
            <span className="text-xs" style={{ color: 'rgba(207,166,58,0.8)' }}>● Conectado</span>
            <div className="w-8 h-8 rounded-full executive-gold-orb" style={{ background: `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD_MEDIUM} 58%, ${GOLD_DARK})` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children, id }) {
  return <h2 id={id} className="text-lg font-bold mb-5 executive-section-title" style={{ color: GOLD, letterSpacing: '0.06em' }}>{children}</h2>;
}

function QuickAccessModules() {
  return (
    <section className="mt-6" aria-labelledby="quick-access-title">
      <SectionTitle id="quick-access-title">ATAJOS OPERATIVOS</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-4">
        {QUICK_MODULES.map((module) => (
          <Link key={module.path} to={module.path} className="group">
            <div
              className="rounded-2xl p-4 text-center transition-all duration-300 executive-subtle-fade executive-hover-lift"
              style={{
                background: 'linear-gradient(150deg, rgba(18,18,18,0.95) 0%, rgba(12,12,12,0.98) 100%)',
                border: '1px solid rgba(207,166,58,0.2)',
                boxShadow: '0 6px 18px rgba(0,0,0,0.35), inset 0 1px 0 rgba(248,231,162,0.05)',
              }}
            >
              <module.icon className="w-6 h-6 mx-auto mb-2" style={{ color: GOLD }} />
              <p className="text-xs font-semibold" style={{ color: 'rgba(241,232,212,0.83)' }}>{module.label}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function StatsCards({ cards, monthlyData }) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-6 mb-8" aria-label="Indicadores principales">
      {cards.map((card) => (
        <div key={card.label} className="rounded-2xl p-6 executive-subtle-fade executive-hover-lift" style={CARD_STYLE}>
          <div className="flex items-start justify-between mb-4">
            <span className="text-xs font-bold uppercase" style={{ color: 'rgba(232,199,106,0.82)', letterSpacing: '0.05em' }}>{card.label}</span>
            <card.icon className="w-4 h-4" style={{ color: GOLD, opacity: 0.85 }} />
          </div>
          <p className="text-3xl font-bold mb-3 executive-metric-value" style={{ color: GOLD_LIGHT }}>{card.value}</p>
          <Suspense fallback={<ChartFallback />}>
            <DashboardSparkline monthlySeries={monthlyData} color={GOLD_MEDIUM} />
          </Suspense>
          <div className="mt-3 flex justify-between items-center text-xs">
            <span style={{ color: 'rgba(213,203,180,0.62)' }}>Este mes</span>
            <span style={{ color: '#4caf50' }}>{card.change}</span>
          </div>
        </div>
      ))}
    </section>
  );
}

function CompaniesPanel({ companies }) {
  return (
    <section className="xl:col-span-2 rounded-2xl p-7 executive-subtle-fade" style={PANEL_STYLE} aria-labelledby="companies-title">
      <div className="flex items-center justify-between mb-4">
        <h3 id="companies-title" className="text-sm font-bold uppercase" style={{ color: GOLD, letterSpacing: '0.05em' }}>EMPRESAS</h3>
        <div className="flex gap-2">
          <Link to="/companies" className="text-xs" style={{ color: GOLD, textDecoration: 'underline' }}>Ver todas</Link>
          <Link to="/companies" className="text-xs px-3 py-1.5 rounded-lg" style={{ background: `linear-gradient(135deg, ${GOLD_LIGHT} 0%, ${GOLD_MEDIUM} 62%, ${GOLD_DARK} 100%)`, color: '#101010', fontWeight: '700' }}>+ Nueva</Link>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(207,166,58,0.34)' }}>
              {['EMPRESA', 'SECTOR', 'ESTADO', 'RIESGO', 'ÚLTIMO ANÁLISIS'].map((heading) => (
                <th key={heading} className="text-left py-3" style={{ color: GOLD, fontWeight: '600' }}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {companies.slice(0, 4).map((company) => (
              <tr key={company.id} style={{ borderBottom: '1px solid rgba(207,166,58,0.16)' }}>
                <td className="py-3.5 font-semibold" style={{ color: 'rgba(241,232,212,0.95)' }}>{company.name}</td>
                <td style={{ color: 'rgba(213,203,180,0.78)' }}>{company.industry || '-'}</td>
                <td><StatusPill label="Activa" /></td>
                <td><StatusPill label="Bajo" /></td>
                <td style={{ color: 'rgba(213,203,180,0.58)' }}>Hoy, 09:15 AM</td>
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
    <span className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: 'rgba(76,175,80,0.18)', color: '#4caf50', border: '1px solid rgba(76,175,80,0.26)' }}>
      {label}
    </span>
  );
}

function RealtimeAnalysisPanel({ kpis, transactions }) {
  const criticos = kpis.filter((kpi) => kpi.status === 'critico').length;
  const enRiesgo = kpis.filter((kpi) => kpi.status === 'en_riesgo').length;
  const pendientes = transactions.filter((transaction) => transaction.status === 'pending').length;
  const monitoreados = kpis.length;

  const estadoControl = criticos > 0 ? 'Atención prioritaria' : enRiesgo > 0 ? 'Seguimiento activo' : 'Controlado';

  return (
    <section className="rounded-2xl p-7 executive-subtle-fade" style={PANEL_STYLE} aria-labelledby="realtime-title">
      <h3 id="realtime-title" className="text-sm font-bold uppercase mb-4" style={{ color: GOLD, letterSpacing: '0.05em' }}>ANÁLISIS EN TIEMPO REAL</h3>
      <div className="flex flex-col items-center">
        <Suspense fallback={<ChartFallback height={180} />}>
          <DashboardRealtimePie />
        </Suspense>
        <p className="text-center text-2xl font-bold mt-3" style={{ color: GOLD_LIGHT }}>{estadoControl}</p>
        <p className="text-xs" style={{ color: 'rgba(213,203,180,0.72)' }}>{monitoreados} KPIs monitoreados</p>
      </div>
      <div className="mt-4 space-y-2 text-xs">
        {[
          `Alertas críticas: ${criticos}`,
          `Alertas en riesgo: ${enRiesgo}`,
          `Obligaciones pendientes: ${pendientes}`,
        ].map((item) => (
          <div key={item} className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4" style={{ color: criticos > 0 ? '#f44336' : '#4caf50' }} />
            <span style={{ color: 'rgba(227,218,197,0.9)' }}>{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function AlertsPanel({ alerts }) {
  return (
    <section className="rounded-2xl p-7 executive-subtle-fade" style={PANEL_STYLE} aria-labelledby="alerts-title">
      <div className="flex items-center justify-between mb-4">
        <h3 id="alerts-title" className="text-sm font-bold uppercase" style={{ color: GOLD, letterSpacing: '0.05em' }}>ALERTAS ACTIVAS</h3>
        <Link to="/audit" className="text-xs" style={{ color: GOLD, textDecoration: 'underline' }}>Ver todas</Link>
      </div>
      <div className="space-y-3 text-xs">
        {alerts.map((alert) => (
          <div key={alert.title} className="flex gap-2 p-3.5 rounded-xl" style={{ background: 'rgba(18,18,18,0.78)', border: '1px solid rgba(207,166,58,0.24)' }}>
            <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: alert.type === 'warning' ? '#f44336' : GOLD_MEDIUM }} />
            <div>
              <p className="font-semibold" style={{ color: 'rgba(241,232,212,0.94)' }}>{alert.title}</p>
              <p style={{ color: 'rgba(213,203,180,0.64)' }}>{alert.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentActivityPanel({ activities }) {
  return (
    <section className="mt-8 rounded-2xl p-7 executive-subtle-fade" style={PANEL_STYLE} aria-labelledby="activity-title">
      <div className="flex items-center justify-between mb-4">
        <h3 id="activity-title" className="text-sm font-bold uppercase" style={{ color: GOLD, letterSpacing: '0.05em' }}>ACTIVIDAD RECIENTE</h3>
        <Link to="/activity" className="text-xs" style={{ color: GOLD, textDecoration: 'underline' }}>Ver todas</Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 text-xs text-center">
        {activities.map((item) => (
          <div key={item.label} className="rounded-xl p-5 executive-hover-lift" style={{ background: 'rgba(18,18,18,0.78)', border: '1px solid rgba(207,166,58,0.2)' }}>
            <item.icon className="w-5 h-5 mx-auto mb-2" style={{ color: GOLD }} />
            <p className="font-semibold" style={{ color: 'rgba(241,232,212,0.95)' }}>{item.label}</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(213,203,180,0.6)' }}>{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DashboardFooter() {
  return (
    <footer className="flex justify-between items-center px-6 py-5 border-t text-xs" style={{ borderColor: 'rgba(207,166,58,0.14)', color: 'rgba(213,203,180,0.54)' }}>
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
  const { transactions, documents, kpis } = useCompanyData(activeCompany?.id, {
    queryNames: ['transactions', 'documents', 'kpis'],
  });

  const monthlyData = useMemo(() => buildMonthlyData(transactions), [transactions]);
  const metricCards = useMemo(
    () => getDashboardMetrics({ companies, documents, kpis, transactions }),
    [companies, documents, kpis, transactions],
  );
  const dashboardAlerts = useMemo(
    () => buildDashboardAlerts({ kpis, transactions, documents }),
    [kpis, transactions, documents],
  );
  const recentActivity = useMemo(
    () => buildRecentActivity({ transactions, documents }),
    [transactions, documents],
  );

  if (companyLoading) return <LoadingState variant="screen" style={{ background: DARK_BACKGROUND }} />;

  return (
    <div className="min-h-screen executive-dashboard" style={{ background: DARK_BACKGROUND }}>
      <DashboardHeader />
      <main className="p-5 md:p-7 xl:p-8 executive-main-grid">
        <StatsCards cards={metricCards} monthlyData={monthlyData} />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-7">
          <CompaniesPanel companies={companies} />
          <div className="space-y-6">
            <RealtimeAnalysisPanel kpis={kpis} transactions={transactions} />
            <AlertsPanel alerts={dashboardAlerts} />
          </div>
        </div>
        <QuickAccessModules />
        <RecentActivityPanel activities={recentActivity} />
      </main>
      <DashboardFooter />
    </div>
  );
}

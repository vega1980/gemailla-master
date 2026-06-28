import {
  AlertTriangle,
  BarChart3,
  Building2,
  Clock,
  DollarSign,
  Zap,
} from 'lucide-react';

const GOLD = '#f0d080';
const MUTED_GOLD = '#c5a059';
const SOFT_GOLD = '#e8c97a';

export function buildMonthlyData(transactions = []) {
  const buckets = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      value: 0,
    };
  });

  const bucketByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  transactions.forEach((transaction) => {
    const rawDate = transaction.date || transaction.createdAt || transaction.updatedAt;
    const date = rawDate ? new Date(rawDate) : null;
    if (!date || Number.isNaN(date.getTime())) return;

    const bucket = bucketByKey.get(`${date.getFullYear()}-${date.getMonth()}`);
    if (!bucket) return;

    const amount = Number(transaction.amount) || 0;
    bucket.value += transaction.type === 'gasto' ? -amount : amount;
  });

  return buckets.map((bucket) => ({ value: Math.max(bucket.value, 0) }));
}

export function getDashboardMetrics({ companies = [], documents = [], kpis = [], transactions = [] }) {
  const totalIngresos = transactions
    .filter((transaction) => transaction.type === 'ingreso')
    .reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0);
  const totalGastos = transactions
    .filter((transaction) => transaction.type === 'gasto')
    .reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0);
  const flujoEfectivo = totalIngresos - totalGastos;

  const alertasCriticas = kpis.filter((kpi) => kpi.status === 'critico').length;
  const alertasEnRiesgo = kpis.filter((kpi) => kpi.status === 'en_riesgo').length;
  const alertCount = kpis.filter((kpi) => kpi.status === 'critico' || kpi.status === 'en_riesgo').length;
  const obligacionesProximas = transactions.filter((transaction) => transaction.status === 'pending').length;
  const documentosPendientes = documents.filter((document) => {
    const status = String(document.status || '').toLowerCase();
    return status === 'pending' || status === 'pendiente' || status === 'review';
  }).length;

  const riesgoTributario = alertasCriticas > 0 ? 'Alto' : alertasEnRiesgo > 0 ? 'Medio' : 'Bajo';
  const liquidezRatio = totalGastos > 0 ? totalIngresos / totalGastos : totalIngresos > 0 ? 1 : 0;
  const liquidezLabel = liquidezRatio >= 1.2 ? 'Sana' : liquidezRatio >= 1 ? 'Vigilancia' : 'Ajustada';

  return [
    {
      label: 'RIESGO TRIBUTARIO',
      value: riesgoTributario,
      change: `${alertasCriticas + alertasEnRiesgo} señales`,
      icon: AlertTriangle,
      color: GOLD,
    },
    {
      label: 'FLUJO DE EFECTIVO',
      value: `$${flujoEfectivo.toLocaleString()}`,
      change: flujoEfectivo >= 0 ? 'Estable' : 'Atención',
      icon: BarChart3,
      color: MUTED_GOLD,
    },
    {
      label: 'LIQUIDEZ',
      value: liquidezLabel,
      change: `Ratio ${liquidezRatio.toFixed(2)}x`,
      icon: Building2,
      color: SOFT_GOLD,
    },
    {
      label: 'OBLIGACIONES PRÓXIMAS',
      value: obligacionesProximas,
      change: obligacionesProximas > 0 ? 'Revisar hoy' : 'Sin pendientes',
      icon: Clock,
      color: GOLD,
    },
    {
      label: 'ALERTAS CRÍTICAS',
      value: alertasCriticas,
      change: alertCount > 0 ? `${alertCount} totales` : 'Sin alertas',
      icon: Zap,
      color: MUTED_GOLD,
    },
    {
      label: 'FACTURACIÓN',
      value: `$${totalIngresos.toLocaleString()}`,
      change: `${documentosPendientes} docs por revisar`,
      icon: DollarSign,
      color: SOFT_GOLD,
    },
  ];
}

import React, { useMemo } from 'react';
import { AlertTriangle, AlertCircle, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const EXPENSE_RATIO_THRESHOLD = 85; // % of income that triggers a warning
const EXPENSE_RATIO_CRITICAL = 100; // % that triggers critical

function buildAlerts(scenarioData) {
  const alerts = [];

  scenarioData.forEach((d, i) => {
    const { month, ingresos_sc, gastos_sc, balance_sc } = d;

    // 1. Negative balance alert
    if (balance_sc < 0) {
      alerts.push({
        id: `neg-${i}`,
        level: 'critical',
        month,
        message: `Saldo negativo proyectado: -$${Math.abs(balance_sc).toLocaleString('es-MX')}`,
        detail: 'Los gastos del escenario superan los ingresos en este mes.',
      });
    }

    // 2. Expense ratio alerts
    if (ingresos_sc > 0) {
      const ratio = (gastos_sc / ingresos_sc) * 100;
      if (ratio >= EXPENSE_RATIO_CRITICAL) {
        alerts.push({
          id: `ratio-crit-${i}`,
          level: 'critical',
          month,
          message: `Gastos al ${Math.round(ratio)}% de ingresos en ${month}`,
          detail: 'Los gastos igualan o superan los ingresos. Riesgo de insolvencia.',
        });
      } else if (ratio >= EXPENSE_RATIO_THRESHOLD) {
        alerts.push({
          id: `ratio-warn-${i}`,
          level: 'warning',
          month,
          message: `Gastos al ${Math.round(ratio)}% de ingresos en ${month}`,
          detail: `Umbral crítico: ${EXPENSE_RATIO_THRESHOLD}%. Margen operativo muy ajustado.`,
        });
      }
    }
  });

  // Deduplicate: if we already have a "critical" balance alert for a month, skip ratio critical for same month
  const seen = new Set();
  return alerts.filter(a => {
    if (seen.has(a.month + a.level)) return false;
    seen.add(a.month + a.level);
    return true;
  });
}

const LEVEL_CONFIG = {
  critical: {
    icon: XCircle,
    bg: 'bg-red-500/10 border-red-500/30',
    iconColor: 'text-red-400',
    titleColor: 'text-red-400',
    badge: 'bg-red-500/20 text-red-400',
    label: 'Crítico',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-500/10 border-amber-500/30',
    iconColor: 'text-amber-400',
    titleColor: 'text-amber-400',
    badge: 'bg-amber-500/20 text-amber-400',
    label: 'Alerta',
  },
};

export default function ScenarioAlerts({ scenarioData }) {
  const alerts = useMemo(() => buildAlerts(scenarioData), [scenarioData]);

  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-400 px-1">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Escenario dentro de parámetros saludables
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className="w-4 h-4 text-amber-400" />
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Alertas del Escenario
        </span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ml-auto ${
          alerts.some(a => a.level === 'critical')
            ? 'bg-red-500/20 text-red-400'
            : 'bg-amber-500/20 text-amber-400'
        }`}>
          {alerts.length} {alerts.length === 1 ? 'alerta' : 'alertas'}
        </span>
      </div>

      <AnimatePresence mode="popLayout">
        {alerts.map(alert => {
          const cfg = LEVEL_CONFIG[alert.level];
          const Icon = cfg.icon;
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className={`flex items-start gap-3 rounded-lg border p-3 ${cfg.bg}`}
            >
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.iconColor}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-xs font-semibold ${cfg.titleColor}`}>{alert.message}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${cfg.badge}`}>
                    {cfg.label}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{alert.detail}</p>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
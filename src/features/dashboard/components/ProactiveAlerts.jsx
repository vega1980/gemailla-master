import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, XCircle, Info, ChevronDown, ChevronUp, Bell, X
} from 'lucide-react';

const LEVEL_CONFIG = {
  critical: {
    icon: XCircle,
    bg: 'bg-red-500/10 border-red-500/30',
    iconColor: 'text-red-400',
    titleColor: 'text-red-300',
    badge: 'bg-red-500/20 text-red-400',
    label: 'Crítico',
    headerBg: 'bg-red-500/10',
    headerBorder: 'border-red-500/40',
    dot: 'bg-red-400',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-500/10 border-amber-500/30',
    iconColor: 'text-amber-400',
    titleColor: 'text-amber-300',
    badge: 'bg-amber-500/20 text-amber-400',
    label: 'Advertencia',
    headerBg: 'bg-amber-500/10',
    headerBorder: 'border-amber-500/40',
    dot: 'bg-amber-400',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-500/10 border-blue-500/30',
    iconColor: 'text-blue-400',
    titleColor: 'text-blue-300',
    badge: 'bg-blue-500/20 text-blue-400',
    label: 'Información',
    headerBg: 'bg-blue-500/10',
    headerBorder: 'border-blue-500/40',
    dot: 'bg-blue-400',
  },
};


export default function ProactiveAlerts({ alerts, criticalCount, warningCount }) {
  const [open, setOpen] = useState(true);
  const [dismissed, setDismissed] = useState(new Set());

  const visibleAlerts = alerts.filter(a => !dismissed.has(a.id));

  if (alerts.length === 0) return null;

  const dismiss = (id) => setDismissed(prev => new Set([...prev, id]));

  const totalVisible = visibleAlerts.length;
  const hasCritical = visibleAlerts.some(a => a.level === 'critical');
  const hasWarning = visibleAlerts.some(a => a.level === 'warning');

  if (totalVisible === 0) return null;

  const headerLevel = hasCritical ? 'critical' : hasWarning ? 'warning' : 'info';
  const cfg = LEVEL_CONFIG[headerLevel];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border ${cfg.headerBorder} ${cfg.headerBg} overflow-hidden mb-6`}
    >
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell className={`w-4 h-4 ${cfg.iconColor}`} />
            {hasCritical && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </div>
          <span className="text-sm font-semibold text-foreground">Alertas del Sistema</span>
          <div className="flex items-center gap-1.5">
            {criticalCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-500/20 text-red-400">
                {criticalCount} crítica{criticalCount !== 1 ? 's' : ''}
              </span>
            )}
            {warningCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-400">
                {warningCount} advertencia{warningCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {/* Alert list */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 space-y-2.5">
              <AnimatePresence mode="popLayout">
                {visibleAlerts.map(alert => {
                  const lcfg = LEVEL_CONFIG[alert.level];
                  const LIcon = lcfg.icon;
                  return (
                    <motion.div
                      key={alert.id}
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8, height: 0 }}
                      transition={{ duration: 0.18 }}
                      className={`flex items-start gap-3 rounded-lg border p-3.5 ${lcfg.bg}`}
                    >
                      <LIcon className={`w-4 h-4 mt-0.5 shrink-0 ${lcfg.iconColor}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className={`text-xs font-semibold ${lcfg.titleColor}`}>{alert.title}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${lcfg.badge}`}>
                            {lcfg.label}
                          </span>
                          {alert.value && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ml-auto ${lcfg.badge}`}>
                              {alert.value}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-foreground/80">{alert.message}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{alert.detail}</p>
                      </div>
                      <button
                        onClick={() => dismiss(alert.id)}
                        className="shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
                        title="Descartar"
                      >
                        <X className="w-3 h-3 text-muted-foreground" />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
import React from 'react';
import { motion } from 'framer-motion';

export default function StatCard({ title, value, subtitle, icon: Icon, trend, trendUp }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative overflow-hidden rounded-2xl p-5 transition-all duration-300"
      style={{
        background: 'linear-gradient(145deg, #ffffff 0%, #f5fbfc 100%)',
        border: '1px solid rgba(8,145,160,0.2)',
        boxShadow: '0 12px 30px rgba(15,43,58,0.07), inset 0 1px 0 rgba(255,255,255,0.9)',
      }}
      onMouseEnter={(event) => { event.currentTarget.style.borderColor = 'rgba(8,145,160,0.42)'; event.currentTarget.style.boxShadow = '0 16px 36px rgba(15,43,58,0.11)'; }}
      onMouseLeave={(event) => { event.currentTarget.style.borderColor = 'rgba(8,145,160,0.2)'; event.currentTarget.style.boxShadow = '0 12px 30px rgba(15,43,58,0.07), inset 0 1px 0 rgba(255,255,255,0.9)'; }}
    >
      {/* Corner accent */}
      <div className="absolute top-0 right-0 w-16 h-16 opacity-30" style={{
        background: 'radial-gradient(circle at top right, rgba(8,145,160,0.18), transparent 70%)',
      }} />
      <div className="flex items-start justify-between relative">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">{title}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {trend && (
            <p className={`text-xs font-semibold ${trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
              {trendUp ? '▲' : '▼'} {trend}
            </p>
          )}
        </div>
        {Icon && (
          <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-2.5">
            <Icon className="h-5 w-5 text-cyan-700" />
          </div>
        )}
      </div>
    </motion.div>
  );
}

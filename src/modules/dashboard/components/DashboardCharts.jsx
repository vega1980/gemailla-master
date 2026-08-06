import React from 'react';
import { Line, LineChart, ResponsiveContainer } from 'recharts';

export function DashboardSparkline({ data, color }) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data} className="text-[#ef1a1a]">
        <Line type="monotone" dataKey="value" stroke={color} dot={false} strokeWidth={2} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DashboardRealtimePie() {
  return (
    <div className="flex h-[180px] w-full items-center justify-center" role="img" aria-label="Análisis completado al 92 por ciento">
      <div
        className="relative h-36 w-36 rounded-full shadow-[0_12px_28px_rgba(15,43,58,0.08)]"
        style={{ background: 'conic-gradient(#d9aa2b 0deg 331.2deg, #d7eef1 331.2deg 360deg)' }}
      >
        <div className="absolute inset-5 rounded-full border border-cyan-100 bg-white" />
      </div>
    </div>
  );
}

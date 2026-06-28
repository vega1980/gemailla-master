import React from 'react';
import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer } from 'recharts';

const realtimeDistribution = [{ value: 92 }, { value: 8 }];

export function DashboardSparkline({ monthlySeries, color }) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={monthlySeries} className="text-[#ef1a1a]">
        <Line type="monotone" dataKey="value" stroke={color} dot={false} strokeWidth={2.2} strokeOpacity={0.95} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DashboardRealtimePie() {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie data={realtimeDistribution} innerRadius={60} outerRadius={90} startAngle={90} endAngle={-270} dataKey="value">
          <Cell fill="#CFA63A" />
          <Cell fill="rgba(141,106,23,0.26)" />
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

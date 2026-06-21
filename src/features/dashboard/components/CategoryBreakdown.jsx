import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = [
  'hsl(43, 72%, 53%)',
  'hsl(43, 50%, 40%)',
  'hsl(160, 60%, 45%)',
  'hsl(200, 70%, 50%)',
  'hsl(280, 60%, 55%)',
  'hsl(20, 70%, 50%)',
  'hsl(340, 60%, 50%)',
];

const categoryLabels = {
  ventas: 'Ventas',
  servicios: 'Servicios',
  inversiones: 'Inversiones',
  otros_ingresos: 'Otros Ingresos',
  nómina: 'Nómina',
  renta: 'Renta',
  servicios_profesionales: 'Serv. Profesionales',
  materiales: 'Materiales',
  marketing: 'Marketing',
  impuestos: 'Impuestos',
  seguros: 'Seguros',
  mantenimiento: 'Mantenimiento',
  tecnología: 'Tecnología',
  transporte: 'Transporte',
  otros_gastos: 'Otros Gastos',
};

export default function CategoryBreakdown({ transactions, type }) {
  const filtered = transactions.filter(t => t.type === type);
  const byCategory = {};
  filtered.forEach(t => {
    const cat = t.category || 'otros_gastos';
    byCategory[cat] = (byCategory[cat] || 0) + (t.amount || 0);
  });

  const data = Object.entries(byCategory)
    .map(([name, value]) => ({ name: categoryLabels[name] || name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">
        {type === 'ingreso' ? 'Ingresos' : 'Gastos'} por Categoría
      </h3>
      {data.length > 0 ? (
        <div className="flex items-center gap-4">
          <div className="w-32 h-32 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={30} outerRadius={55} dataKey="value" stroke="none">
                  {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip
                  formatter={(v) => `$${v.toLocaleString()}`}
                  contentStyle={{ background: 'hsl(0,0%,7%)', border: '1px solid hsl(0,0%,14%)', borderRadius: '8px' }}
                  itemStyle={{ color: 'hsl(45,30%,90%)' }}
                  labelStyle={{ color: 'hsl(0,0%,50%)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2">
            {data.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-muted-foreground">{d.name}</span>
                </div>
                <span className="font-medium text-foreground">{total ? ((d.value / total) * 100).toFixed(0) : 0}%</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">Sin datos</p>
      )}
    </div>
  );
}
import StatCard from '@/components/shared/StatCard';
import { ArrowDownLeft, ArrowUpRight, DollarSign } from 'lucide-react';

export default function TransactionStats({ totalIngresos, totalGastos }) {
  const balance = totalIngresos - totalGastos;
  const margin = totalIngresos > 0 ? `${((balance / totalIngresos) * 100).toFixed(1)}% margen` : '';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      <StatCard title="Ingresos" value={`$${totalIngresos.toLocaleString()}`} icon={ArrowUpRight} />
      <StatCard title="Gastos" value={`$${totalGastos.toLocaleString()}`} icon={ArrowDownLeft} />
      <StatCard
        title="Balance"
        value={`$${balance.toLocaleString()}`}
        icon={DollarSign}
        trendUp={totalIngresos >= totalGastos}
        trend={margin}
      />
    </div>
  );
}

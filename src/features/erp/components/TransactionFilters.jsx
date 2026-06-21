import { Button } from '@/components/ui/button';

const transactionTypeFilters = [
  { value: 'all', label: 'Todos' },
  { value: 'ingreso', label: 'Ingresos' },
  { value: 'gasto', label: 'Gastos' },
];

export default function TransactionFilters({ filterType, onFilterTypeChange }) {
  return (
    <div className="flex gap-2 mb-6">
      {transactionTypeFilters.map((filter) => (
        <Button
          key={filter.value}
          variant={filterType === filter.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => onFilterTypeChange(filter.value)}
          className={filterType === filter.value ? 'bg-primary text-primary-foreground' : 'border-border'}
        >
          {filter.label}
        </Button>
      ))}
    </div>
  );
}

import EmptyState from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { transactionCategoryLabels } from '@/features/erp/components/transactionCatalog';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownLeft, ArrowUpDown, ArrowUpRight, CalendarClock, Loader2, RefreshCw, Trash2 } from 'lucide-react';

export default function TransactionList({ transactions, isLoading, onDeleteTransaction }) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (transactions.length === 0) {
    return <EmptyState icon={ArrowUpDown} title="Sin transacciones" description="Registra tu primera transacción." />;
  }

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {transactions.map((transaction) => {
          const isIncome = transaction.type === 'ingreso';
          const categoryLabel = transactionCategoryLabels[transaction.category] || transaction.category;

          return (
            <motion.div
              key={transaction.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors"
            >
              <div className={`p-2 rounded-lg ${isIncome ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                {isIncome ? <ArrowUpRight className="w-4 h-4 text-emerald-400" /> : <ArrowDownLeft className="w-4 h-4 text-red-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">{transaction.description || categoryLabel}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="outline" className="text-xs border-border">{categoryLabel}</Badge>
                  {transaction.type === 'gasto' && transaction.expense_type && (
                    <Badge variant="outline" className={`text-xs ${transaction.expense_type === 'fijo' ? 'border-blue-500/40 text-blue-400' : 'border-amber-500/40 text-amber-400'}`}>
                      {transaction.expense_type === 'fijo' ? 'Fijo' : 'Variable'}
                    </Badge>
                  )}
                  {transaction.isRecurring && (
                    <Badge variant="outline" className="text-xs border-primary/40 text-primary gap-1">
                      <RefreshCw className="w-2.5 h-2.5" /> Recurrente
                    </Badge>
                  )}
                  {transaction.dueDate && (
                    <span className="flex items-center gap-1 text-xs text-amber-400">
                      <CalendarClock className="w-3 h-3" /> Vence {transaction.dueDate}
                    </span>
                  )}
                  {transaction.date && <span className="text-xs text-muted-foreground">{transaction.date}</span>}
                </div>
                {transaction.supplier_id && <p className="text-xs text-muted-foreground mt-0.5">Proveedor: {transaction.supplier_id}</p>}
              </div>
              <p className={`font-bold ${isIncome ? 'text-emerald-400' : 'text-red-400'}`}>
                {isIncome ? '+' : '-'}${transaction.amount?.toLocaleString()}
              </p>
              <Button size="sm" variant="ghost" onClick={() => onDeleteTransaction(transaction.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

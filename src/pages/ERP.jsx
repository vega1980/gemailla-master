import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { companyEntityQueryKey, useCompanyTransactions } from '@/lib/companyEntityQueries';
import { useCompany } from '@/lib/companyContext';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { logAction } from '@/lib/auditLogger';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { ArrowUpDown, Plus } from 'lucide-react';
import ImportTransactions from '@/features/erp/components/ImportTransactions';
import TransactionFilters from '@/features/erp/components/TransactionFilters';
import TransactionFormDialog from '@/features/erp/components/TransactionFormDialog';
import TransactionList from '@/features/erp/components/TransactionList';
import TransactionStats from '@/features/erp/components/TransactionStats';
import { format } from 'date-fns';
import { archiveTransaction, calculateTransactionTotals, createTransaction } from '@/app/useCases/financeUseCases';

function createEmptyTransactionForm() {
  return {
    type: 'ingreso',
    category: 'ventas',
    amount: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    paymentMethod: 'transferencia',
    reference: '',
    notes: '',
    expense_type: 'variable',
    isRecurring: false,
    dueDate: '',
    supplier_id: '',
  };
}

export default function ERP() {
  const { activeCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [formData, setFormData] = useState(createEmptyTransactionForm);

  const transactionsQueryKey = companyEntityQueryKey('transactions', activeCompany);
  const invalidateTransactions = () => queryClient.invalidateQueries({ queryKey: transactionsQueryKey });

  const { data: transactions = [], isLoading } = useCompanyTransactions(activeCompany);

  const createMutation = useMutation({
    mutationFn: (data) => createTransaction(data, activeCompany.id),
    onSuccess: async (transaction) => {
      await logAction({
        companyId: activeCompany.id,
        userEmail: user.email,
        userName: user.fullName,
        action: 'transaction_create',
        entityType: 'Transaction',
        entityId: transaction.id,
        details: `${formData.type}: $${formData.amount}`,
      });
      invalidateTransactions();
      setShowForm(false);
      setFormData(createEmptyTransactionForm());
      toast({ title: 'Transacción registrada' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: archiveTransaction,
    onSuccess: invalidateTransactions,
  });

  const filteredTransactions = useMemo(
    () => transactions.filter((transaction) => filterType === 'all' || transaction.type === filterType),
    [filterType, transactions],
  );

  const transactionTotals = useMemo(() => calculateTransactionTotals(transactions), [transactions]);

  function handleSubmit(event) {
    event.preventDefault();
    createMutation.mutate({
      ...formData,
    });
  }

  if (!activeCompany) {
    return <EmptyState icon={ArrowUpDown} title="Selecciona una empresa" description="Necesitas una empresa activa." />;
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="ERP — Finanzas"
        description="Registro de ingresos y gastos de tu empresa."
        actions={
          <div className="flex gap-2">
            <ImportTransactions companyId={activeCompany?.id} onSuccess={invalidateTransactions} />
            <Button onClick={() => setShowForm(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" /> Nueva Transacción
            </Button>
          </div>
        }
      />

      <TransactionStats
        totalIngresos={transactionTotals.totalIngresos}
        totalGastos={transactionTotals.totalGastos}
      />
      <TransactionFilters filterType={filterType} onFilterTypeChange={setFilterType} />
      <TransactionList
        transactions={filteredTransactions}
        isLoading={isLoading}
        onDeleteTransaction={(transactionId) => deleteMutation.mutate(transactionId)}
      />
      <TransactionFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        formData={formData}
        onFormDataChange={setFormData}
        onSubmit={handleSubmit}
        isSaving={createMutation.isPending}
      />
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getPaginatedItems, usePaginatedCompanyTransactions } from '@/lib/companyEntityQueries';
import { useCompany } from '@/lib/companyContext';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { logAction } from '@/lib/auditLogger';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { ArrowUpDown, Plus } from 'lucide-react';
import ImportTransactions from '@/components/erp/ImportTransactions';
import TransactionFilters from '@/components/erp/TransactionFilters';
import TransactionFormDialog from '@/components/erp/TransactionFormDialog';
import TransactionList from '@/components/erp/TransactionList';
import TransactionStats from '@/components/erp/TransactionStats';
import { format } from 'date-fns';

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

  const transactionFilters = useMemo(() => (filterType === 'all' ? {} : { type: filterType }), [filterType]);
  const invalidateTransactions = () => queryClient.invalidateQueries({ queryKey: ['company-entity-page', 'transactions', activeCompany?.id] });

  const {
    data: transactionPages,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = usePaginatedCompanyTransactions(activeCompany, { pageSize: 50, filters: transactionFilters });
  const transactions = useMemo(() => getPaginatedItems(transactionPages), [transactionPages]);

  const createMutation = useMutation({
    mutationFn: (data) => firebase.entities.Transaction.create(data),
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
    mutationFn: (id) => firebase.entities.Transaction.delete(id),
    onSuccess: invalidateTransactions,
  });

  const transactionTotals = useMemo(() => {
    const totalIngresos = transactions
      .filter((transaction) => transaction.type === 'ingreso')
      .reduce((sum, transaction) => sum + (transaction.amount || 0), 0);
    const totalGastos = transactions
      .filter((transaction) => transaction.type === 'gasto')
      .reduce((sum, transaction) => sum + (transaction.amount || 0), 0);

    return { totalIngresos, totalGastos };
  }, [transactions]);

  function handleSubmit(event) {
    event.preventDefault();
    createMutation.mutate({
      ...formData,
      companyId: activeCompany.id,
      amount: parseFloat(formData.amount),
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
        transactions={transactions}
        isLoading={isLoading}
        onDeleteTransaction={(transactionId) => deleteMutation.mutate(transactionId)}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={() => fetchNextPage()}
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

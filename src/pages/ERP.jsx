import React, { useState } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/lib/companyContext';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import StatCard from '@/components/shared/StatCard';
import { logAction } from '@/lib/auditLogger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Switch } from '@/components/ui/switch';
import { ArrowUpDown, Plus, ArrowUpRight, ArrowDownLeft, DollarSign, Trash2, Loader2, RefreshCw, CalendarClock } from 'lucide-react';
import ImportTransactions from '@/components/erp/ImportTransactions';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

const categoryLabels = {
  ventas: 'Ventas', servicios: 'Servicios', inversiones: 'Inversiones', otros_ingresos: 'Otros Ingresos',
  nómina: 'Nómina', renta: 'Renta', servicios_profesionales: 'Serv. Profesionales', materiales: 'Materiales',
  marketing: 'Marketing', impuestos: 'Impuestos', seguros: 'Seguros', mantenimiento: 'Mantenimiento',
  tecnología: 'Tecnología', transporte: 'Transporte', otros_gastos: 'Otros Gastos'
};

const incomeCategories = ['ventas', 'servicios', 'inversiones', 'otros_ingresos'];
const expenseCategories = ['nómina', 'renta', 'servicios_profesionales', 'materiales', 'marketing', 'impuestos', 'seguros', 'mantenimiento', 'tecnología', 'transporte', 'otros_gastos'];

export default function ERP() {
  const { activeCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [formData, setFormData] = useState({
    type: 'ingreso', category: 'ventas', amount: '', description: '', date: format(new Date(), 'yyyy-MM-dd'),
    paymentMethod: 'transferencia', reference: '', notes: '',
    expense_type: 'variable', isRecurring: false, dueDate: '', supplier_id: ''
  });

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', activeCompany?.id],
    queryFn: () => firebase.entities.Transaction.filter({ companyId: activeCompany.id }, '-date'),
    enabled: !!activeCompany,
  });

  const transactionsQueryKey = ['transactions', activeCompany?.id];
  const invalidateTransactions = () => queryClient.invalidateQueries({ queryKey: transactionsQueryKey });

  const createMutation = useMutation({
    mutationFn: (data) => firebase.entities.Transaction.create(data),
    onSuccess: async (tx) => {
      await logAction({
        companyId: activeCompany.id, userEmail: user.email, userName: user.fullName,
        action: 'transaction_create', entityType: 'Transaction', entityId: tx.id,
        details: `${formData.type}: $${formData.amount}`
      });
      invalidateTransactions();
      setShowForm(false);
      setFormData({ type: 'ingreso', category: 'ventas', amount: '', description: '', date: format(new Date(), 'yyyy-MM-dd'), paymentMethod: 'transferencia', reference: '', notes: '', expense_type: 'variable', isRecurring: false, dueDate: '', supplier_id: '' });
      toast({ title: 'Transacción registrada' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => firebase.entities.Transaction.delete(id),
    onSuccess: invalidateTransactions,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({ ...formData, companyId: activeCompany.id, amount: parseFloat(formData.amount) });
  };

  const filtered = transactions.filter(t => filterType === 'all' || t.type === filterType);
  const totalIngresos = transactions.filter(t => t.type === 'ingreso').reduce((s, t) => s + (t.amount || 0), 0);
  const totalGastos = transactions.filter(t => t.type === 'gasto').reduce((s, t) => s + (t.amount || 0), 0);

  if (!activeCompany) return <EmptyState icon={ArrowUpDown} title="Selecciona una empresa" description="Necesitas una empresa activa." />;

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

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard title="Ingresos" value={`$${totalIngresos.toLocaleString()}`} icon={ArrowUpRight} />
        <StatCard title="Gastos" value={`$${totalGastos.toLocaleString()}`} icon={ArrowDownLeft} />
        <StatCard title="Balance" value={`$${(totalIngresos - totalGastos).toLocaleString()}`} icon={DollarSign} trendUp={totalIngresos >= totalGastos} trend={totalIngresos > 0 ? `${(((totalIngresos - totalGastos) / totalIngresos) * 100).toFixed(1)}% margen` : ''} />
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6">
        {['all', 'ingreso', 'gasto'].map(t => (
          <Button key={t} variant={filterType === t ? 'default' : 'outline'} size="sm"
            onClick={() => setFilterType(t)}
            className={filterType === t ? 'bg-primary text-primary-foreground' : 'border-border'}>
            {t === 'all' ? 'Todos' : t === 'ingreso' ? 'Ingresos' : 'Gastos'}
          </Button>
        ))}
      </div>

      {/* Transactions */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={ArrowUpDown} title="Sin transacciones" description="Registra tu primera transacción." />
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map(tx => (
              <motion.div key={tx.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/30 transition-colors">
                <div className={`p-2 rounded-lg ${tx.type === 'ingreso' ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                  {tx.type === 'ingreso' ? <ArrowUpRight className="w-4 h-4 text-emerald-400" /> : <ArrowDownLeft className="w-4 h-4 text-red-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{tx.description || categoryLabels[tx.category] || tx.category}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-xs border-border">{categoryLabels[tx.category] || tx.category}</Badge>
                    {tx.type === 'gasto' && tx.expense_type && (
                      <Badge variant="outline" className={`text-xs ${tx.expense_type === 'fijo' ? 'border-blue-500/40 text-blue-400' : 'border-amber-500/40 text-amber-400'}`}>
                        {tx.expense_type === 'fijo' ? 'Fijo' : 'Variable'}
                      </Badge>
                    )}
                    {tx.isRecurring && (
                      <Badge variant="outline" className="text-xs border-primary/40 text-primary gap-1">
                        <RefreshCw className="w-2.5 h-2.5" /> Recurrente
                      </Badge>
                    )}
                    {tx.dueDate && (
                      <span className="flex items-center gap-1 text-xs text-amber-400">
                        <CalendarClock className="w-3 h-3" /> Vence {tx.dueDate}
                      </span>
                    )}
                    {tx.date && <span className="text-xs text-muted-foreground">{tx.date}</span>}
                  </div>
                  {tx.supplier_id && <p className="text-xs text-muted-foreground mt-0.5">Proveedor: {tx.supplier_id}</p>}
                </div>
                <p className={`font-bold ${tx.type === 'ingreso' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {tx.type === 'ingreso' ? '+' : '-'}${tx.amount?.toLocaleString()}
                </p>
                <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(tx.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* New Transaction Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">Nueva Transacción</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select value={formData.type} onValueChange={v => setFormData({ ...formData, type: v, category: v === 'ingreso' ? 'ventas' : 'nómina' })}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ingreso">Ingreso</SelectItem>
                    <SelectItem value="gasto">Gasto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoría</Label>
                <Select value={formData.category} onValueChange={v => setFormData({ ...formData, category: v })}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(formData.type === 'ingreso' ? incomeCategories : expenseCategories).map(c => (
                      <SelectItem key={c} value={c}>{categoryLabels[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Monto</Label>
                <Input type="number" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" className="bg-secondary border-border" required />
              </div>
              <div>
                <Label>Fecha</Label>
                <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="bg-secondary border-border" required />
              </div>
            </div>
            <div>
              <Label>Descripción</Label>
              <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Descripción..." className="bg-secondary border-border" />
            </div>

            {/* Campos exclusivos para Gastos */}
            {formData.type === 'gasto' && (
              <div className="space-y-4 border border-border/60 rounded-xl p-4 bg-secondary/30">
                <p className="text-xs font-semibold text-primary uppercase tracking-widest">Detalles del Gasto (IA)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo de Gasto</Label>
                    <Select value={formData.expense_type} onValueChange={v => setFormData({ ...formData, expense_type: v })}>
                      <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fijo">Fijo (Renta, Nómina…)</SelectItem>
                        <SelectItem value="variable">Variable (Marketing, Insumos…)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Proveedor (ID / Nombre)</Label>
                    <Input value={formData.supplier_id} onChange={e => setFormData({ ...formData, supplier_id: e.target.value })} placeholder="Ej. CFE, Papelería XYZ…" className="bg-secondary border-border" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 items-end">
                  <div>
                    <Label className="flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5 text-amber-400" /> Fecha de Vencimiento</Label>
                    <Input type="date" value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} className="bg-secondary border-border" />
                  </div>
                  <div className="flex items-center justify-between bg-secondary rounded-lg px-4 py-2.5 border border-border h-9">
                    <Label className="flex items-center gap-1.5 mb-0 cursor-pointer">
                      <RefreshCw className="w-3.5 h-3.5 text-primary" /> Recurrente
                    </Label>
                    <Switch checked={formData.isRecurring} onCheckedChange={v => setFormData({ ...formData, isRecurring: v })} />
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label>Método de Pago</Label>
              <Select value={formData.paymentMethod} onValueChange={v => setFormData({ ...formData, paymentMethod: v })}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="tarjeta_credito">Tarjeta de Crédito</SelectItem>
                  <SelectItem value="tarjeta_debito">Tarjeta de Débito</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="border-border">Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending} className="bg-primary text-primary-foreground">
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Registrar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
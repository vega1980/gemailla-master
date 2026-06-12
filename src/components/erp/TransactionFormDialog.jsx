import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { expenseCategories, incomeCategories, transactionCategoryLabels } from '@/components/erp/transactionCatalog';
import { CalendarClock, Loader2, RefreshCw } from 'lucide-react';

export default function TransactionFormDialog({ open, onOpenChange, formData, onFormDataChange, onSubmit, isSaving }) {
  function updateField(field, value) {
    onFormDataChange({ ...formData, [field]: value });
  }

  function updateType(type) {
    onFormDataChange({
      ...formData,
      type,
      category: type === 'ingreso' ? 'ventas' : 'nómina',
    });
  }

  const availableCategories = formData.type === 'ingreso' ? incomeCategories : expenseCategories;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display">Nueva Transacción</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo</Label>
              <Select value={formData.type} onValueChange={updateType}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ingreso">Ingreso</SelectItem>
                  <SelectItem value="gasto">Gasto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoría</Label>
              <Select value={formData.category} onValueChange={(value) => updateField('category', value)}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableCategories.map((category) => (
                    <SelectItem key={category} value={category}>{transactionCategoryLabels[category]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Monto</Label>
              <Input type="number" step="0.01" value={formData.amount} onChange={(event) => updateField('amount', event.target.value)} placeholder="0.00" className="bg-secondary border-border" required />
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={formData.date} onChange={(event) => updateField('date', event.target.value)} className="bg-secondary border-border" required />
            </div>
          </div>
          <div>
            <Label>Descripción</Label>
            <Input value={formData.description} onChange={(event) => updateField('description', event.target.value)} placeholder="Descripción..." className="bg-secondary border-border" />
          </div>

          {formData.type === 'gasto' && (
            <div className="space-y-4 border border-border/60 rounded-xl p-4 bg-secondary/30">
              <p className="text-xs font-semibold text-primary uppercase tracking-widest">Detalles del Gasto (IA)</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de Gasto</Label>
                  <Select value={formData.expense_type} onValueChange={(value) => updateField('expense_type', value)}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fijo">Fijo (Renta, Nómina…)</SelectItem>
                      <SelectItem value="variable">Variable (Marketing, Insumos…)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Proveedor (ID / Nombre)</Label>
                  <Input value={formData.supplier_id} onChange={(event) => updateField('supplier_id', event.target.value)} placeholder="Ej. CFE, Papelería XYZ…" className="bg-secondary border-border" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 items-end">
                <div>
                  <Label className="flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5 text-amber-400" /> Fecha de Vencimiento</Label>
                  <Input type="date" value={formData.dueDate} onChange={(event) => updateField('dueDate', event.target.value)} className="bg-secondary border-border" />
                </div>
                <div className="flex items-center justify-between bg-secondary rounded-lg px-4 py-2.5 border border-border h-9">
                  <Label className="flex items-center gap-1.5 mb-0 cursor-pointer">
                    <RefreshCw className="w-3.5 h-3.5 text-primary" /> Recurrente
                  </Label>
                  <Switch checked={formData.isRecurring} onCheckedChange={(value) => updateField('isRecurring', value)} />
                </div>
              </div>
            </div>
          )}

          <div>
            <Label>Método de Pago</Label>
            <Select value={formData.paymentMethod} onValueChange={(value) => updateField('paymentMethod', value)}>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-border">Cancelar</Button>
            <Button type="submit" disabled={isSaving} className="bg-primary text-primary-foreground">
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Registrar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

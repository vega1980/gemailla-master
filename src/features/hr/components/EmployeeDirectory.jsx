import React, { useState } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { companyEntityQueryKey, useCompanyEmployees } from '@/lib/companyEntityQueries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Users, Search, Pencil, Trash2, Loader2, Phone, Mail, Calendar, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { differenceInMonths } from 'date-fns';

const statusConfig = {
  activo:     { label: 'Activo',     color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  inactivo:   { label: 'Inactivo',   color: 'bg-secondary text-muted-foreground border-border' },
  vacaciones: { label: 'Vacaciones', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  baja:       { label: 'Baja',       color: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

const typeConfig = {
  tiempo_completo: 'TC', medio_tiempo: 'MT', freelance: 'FL', temporal: 'TP',
};

const fmt = (n) => `$${(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;

const EMPTY = {
  fullName: '', email: '', phone: '', department: '', position: '',
  employmentType: 'tiempo_completo', status: 'activo', hireDate: '',
  baseSalary: '', rfc: '', curp: '', imssNumber: '', bankAccount: '', bank: '',
  emergency_contact: '', notes: '',
};

export default function EmployeeDirectory({ company }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: employees = [], isLoading } = useCompanyEmployees(company);

  const save = useMutation({
    mutationFn: (data) => editing
      ? firebase.entities.Employee.update(editing.id, data)
      : firebase.entities.Employee.create({ ...data, companyId: company.id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: companyEntityQueryKey('employees', company) }); setOpen(false); setEditing(null); setForm(EMPTY); toast.success('Empleado guardado'); },
  });

  const del = useMutation({
    mutationFn: (id) => firebase.entities.Employee.archive(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: companyEntityQueryKey('employees', company) }); toast.success('Empleado eliminado'); },
  });

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (e) => { setEditing(e); setForm({ ...e }); setOpen(true); };
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];

  const filtered = employees.filter(e => {
    const matchSearch = !search || e.fullName.toLowerCase().includes(search.toLowerCase()) || e.email?.toLowerCase().includes(search.toLowerCase()) || e.position?.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === 'all' || e.department === deptFilter;
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchSearch && matchDept && matchStatus;
  });

  const totalPayroll = employees.filter(e => e.status === 'activo').reduce((s, e) => s + (e.baseSalary || 0), 0);
  const activeCount = employees.filter(e => e.status === 'activo').length;

  const tenure = (hireDate) => {
    if (!hireDate) return null;
    const months = differenceInMonths(new Date(), new Date(hireDate));
    if (months < 12) return `${months} meses`;
    return `${Math.floor(months / 12)} año${Math.floor(months / 12) !== 1 ? 's' : ''}`;
  };

  return (
    <div className="space-y-5">
      {/* Summary */}
      {employees.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Empleados', val: employees.length, color: 'text-foreground' },
            { label: 'Activos', val: activeCount, color: 'text-emerald-400' },
            { label: 'Nómina Mensual', val: fmt(totalPayroll), color: 'text-amber-400' },
            { label: 'Departamentos', val: departments.length, color: 'text-blue-400' },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className={`text-xl font-bold font-mono ${color}`}>{val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-1 min-w-0 flex-wrap">
          <div className="relative flex-1 max-w-xs min-w-36">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar empleado..." className="pl-8 bg-secondary border-border h-9 text-sm" />
          </div>
          {departments.length > 0 && (
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-40 h-9 bg-secondary border-border text-sm"><SelectValue placeholder="Departamento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los dept.</SelectItem>
                {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 h-9 bg-secondary border-border text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={openNew} className="bg-primary text-primary-foreground gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Nuevo Empleado
        </Button>
      </div>

      {/* Employee grid */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay empleados. Agrega el primero.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(emp => {
            const st = statusConfig[emp.status] || statusConfig.activo;
            const ten = tenure(emp.hireDate);
            return (
              <div key={emp.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">{emp.fullName?.[0]?.toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{emp.fullName}</p>
                      <p className="text-xs text-muted-foreground truncate">{emp.position || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(emp)} className="p-1 hover:text-primary text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => del.mutate(emp.id)} className="p-1 hover:text-destructive text-muted-foreground"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                <div className="space-y-1">
                  {emp.department && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Briefcase className="w-3 h-3" />{emp.department}</p>}
                  {emp.email && <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate"><Mail className="w-3 h-3 shrink-0" />{emp.email}</p>}
                  {emp.phone && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="w-3 h-3" />{emp.phone}</p>}
                  {ten && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Calendar className="w-3 h-3" />Antigüedad: {ten}</p>}
                </div>

                <div className="flex items-center justify-between">
                  <Badge className={`text-xs ${st.color}`}>{st.label}</Badge>
                  <div className="flex items-center gap-2 text-xs">
                    {emp.employmentType && <span className="text-muted-foreground">{typeConfig[emp.employmentType]}</span>}
                    {emp.baseSalary > 0 && <span className="text-amber-400 font-medium">{fmt(emp.baseSalary)}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Empleado' : 'Nuevo Empleado'}</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Información Personal</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Nombre completo</Label>
                  <Input value={form.fullName} onChange={e => f('fullName', e.target.value)} placeholder="Nombre completo" className="mt-1 bg-secondary border-border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input value={form.email} onChange={e => f('email', e.target.value)} placeholder="email@empresa.com" className="mt-1 bg-secondary border-border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Teléfono</Label>
                  <Input value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="+52 55..." className="mt-1 bg-secondary border-border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">RFC</Label>
                  <Input value={form.rfc} onChange={e => f('rfc', e.target.value)} className="mt-1 bg-secondary border-border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">CURP</Label>
                  <Input value={form.curp} onChange={e => f('curp', e.target.value)} className="mt-1 bg-secondary border-border" />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Información Laboral</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Departamento</Label>
                  <Input value={form.department} onChange={e => f('department', e.target.value)} placeholder="Ej. Ventas" className="mt-1 bg-secondary border-border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Cargo / Puesto</Label>
                  <Input value={form.position} onChange={e => f('position', e.target.value)} placeholder="Ej. Gerente de ventas" className="mt-1 bg-secondary border-border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Tipo de empleo</Label>
                  <Select value={form.employmentType} onValueChange={v => f('employmentType', v)}>
                    <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tiempo_completo">Tiempo completo</SelectItem>
                      <SelectItem value="medio_tiempo">Medio tiempo</SelectItem>
                      <SelectItem value="freelance">Freelance</SelectItem>
                      <SelectItem value="temporal">Temporal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Estado</Label>
                  <Select value={form.status} onValueChange={v => f('status', v)}>
                    <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Fecha de ingreso</Label>
                  <Input type="date" value={form.hireDate} onChange={e => f('hireDate', e.target.value)} className="mt-1 bg-secondary border-border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Salario base (MXN/mes)</Label>
                  <Input type="number" value={form.baseSalary} onChange={e => f('baseSalary', e.target.value)} placeholder="0" className="mt-1 bg-secondary border-border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">N° IMSS</Label>
                  <Input value={form.imssNumber} onChange={e => f('imssNumber', e.target.value)} className="mt-1 bg-secondary border-border" />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Datos Bancarios</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Banco</Label>
                  <Input value={form.bank} onChange={e => f('bank', e.target.value)} placeholder="BBVA, Santander..." className="mt-1 bg-secondary border-border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">N° de Cuenta / CLABE</Label>
                  <Input value={form.bankAccount} onChange={e => f('bankAccount', e.target.value)} className="mt-1 bg-secondary border-border" />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Notas</Label>
              <Textarea value={form.notes} onChange={e => f('notes', e.target.value)} className="mt-1 bg-secondary border-border h-16 resize-none" />
            </div>

            <Button onClick={() => save.mutate({ ...form, baseSalary: parseFloat(form.baseSalary) || 0 })}
              disabled={!form.fullName || save.isPending} className="w-full bg-primary text-primary-foreground gap-2">
              {save.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? 'Guardar cambios' : 'Crear Empleado'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
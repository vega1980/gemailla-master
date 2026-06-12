import React, { useState, useMemo } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { companyEntityQueryKey, useCompanyEmployees, useCompanyPayrolls, useCompanyPerformanceReviews } from '@/lib/companyEntityQueries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, DollarSign, Loader2, Pencil, Trash2, CheckCircle, Clock, Sparkles, Zap, Info } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

const statusConfig = {
  pendiente: { label: 'Pendiente', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: Clock },
  aprobado:  { label: 'Aprobado',  color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',    icon: CheckCircle },
  pagado:    { label: 'Pagado',    color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: CheckCircle },
};

const fmt = (n) => `$${(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;

// KPI-based bonus calculation
// Score 0-10 → bonus % of base salary
const kpiToBonusPercent = (avgScore) => {
  if (avgScore >= 9) return 0.15;  // 15% bonus excepcional
  if (avgScore >= 7.5) return 0.08; // 8% bueno
  if (avgScore >= 6) return 0.03;   // 3% satisfactorio
  return 0;                          // sin bono
};

const IMSS_RATE = 0.0315; // empleado 3.15%
const ISR_RATE  = 0.10;   // simplificado 10%

const autoCalcPayroll = (employee, review) => {
  const base = employee.baseSalary || 0;
  const avgScore = review
    ? (['score_productivity','score_quality','score_teamwork','score_punctuality','score_leadership']
        .map(k => parseFloat(review[k]) || 0)
        .reduce((s, v) => s + v, 0) / 5)
    : 0;
  const bonusPct = kpiToBonusPercent(avgScore);
  const bonuses = Math.round(base * bonusPct);
  const gross = base + bonuses;
  const deductions_imss = Math.round(gross * IMSS_RATE);
  const deductions_isr  = Math.round(gross * ISR_RATE);
  const netPay = gross - deductions_imss - deductions_isr;
  return { baseSalary: base, bonuses, overtime: 0, deductions_imss, deductions_isr, other_deductions: 0, netPay, avgScore, bonusPct };
};

const EMPTY = {
  employeeId: '', employeeName: '', period: new Date().toISOString().slice(0, 7),
  period_type: 'mensual', baseSalary: '', bonuses: '0', overtime: '0',
  deductions_imss: '0', deductions_isr: '0', other_deductions: '0',
  netPay: '', status: 'pendiente', paymentDate: '', notes: '',
};

const calcNet = (f) => {
  const gross = (parseFloat(f.baseSalary) || 0) + (parseFloat(f.bonuses) || 0) + (parseFloat(f.overtime) || 0);
  const deductions = (parseFloat(f.deductions_imss) || 0) + (parseFloat(f.deductions_isr) || 0) + (parseFloat(f.other_deductions) || 0);
  return gross - deductions;
};

export default function PayrollManager({ company }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [periodFilter, setPeriodFilter] = useState('');
  const [aiInsight, setAiInsight] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [autoMode, setAutoMode] = useState(true);

  const { data: employees = [] } = useCompanyEmployees(company);

  const { data: reviews = [] } = useCompanyPerformanceReviews(company);

  const { data: payrolls = [], isLoading } = useCompanyPayrolls(company);

  const save = useMutation({
    mutationFn: (data) => editing
      ? firebase.entities.Payroll.update(editing.id, data)
      : firebase.entities.Payroll.create({ ...data, companyId: company.id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: companyEntityQueryKey('payrolls', company) }); setOpen(false); setEditing(null); setForm(EMPTY); toast.success('Nómina guardada'); },
  });

  const del = useMutation({
    mutationFn: (id) => firebase.entities.Payroll.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: companyEntityQueryKey('payrolls', company) }),
  });

  const updateStatus = (id, status) =>
    firebase.entities.Payroll.update(id, { status }).then(() => qc.invalidateQueries({ queryKey: companyEntityQueryKey('payrolls', company) }));

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); setAutoMode(true); };
  const openEdit = (p) => { setEditing(p); setForm({ ...p }); setOpen(true); setAutoMode(false); };
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const periods = [...new Set(payrolls.map(p => p.period))].sort().reverse();
  const filteredPayrolls = periodFilter ? payrolls.filter(p => p.period === periodFilter) : payrolls;
  const totalPending = payrolls.filter(p => p.status === 'pendiente').reduce((s, p) => s + (p.netPay || 0), 0);
  const totalPaid    = payrolls.filter(p => p.status === 'pagado').reduce((s, p) => s + (p.netPay || 0), 0);

  // Latest review per employee
  const latestReview = useMemo(() => {
    const map = {};
    reviews.forEach(r => {
      if (!map[r.employeeId] || r.reviewDate > map[r.employeeId].reviewDate) map[r.employeeId] = r;
    });
    return map;
  }, [reviews]);

  // Auto-generate nómina for all active employees
  const generateBulk = async () => {
    const period = new Date().toISOString().slice(0, 7);
    const activeEmps = employees.filter(e => e.status === 'activo' && e.baseSalary > 0);
    if (!activeEmps.length) { toast.error('No hay empleados activos con salario registrado'); return; }

    const existing = payrolls.filter(p => p.period === period).map(p => p.employeeId);
    const toCreate = activeEmps.filter(e => !existing.includes(e.id));
    if (!toCreate.length) { toast.info(`Ya existe nómina para ${period}`); return; }

    const records = toCreate.map(emp => {
      const review = latestReview[emp.id] || null;
      const calc = autoCalcPayroll(emp, review);
      return {
        companyId: company.id, employeeId: emp.id, employeeName: emp.fullName,
        period, period_type: 'mensual', ...calc, status: 'pendiente',
        notes: review ? `Bono KPI: ${(calc.bonusPct * 100).toFixed(0)}% (score ${calc.avgScore.toFixed(1)}/10)` : 'Sin evaluación registrada',
      };
    });
    await firebase.entities.Payroll.bulkCreate(records);
    qc.invalidateQueries({ queryKey: companyEntityQueryKey('payrolls', company) });
    toast.success(`✅ ${records.length} nóminas generadas automáticamente para ${period}`);
  };

  const getAI = async () => {
    setAiLoading(true);
    setAiInsight('');
    const res = await firebase.integrations.Core.InvokeLLM({
      companyId: company.id,
      prompt: `Eres experto en nóminas y RRHH para PyMEs mexicanas. Analiza la nómina de "${company.name}".
Empleados activos: ${employees.filter(e => e.status === 'activo').length}
Nómina base mensual total: ${fmt(employees.filter(e => e.status === 'activo').reduce((s, e) => s + (e.baseSalary||0), 0))}
Nóminas pendientes: ${payrolls.filter(p=>p.status==='pendiente').length} por ${fmt(totalPending)}
Total pagado históricamente: ${fmt(totalPaid)}
Empleados con evaluación KPI: ${Object.keys(latestReview).length} de ${employees.length}
Distribución: ${employees.filter(e=>e.status==='activo').slice(0,8).map(e=>`${e.fullName}: ${fmt(e.baseSalary)} (${e.department||'sin dept'})`).join(', ')}

Proporciona:
1. 💰 Análisis del costo laboral y eficiencia de nómina
2. ⚠️ Alertas fiscales IMSS, ISR, INFONAVIT para México
3. 📊 Impacto del esquema de bonos por KPI en la motivación
4. 🎯 3 recomendaciones para optimizar la estructura de compensación
5. 📋 Checklist de cumplimiento laboral (STPS, IMSS, LFT)
Responde en español, tono experto en RRHH y derecho laboral mexicano.`,
    });
    setAiInsight(res);
    setAiLoading(false);
  };

  const onEmployeeChange = (empId) => {
    const emp = employees.find(e => e.id === empId);
    const review = latestReview[empId] || null;
    if (autoMode && emp) {
      const calc = autoCalcPayroll(emp, review);
      setForm(p => ({
        ...p,
        employeeId: empId,
        employeeName: emp.fullName,
        baseSalary: calc.baseSalary.toString(),
        bonuses: calc.bonuses.toString(),
        overtime: '0',
        deductions_imss: calc.deductions_imss.toString(),
        deductions_isr: calc.deductions_isr.toString(),
        other_deductions: '0',
        netPay: calc.netPay.toString(),
        notes: review ? `Bono KPI: ${(calc.bonusPct*100).toFixed(0)}% (score avg ${calc.avgScore.toFixed(1)}/10)` : 'Sin evaluación',
      }));
    } else {
      f('employeeId', empId);
      f('employeeName', emp?.fullName || '');
      f('baseSalary', emp?.baseSalary?.toString() || '');
    }
  };

  const selectedReview = latestReview[form.employeeId];
  const netPay = calcNet(form);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pendiente de pago', val: fmt(totalPending), color: 'text-amber-400' },
          { label: 'Total pagado', val: fmt(totalPaid), color: 'text-emerald-400' },
          { label: 'Registros totales', val: payrolls.length, color: 'text-foreground' },
          { label: 'Con evaluación KPI', val: `${Object.keys(latestReview).length}/${employees.length}`, color: 'text-blue-400' },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-xl font-bold font-mono ${color}`}>{val}</p>
          </div>
        ))}
      </div>

      {/* KPI-bonus legend */}
      <div className="p-3 rounded-2xl border border-border bg-secondary/40 flex flex-wrap gap-4 items-center text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-primary" /><strong className="text-foreground">Cálculo automático por KPI:</strong></span>
        <span>Score ≥9 → <strong className="text-amber-400">+15% bono</strong></span>
        <span>Score ≥7.5 → <strong className="text-blue-400">+8% bono</strong></span>
        <span>Score ≥6 → <strong className="text-foreground">+3% bono</strong></span>
        <span>Score &lt;6 → sin bono</span>
        <span className="ml-auto text-muted-foreground">IMSS 3.15% · ISR 10%</span>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {periods.length > 0 && (
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-40 bg-secondary border-border h-9 text-sm"><SelectValue placeholder="Todos los periodos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Todos</SelectItem>
                {periods.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" variant="outline" onClick={getAI} disabled={aiLoading || !employees.length} className="gap-2 border-border h-9">
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-primary" />}
            Análisis IA
          </Button>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={generateBulk} disabled={!employees.length}
            className="gap-2 border-primary/40 text-primary hover:bg-primary/10 h-9">
            <Zap className="w-4 h-4" /> Generar nómina del mes
          </Button>
          <Button size="sm" onClick={openNew} disabled={!employees.length} className="bg-primary text-primary-foreground gap-2">
            <Plus className="w-4 h-4" /> Nueva
          </Button>
        </div>
      </div>

      {employees.length === 0 && (
        <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-sm text-amber-400">
          ⚠️ Primero registra empleados en la pestaña "Directorio" para gestionar nóminas.
        </div>
      )}

      {/* AI Insight */}
      {(aiInsight || aiLoading) && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3"><Sparkles className="w-4 h-4 text-primary" /> Análisis de Nómina IA</p>
          {aiLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin text-primary" /> Analizando...</div>}
          {aiInsight && <div className="prose prose-sm prose-invert max-w-none text-sm text-muted-foreground"><ReactMarkdown>{aiInsight}</ReactMarkdown></div>}
        </div>
      )}

      {/* Payroll list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filteredPayrolls.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sin registros. Usa "Generar nómina del mes" para calcular automáticamente.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPayrolls.sort((a, b) => (b.period||'').localeCompare(a.period||'')).map(pay => {
            const cfg = statusConfig[pay.status] || statusConfig.pendiente;
            const Icon = cfg.icon;
            const hasBonus = pay.bonuses > 0;
            return (
              <div key={pay.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${cfg.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{pay.employeeName}</p>
                    <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                    {hasBonus && <Badge className="text-xs bg-amber-500/15 text-amber-400 border-amber-500/30">🎯 KPI Bono</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>📅 {pay.period}</span>
                    <span>Base: {fmt(pay.baseSalary)}</span>
                    {pay.bonuses > 0 && <span className="text-amber-400">+{fmt(pay.bonuses)} bono</span>}
                    {pay.deductions_isr > 0 && <span>-{fmt(pay.deductions_isr)} ISR</span>}
                    {pay.notes && <span className="text-muted-foreground/70 truncate max-w-xs">{pay.notes}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold text-emerald-400 font-mono">{fmt(pay.netPay)}</p>
                  <p className="text-xs text-muted-foreground">Neto</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {pay.status === 'pendiente' && (
                    <button onClick={() => updateStatus(pay.id, 'aprobado')} className="text-xs px-2 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 transition-colors">Aprobar</button>
                  )}
                  {pay.status === 'aprobado' && (
                    <button onClick={() => updateStatus(pay.id, 'pagado')} className="text-xs px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors">Pagar</button>
                  )}
                  <button onClick={() => openEdit(pay)} className="p-1.5 hover:text-primary text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => del.mutate(pay.id)} className="p-1.5 hover:text-destructive text-muted-foreground"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Nómina' : 'Nueva Nómina'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Auto mode toggle */}
            {!editing && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                <Zap className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 text-xs text-muted-foreground">
                  <span className="text-foreground font-medium">Cálculo automático por KPI</span> — el sistema aplica el bono según la última evaluación del empleado.
                </div>
                <button onClick={() => setAutoMode(a => !a)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${autoMode ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-muted-foreground border-border'}`}>
                  {autoMode ? 'Auto' : 'Manual'}
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Empleado</Label>
                <Select value={form.employeeId} onValueChange={onEmployeeChange}>
                  <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue placeholder="Selecciona empleado" /></SelectTrigger>
                  <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.fullName} — {e.position || e.department}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {/* KPI badge */}
              {selectedReview && (
                <div className="col-span-2 flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-xs text-amber-400">
                    Última evaluación: <strong>{selectedReview.period}</strong> — Score: <strong>{
                      (['score_productivity','score_quality','score_teamwork','score_punctuality','score_leadership']
                        .map(k => parseFloat(selectedReview[k])||0)
                        .reduce((s,v)=>s+v,0)/5).toFixed(1)
                    }/10</strong> → Bono <strong>{(kpiToBonusPercent(
                      ['score_productivity','score_quality','score_teamwork','score_punctuality','score_leadership']
                        .map(k=>parseFloat(selectedReview[k])||0)
                        .reduce((s,v)=>s+v,0)/5
                    )*100).toFixed(0)}%</strong>
                  </span>
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Período (YYYY-MM)</Label>
                <Input value={form.period} onChange={e => f('period', e.target.value)} placeholder="2025-05" className="mt-1 bg-secondary border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Select value={form.period_type} onValueChange={v => f('period_type', v)}>
                  <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="mensual">Mensual</SelectItem><SelectItem value="quincenal">Quincenal</SelectItem><SelectItem value="semanal">Semanal</SelectItem></SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Percepciones</p>
              <div className="grid grid-cols-3 gap-3">
                {[{key:'baseSalary',label:'Salario base'},{key:'bonuses',label:'Bonos KPI'},{key:'overtime',label:'Horas extra'}].map(({key,label}) => (
                  <div key={key}>
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <Input type="number" value={form[key]} onChange={e => f(key, e.target.value)} disabled={autoMode && !editing && key !== 'overtime'} placeholder="0" className="mt-1 bg-secondary border-border disabled:opacity-60" />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Deducciones</p>
              <div className="grid grid-cols-3 gap-3">
                {[{key:'deductions_imss',label:'IMSS (3.15%)'},{key:'deductions_isr',label:'ISR (10%)'},{key:'other_deductions',label:'Otras'}].map(({key,label}) => (
                  <div key={key}>
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <Input type="number" value={form[key]} onChange={e => f(key, e.target.value)} disabled={autoMode && !editing && key !== 'other_deductions'} placeholder="0" className="mt-1 bg-secondary border-border disabled:opacity-60" />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-sm font-medium text-foreground">Pago Neto</span>
              <span className="text-xl font-bold text-emerald-400 font-mono">{fmt(netPay)}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Estado</Label>
                <Select value={form.status} onValueChange={v => f('status', v)}>
                  <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(statusConfig).map(([k,v])=><SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Fecha de pago</Label>
                <Input type="date" value={form.paymentDate} onChange={e => f('paymentDate', e.target.value)} className="mt-1 bg-secondary border-border" />
              </div>
            </div>

            <Button onClick={() => {
              save.mutate({
                ...form,
                baseSalary: parseFloat(form.baseSalary)||0,
                bonuses: parseFloat(form.bonuses)||0,
                overtime: parseFloat(form.overtime)||0,
                deductions_imss: parseFloat(form.deductions_imss)||0,
                deductions_isr: parseFloat(form.deductions_isr)||0,
                other_deductions: parseFloat(form.other_deductions)||0,
                netPay: calcNet(form),
              });
            }} disabled={!form.employeeId||!form.period||save.isPending} className="w-full bg-primary text-primary-foreground gap-2">
              {save.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? 'Guardar cambios' : 'Crear Nómina'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
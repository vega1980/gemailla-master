import React, { useState } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { companyEntityQueryKey, useCompanyCrmClients, useCompanyCrmDeals } from '@/lib/companyEntityQueries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, TrendingUp, Pencil, Trash2, Loader2, Sparkles, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ReactMarkdown from 'react-markdown';

import { askLLM } from '@/modules/ai/aiService';
const stageConfig = {
  prospecto:       { label: 'Prospecto',       color: 'bg-secondary text-muted-foreground border-border',          prob: 10 },
  contactado:      { label: 'Contactado',      color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',           prob: 25 },
  propuesta:       { label: 'Propuesta',       color: 'bg-violet-500/15 text-violet-400 border-violet-500/30',     prob: 50 },
  negociacion:     { label: 'Negociación',     color: 'bg-amber-500/15 text-amber-400 border-amber-500/30',        prob: 75 },
  cerrado_ganado:  { label: 'Cerrado ✓',      color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',  prob: 100 },
  cerrado_perdido: { label: 'Perdido',         color: 'bg-red-500/15 text-red-400 border-red-500/30',              prob: 0 },
};

const STAGES_ORDER = ['prospecto', 'contactado', 'propuesta', 'negociacion', 'cerrado_ganado', 'cerrado_perdido'];
const EMPTY = { clientId: '', client_name: '', title: '', stage: 'prospecto', amount: '', probability: 10, expectedClose: '', assignedTo: '', description: '', notes: '' };
const fmt = (n) => `$${(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-xl p-3 text-xs shadow-xl">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>)}
    </div>
  );
};

export default function DealPipeline({ company }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [aiInsight, setAiInsight] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const { data: clients = [] } = useCompanyCrmClients(company);

  const { data: deals = [], isLoading } = useCompanyCrmDeals(company);

  const save = useMutation({
    mutationFn: (data) => editing
      ? firebase.entities.CRMDeal.update(editing.id, data)
      : firebase.entities.CRMDeal.create({ ...data, companyId: company.id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: companyEntityQueryKey('crmDeals', company) }); setOpen(false); setEditing(null); setForm(EMPTY); toast.success('Oportunidad guardada'); },
  });

  const del = useMutation({
    mutationFn: (id) => firebase.entities.CRMDeal.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: companyEntityQueryKey('crmDeals', company) }); toast.success('Oportunidad eliminada'); },
  });

  const moveStage = (deal, stage) => {
    const prob = stageConfig[stage]?.prob ?? deal.probability;
    firebase.entities.CRMDeal.update(deal.id, { stage, probability: prob }).then(() => qc.invalidateQueries({ queryKey: companyEntityQueryKey('crmDeals', company) }));
  };

  const openNew  = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (d) => { setEditing(d); setForm({ ...d }); setOpen(true); };
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // KPIs
  const active = deals.filter(d => !['cerrado_ganado','cerrado_perdido'].includes(d.stage));
  const won = deals.filter(d => d.stage === 'cerrado_ganado');
  const lost = deals.filter(d => d.stage === 'cerrado_perdido');
  const pipeline = active.reduce((s, d) => s + ((d.amount || 0) * (d.probability || 0) / 100), 0);
  const wonTotal = won.reduce((s, d) => s + (d.amount || 0), 0);
  const winRate = deals.filter(d => ['cerrado_ganado','cerrado_perdido'].includes(d.stage)).length > 0
    ? Math.round((won.length / (won.length + lost.length)) * 100) : 0;

  const chartData = STAGES_ORDER.slice(0, 4).map(k => ({
    stage: stageConfig[k].label,
    deals: deals.filter(d => d.stage === k).length,
    valor: deals.filter(d => d.stage === k).reduce((s, d) => s + (d.amount || 0), 0),
  }));

  const getAI = async () => {
    setAiLoading(true);
    setAiInsight('');
    const res = await askLLM({
      companyId: company.id,
      prompt: `Eres un director comercial experto en ventas B2B para PyMEs mexicanas. Analiza el pipeline de ventas de "${company.name}".

PIPELINE ACTIVO (${active.length} oportunidades):
${active.map(d => `- ${d.title} | Cliente: ${d.client_name || '?'} | Valor: ${fmt(d.amount)} | Etapa: ${stageConfig[d.stage]?.label} | Prob: ${d.probability}% | Cierre esperado: ${d.expectedClose || 'N/D'}`).join('\n') || 'Sin oportunidades activas'}

MÉTRICAS:
- Tasa de cierre: ${winRate}%
- Deals ganados: ${won.length} (${fmt(wonTotal)})
- Deals perdidos: ${lost.length}
- Pipeline esperado: ${fmt(pipeline)}

Proporciona:
1. 🔥 Top 3 oportunidades prioritarias y por qué
2. ⚠️ Riesgos detectados en el pipeline
3. 💡 3 acciones inmediatas para acelerar cierres
4. 📊 Proyección realista del mes y trimestre
5. 🎯 Estrategia para mejorar la tasa de cierre

Responde en español, tono director comercial, con datos y recomendaciones concretas.`,
    });
    setAiInsight(res);
    setAiLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pipeline esperado', value: fmt(pipeline), color: 'text-primary' },
          { label: 'Ganados', value: fmt(wonTotal), color: 'text-emerald-400' },
          { label: 'Oportunidades activas', value: active.length, color: 'text-foreground' },
          { label: 'Tasa de cierre', value: `${winRate}%`, color: winRate >= 50 ? 'text-emerald-400' : 'text-amber-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Funnel chart */}
      {deals.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-sm font-semibold text-foreground mb-4">Embudo de Ventas</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 14%)" />
              <XAxis dataKey="stage" tick={{ fill: 'hsl(0 0% 50%)', fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fill: 'hsl(0 0% 50%)', fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: 'hsl(0 0% 50%)', fontSize: 10 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} />
              <Bar yAxisId="left" dataKey="deals" name="Deals" fill="hsl(43 72% 53%)" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="valor" name="Valor" fill="hsl(43 50% 40%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{deals.length} oportunidad{deals.length !== 1 ? 'es' : ''}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={getAI} disabled={aiLoading || !deals.length} className="gap-2 border-border">
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-primary" />}
            Análisis IA
          </Button>
          <Button size="sm" onClick={openNew} className="bg-primary text-primary-foreground gap-2">
            <Plus className="w-4 h-4" /> Nueva Oportunidad
          </Button>
        </div>
      </div>

      {/* AI Insight */}
      {(aiInsight || aiLoading) && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3"><Sparkles className="w-4 h-4 text-primary" /> Análisis Comercial IA</p>
          {aiLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin text-primary" /> Analizando pipeline...</div>}
          {aiInsight && <div className="prose prose-sm prose-invert max-w-none text-sm text-muted-foreground"><ReactMarkdown>{aiInsight}</ReactMarkdown></div>}
        </div>
      )}

      {/* Kanban-style columns */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : deals.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sin oportunidades. Crea la primera.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {STAGES_ORDER.filter(s => deals.some(d => d.stage === s)).map(stage => {
            const cfg = stageConfig[stage];
            const stageDeals = deals.filter(d => d.stage === stage);
            const stageTotal = stageDeals.reduce((s, d) => s + (d.amount || 0), 0);
            return (
              <div key={stage}>
                <div className="flex items-center gap-3 mb-3">
                  <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                  <span className="text-xs text-muted-foreground">{stageDeals.length} deal{stageDeals.length !== 1 ? 's' : ''} · {fmt(stageTotal)}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {stageDeals.map(deal => (
                    <div key={deal.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{deal.title}</p>
                          {deal.client_name && <p className="text-xs text-muted-foreground">{deal.client_name}</p>}
                        </div>
                        <div className="flex items-center gap-1 ml-2 shrink-0">
                          <button onClick={() => openEdit(deal)} className="p-1 hover:text-primary text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => del.mutate(deal.id)} className="p-1 hover:text-destructive text-muted-foreground"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-lg font-bold text-primary font-mono">{fmt(deal.amount)}</p>
                        <span className="text-xs text-muted-foreground">{deal.probability}% prob.</span>
                      </div>

                      <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                        {deal.assignedTo && <span>👤 {deal.assignedTo}</span>}
                        {deal.expectedClose && <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{format(new Date(deal.expectedClose), "d MMM yy", { locale: es })}</span>}
                      </div>

                      {/* Stage advance buttons */}
                      {!['cerrado_ganado','cerrado_perdido'].includes(stage) && (
                        <div className="flex gap-1 flex-wrap">
                          {STAGES_ORDER.filter(s => s !== stage && s !== 'cerrado_perdido').slice(STAGES_ORDER.indexOf(stage)).slice(0, 2).map(s => (
                            <button key={s} onClick={() => moveStage(deal, s)}
                              className="text-xs px-2 py-1 rounded-lg bg-secondary hover:bg-primary/10 hover:text-primary text-muted-foreground border border-border transition-colors">
                              → {stageConfig[s].label}
                            </button>
                          ))}
                          <button onClick={() => moveStage(deal, 'cerrado_perdido')}
                            className="text-xs px-2 py-1 rounded-lg bg-secondary hover:bg-red-500/10 hover:text-red-400 text-muted-foreground border border-border transition-colors">
                            Perdido
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Oportunidad' : 'Nueva Oportunidad'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Nombre de la oportunidad</label>
                <Input value={form.title} onChange={e => f('title', e.target.value)} placeholder="Ej. Proyecto ERP para Grupo X" className="mt-1 bg-secondary border-border" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Cliente</label>
                <Select value={form.clientId} onValueChange={v => { const c = clients.find(cl => cl.id === v); f('clientId', v); f('client_name', c?.name || ''); }}>
                  <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Etapa</label>
                <Select value={form.stage} onValueChange={v => { f('stage', v); f('probability', stageConfig[v]?.prob ?? form.probability); }}>
                  <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(stageConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Valor estimado (MXN)</label>
                <Input type="number" value={form.amount} onChange={e => f('amount', e.target.value)} placeholder="0" className="mt-1 bg-secondary border-border" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Probabilidad (%)</label>
                <Input type="number" min="0" max="100" value={form.probability} onChange={e => f('probability', e.target.value)} className="mt-1 bg-secondary border-border" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Cierre esperado</label>
                <Input type="date" value={form.expectedClose} onChange={e => f('expectedClose', e.target.value)} className="mt-1 bg-secondary border-border" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Asignado a</label>
                <Input value={form.assignedTo} onChange={e => f('assignedTo', e.target.value)} placeholder="Ejecutivo" className="mt-1 bg-secondary border-border" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Descripción / Notas</label>
                <Textarea value={form.description} onChange={e => f('description', e.target.value)} className="mt-1 bg-secondary border-border h-20 resize-none" />
              </div>
            </div>
            <Button onClick={() => save.mutate({ ...form, amount: parseFloat(form.amount) || 0, probability: parseFloat(form.probability) || 0 })}
              disabled={!form.title || save.isPending} className="w-full bg-primary text-primary-foreground gap-2">
              {save.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? 'Guardar cambios' : 'Crear Oportunidad'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

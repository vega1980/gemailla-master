import React, { useState } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { companyEntityQueryKey, useCompanyKpis } from '@/lib/companyEntityQueries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Target, Sparkles, Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

import { askLLM } from '@modules/ai/services/aiService';
const statusConfig = {
  alcanzado:  { label: 'Alcanzado',  color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  en_curso:   { label: 'En curso',   color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  en_riesgo:  { label: 'En riesgo',  color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  critico:    { label: 'Crítico',    color: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

const catColors = {
  financiero: 'text-[#f0d080]', operacional: 'text-[#c5a059]',
  comercial: 'text-[#e8c97a]', talento: 'text-[#d4b57a]', cliente: 'text-[#b8956a]',
};

const EMPTY = { name: '', category: 'financiero', target: '', current: '', unit: '', frequency: 'mensual', status: 'en_curso', owner: '', notes: '' };

export default function StrategicKPIs({ company }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [aiInsight, setAiInsight] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const { data: kpis = [], isLoading } = useCompanyKpis(company);

  const displayKPIs = company ? kpis : [];

  const save = useMutation({
    mutationFn: async (data) => {
      if (!company) { toast.error('Selecciona una empresa para guardar'); return; }
      if (editing) return firebase.entities.KPI.update(editing.id, data);
      return firebase.entities.KPI.create({ ...data, companyId: company.id });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: companyEntityQueryKey('kpis', company) }); setOpen(false); setEditing(null); setForm(EMPTY); toast.success('KPI guardado'); },
  });

  const del = useMutation({
    mutationFn: (id) => firebase.entities.KPI.archive(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: companyEntityQueryKey('kpis', company) }); toast.success('KPI eliminado'); },
  });

  const openEdit = (kpi) => { setEditing(kpi); setForm({ ...kpi }); setOpen(true); };
  const openNew  = () => { setEditing(null); setForm(EMPTY); setOpen(true); };

  const pct = (kpi) => kpi.target > 0 ? Math.min(Math.round((kpi.current / kpi.target) * 100), 100) : 0;

  const getAIAnalysis = async () => {
    if (!displayKPIs.length) return;
    setAiLoading(true);
    setAiInsight(null);
    const res = await askLLM({
      companyId: company?.id,
      prompt: `Eres un consultor estratégico experto en PyMEs mexicanas. Analiza los KPIs de la empresa "${company?.name || 'Empresa sin seleccionar'}" y entrega un diagnóstico ejecutivo.

KPIs:
${displayKPIs.map(k => `- ${k.name} (${k.category}): ${k.current ?? 'N/D'} / ${k.target} ${k.unit || ''} — Estado: ${k.status} — Responsable: ${k.owner || 'sin asignar'}`).join('\n')}

Proporciona:
1. 📊 Evaluación general del desempeño estratégico
2. ✅ KPIs que van bien y por qué
3. ⚠️ KPIs en riesgo y acciones correctivas concretas
4. 💡 3 recomendaciones estratégicas para el siguiente trimestre
5. 🎯 Un KPI adicional que deberían medir según su perfil

Responde en español, formato estructurado, tono de consultor senior.`,
    });
    setAiInsight(res);
    setAiLoading(false);
  };

  const byCategory = displayKPIs.reduce((acc, k) => { (acc[k.category] = acc[k.category] || []).push(k); return acc; }, {});

  return (
    <div className="space-y-6">
      {/* Header actions con estilo dorado */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm" style={{color: 'rgba(197,160,89,0.7)'}}>{displayKPIs.length} KPI{displayKPIs.length !== 1 ? 's' : ''} definidos</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={getAIAnalysis} disabled={aiLoading || !displayKPIs.length} className="gap-2" style={{
            background: 'rgba(197,160,89,0.08)',
            border: '1px solid rgba(197,160,89,0.2)',
            color: '#c5a059'
          }}>
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{color: '#c5a059'}} /> : <Sparkles className="w-3.5 h-3.5" style={{color: '#f0d080'}} />}
            Análisis IA
          </Button>
          <Button size="sm" onClick={openNew} disabled={!company} className="gap-2" style={{
            background: 'linear-gradient(135deg, #f0d080 0%, #c5a059 100%)',
            color: '#050505',
            boxShadow: '0 2px 8px rgba(197,160,89,0.3)',
            opacity: !company ? 0.5 : 1
          }}>
            <Plus className="w-4 h-4" /> {company ? 'Nuevo KPI' : 'Selecciona empresa'}
          </Button>
        </div>
      </div>

      {/* Summary cards con estilo dorado */}
      {displayKPIs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(statusConfig).map(([key, cfg]) => {
            const count = kpis.filter(k => k.status === key).length;
            return (
              <div key={key} className="rounded-xl border p-3" style={{
                background: 'linear-gradient(135deg, rgba(197,160,89,0.08) 0%, rgba(197,160,89,0.02) 100%)',
                border: '1px solid rgba(197,160,89,0.2)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
              }}>
                <p className="text-xs mb-1" style={{color: 'rgba(197,160,89,0.7)'}}>{cfg.label}</p>
                <p className="text-2xl font-bold" style={{color: '#c5a059'}}>{count}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* KPIs by category */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : displayKPIs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay KPIs definidos. Crea el primero para comenzar.</p>
        </div>
      ) : (
        Object.entries(byCategory).map(([cat, items]) => (
          <div key={cat}>
            <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${catColors[cat] || 'text-muted-foreground'}`}>
              {cat}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
               {items.map(kpi => {
                 const p = pct(kpi);
                 const cfg = statusConfig[kpi.status] || statusConfig.en_curso;
                 return (
                   <div key={kpi.id || `demo-${kpi.name}`} className="rounded-2xl p-4 space-y-3" style={{
                     background: 'linear-gradient(135deg, rgba(197,160,89,0.06) 0%, rgba(197,160,89,0.02) 100%)',
                     border: '1px solid rgba(197,160,89,0.15)',
                     boxShadow: '0 2px 12px rgba(0,0,0,0.3)'
                   }}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{color: '#e8d5a3'}}>{kpi.name}</p>
                        {kpi.owner && <p className="text-xs" style={{color: 'rgba(197,160,89,0.6)'}}>{kpi.owner}</p>}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        {company && (<>
                        <button onClick={() => openEdit(kpi)} className="p-1 hover:text-primary text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => del.mutate(kpi.id)} className="p-1 hover:text-destructive text-muted-foreground"><Trash2 className="w-3.5 h-3.5" /></button>
                        </>)}
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <span className="text-2xl font-bold font-mono" style={{color: '#c5a059'}}>{kpi.current ?? '—'}</span>
                        <span className="text-xs ml-1" style={{color: 'rgba(197,160,89,0.6)'}}>{kpi.unit}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs" style={{color: 'rgba(197,160,89,0.6)'}}>Meta</p>
                        <p className="text-sm font-semibold" style={{color: '#e8d5a3'}}>{kpi.target} {kpi.unit}</p>
                      </div>
                    </div>
                    <Progress value={p} className="h-1.5" />
                    <div className="flex items-center justify-between">
                      <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                      <span className="text-xs text-muted-foreground">{p}% completado</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* AI Insight */}
      {(aiInsight || aiLoading) && (
        <div className="rounded-2xl p-5" style={{
          background: 'linear-gradient(135deg, rgba(197,160,89,0.06) 0%, rgba(197,160,89,0.02) 100%)',
          border: '1px solid rgba(197,160,89,0.15)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.3)'
        }}>
          <p className="text-sm font-semibold flex items-center gap-2 mb-3" style={{color: '#c5a059'}}>
            <Sparkles className="w-4 h-4" /> Diagnóstico Estratégico IA
          </p>
          {aiLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin text-primary" /> Analizando KPIs...</div>}
          {aiInsight && <div className="prose prose-sm prose-invert max-w-none text-sm text-muted-foreground leading-relaxed"><ReactMarkdown>{aiInsight}</ReactMarkdown></div>}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar KPI' : 'Nuevo KPI'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Nombre del KPI</Label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ej. Tasa de conversión" className="mt-1 bg-secondary border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Categoría</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['financiero','operacional','comercial','talento','cliente'].map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Estado</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Meta</Label>
                <Input type="number" value={form.target} onChange={e => setForm(p => ({ ...p, target: e.target.value }))} placeholder="100" className="mt-1 bg-secondary border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Valor actual</Label>
                <Input type="number" value={form.current} onChange={e => setForm(p => ({ ...p, current: e.target.value }))} placeholder="0" className="mt-1 bg-secondary border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Unidad</Label>
                <Input value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} placeholder="%, MXN, días..." className="mt-1 bg-secondary border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Frecuencia</Label>
                <Select value={form.frequency} onValueChange={v => setForm(p => ({ ...p, frequency: v }))}>
                  <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['diario','semanal','mensual','trimestral','anual'].map(f => <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Responsable</Label>
                <Input value={form.owner} onChange={e => setForm(p => ({ ...p, owner: e.target.value }))} placeholder="Nombre del responsable" className="mt-1 bg-secondary border-border" />
              </div>
            </div>
            <Button onClick={() => save.mutate({ ...form, target: parseFloat(form.target) || 0, current: parseFloat(form.current) || 0 })}
              disabled={!form.name || save.isPending} className="w-full bg-primary text-primary-foreground gap-2">
              {save.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? 'Guardar cambios' : 'Crear KPI'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

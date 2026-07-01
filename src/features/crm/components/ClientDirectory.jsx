import React, { useState } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { companyEntityQueryKey, useCompanyCrmClients } from '@/lib/companyEntityQueries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Users, Search, Pencil, Trash2, Loader2, Sparkles, Phone, Mail, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

import { askLLM } from '@/modules/ai/aiService';
const segmentConfig = {
  premium:    { label: 'Premium',    color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  recurrente: { label: 'Recurrente', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  potencial:  { label: 'Potencial',  color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  inactivo:   { label: 'Inactivo',   color: 'bg-secondary text-muted-foreground border-border' },
  perdido:    { label: 'Perdido',    color: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

const EMPTY = { name: '', email: '', phone: '', rfc: '', segment: 'potencial', industry: '', address: '', assignedTo: '', notes: '', total_revenue: '', status: 'activo' };

const fmt = (n) => n ? `$${Number(n).toLocaleString('es-MX', { maximumFractionDigits: 0 })}` : '—';

export default function ClientDirectory({ company }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [search, setSearch] = useState('');
  const [segFilter, setSegFilter] = useState('all');
  const [aiOpen, setAiOpen] = useState(null);
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const { data: clients = [], isLoading } = useCompanyCrmClients(company);

  const { data: interactions = [] } = useCompanyCrmInteractions(company);

  const save = useMutation({
    mutationFn: (data) => editing
      ? firebase.entities.CRMClient.update(editing.id, data)
      : firebase.entities.CRMClient.create({ ...data, companyId: company.id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: companyEntityQueryKey('crmClients', company) }); setOpen(false); setEditing(null); setForm(EMPTY); toast.success('Cliente guardado'); },
  });

  const del = useMutation({
    mutationFn: (id) => firebase.entities.CRMClient.archive(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: companyEntityQueryKey('crmClients', company) }); toast.success('Cliente eliminado'); },
  });

  const openEdit = (c) => { setEditing(c); setForm({ ...c }); setOpen(true); };
  const openNew  = () => { setEditing(null); setForm(EMPTY); setOpen(true); };

  const getAI = async (client) => {
    setAiOpen(client.id);
    setAiResult('');
    setAiLoading(true);
    const clientInteractions = interactions.filter(i => i.clientId === client.id);
    const res = await askLLM({
      companyId: company.id,
      prompt: `Eres un consultor de CRM experto en PyMEs mexicanas. Analiza al cliente "${client.name}" de la empresa "${company.name}" y genera una estrategia personalizada.

DATOS DEL CLIENTE:
- Segmento: ${client.segment}
- Industria: ${client.industry || 'no especificada'}
- Ingreso acumulado: ${fmt(client.total_revenue)}
- Ejecutivo asignado: ${client.assignedTo || 'sin asignar'}
- Estado: ${client.status}
- Notas: ${client.notes || 'ninguna'}

HISTORIAL DE INTERACCIONES (${clientInteractions.length} registradas):
${clientInteractions.slice(-5).map(i => `- [${i.date}] ${i.type}: ${i.summary}`).join('\n') || 'Sin interacciones registradas'}

Proporciona:
1. 🎯 Perfil del cliente y valor potencial
2. 📈 Estrategia de retención/crecimiento personalizada (3 acciones concretas)
3. 💡 Próximos pasos recomendados para el ejecutivo de cuenta
4. ⚠️ Señales de riesgo o alertas según los datos

Responde en español, tono consultor, conciso y accionable.`,
    });
    setAiResult(res);
    setAiLoading(false);
  };

  // Summary by segment
  const bySeg = Object.fromEntries(Object.keys(segmentConfig).map(k => [k, clients.filter(c => c.segment === k).length]));
  const totalRevenue = clients.reduce((s, c) => s + (c.total_revenue || 0), 0);

  const filtered = clients.filter(c => {
    const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase());
    const matchSeg = segFilter === 'all' || c.segment === segFilter;
    return matchSearch && matchSeg;
  });

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-6">
      {/* Summary */}
      {clients.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(segmentConfig).map(([k, cfg]) => (
            <div key={k} className={`rounded-2xl border p-3 cursor-pointer ${segFilter === k ? cfg.color : 'bg-card border-border'}`} onClick={() => setSegFilter(segFilter === k ? 'all' : k)}>
              <p className="text-xs text-muted-foreground">{cfg.label}</p>
              <p className="text-xl font-bold">{bySeg[k] || 0}</p>
            </div>
          ))}
          <div className="rounded-2xl border border-border bg-card p-3 col-span-2 sm:col-span-3 lg:col-span-1">
            <p className="text-xs text-muted-foreground">Revenue Total</p>
            <p className="text-lg font-bold text-primary">{fmt(totalRevenue)}</p>
          </div>
        </div>
      )}

      {/* Filters + Actions */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente..." className="pl-9 bg-secondary border-border" />
          </div>
          <Select value={segFilter} onValueChange={setSegFilter}>
            <SelectTrigger className="w-36 bg-secondary border-border"><SelectValue placeholder="Segmento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(segmentConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={openNew} className="bg-primary text-primary-foreground gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Nuevo Cliente
        </Button>
      </div>

      {/* Client Cards */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sin clientes. Agrega el primero.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(client => {
            const cfg = segmentConfig[client.segment] || segmentConfig.potencial;
            const clientInts = interactions.filter(i => i.clientId === client.id).length;
            const isAiOpen = aiOpen === client.id;
            return (
              <div key={client.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{client.name}</p>
                    {client.industry && <p className="text-xs text-muted-foreground">{client.industry}</p>}
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <button onClick={() => openEdit(client)} className="p-1 hover:text-primary text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => del.mutate(client.id)} className="p-1 hover:text-destructive text-muted-foreground"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                <div className="space-y-1">
                  {client.email && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="w-3 h-3" />{client.email}</p>}
                  {client.phone && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="w-3 h-3" />{client.phone}</p>}
                  {client.assignedTo && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Building2 className="w-3 h-3" />{client.assignedTo}</p>}
                </div>

                <div className="flex items-center justify-between">
                  <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {client.total_revenue > 0 && <span className="text-primary font-medium">{fmt(client.total_revenue)}</span>}
                    {clientInts > 0 && <span>{clientInts} int.</span>}
                  </div>
                </div>

                <Button size="sm" variant="ghost" onClick={() => isAiOpen ? setAiOpen(null) : getAI(client)}
                  className="w-full text-xs h-7 text-primary hover:bg-primary/10 gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {isAiOpen ? 'Ocultar análisis' : 'Estrategia IA'}
                </Button>

                {isAiOpen && (
                  <div className="pt-2 border-t border-border">
                    {aiLoading
                      ? <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> Analizando...</div>
                      : <div className="text-xs text-muted-foreground prose prose-sm prose-invert max-w-none"><ReactMarkdown>{aiResult}</ReactMarkdown></div>
                    }
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Nombre / Empresa</label>
                <Input value={form.name} onChange={e => f('name', e.target.value)} placeholder="Ej. Grupo Martínez S.A." className="mt-1 bg-secondary border-border" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Email</label>
                <Input value={form.email} onChange={e => f('email', e.target.value)} placeholder="contacto@empresa.com" className="mt-1 bg-secondary border-border" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Teléfono</label>
                <Input value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="+52 55 1234 5678" className="mt-1 bg-secondary border-border" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">RFC</label>
                <Input value={form.rfc} onChange={e => f('rfc', e.target.value)} placeholder="RFC del cliente" className="mt-1 bg-secondary border-border" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Industria</label>
                <Input value={form.industry} onChange={e => f('industry', e.target.value)} placeholder="Tecnología, manufactura..." className="mt-1 bg-secondary border-border" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Segmento</label>
                <Select value={form.segment} onValueChange={v => f('segment', v)}>
                  <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(segmentConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Estado</label>
                <Select value={form.status} onValueChange={v => f('status', v)}>
                  <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="activo">Activo</SelectItem><SelectItem value="inactivo">Inactivo</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Ejecutivo asignado</label>
                <Input value={form.assignedTo} onChange={e => f('assignedTo', e.target.value)} placeholder="Nombre del ejecutivo" className="mt-1 bg-secondary border-border" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Revenue acumulado (MXN)</label>
                <Input type="number" value={form.total_revenue} onChange={e => f('total_revenue', e.target.value)} placeholder="0" className="mt-1 bg-secondary border-border" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Notas</label>
                <Textarea value={form.notes} onChange={e => f('notes', e.target.value)} className="mt-1 bg-secondary border-border h-20 resize-none" />
              </div>
            </div>
            <Button onClick={() => save.mutate({ ...form, total_revenue: parseFloat(form.total_revenue) || 0 })}
              disabled={!form.name || save.isPending} className="w-full bg-primary text-primary-foreground gap-2">
              {save.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? 'Guardar cambios' : 'Crear Cliente'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

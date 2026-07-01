import React, { useState } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { companyEntityQueryKey, useCompanyCrmClients, useCompanyCrmInteractions } from '@/lib/companyEntityQueries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, MessageSquare, Search, Pencil, Trash2, Loader2, Phone, Mail, Users, CalendarDays, FileText, Video, MessageCircle, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const typeConfig = {
  llamada:     { label: 'Llamada',     icon: Phone,          color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  email:       { label: 'Email',       icon: Mail,           color: 'bg-violet-500/15 text-violet-400 border-violet-500/30' },
  reunion:     { label: 'Reunión',     icon: Users,          color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  demo:        { label: 'Demo',        icon: Video,          color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  propuesta:   { label: 'Propuesta',   icon: FileText,       color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
  seguimiento: { label: 'Seguimiento', icon: MessageCircle,  color: 'bg-pink-500/15 text-pink-400 border-pink-500/30' },
  queja:       { label: 'Queja',       icon: MessageSquare,  color: 'bg-red-500/15 text-red-400 border-red-500/30' },
  pedido:      { label: 'Pedido',      icon: ShoppingCart,   color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  otro:        { label: 'Otro',        icon: MessageSquare,  color: 'bg-secondary text-muted-foreground border-border' },
};

const EMPTY = { clientId: '', type: 'llamada', date: new Date().toISOString().slice(0, 10), summary: '', outcome: '' };

export default function InteractionHistory({ company }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');

  const { data: clients = [] } = useCompanyCrmClients(company);

  const { data: interactions = [], isLoading } = useCompanyCrmInteractions(company);

  const save = useMutation({
    mutationFn: (data) => editing
      ? firebase.entities.CRMInteraction.update(editing.id, data)
      : firebase.entities.CRMInteraction.create({ ...data, companyId: company.id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: companyEntityQueryKey('crmInteractions', company) }); setOpen(false); setEditing(null); setForm(EMPTY); toast.success('Interacción guardada'); },
  });

  const del = useMutation({
    mutationFn: (id) => firebase.entities.CRMInteraction.archive(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: companyEntityQueryKey('crmInteractions', company) }); toast.success('Interacción eliminada'); },
  });

  const openEdit = (i) => { setEditing(i); setForm({ ...i }); setOpen(true); };
  const openNew  = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const clientName = (id) => clients.find(c => c.id === id)?.name || '—';

  const filtered = interactions
    .filter(i => {
      const matchSearch = !search || i.summary?.toLowerCase().includes(search.toLowerCase()) || clientName(i.clientId).toLowerCase().includes(search.toLowerCase());
      const matchType = typeFilter === 'all' || i.type === typeFilter;
      const matchClient = clientFilter === 'all' || i.clientId === clientFilter;
      return matchSearch && matchType && matchClient;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-6">
      {/* Summary chips */}
      {interactions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(typeConfig).map(([k, cfg]) => {
            const count = interactions.filter(i => i.type === k).length;
            if (!count) return null;
            const Icon = cfg.icon;
            return (
              <button key={k} onClick={() => setTypeFilter(typeFilter === k ? 'all' : k)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-all ${typeFilter === k ? cfg.color : 'bg-card border-border text-muted-foreground hover:border-primary/40'}`}>
                <Icon className="w-3 h-3" />{cfg.label} <span className="font-bold">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Filters + Actions */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-1 min-w-0 flex-wrap">
          <div className="relative min-w-40 flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-9 bg-secondary border-border" />
          </div>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-44 bg-secondary border-border"><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={openNew} className="bg-primary text-primary-foreground gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Nueva Interacción
        </Button>
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sin interacciones registradas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const cfg = typeConfig[item.type] || typeConfig.otro;
            const Icon = cfg.icon;
            return (
              <div key={item.id} className="bg-card border border-border rounded-2xl p-4 flex gap-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${cfg.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                    <span className="text-xs text-muted-foreground font-medium">{clientName(item.clientId)}</span>
                    <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      {format(new Date(item.date), "d MMM yyyy", { locale: es })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{item.summary}</p>
                  {item.outcome && <p className="text-xs text-muted-foreground mt-1">→ {item.outcome}</p>}
                </div>
                <div className="flex items-start gap-1 shrink-0">
                  <button onClick={() => openEdit(item)} className="p-1 hover:text-primary text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => del.mutate(item.id)} className="p-1 hover:text-destructive text-muted-foreground"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader><DialogTitle>{editing ? 'Editar Interacción' : 'Nueva Interacción'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Cliente</label>
                <Select value={form.clientId} onValueChange={v => f('clientId', v)}>
                  <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue placeholder="Selecciona cliente" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Tipo</label>
                <Select value={form.type} onValueChange={v => f('type', v)}>
                  <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(typeConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Fecha</label>
                <Input type="date" value={form.date} onChange={e => f('date', e.target.value)} className="mt-1 bg-secondary border-border" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Resumen</label>
                <Textarea value={form.summary} onChange={e => f('summary', e.target.value)} placeholder="¿Qué ocurrió en esta interacción?" className="mt-1 bg-secondary border-border h-24 resize-none" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Resultado / Siguiente paso</label>
                <Input value={form.outcome} onChange={e => f('outcome', e.target.value)} placeholder="Ej. Agendar demo la próxima semana" className="mt-1 bg-secondary border-border" />
              </div>
            </div>
            <Button onClick={() => save.mutate(form)} disabled={!form.clientId || !form.summary || save.isPending} className="w-full bg-primary text-primary-foreground gap-2">
              {save.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? 'Guardar cambios' : 'Registrar Interacción'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
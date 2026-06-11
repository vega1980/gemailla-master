import React, { useMemo, useState } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { companyEntityQueryKey, getPaginatedItems, usePaginatedCompanyCrmClients, useCompanyCrmInteractions } from '@/lib/companyEntityQueries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, Users, Loader2, Pencil, Trash2, ChevronDown, ChevronRight, Phone, Mail, Calendar, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const segmentConfig = {
  premium:    { label: 'Premium',    color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  recurrente: { label: 'Recurrente', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  nuevo:      { label: 'Nuevo',      color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  inactivo:   { label: 'Inactivo',   color: 'bg-secondary text-muted-foreground border-border' },
  prospecto:  { label: 'Prospecto',  color: 'bg-violet-500/15 text-violet-400 border-violet-500/30' },
};

const statusConfig = {
  activo:    { label: 'Activo',    color: 'bg-emerald-500/15 text-emerald-400' },
  inactivo:  { label: 'Inactivo',  color: 'bg-secondary text-muted-foreground' },
  prospecto: { label: 'Prospecto', color: 'bg-violet-500/15 text-violet-400' },
  perdido:   { label: 'Perdido',   color: 'bg-red-500/15 text-red-400' },
};

const interactionTypeLabel = { llamada: '📞', email: '✉️', reunion: '🤝', cotizacion: '💰', pedido: '📦', soporte: '🔧', otro: '📝' };

const EMPTY_CLIENT = { name: '', email: '', phone: '', segment: 'prospecto', status: 'prospecto', industry: '', total_revenue: '', notes: '' };
const EMPTY_INT = { type: 'llamada', subject: '', notes: '', date: '', outcome: '', nextAction: '', nextActionDate: '' };

const fmt = (n) => `$${(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;

export default function ClientList({ company }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [segFilter, setSegFilter] = useState('all');
  const [openClient, setOpenClient] = useState(false);
  const [openInt, setOpenInt] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [activeClientId, setActiveClientId] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [form, setForm] = useState(EMPTY_CLIENT);
  const [intForm, setIntForm] = useState(EMPTY_INT);

  const clientFilters = useMemo(() => (segFilter === 'all' ? {} : { segment: segFilter }), [segFilter]);
  const {
    data: clientPages,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = usePaginatedCompanyCrmClients(company, { pageSize: 40, filters: clientFilters });
  const clients = useMemo(() => getPaginatedItems(clientPages), [clientPages]);

  const { data: interactions = [] } = useCompanyCrmInteractions(company);

  const saveClient = useMutation({
    mutationFn: (data) => editingClient
      ? firebase.entities.CRMClient.update(editingClient.id, data)
      : firebase.entities.CRMClient.create({ ...data, companyId: company.id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company-entity-page', 'crmClients', company?.id] }); setOpenClient(false); setEditingClient(null); setForm(EMPTY_CLIENT); toast.success('Cliente guardado'); },
  });

  const delClient = useMutation({
    mutationFn: (id) => firebase.entities.CRMClient.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['company-entity-page', 'crmClients', company?.id] }); toast.success('Cliente eliminado'); },
  });

  const saveInt = useMutation({
    mutationFn: (data) => firebase.entities.CRMInteraction.create({ ...data, companyId: company.id, clientId: activeClientId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: companyEntityQueryKey('crmInteractions', company) }); setOpenInt(false); setIntForm(EMPTY_INT); toast.success('Interacción registrada'); },
  });

  const filtered = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()));

  const openNewClient = () => { setEditingClient(null); setForm(EMPTY_CLIENT); setOpenClient(true); };
  const openEditClient = (c) => { setEditingClient(c); setForm({ ...c }); setOpenClient(true); };
  const openNewInt = (clientId) => { setActiveClientId(clientId); setIntForm({ ...EMPTY_INT, date: new Date().toISOString().split('T')[0] }); setOpenInt(true); };
  const toggleExpand = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const totalRevenue = clients.reduce((s, c) => s + (c.total_revenue || 0), 0);
  const activeCount = clients.filter(c => c.status === 'activo').length;

  return (
    <div className="space-y-5">
      {/* Summary */}
      {clients.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Clientes', val: clients.length, color: 'text-foreground' },
            { label: 'Activos', val: activeCount, color: 'text-emerald-400' },
            { label: 'Prospectos', val: clients.filter(c => c.status === 'prospecto').length, color: 'text-violet-400' },
            { label: 'Revenue Total', val: fmt(totalRevenue), color: 'text-amber-400' },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className={`text-xl font-bold font-mono ${color}`}>{val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters + actions */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar en clientes cargados..." className="pl-8 bg-secondary border-border h-9 text-sm" />
          </div>
          <Select value={segFilter} onValueChange={setSegFilter}>
            <SelectTrigger className="w-36 h-9 bg-secondary border-border text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(segmentConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={openNewClient} className="bg-primary text-primary-foreground gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Nuevo Cliente
        </Button>
      </div>

      {/* Client list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay clientes. Agrega el primero.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(client => {
            const clientInts = interactions.filter(i => i.clientId === client.id).sort((a, b) => new Date(b.date) - new Date(a.date));
            const isExpanded = expanded[client.id];
            const seg = segmentConfig[client.segment];
            const sta = statusConfig[client.status];
            return (
              <div key={client.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="p-4 flex items-start gap-3">
                  <button onClick={() => toggleExpand(client.id)} className="mt-0.5 text-muted-foreground hover:text-foreground">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-foreground">{client.name}</p>
                      {seg && <Badge className={`text-xs ${seg.color}`}>{seg.label}</Badge>}
                      {sta && <Badge className={`text-xs ${sta.color}`}>{sta.label}</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {client.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{client.email}</span>}
                      {client.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{client.phone}</span>}
                      {client.lastContact && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Último contacto: {format(new Date(client.lastContact), 'd MMM yy', { locale: es })}</span>}
                      {client.total_revenue > 0 && <span className="text-amber-400 font-medium">{fmt(client.total_revenue)}</span>}
                      <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{clientInts.length} interacciones</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openNewInt(client.id)} className="p-1.5 hover:text-primary text-muted-foreground" title="Registrar interacción"><MessageSquare className="w-3.5 h-3.5" /></button>
                    <button onClick={() => openEditClient(client)} className="p-1.5 hover:text-primary text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => delClient.mutate(client.id)} className="p-1.5 hover:text-destructive text-muted-foreground"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border bg-secondary/20 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Historial de Interacciones</p>
                      <Button size="sm" variant="ghost" onClick={() => openNewInt(client.id)} className="h-7 text-xs gap-1 text-primary hover:bg-primary/10">
                        <Plus className="w-3.5 h-3.5" /> Registrar
                      </Button>
                    </div>
                    {clientInts.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">Sin interacciones registradas.</p>
                    ) : (
                      <div className="space-y-2">
                        {clientInts.slice(0, 5).map(int => (
                          <div key={int.id} className="flex items-start gap-3 p-2.5 bg-card rounded-xl border border-border/50">
                            <span className="text-base mt-0.5">{interactionTypeLabel[int.type] || '📝'}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground">{int.subject || int.type}</p>
                              {int.notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{int.notes}</p>}
                              {int.nextAction && <p className="text-xs text-primary mt-0.5">→ {int.nextAction}</p>}
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">{format(new Date(int.date), 'd MMM', { locale: es })}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {client.notes && (
                      <div className="mt-3 p-3 bg-card rounded-xl border border-border/50">
                        <p className="text-xs text-muted-foreground">{client.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {hasNextPage && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="border-border">
            {isFetchingNextPage ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Cargar más clientes
          </Button>
        </div>
      )}

      {/* Client Dialog */}
      <Dialog open={openClient} onOpenChange={setOpenClient}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Nombre completo / Empresa</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ej. Empresa ABC" className="mt-1 bg-secondary border-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@empresa.com" className="mt-1 bg-secondary border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Teléfono</Label>
                <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+52 55..." className="mt-1 bg-secondary border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Segmento</Label>
                <Select value={form.segment} onValueChange={v => setForm(p => ({ ...p, segment: v }))}>
                  <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(segmentConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Estado</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Industria</Label>
                <Input value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))} placeholder="Ej. Manufactura" className="mt-1 bg-secondary border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Revenue (MXN)</Label>
                <Input type="number" value={form.total_revenue} onChange={e => setForm(p => ({ ...p, total_revenue: e.target.value }))} placeholder="0" className="mt-1 bg-secondary border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Último contacto</Label>
                <Input type="date" value={form.lastContact} onChange={e => setForm(p => ({ ...p, lastContact: e.target.value }))} className="mt-1 bg-secondary border-border" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Notas</Label>
              <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="mt-1 bg-secondary border-border h-20 resize-none" />
            </div>
            <Button onClick={() => saveClient.mutate({ ...form, total_revenue: parseFloat(form.total_revenue) || 0 })}
              disabled={!form.name || saveClient.isPending} className="w-full bg-primary text-primary-foreground gap-2">
              {saveClient.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingClient ? 'Guardar cambios' : 'Crear Cliente'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Interaction Dialog */}
      <Dialog open={openInt} onOpenChange={setOpenInt}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader><DialogTitle>Registrar Interacción</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Select value={intForm.type} onValueChange={v => setIntForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(interactionTypeLabel).map(([k, ico]) => <SelectItem key={k} value={k}>{ico} {k}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Fecha</Label>
                <Input type="date" value={intForm.date} onChange={e => setIntForm(p => ({ ...p, date: e.target.value }))} className="mt-1 bg-secondary border-border" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Asunto</Label>
              <Input value={intForm.subject} onChange={e => setIntForm(p => ({ ...p, subject: e.target.value }))} placeholder="Ej. Llamada de seguimiento" className="mt-1 bg-secondary border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Notas / Resumen</Label>
              <Textarea value={intForm.notes} onChange={e => setIntForm(p => ({ ...p, notes: e.target.value }))} className="mt-1 bg-secondary border-border h-20 resize-none" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Resultado</Label>
              <Input value={intForm.outcome} onChange={e => setIntForm(p => ({ ...p, outcome: e.target.value }))} placeholder="Ej. Cliente interesado" className="mt-1 bg-secondary border-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Próxima acción</Label>
                <Input value={intForm.nextAction} onChange={e => setIntForm(p => ({ ...p, nextAction: e.target.value }))} placeholder="Ej. Enviar propuesta" className="mt-1 bg-secondary border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Fecha próxima acción</Label>
                <Input type="date" value={intForm.nextActionDate} onChange={e => setIntForm(p => ({ ...p, nextActionDate: e.target.value }))} className="mt-1 bg-secondary border-border" />
              </div>
            </div>
            <Button onClick={() => saveInt.mutate(intForm)} disabled={!intForm.date || saveInt.isPending} className="w-full bg-primary text-primary-foreground gap-2">
              {saveInt.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
import React, { useMemo, useState } from 'react';
import { getPaginatedItems, usePaginatedCompanyAuditLogs } from '@/lib/companyEntityQueries';
import { useCompany } from '@/lib/companyContext';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Activity, FileText, ArrowUpDown, Brain, Building2, Shield,
  UserPlus, LogIn, Trash2, Download, Search, Loader2, X, SlidersHorizontal
} from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

// Entity types grouped for filter
const ENTITY_TYPES = [
  { value: 'all', label: 'Todas las entidades' },
  { value: 'Transaction', label: 'Transacciones' },
  { value: 'Document', label: 'Documentos' },
  { value: 'Company', label: 'Empresas' },
  { value: 'CompanyMember', label: 'Miembros' },
  { value: 'AuditLog', label: 'Auditoría' },
];

const actionConfig = {
  login: { icon: LogIn, label: 'Inicio de sesión', color: 'text-blue-400 bg-blue-500/10' },
  document_upload: { icon: FileText, label: 'Documento subido', color: 'text-primary bg-primary/10' },
  document_analyze: { icon: Brain, label: 'Documento analizado', color: 'text-purple-400 bg-purple-500/10' },
  document_delete: { icon: Trash2, label: 'Documento eliminado', color: 'text-red-400 bg-red-500/10' },
  transaction_create: { icon: ArrowUpDown, label: 'Transacción creada', color: 'text-emerald-400 bg-emerald-500/10' },
  transaction_update: { icon: ArrowUpDown, label: 'Transacción actualizada', color: 'text-yellow-400 bg-yellow-500/10' },
  transaction_delete: { icon: Trash2, label: 'Transacción eliminada', color: 'text-red-400 bg-red-500/10' },
  ai_query: { icon: Brain, label: 'Consulta IA', color: 'text-primary bg-primary/10' },
  company_create: { icon: Building2, label: 'Empresa creada', color: 'text-primary bg-primary/10' },
  company_update: { icon: Building2, label: 'Empresa actualizada', color: 'text-blue-400 bg-blue-500/10' },
  member_add: { icon: UserPlus, label: 'Miembro agregado', color: 'text-emerald-400 bg-emerald-500/10' },
  member_remove: { icon: UserPlus, label: 'Miembro removido', color: 'text-red-400 bg-red-500/10' },
  audit_run: { icon: Shield, label: 'Auditoría ejecutada', color: 'text-primary bg-primary/10' },
  export_data: { icon: Download, label: 'Datos exportados', color: 'text-blue-400 bg-blue-500/10' },
};

export default function ActivityLog() {
  const { activeCompany } = useCompany();
  const [filterAction, setFilterAction] = useState('all');
  const [filterEntity, setFilterEntity] = useState('all');
  const [filterUser, setFilterUser] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const activityFilters = useMemo(() => {
    const filters = {};
    if (filterAction !== 'all') filters.action = filterAction;
    if (filterEntity !== 'all') filters.entity_type = filterEntity;
    if (filterUser) filters.userEmail = filterUser;

    const dateFilters = [];
    if (dateFrom) dateFilters.push({ op: '>=', value: startOfDay(parseISO(dateFrom)).toISOString() });
    if (dateTo) dateFilters.push({ op: '<=', value: endOfDay(parseISO(dateTo)).toISOString() });
    if (dateFilters.length) filters.createdAt = dateFilters;

    return filters;
  }, [dateFrom, dateTo, filterAction, filterEntity, filterUser]);

  const {
    data: logPages,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = usePaginatedCompanyAuditLogs(activeCompany, { pageSize: 50, filters: activityFilters });
  const logs = useMemo(() => getPaginatedItems(logPages), [logPages]);

  // Unique users from loaded log pages; selecting one moves the user filter to Firestore.
  const uniqueUsers = useMemo(() => [...new Set(logs.map(l => l.userEmail).filter(Boolean))], [logs]);

  const clearFilters = () => {
    setFilterAction('all');
    setFilterEntity('all');
    setFilterUser('');
    setDateFrom('');
    setDateTo('');
    setSearch('');
  };

  const hasActiveFilters = filterAction !== 'all' || filterEntity !== 'all' || filterUser || dateFrom || dateTo || search;

  const filtered = logs.filter(l => {
    const matchSearch = !search || l.details?.toLowerCase().includes(search.toLowerCase()) || l.userEmail?.toLowerCase().includes(search.toLowerCase()) || l.userName?.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  if (!activeCompany) return <EmptyState icon={Activity} title="Selecciona una empresa" description="Necesitas una empresa activa." />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Registro de Actividad"
        description="Trazabilidad completa de acciones del sistema."
        actions={
          <Button variant="outline" size="sm" onClick={() => setShowFilters(p => !p)} className={`gap-2 border-border ${showFilters ? 'bg-primary/10 border-primary/40 text-primary' : ''}`}>
            <SlidersHorizontal className="w-4 h-4" />
            Filtros avanzados
            {hasActiveFilters && <span className="ml-1 w-2 h-2 rounded-full bg-primary" />}
          </Button>
        }
      />

      {/* Search bar always visible */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar en actividad cargada..." className="pl-10 bg-card border-border" />
      </div>

      {/* Advanced filters panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
            <div className="p-4 rounded-xl border border-border bg-card space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Filter by action */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium">Tipo de acción</label>
                  <Select value={filterAction} onValueChange={setFilterAction}>
                    <SelectTrigger className="bg-secondary border-border text-sm h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las acciones</SelectItem>
                      {Object.entries(actionConfig).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter by entity type */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium">Entidad financiera</label>
                  <Select value={filterEntity} onValueChange={setFilterEntity}>
                    <SelectTrigger className="bg-secondary border-border text-sm h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ENTITY_TYPES.map(e => (
                        <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter by user */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium">Usuario</label>
                  <Select value={filterUser || 'all'} onValueChange={v => setFilterUser(v === 'all' ? '' : v)}>
                    <SelectTrigger className="bg-secondary border-border text-sm h-9"><SelectValue placeholder="Todos los usuarios" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los usuarios</SelectItem>
                      {uniqueUsers.map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date range */}
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium">Rango de fechas</label>
                  <div className="flex gap-1.5">
                    <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-secondary border-border text-xs h-9 px-2" />
                    <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-secondary border-border text-xs h-9 px-2" />
                  </div>
                </div>
              </div>

              {hasActiveFilters && (
                <div className="flex items-center justify-between pt-1 border-t border-border">
                  <span className="text-xs text-muted-foreground">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}</span>
                  <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-3 h-3" /> Limpiar filtros
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Activity} title="Sin actividad" description="No se han registrado acciones aún." />
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map(log => {
              const config = actionConfig[log.action] || { icon: Activity, label: log.action, color: 'text-muted-foreground bg-muted' };
              const Icon = config.icon;
              return (
                <motion.div key={log.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
                  <div className={`p-2 rounded-lg shrink-0 ${config.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs border-border">{config.label}</Badge>
                      {log.entity_type && <span className="text-xs text-muted-foreground">{log.entity_type}</span>}
                    </div>
                    {log.details && <p className="text-sm text-foreground mt-1 truncate">{log.details}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {log.userName || log.userEmail}
                      {log.createdAt && ` · ${format(new Date(log.createdAt), "dd MMM yyyy, HH:mm", { locale: es })}`}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {hasNextPage && (
            <div className="flex justify-center pt-3">
              <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="border-border">
                {isFetchingNextPage ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Cargar más actividad
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
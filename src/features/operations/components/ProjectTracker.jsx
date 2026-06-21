import React, { useState } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { companyEntityQueryKey, useCompanyProjects, useCompanyProjectTasks } from '@/lib/companyEntityQueries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, FolderKanban, Loader2, Pencil, Trash2, ChevronDown, ChevronRight, CheckCircle2, Circle, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const statusConfig = {
  planificado: { label: 'Planificado', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  en_curso:    { label: 'En curso',    color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  pausado:     { label: 'Pausado',     color: 'bg-secondary text-muted-foreground border-border' },
  completado:  { label: 'Completado',  color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  cancelado:   { label: 'Cancelado',   color: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

const priorityConfig = {
  baja:    { label: 'Baja',    color: 'text-muted-foreground' },
  media:   { label: 'Media',   color: 'text-blue-400' },
  alta:    { label: 'Alta',    color: 'text-amber-400' },
  critica: { label: 'Crítica', color: 'text-red-400' },
};

const taskStatusIcon = {
  pendiente:  <Circle className="w-4 h-4 text-muted-foreground" />,
  en_curso:   <Clock className="w-4 h-4 text-amber-400" />,
  bloqueado:  <AlertCircle className="w-4 h-4 text-red-400" />,
  completado: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
};

const PROJ_EMPTY = { name: '', description: '', status: 'planificado', priority: 'media', owner: '', startDate: '', endDate: '', budget: '', progress: 0 };
const TASK_EMPTY = { title: '', description: '', status: 'pendiente', priority: 'media', assignee: '', dueDate: '', estimatedHours: '' };

const fmt = (n) => `$${(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;

export default function ProjectTracker({ company }) {
  const qc = useQueryClient();
  const [openProj, setOpenProj] = useState(false);
  const [openTask, setOpenTask] = useState(false);
  const [editingProj, setEditingProj] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [activeProject, setActiveProject] = useState(null);
  const [form, setForm] = useState(PROJ_EMPTY);
  const [taskForm, setTaskForm] = useState(TASK_EMPTY);
  const [expanded, setExpanded] = useState({});

  const { data: projects = [], isLoading } = useCompanyProjects(company);
  const { data: tasks = [] } = useCompanyProjectTasks(company);

  const displayProjects = company ? projects : [];
  const displayTasks = company ? tasks : [];

  const saveProj = useMutation({
    mutationFn: (data) => {
      if (!company) { toast.error('Selecciona una empresa para guardar'); return; }
      return editingProj ? firebase.entities.Project.update(editingProj.id, data) : firebase.entities.Project.create({ ...data, companyId: company.id });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: companyEntityQueryKey('projects', company) }); setOpenProj(false); setEditingProj(null); setForm(PROJ_EMPTY); toast.success('Proyecto guardado'); },
  });

  const delProj = useMutation({
    mutationFn: (id) => firebase.entities.Project.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: companyEntityQueryKey('projects', company) }); toast.success('Proyecto eliminado'); },
  });

  const saveTask = useMutation({
    mutationFn: (data) => {
      if (!company) { toast.error('Selecciona una empresa para guardar'); return; }
      return editingTask ? firebase.entities.ProjectTask.update(editingTask.id, data) : firebase.entities.ProjectTask.create({ ...data, projectId: activeProject, companyId: company.id });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: companyEntityQueryKey('projectTasks', company) }); setOpenTask(false); setEditingTask(null); setTaskForm(TASK_EMPTY); toast.success('Tarea guardada'); },
  });

  const delTask = useMutation({
    mutationFn: (id) => firebase.entities.ProjectTask.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: companyEntityQueryKey('projectTasks', company) }),
  });

  const updateTaskStatus = (task, status) => {
    if (!company) return;
    firebase.entities.ProjectTask.update(task.id, { status }).then(() => qc.invalidateQueries({ queryKey: companyEntityQueryKey('projectTasks', company) }));
  };

  const openNewProj = () => { setEditingProj(null); setForm(PROJ_EMPTY); setOpenProj(true); };
  const openEditProj = (p) => { setEditingProj(p); setForm({ ...p }); setOpenProj(true); };
  const openNewTask = (projId) => { setActiveProject(projId); setEditingTask(null); setTaskForm(TASK_EMPTY); setOpenTask(true); };
  const openEditTask = (task) => { setEditingTask(task); setTaskForm({ ...task }); setOpenTask(true); };
  const toggleExpand = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  // Summary stats
  const total = displayProjects.length;
  const byStatus = Object.fromEntries(Object.keys(statusConfig).map(k => [k, displayProjects.filter(p => p.status === k).length]));
  const totalBudget = displayProjects.reduce((s, p) => s + (p.budget || 0), 0);
  const totalSpent = displayProjects.reduce((s, p) => s + (p.spent || 0), 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      {total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'En curso', count: byStatus.en_curso, color: '#f0d080' },
            { label: 'Completados', count: byStatus.completado, color: '#c5a059' },
            { label: 'Presupuesto', count: fmt(totalBudget), color: '#e8d5a3' },
            { label: 'Ejecutado', count: fmt(totalSpent), color: totalSpent > totalBudget ? '#ef4444' : '#e8d5a3' },
          ].map(({ label, count, color }) => (
            <div key={label} className="rounded-2xl p-4" style={{
              background: 'linear-gradient(135deg, rgba(197,160,89,0.08) 0%, rgba(197,160,89,0.02) 100%)',
              border: '1px solid rgba(197,160,89,0.2)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}>
              <p className="text-xs mb-1" style={{color: 'rgba(197,160,89,0.7)'}}>{label}</p>
              <p className="text-xl font-bold font-mono" style={{color}}>{count ?? 0}</p>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{total} proyecto{total !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={openNewProj} disabled={!company} className="gap-2" style={{
          background: 'linear-gradient(135deg, #f0d080 0%, #c5a059 100%)',
          color: '#050505',
          boxShadow: '0 2px 8px rgba(197,160,89,0.3)',
          opacity: !company ? 0.5 : 1
        }}>
          <Plus className="w-4 h-4" style={{color: '#050505'}} /> {company ? 'Nuevo Proyecto' : 'Selecciona empresa'}
        </Button>
      </div>

      {/* Project list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : displayProjects.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderKanban className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No hay proyectos. Crea el primero.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayProjects.map(proj => {
            const projTasks = displayTasks.filter(t => t.projectId === proj.id);
            const done = projTasks.filter(t => t.status === 'completado').length;
            const isExpanded = expanded[proj.id];
            const cfg = statusConfig[proj.status] || statusConfig.planificado;
            const pCfg = priorityConfig[proj.priority] || priorityConfig.media;

            return (
              <div key={proj.id} className="rounded-2xl overflow-hidden" style={{
                background: 'linear-gradient(135deg, rgba(197,160,89,0.06) 0%, rgba(197,160,89,0.02) 100%)',
                border: '1px solid rgba(197,160,89,0.15)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.3)'
              }}>
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <button onClick={() => toggleExpand(proj.id)} className="mt-0.5 hover:text-foreground transition-colors" style={{color: 'rgba(197,160,89,0.6)'}}>
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="text-sm font-semibold" style={{color: '#e8d5a3'}}>{proj.name}</p>
                        <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                        <span className={`text-xs font-medium ${pCfg.color}`}>↑ {pCfg.label}</span>
                      </div>
                      {proj.description && <p className="text-xs text-muted-foreground mb-2 truncate">{proj.description}</p>}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        {proj.owner && <span>👤 {proj.owner}</span>}
                        {proj.endDate && <span>📅 {format(new Date(proj.endDate), "d MMM yy", { locale: es })}</span>}
                        {proj.budget > 0 && <span>💰 {fmt(proj.budget)}</span>}
                        {projTasks.length > 0 && <span>✅ {done}/{projTasks.length} tareas</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {company && (<>
                      <button onClick={() => openEditProj(proj)} className="p-1.5 hover:text-primary text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => delProj.mutate(proj.id)} className="p-1.5 hover:text-destructive text-muted-foreground"><Trash2 className="w-3.5 h-3.5" /></button>
                      </>)}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 ml-7">
                    <div className="flex justify-between text-xs mb-1" style={{color: 'rgba(197,160,89,0.6)'}}>
                      <span>Progreso</span>
                      <span>{proj.progress || 0}%</span>
                    </div>
                    <Progress value={proj.progress || 0} className="h-1.5" />
                  </div>
                </div>

                {/* Tasks panel */}
                {isExpanded && (
                  <div className="border-t border-border bg-secondary/20 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Tareas</p>
                      {company && (
                      <Button size="sm" variant="ghost" onClick={() => openNewTask(proj.id)} className="h-7 text-xs gap-1 text-primary hover:bg-primary/10">
                        <Plus className="w-3.5 h-3.5" /> Agregar tarea
                      </Button>
                      )}
                    </div>
                    {projTasks.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">Sin tareas. Agrega la primera.</p>
                    ) : (
                      <div className="space-y-2">
                        {projTasks.map(task => (
                          <div key={task.id} className="flex items-center gap-3 p-2.5 bg-card rounded-xl border border-border/50">
                            <button onClick={() => updateTaskStatus(task, task.status === 'completado' ? 'pendiente' : 'completado')}>
                              {taskStatusIcon[task.status] || taskStatusIcon.pendiente}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm ${task.status === 'completado' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{task.title}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                {task.assignee && <span>👤 {task.assignee}</span>}
                                {task.dueDate && <span>📅 {format(new Date(task.dueDate), "d MMM", { locale: es })}</span>}
                                {task.estimatedHours && <span>⏱ {task.estimatedHours}h</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {company && (<>
                              <button onClick={() => openEditTask(task)} className="p-1 hover:text-primary text-muted-foreground"><Pencil className="w-3 h-3" /></button>
                              <button onClick={() => delTask.mutate(task.id)} className="p-1 hover:text-destructive text-muted-foreground"><Trash2 className="w-3 h-3" /></button>
                              </>)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Project Dialog */}
      <Dialog open={openProj} onOpenChange={setOpenProj}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProj ? 'Editar Proyecto' : 'Nuevo Proyecto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Nombre del proyecto</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ej. Expansión a CDMX" className="mt-1 bg-secondary border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Descripción</Label>
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="mt-1 bg-secondary border-border h-20 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Estado</Label>
                <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Prioridad</Label>
                <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(priorityConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Fecha inicio</Label>
                <Input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} className="mt-1 bg-secondary border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Fecha fin</Label>
                <Input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} className="mt-1 bg-secondary border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Presupuesto (MXN)</Label>
                <Input type="number" value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))} placeholder="0" className="mt-1 bg-secondary border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Avance (%)</Label>
                <Input type="number" min="0" max="100" value={form.progress} onChange={e => setForm(p => ({ ...p, progress: e.target.value }))} className="mt-1 bg-secondary border-border" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Responsable</Label>
                <Input value={form.owner} onChange={e => setForm(p => ({ ...p, owner: e.target.value }))} placeholder="Nombre del responsable" className="mt-1 bg-secondary border-border" />
              </div>
            </div>
            <Button onClick={() => saveProj.mutate({ ...form, budget: parseFloat(form.budget) || 0, progress: parseFloat(form.progress) || 0 })}
              disabled={!form.name || saveProj.isPending} className="w-full bg-primary text-primary-foreground gap-2">
              {saveProj.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingProj ? 'Guardar cambios' : 'Crear Proyecto'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Dialog */}
      <Dialog open={openTask} onOpenChange={setOpenTask}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Editar Tarea' : 'Nueva Tarea'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Título</Label>
              <Input value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} placeholder="Ej. Definir requerimientos" className="mt-1 bg-secondary border-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Estado</Label>
                <Select value={taskForm.status} onValueChange={v => setTaskForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['pendiente','en_curso','bloqueado','completado'].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Prioridad</Label>
                <Select value={taskForm.priority} onValueChange={v => setTaskForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{['baja','media','alta'].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Asignado a</Label>
                <Input value={taskForm.assignee} onChange={e => setTaskForm(p => ({ ...p, assignee: e.target.value }))} placeholder="Nombre" className="mt-1 bg-secondary border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Fecha límite</Label>
                <Input type="date" value={taskForm.dueDate} onChange={e => setTaskForm(p => ({ ...p, dueDate: e.target.value }))} className="mt-1 bg-secondary border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Horas estimadas</Label>
                <Input type="number" value={taskForm.estimatedHours} onChange={e => setTaskForm(p => ({ ...p, estimatedHours: e.target.value }))} className="mt-1 bg-secondary border-border" />
              </div>
            </div>
            <Button onClick={() => saveTask.mutate({ ...taskForm, estimatedHours: parseFloat(taskForm.estimatedHours) || undefined })}
              disabled={!taskForm.title || saveTask.isPending} className="w-full bg-primary text-primary-foreground gap-2">
              {saveTask.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingTask ? 'Guardar cambios' : 'Crear Tarea'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
import React, { useState } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { companyEntityQueryKey, useCompanyEmployees, useCompanyPerformanceReviews } from '@/lib/companyEntityQueries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Star, Loader2, Pencil, Trash2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import ReactMarkdown from 'react-markdown';

const ratingConfig = {
  excepcional:       { label: 'Excepcional',       color: 'bg-amber-500/15 text-amber-400 border-amber-500/30',     score: 5 },
  bueno:             { label: 'Bueno',              color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', score: 4 },
  satisfactorio:     { label: 'Satisfactorio',      color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',        score: 3 },
  necesita_mejora:   { label: 'Necesita Mejora',    color: 'bg-orange-500/15 text-orange-400 border-orange-500/30',  score: 2 },
  insatisfactorio:   { label: 'Insatisfactorio',    color: 'bg-red-500/15 text-red-400 border-red-500/30',           score: 1 },
};

const SCORES = ['score_productivity', 'score_quality', 'score_teamwork', 'score_punctuality', 'score_leadership'];
const SCORE_LABELS = { score_productivity: 'Productividad', score_quality: 'Calidad', score_teamwork: 'Trabajo en equipo', score_punctuality: 'Puntualidad', score_leadership: 'Liderazgo' };

const avgScore = (r) => {
  const vals = SCORES.map(k => parseFloat(r[k]) || 0).filter(v => v > 0);
  return vals.length ? (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) : '—';
};

const EMPTY = {
  employeeId: '', employeeName: '', reviewer: '', period: '', reviewDate: new Date().toISOString().split('T')[0],
  score_productivity: '7', score_quality: '7', score_teamwork: '7', score_punctuality: '7', score_leadership: '7',
  strengths: '', areas_improvement: '', goals_next_period: '',
  overallRating: 'satisfactorio', salary_adjustment: '0', notes: '',
};

export default function PerformanceManager({ company }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [aiInsight, setAiInsight] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);

  const { data: employees = [] } = useCompanyEmployees(company);

  const { data: reviews = [], isLoading } = useCompanyPerformanceReviews(company);

  const save = useMutation({
    mutationFn: (data) => editing
      ? firebase.entities.PerformanceReview.update(editing.id, data)
      : firebase.entities.PerformanceReview.create({ ...data, companyId: company.id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: companyEntityQueryKey('performanceReviews', company) }); setOpen(false); setEditing(null); setForm(EMPTY); toast.success('Evaluación guardada'); },
  });

  const del = useMutation({
    mutationFn: (id) => firebase.entities.PerformanceReview.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: companyEntityQueryKey('performanceReviews', company) }); if (selectedReview?.id === editing?.id) setSelectedReview(null); },
  });

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (r) => { setEditing(r); setForm({ ...r }); setOpen(true); };
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const getAI = async (review) => {
    setAiLoading(true);
    setAiInsight('');
    const emp = employees.find(e => e.id === review.employeeId);
    const res = await firebase.integrations.Core.InvokeLLM({
      companyId: company.id,
      prompt: `Eres un experto en gestión del talento y desarrollo humano. Analiza la evaluación de desempeño de "${review.employeeName}" en la empresa "${company.name}".

DATOS DEL EMPLEADO:
- Puesto: ${emp?.position || 'N/D'} | Departamento: ${emp?.department || 'N/D'}
- Antigüedad: desde ${emp?.hireDate || 'N/D'}
- Salario actual: ${emp?.baseSalary ? `$${emp.baseSalary.toLocaleString()}` : 'N/D'}/mes

EVALUACIÓN DEL PERÍODO "${review.period}":
- Productividad: ${review.score_productivity}/10
- Calidad: ${review.score_quality}/10
- Trabajo en equipo: ${review.score_teamwork}/10
- Puntualidad: ${review.score_punctuality}/10
- Liderazgo: ${review.score_leadership}/10
- Calificación general: ${review.overallRating}
- Promedio: ${avgScore(review)}/10
- Fortalezas: ${review.strengths || 'No especificadas'}
- Áreas de mejora: ${review.areas_improvement || 'No especificadas'}
- Metas próximo período: ${review.goals_next_period || 'No especificadas'}
- Ajuste salarial propuesto: ${review.salary_adjustment}%

Proporciona:
1. 🎯 Diagnóstico del desempeño y perfil del colaborador
2. 💪 Plan de desarrollo personalizado (3 acciones concretas)
3. 📚 Formación recomendada: cursos, certificaciones o habilidades a desarrollar
4. 💰 Análisis del ajuste salarial propuesto vs mercado mexicano
5. 🗓️ Plan de seguimiento: hitos para el próximo trimestre
6. ⭐ Potencial de crecimiento dentro de la organización

Responde en español, tono de coach/consultor de RRHH, constructivo y motivador.`,
    });
    setAiInsight(res);
    setAiLoading(false);
  };

  // Team overview stats
  const avgTeamScore = reviews.length > 0
    ? (reviews.reduce((s, r) => s + parseFloat(avgScore(r)), 0) / reviews.length).toFixed(1)
    : '—';

  const byRating = Object.fromEntries(Object.keys(ratingConfig).map(k => [k, reviews.filter(r => r.overallRating === k).length]));

  return (
    <div className="space-y-6">
      {/* Summary */}
      {reviews.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Evaluaciones', val: reviews.length, color: 'text-foreground' },
            { label: 'Puntuación promedio', val: `${avgTeamScore}/10`, color: 'text-amber-400' },
            { label: 'Excepcionales', val: byRating.excepcional || 0, color: 'text-amber-400' },
            { label: 'Necesitan apoyo', val: (byRating.necesita_mejora || 0) + (byRating.insatisfactorio || 0), color: 'text-red-400' },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-card border border-border rounded-2xl p-4">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className={`text-xl font-bold font-mono ${color}`}>{val}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{reviews.length} evaluación{reviews.length !== 1 ? 'es' : ''}</p>
        <Button size="sm" onClick={openNew} disabled={!employees.length} className="bg-primary text-primary-foreground gap-2">
          <Plus className="w-4 h-4" /> Nueva Evaluación
        </Button>
      </div>

      {employees.length === 0 && (
        <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-sm text-amber-400">
          ⚠️ Primero registra empleados en la pestaña "Directorio" para crear evaluaciones.
        </div>
      )}

      {/* Review cards */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Star className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sin evaluaciones. Crea la primera.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {reviews.map(review => {
            const cfg = ratingConfig[review.overallRating] || ratingConfig.satisfactorio;
            const avg = avgScore(review);
            const isSelected = selectedReview?.id === review.id;

            const radarData = SCORES.map(k => ({
              subject: SCORE_LABELS[k].split(' ')[0],
              A: parseFloat(review[k]) || 0,
            }));

            return (
              <div key={review.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{review.employeeName}</p>
                    <p className="text-xs text-muted-foreground">{review.period} · Evaluado por: {review.reviewer || 'N/D'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                    <span className="text-sm font-bold text-primary">{avg}/10</span>
                  </div>
                </div>

                {/* Score bars */}
                <div className="space-y-2">
                  {SCORES.map(k => (
                    <div key={k} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-28 shrink-0">{SCORE_LABELS[k]}</span>
                      <Progress value={(parseFloat(review[k]) || 0) * 10} className="h-1.5 flex-1" />
                      <span className="text-xs font-medium text-foreground w-6 text-right">{review[k] || 0}</span>
                    </div>
                  ))}
                </div>

                {/* Radar chart toggle */}
                <button onClick={() => setSelectedReview(isSelected ? null : review)}
                  className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 py-1 transition-colors">
                  {isSelected ? '▲ Ocultar gráfico' : '▼ Ver gráfico radar'}
                </button>

                {isSelected && (
                  <ResponsiveContainer width="100%" height={180}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="hsl(0 0% 14%)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(0 0% 50%)', fontSize: 10 }} />
                      <Radar name="Score" dataKey="A" stroke="hsl(43 72% 53%)" fill="hsl(43 72% 53%)" fillOpacity={0.25} />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                )}

                {review.salary_adjustment > 0 && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-400">
                    💰 Ajuste salarial propuesto: +{review.salary_adjustment}%
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => getAI(review)} disabled={aiLoading}
                    className="flex-1 text-xs h-8 text-primary hover:bg-primary/10 gap-1.5">
                    {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Plan de desarrollo IA
                  </Button>
                  <button onClick={() => openEdit(review)} className="p-1.5 hover:text-primary text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => del.mutate(review.id)} className="p-1.5 hover:text-destructive text-muted-foreground"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI Plan */}
      {(aiInsight || aiLoading) && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3"><Sparkles className="w-4 h-4 text-primary" /> Plan de Desarrollo IA</p>
          {aiLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin text-primary" /> Generando plan...</div>}
          {aiInsight && <div className="prose prose-sm prose-invert max-w-none text-sm text-muted-foreground"><ReactMarkdown>{aiInsight}</ReactMarkdown></div>}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Evaluación' : 'Nueva Evaluación'}</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Empleado</Label>
                <Select value={form.employeeId} onValueChange={v => { const e = employees.find(emp => emp.id === v); f('employeeId', v); f('employeeName', e?.fullName || ''); }}>
                  <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue placeholder="Selecciona empleado" /></SelectTrigger>
                  <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.fullName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Período evaluado</Label>
                <Input value={form.period} onChange={e => f('period', e.target.value)} placeholder="Ej. Q1 2024, 2024-H1" className="mt-1 bg-secondary border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Evaluado por</Label>
                <Input value={form.reviewer} onChange={e => f('reviewer', e.target.value)} placeholder="Nombre del evaluador" className="mt-1 bg-secondary border-border" />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Puntuaciones (1-10)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {SCORES.map(k => (
                  <div key={k}>
                    <Label className="text-xs text-muted-foreground">{SCORE_LABELS[k]}</Label>
                    <Input type="number" min="1" max="10" value={form[k]} onChange={e => f(k, e.target.value)} className="mt-1 bg-secondary border-border" />
                  </div>
                ))}
                <div className="flex items-end pb-1">
                  <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 w-full text-center">
                    <p className="text-xs text-muted-foreground">Promedio</p>
                    <p className="text-xl font-bold text-primary">{(SCORES.map(k => parseFloat(form[k]) || 0).reduce((s, v) => s + v, 0) / SCORES.length).toFixed(1)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Calificación general</Label>
                <Select value={form.overallRating} onValueChange={v => f('overallRating', v)}>
                  <SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(ratingConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Ajuste salarial propuesto (%)</Label>
                <Input type="number" value={form.salary_adjustment} onChange={e => f('salary_adjustment', e.target.value)} placeholder="0" className="mt-1 bg-secondary border-border" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {[
                { key: 'strengths', label: 'Fortalezas destacadas' },
                { key: 'areas_improvement', label: 'Áreas de mejora' },
                { key: 'goals_next_period', label: 'Metas para el próximo período' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <Textarea value={form[key]} onChange={e => f(key, e.target.value)} className="mt-1 bg-secondary border-border h-16 resize-none" />
                </div>
              ))}
            </div>

            <Button onClick={() => save.mutate({
              ...form,
              ...Object.fromEntries(SCORES.map(k => [k, parseFloat(form[k]) || 0])),
              salary_adjustment: parseFloat(form.salary_adjustment) || 0,
            })} disabled={!form.employeeId || !form.period || save.isPending} className="w-full bg-primary text-primary-foreground gap-2">
              {save.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? 'Guardar cambios' : 'Crear Evaluación'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
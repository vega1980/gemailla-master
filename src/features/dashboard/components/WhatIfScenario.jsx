import React, { useState, useCallback } from 'react';
import { Sliders, TrendingUp, TrendingDown, RotateCcw, ChevronDown, ChevronUp, Bookmark, Layers } from 'lucide-react';
import ScenarioAlerts from './ScenarioAlerts';
import SavedScenariosList from './SavedScenariosList';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { addMonths, startOfMonth, format } from 'date-fns';
import { es } from 'date-fns/locale';

const next3Months = [1, 2, 3].map(i =>
  format(addMonths(startOfMonth(new Date()), i), 'MMM yy', { locale: es })
);

const DEFAULT_ADJUSTMENTS = { 0: { ingresos: 0, gastos: 0 }, 1: { ingresos: 0, gastos: 0 }, 2: { ingresos: 0, gastos: 0 } };

const SCENARIO_COLORS = [
  'hsl(120,60%,55%)',
  'hsl(200,80%,55%)',
  'hsl(280,65%,60%)',
  'hsl(30,90%,60%)',
  'hsl(160,60%,50%)',
  'hsl(340,70%,60%)',
];

const DEFAULT_NAMES = ['Escenario Optimista', 'Escenario Conservador', 'Escenario Pesimista', 'Escenario Base', 'Escenario Agresivo', 'Escenario Moderado'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-xl min-w-[180px]">
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      {payload.map((p, i) => p.value != null && (
        <p key={i} className="text-xs font-semibold" style={{ color: p.color }}>
          {p.name}: ${Math.round(p.value).toLocaleString('es-MX')}
        </p>
      ))}
    </div>
  );
};

function computeScenarioData(basePredictions, adjustments) {
  return basePredictions.map((p, i) => {
    const adj = adjustments[i] || { ingresos: 0, gastos: 0 };
    const ingresos_sc = Math.max(0, p.ingresos_pred * (1 + adj.ingresos / 100));
    const gastos_sc = Math.max(0, p.gastos_pred * (1 + adj.gastos / 100));
    return {
      month: p.month,
      ingresos_base: p.ingresos_pred,
      gastos_base: p.gastos_pred,
      ingresos_sc: Math.round(ingresos_sc),
      gastos_sc: Math.round(gastos_sc),
      balance_base: Math.round(p.ingresos_pred - p.gastos_pred),
      balance_sc: Math.round(ingresos_sc - gastos_sc),
    };
  });
}

export default function WhatIfScenario({ prediction, historicalData }) {
  const [adjustments, setAdjustments] = useState(DEFAULT_ADJUSTMENTS);
  const [open, setOpen] = useState(true);
  const [savedScenarios, setSavedScenarios] = useState([]);
  const [visibleIds, setVisibleIds] = useState([]);
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  const hasBase = prediction?.predictions?.length === 3;
  const basePredictions = hasBase
    ? prediction.predictions
    : next3Months.map(month => ({ month, ingresos_pred: 0, gastos_pred: 0 }));

  const scenarioData = computeScenarioData(basePredictions, adjustments);

  const totalBalanceBase = scenarioData.reduce((s, d) => s + d.balance_base, 0);
  const totalBalanceSc = scenarioData.reduce((s, d) => s + d.balance_sc, 0);
  const balanceDelta = totalBalanceSc - totalBalanceBase;

  const reset = () => setAdjustments(DEFAULT_ADJUSTMENTS);

  const setAdj = useCallback((monthIdx, field, val) => {
    setAdjustments(prev => ({
      ...prev,
      [monthIdx]: { ...prev[monthIdx], [field]: val },
    }));
  }, []);

  const handleSave = () => {
    const name = saveName.trim() || DEFAULT_NAMES[savedScenarios.length % DEFAULT_NAMES.length];
    const color = SCENARIO_COLORS[savedScenarios.length % SCENARIO_COLORS.length];
    const id = `sc-${Date.now()}`;
    const newSc = { id, name, color, data: scenarioData, adjustments: { ...adjustments } };
    setSavedScenarios(prev => [...prev, newSc]);
    setVisibleIds(prev => [...prev, id]);
    setSaveName('');
    setShowSaveInput(false);
    setShowComparison(true);
  };

  const toggleVisible = (id) => {
    setVisibleIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const deleteScenario = (id) => {
    setSavedScenarios(prev => prev.filter(s => s.id !== id));
    setVisibleIds(prev => prev.filter(x => x !== id));
  };

  const historicalChartPoints = (historicalData || []).slice(-3).map(d => ({
    month: d.month,
    ingresos_hist: d.ingresos,
    gastos_hist: d.gastos,
  }));

  const predChartPoints = scenarioData.map(d => ({
    month: d.month,
    ingresos_base: d.ingresos_base,
    gastos_base: d.gastos_base,
    ingresos_sc: d.ingresos_sc,
    gastos_sc: d.gastos_sc,
  }));

  const visibleSaved = savedScenarios.filter(s => visibleIds.includes(s.id));
  const chartData = [
    ...historicalChartPoints,
    ...predChartPoints.map((pt, i) => {
      const extra = {};
      visibleSaved.forEach(sc => {
        extra[`${sc.id}_ingresos`] = sc.data[i]?.ingresos_sc;
        extra[`${sc.id}_gastos`] = sc.data[i]?.gastos_sc;
      });
      return { ...pt, ...extra };
    }),
  ];

  const splitMonth = predChartPoints[0]?.month;

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sliders className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Escenarios What-If</h3>
            <p className="text-xs text-muted-foreground">Ajusta ingresos y gastos para ver el impacto en 3 meses</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {savedScenarios.length > 0 && (
            <span className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary font-medium">
              <Layers className="w-3 h-3 inline mr-1" />{savedScenarios.length} guardado{savedScenarios.length !== 1 ? 's' : ''}
            </span>
          )}
          {balanceDelta !== 0 && (
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${balanceDelta > 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
              {balanceDelta > 0 ? '+' : ''}${balanceDelta.toLocaleString('es-MX')} impacto
            </span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-6">
          {/* Sliders */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {next3Months.map((month, i) => {
              const adj = adjustments[i];
              return (
                <div key={month} className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">{month}</p>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <TrendingUp className="w-3 h-3 text-amber-400" /> Ingresos
                      </span>
                      <span className={`text-xs font-bold ${adj.ingresos > 0 ? 'text-emerald-400' : adj.ingresos < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                        {adj.ingresos > 0 ? '+' : ''}{adj.ingresos}%
                      </span>
                    </div>
                    <Slider min={-50} max={50} step={1} value={[adj.ingresos]}
                      onValueChange={([v]) => setAdj(i, 'ingresos', v)} className="w-full" />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>-50%</span><span>0</span><span>+50%</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <TrendingDown className="w-3 h-3 text-red-400" /> Gastos
                      </span>
                      <span className={`text-xs font-bold ${adj.gastos < 0 ? 'text-emerald-400' : adj.gastos > 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                        {adj.gastos > 0 ? '+' : ''}{adj.gastos}%
                      </span>
                    </div>
                    <Slider min={-50} max={50} step={1} value={[adj.gastos]}
                      onValueChange={([v]) => setAdj(i, 'gastos', v)} className="w-full" />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>-50%</span><span>0</span><span>+50%</span>
                    </div>
                  </div>

                  <div className={`text-xs text-center font-semibold py-1 rounded ${scenarioData[i]?.balance_sc >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    Balance: ${scenarioData[i]?.balance_sc?.toLocaleString('es-MX') || '0'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Save scenario controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {showSaveInput ? (
              <>
                <input
                  autoFocus
                  type="text"
                  placeholder={DEFAULT_NAMES[savedScenarios.length % DEFAULT_NAMES.length]}
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  className="flex-1 min-w-0 text-xs rounded-md border border-border bg-muted/50 px-3 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Button size="sm" onClick={handleSave} className="text-xs h-7 bg-primary text-primary-foreground hover:bg-primary/90">
                  Guardar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowSaveInput(false)} className="text-xs h-7">
                  Cancelar
                </Button>
              </>
            ) : (
              <Button
                variant="outline" size="sm"
                onClick={() => setShowSaveInput(true)}
                className="text-xs h-7 border-primary/40 text-primary hover:bg-primary/10 gap-1.5"
              >
                <Bookmark className="w-3 h-3" /> Guardar escenario actual
              </Button>
            )}
            {savedScenarios.length > 0 && (
              <Button
                variant="ghost" size="sm"
                onClick={() => setShowComparison(o => !o)}
                className="text-xs h-7 gap-1.5 text-muted-foreground"
              >
                <Layers className="w-3 h-3" />
                {showComparison ? 'Ocultar comparación' : 'Comparar escenarios'}
              </Button>
            )}
          </div>

          {/* Saved scenarios list */}
          {showComparison && savedScenarios.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/20 p-4">
              <SavedScenariosList
                scenarios={savedScenarios}
                visibleIds={visibleIds}
                onToggleVisible={toggleVisible}
                onDelete={deleteScenario}
              />
            </div>
          )}

          {/* Chart */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                <defs>
                  <linearGradient id="whGrad1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(43,72%,53%)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(43,72%,53%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0,0%,14%)" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(0,0%,50%)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(0,0%,50%)', fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip content={<CustomTooltip />} />
                {splitMonth && (
                  <ReferenceLine x={splitMonth} stroke="hsl(43,72%,53%)" strokeDasharray="4 4" strokeOpacity={0.4} />
                )}
                <Area type="monotone" dataKey="ingresos_hist" name="Ingresos hist." stroke="hsl(43,72%,53%)" fill="url(#whGrad1)" strokeWidth={1.5} dot={false} connectNulls />
                <Area type="monotone" dataKey="gastos_hist" name="Gastos hist." stroke="hsl(0,72%,50%)" fill="none" strokeWidth={1.5} dot={false} connectNulls />
                <Line type="monotone" dataKey="ingresos_base" name="Ingresos base" stroke="hsl(43,72%,53%)" strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls />
                <Line type="monotone" dataKey="gastos_base" name="Gastos base" stroke="hsl(0,72%,50%)" strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls />
                <Line type="monotone" dataKey="ingresos_sc" name="Ingresos (actual)" stroke="hsl(120,60%,55%)" strokeWidth={2.5} dot={{ r: 4, fill: 'hsl(120,60%,55%)' }} connectNulls />
                <Line type="monotone" dataKey="gastos_sc" name="Gastos (actual)" stroke="hsl(30,90%,60%)" strokeWidth={2.5} dot={{ r: 4, fill: 'hsl(30,90%,60%)' }} connectNulls />
                {visibleSaved.map(sc => (
                  <React.Fragment key={sc.id}>
                    <Line type="monotone" dataKey={`${sc.id}_ingresos`} name={`${sc.name} — Ingresos`} stroke={sc.color} strokeWidth={2} strokeDasharray="8 4" dot={{ r: 3, fill: sc.color }} connectNulls />
                    <Line type="monotone" dataKey={`${sc.id}_gastos`} name={`${sc.name} — Gastos`} stroke={sc.color} strokeWidth={2} strokeDasharray="3 3" strokeOpacity={0.65} dot={{ r: 3, fill: sc.color }} connectNulls />
                  </React.Fragment>
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {visibleSaved.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {visibleSaved.map(sc => (
                <div key={sc.id} className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 inline-block rounded" style={{ background: sc.color }} />
                  <span className="text-[10px] text-muted-foreground">{sc.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-muted/40 p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Balance base (3m)</p>
              <p className="text-sm font-bold text-foreground">${totalBalanceBase.toLocaleString('es-MX')}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Balance escenario (3m)</p>
              <p className={`text-sm font-bold ${totalBalanceSc >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                ${totalBalanceSc.toLocaleString('es-MX')}
              </p>
            </div>
            <div className={`rounded-lg p-3 text-center ${balanceDelta > 0 ? 'bg-emerald-500/10' : balanceDelta < 0 ? 'bg-red-500/10' : 'bg-muted/40'}`}>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Impacto neto</p>
              <p className={`text-sm font-bold ${balanceDelta > 0 ? 'text-emerald-400' : balanceDelta < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                {balanceDelta > 0 ? '+' : ''}${balanceDelta.toLocaleString('es-MX')}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <ScenarioAlerts scenarioData={scenarioData} />
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={reset} className="text-xs text-muted-foreground gap-1.5">
              <RotateCcw className="w-3 h-3" /> Restablecer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { transactionsInPeriod, summarizeTransactions, summarizeByMonth } from '@/domain/finance/financialReport';

const categoryLabels = {
  ventas: 'Ventas', servicios: 'Servicios', inversiones: 'Inversiones', otros_ingresos: 'Otros Ingresos',
  nómina: 'Nómina', renta: 'Renta', servicios_profesionales: 'Serv. Profesionales', materiales: 'Materiales',
  marketing: 'Marketing', impuestos: 'Impuestos', seguros: 'Seguros', mantenimiento: 'Mantenimiento',
  tecnología: 'Tecnología', transporte: 'Transporte', otros_gastos: 'Otros Gastos',
};

function fmt(n) { return `$${(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`; }

function Row({ label, value, bold, indent, positive, negative, sub }) {
  const color = positive ? 'text-emerald-400' : negative ? 'text-red-400' : 'text-foreground';
  return (
    <div className={`flex items-center justify-between py-2 ${sub ? 'border-b border-border' : ''} ${indent ? 'pl-6' : ''}`}>
      <span className={`text-sm ${bold ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{label}</span>
      <span className={`text-sm font-mono ${bold ? 'font-bold' : ''} ${color}`}>{fmt(value)}</span>
    </div>
  );
}

export default function FinancialStatements({ transactions, company }) {
  const [period, setPeriod] = useState('current');
  const [reportType, setReportType] = useState('results');
  const [exporting, setExporting] = useState(false);

  const { filteredTx, periodLabel } = useMemo(() => {
    const now = new Date();
    let start, end;
    if (period === 'current') {
      start = format(startOfMonth(now), 'yyyy-MM-dd');
      end = format(endOfMonth(now), 'yyyy-MM-dd');
    } else if (period === 'last') {
      const lm = subMonths(now, 1);
      start = format(startOfMonth(lm), 'yyyy-MM-dd');
      end = format(endOfMonth(lm), 'yyyy-MM-dd');
    } else if (period === 'q1') { start = `${now.getFullYear()}-01-01`; end = `${now.getFullYear()}-03-31`; }
    else if (period === 'q2') { start = `${now.getFullYear()}-04-01`; end = `${now.getFullYear()}-06-30`; }
    else if (period === 'q3') { start = `${now.getFullYear()}-07-01`; end = `${now.getFullYear()}-09-30`; }
    else if (period === 'ytd') { start = `${now.getFullYear()}-01-01`; end = format(now, 'yyyy-MM-dd'); }
    else { start = `${now.getFullYear() - 1}-01-01`; end = `${now.getFullYear() - 1}-12-31`; }

    const filtered = transactionsInPeriod(transactions, start, end);
    const labels = {
      current: `${format(now, 'MMMM yyyy', { locale: es })}`,
      last: `${format(subMonths(now, 1), 'MMMM yyyy', { locale: es })}`,
      q1: `Q1 ${now.getFullYear()}`, q2: `Q2 ${now.getFullYear()}`,
      q3: `Q3 ${now.getFullYear()}`, ytd: `Ene–${format(now, 'MMM yyyy', { locale: es })}`,
      year: `${now.getFullYear() - 1}`,
    };
    return { filteredTx: filtered, periodLabel: labels[period] };
  }, [transactions, period]);

  const resultsData = useMemo(() => summarizeTransactions(filteredTx), [filteredTx]);
  const cashFlowData = useMemo(() => summarizeByMonth(filteredTx), [filteredTx]);

  const exportPDF = async () => {
    setExporting(true);
    await new Promise(r => setTimeout(r, 800));
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ format: 'a4' });
    doc.setFontSize(18);
    doc.text('GEMAILLA AI — Resumen de ingresos y gastos', 20, 20);
    doc.setFontSize(12);
    doc.text(`${company?.name || ''} · ${periodLabel}`, 20, 32);
    doc.setFontSize(10);
    doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 20, 42);

    if (reportType === 'results') {
      let y = 58;
      doc.setFontSize(11); doc.text('INGRESOS', 20, y); y += 8;
      Object.entries(resultsData.incByCategory).forEach(([k, v]) => {
        doc.setFontSize(9); doc.text(categoryLabels[k] || k, 30, y); doc.text(fmt(v), 150, y, { align: 'right' }); y += 7;
      });
      doc.line(20, y, 190, y); y += 6;
      doc.setFontSize(11); doc.text('Total Ingresos', 20, y); doc.text(fmt(resultsData.totalIngresos), 150, y, { align: 'right' }); y += 12;
      doc.text('GASTOS', 20, y); y += 8;
      Object.entries(resultsData.byCategory).forEach(([k, v]) => {
        doc.setFontSize(9); doc.text(categoryLabels[k] || k, 30, y); doc.text(fmt(v), 150, y, { align: 'right' }); y += 7;
      });
      doc.line(20, y, 190, y); y += 6;
      doc.setFontSize(11); doc.text('Total Gastos', 20, y); doc.text(fmt(resultsData.totalGastos), 150, y, { align: 'right' }); y += 12;
      doc.setFontSize(13); doc.text('RESULTADO DE MOVIMIENTOS', 20, y); doc.text(fmt(resultsData.resultado), 150, y, { align: 'right' });
    }

    doc.save(`estado_${reportType}_${periodLabel.replace(/\s/g, '_')}.pdf`);
    setExporting(false);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={reportType} onValueChange={setReportType}>
          <SelectTrigger className="w-52 bg-secondary border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="results">📊 Resumen de ingresos y gastos</SelectItem>
            <SelectItem value="balance">⚖️ Balance General (pendiente)</SelectItem>
            <SelectItem value="cashflow">💧 Movimientos por mes</SelectItem>
          </SelectContent>
        </Select>

        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-44 bg-secondary border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Mes actual</SelectItem>
            <SelectItem value="last">Mes anterior</SelectItem>
            <SelectItem value="q1">Q1</SelectItem>
            <SelectItem value="q2">Q2</SelectItem>
            <SelectItem value="q3">Q3</SelectItem>
            <SelectItem value="ytd">Año a la fecha</SelectItem>
            <SelectItem value="year">Año anterior</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto">
          <Button onClick={exportPDF} disabled={exporting || reportType !== 'results'} variant="outline" className="border-border gap-2">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Report */}
      <div id="financial-report" className="bg-card border border-border rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/20 to-primary/5 px-6 py-5 border-b border-border">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">GEMAILLA AI</p>
              <h2 className="text-xl font-display font-bold text-foreground">
                {reportType === 'results' ? 'Resumen de ingresos y gastos' : reportType === 'balance' ? 'Balance General no disponible' : 'Movimientos por mes'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">{company?.name} · {periodLabel}</p>
            </div>
            <Badge variant="outline" className="border-primary/30 text-primary text-xs">
              {format(new Date(), 'dd/MM/yyyy')}
            </Badge>
          </div>
        </div>

        <div className="p-6">
          <p className="text-sm text-muted-foreground mb-5">Resumen operativo de transacciones confirmadas. No sustituye estados financieros contables.</p>
          {/* Estado de Resultados */}
          {reportType === 'results' && (
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Ingresos</div>
              {Object.entries(resultsData.incByCategory).map(([k, v]) => (
                <Row key={k} label={categoryLabels[k] || k} value={v} indent />
              ))}
              {!Object.keys(resultsData.incByCategory).length && <Row label="Sin ingresos en el período" value={0} indent />}
              <Row label="Total Ingresos" value={resultsData.totalIngresos} bold positive sub />

              <div className="text-xs font-semibold uppercase tracking-widest text-primary mb-3 mt-5">Gastos y Costos</div>
              {Object.entries(resultsData.byCategory).map(([k, v]) => (
                <Row key={k} label={categoryLabels[k] || k} value={v} indent />
              ))}
              {!Object.keys(resultsData.byCategory).length && <Row label="Sin gastos en el período" value={0} indent />}
              <Row label="Total Gastos" value={resultsData.totalGastos} bold negative sub />

              <div className="mt-6 pt-4 border-t-2 border-primary/30">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-foreground">RESULTADO DE MOVIMIENTOS</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">Margen: {resultsData.margen.toFixed(1)}%</span>
                    <span className={`text-xl font-bold font-mono ${resultsData.resultado >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {fmt(resultsData.resultado)}
                    </span>
                    {resultsData.resultado >= 0 ? <TrendingUp className="w-5 h-5 text-emerald-400" /> : <TrendingDown className="w-5 h-5 text-red-400" />}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Balance General */}
          {reportType === 'balance' && (
            <div className="rounded-lg border border-amber-500/30 p-5 text-sm text-foreground">
              No hay datos suficientes de cuentas contables, activos, pasivos y patrimonio para generar un Balance General verificable.
              Se ha desactivado el cálculo anterior, que confundía ingresos menos gastos con saldos contables.
            </div>
          )}

          {/* Flujo de Caja */}
          {reportType === 'cashflow' && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-muted-foreground font-medium">Período</th>
                    <th className="text-right py-2 text-emerald-400 font-medium">Entradas</th>
                    <th className="text-right py-2 text-red-400 font-medium">Salidas</th>
                    <th className="text-right py-2 text-foreground font-medium">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {cashFlowData.map((m, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-secondary/30">
                      <td className="py-3 text-foreground font-medium">{format(new Date(`${m.month}-01T12:00:00`), 'MMM yy', { locale: es })}</td>
                      <td className="py-3 text-right font-mono text-emerald-400">{fmt(m.ingresos)}</td>
                      <td className="py-3 text-right font-mono text-red-400">{fmt(m.gastos)}</td>
                      <td className={`py-3 text-right font-mono font-bold ${m.neto >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {m.neto >= 0 ? '+' : ''}{fmt(m.neto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-primary/30">
                    <td className="py-3 font-bold text-foreground">TOTAL PERÍODO</td>
                    <td className="py-3 text-right font-bold font-mono text-emerald-400">{fmt(cashFlowData.reduce((s, m) => s + m.ingresos, 0))}</td>
                    <td className="py-3 text-right font-bold font-mono text-red-400">{fmt(cashFlowData.reduce((s, m) => s + m.gastos, 0))}</td>
                    <td className={`py-3 text-right font-bold font-mono text-xl ${cashFlowData.reduce((s, m) => s + m.neto, 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {fmt(cashFlowData.reduce((s, m) => s + m.neto, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

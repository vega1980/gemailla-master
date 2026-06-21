import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { FileDown, Loader2, ChevronDown, FileSpreadsheet, FileText } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';

export default function ReportGenerator({ company, transactions = [], documents = [], auditReport = null, prediction = null, monthlyData = [] }) {
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const generatePDF = async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 18;
      const contentW = pageW - margin * 2;
      let y = 0;

      const addPage = () => {
        doc.addPage();
        y = margin;
        drawHeader();
      };

      const checkPageBreak = (needed = 10) => {
        if (y + needed > pageH - 20) addPage();
      };

      // ─── Colors ───────────────────────────────────────────────────
      const gold = [212, 175, 55];
      const dark = [15, 15, 15];
      const gray = [100, 100, 100];
      const lightGray = [40, 40, 40];
      const white = [240, 235, 220];

      const filledRect = (...args) => {
        doc.rect(...args, null);
        doc.fill();
      };

      const filledRoundedRect = (...args) => {
        doc.roundedRect(...args, null);
        doc.fill();
      };

      // ─── Header Band ─────────────────────────────────────────────
      const drawHeader = () => {
        doc.setFillColor(...dark);
        filledRect(0, 0, pageW, 18);
        doc.setFillColor(...gold);
        filledRect(0, 16, pageW, 1.5);
        doc.setFontSize(8);
        doc.setTextColor(...gold);
        doc.setFont('helvetica', 'bold');
        doc.text('GEMAILLA AI  •  REPORTE EJECUTIVO CONFIDENCIAL', margin, 11);
        doc.setTextColor(...gray);
        doc.setFont('helvetica', 'normal');
        doc.text(`${company.name}  |  ${format(new Date(), "d 'de' MMMM yyyy", { locale: es })}`, pageW - margin, 11, { align: 'right' });
      };

      // ─── Cover Page ───────────────────────────────────────────────
      doc.setFillColor(10, 10, 10);
      filledRect(0, 0, pageW, pageH);

      // Gold accent bar
      doc.setFillColor(...gold);
      filledRect(0, 0, 4, pageH);

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(28);
      doc.setTextColor(...gold);
      doc.text('REPORTE', margin + 6, 80);
      doc.text('EJECUTIVO', margin + 6, 95);
      doc.setFontSize(12);
      doc.setTextColor(...white);
      doc.text('INTELIGENCIA FINANCIERA EMPRESARIAL', margin + 6, 108);

      // Divider
      doc.setFillColor(...gold);
      filledRect(margin + 6, 114, 60, 0.5);

      // Company block
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...white);
      doc.text(company.name, margin + 6, 126);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...gray);
      if (company.rfc) doc.text(`RFC: ${company.rfc}`, margin + 6, 134);
      if (company.industry) doc.text(`Industria: ${company.industry.charAt(0).toUpperCase() + company.industry.slice(1)}`, margin + 6, 140);
      doc.text(`Generado: ${format(new Date(), "d 'de' MMMM yyyy, HH:mm", { locale: es })}`, margin + 6, 146);

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(...gray);
      doc.text('Documento confidencial generado por GEMAILLA AI. Para uso interno exclusivamente.', pageW / 2, pageH - 18, { align: 'center' });

      // ─── Page 2+: Main Report ─────────────────────────────────────
      doc.addPage();
      doc.setFillColor(12, 12, 12);
      filledRect(0, 0, pageW, pageH);
      y = margin;
      drawHeader();
      y = 28;

      // ── Section helper ────────────────────────────────────────────
      const sectionTitle = (text) => {
        checkPageBreak(16);
        doc.setFillColor(...gold);
        filledRect(margin, y, 3, 7);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...gold);
        doc.text(text.toUpperCase(), margin + 6, y + 5.5);
        y += 12;
      };

      // ── KPIs ──────────────────────────────────────────────────────
      sectionTitle('1. Indicadores Clave de Desempeño (KPIs)');

      const totalIngresos = transactions.filter(t => t.type === 'ingreso').reduce((s, t) => s + (t.amount || 0), 0);
      const totalGastos = transactions.filter(t => t.type === 'gasto').reduce((s, t) => s + (t.amount || 0), 0);
      const balance = totalIngresos - totalGastos;
      const margin_pct = totalIngresos > 0 ? ((balance / totalIngresos) * 100).toFixed(1) : '0.0';

      const kpiColW = contentW / 4;
      const kpis = [
        { label: 'INGRESOS TOTALES', value: `$${totalIngresos.toLocaleString('es-MX')}` },
        { label: 'GASTOS TOTALES', value: `$${totalGastos.toLocaleString('es-MX')}` },
        { label: 'BALANCE NETO', value: `$${balance.toLocaleString('es-MX')}` },
        { label: 'MARGEN', value: `${margin_pct}%` },
      ];

      kpis.forEach((kpi, i) => {
        const colX = margin + i * kpiColW;
        doc.setFillColor(...lightGray);
        filledRoundedRect(colX, y, kpiColW - 3, 22, 2, 2);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...gold);
        doc.text(kpi.label, colX + 4, y + 7);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...white);
        doc.text(kpi.value, colX + 4, y + 16);
      });
      y += 28;

      // Extra KPIs row
      const txCount = transactions.length;
      const docsCount = documents.length;
      const docsAnalyzed = documents.filter(d => d.status === 'analyzed').length;
      const extra = [
        { label: 'TRANSACCIONES', value: String(txCount) },
        { label: 'DOCUMENTOS', value: String(docsCount) },
        { label: 'DOCS ANALIZADOS', value: String(docsAnalyzed) },
        { label: 'RFC', value: company.rfc || 'N/A' },
      ];

      extra.forEach((item, i) => {
        const colX = margin + i * kpiColW;
        doc.setFillColor(25, 25, 25);
        filledRoundedRect(colX, y, kpiColW - 3, 16, 2, 2);
        doc.setFontSize(7);
        doc.setTextColor(...gray);
        doc.setFont('helvetica', 'normal');
        doc.text(item.label, colX + 4, y + 6);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...white);
        doc.text(item.value, colX + 4, y + 13);
      });
      y += 24;

      // ── Top Transactions ──────────────────────────────────────────
      checkPageBreak(20);
      sectionTitle('2. Movimientos Más Importantes');

      const topTx = [...transactions]
        .sort((a, b) => (b.amount || 0) - (a.amount || 0))
        .slice(0, 8);

      // Table header
      doc.setFillColor(...lightGray);
      filledRect(margin, y, contentW, 8);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...gold);
      doc.text('TIPO', margin + 3, y + 5.5);
      doc.text('DESCRIPCIÓN', margin + 22, y + 5.5);
      doc.text('CATEGORÍA', margin + 105, y + 5.5);
      doc.text('FECHA', margin + 143, y + 5.5);
      doc.text('MONTO', pageW - margin - 2, y + 5.5, { align: 'right' });
      y += 8;

      topTx.forEach((tx, i) => {
        checkPageBreak(8);
        if (i % 2 === 0) {
          doc.setFillColor(22, 22, 22);
          filledRect(margin, y, contentW, 7.5);
        }
        const isIngreso = tx.type === 'ingreso';
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(isIngreso ? 34 : 239, isIngreso ? 197 : 68, isIngreso ? 94 : 68);
        doc.text(isIngreso ? '▲ INGRESO' : '▼ GASTO', margin + 3, y + 5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...white);
        const desc = tx.description?.substring(0, 42) || '-';
        doc.text(desc, margin + 22, y + 5);
        doc.setTextColor(...gray);
        doc.text((tx.category || '-').replace(/_/g, ' '), margin + 105, y + 5);
        doc.text(tx.date || '-', margin + 143, y + 5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(isIngreso ? 34 : 239, isIngreso ? 197 : 68, isIngreso ? 94 : 68);
        doc.text(`$${(tx.amount || 0).toLocaleString('es-MX')}`, pageW - margin - 2, y + 5, { align: 'right' });
        y += 7.5;
      });
      y += 8;

      // ── Categories Breakdown ──────────────────────────────────────
      checkPageBreak(20);
      sectionTitle('3. Desglose por Categoría');

      const catMap = {};
      transactions.forEach(tx => {
        if (!catMap[tx.category]) catMap[tx.category] = { ingreso: 0, gasto: 0 };
        catMap[tx.category][tx.type] = (catMap[tx.category][tx.type] || 0) + (tx.amount || 0);
      });
      const catEntries = Object.entries(catMap).sort((a, b) => (b[1].ingreso + b[1].gasto) - (a[1].ingreso + a[1].gasto)).slice(0, 8);

      doc.setFillColor(...lightGray);
      filledRect(margin, y, contentW, 7);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...gold);
      doc.text('CATEGORÍA', margin + 3, y + 5);
      doc.text('INGRESOS', margin + 90, y + 5);
      doc.text('GASTOS', margin + 135, y + 5);
      y += 7;

      catEntries.forEach(([cat, vals], i) => {
        checkPageBreak(7);
        if (i % 2 === 0) { doc.setFillColor(22, 22, 22); filledRect(margin, y, contentW, 6.5); }
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...white);
        doc.text(cat.replace(/_/g, ' '), margin + 3, y + 4.5);
        doc.setTextColor(34, 197, 94);
        doc.text(vals.ingreso ? `$${vals.ingreso.toLocaleString('es-MX')}` : '-', margin + 90, y + 4.5);
        doc.setTextColor(239, 68, 68);
        doc.text(vals.gasto ? `$${vals.gasto.toLocaleString('es-MX')}` : '-', margin + 135, y + 4.5);
        y += 6.5;
      });
      y += 10;

      // ── Monthly Historical ────────────────────────────────────────
      if (monthlyData.length > 0) {
        checkPageBreak(20);
        sectionTitle('4. Flujo Mensual Histórico (6 meses)');

        doc.setFillColor(...lightGray);
        filledRect(margin, y, contentW, 7);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...gold);
        doc.text('MES', margin + 3, y + 5);
        doc.text('INGRESOS', margin + 55, y + 5);
        doc.text('GASTOS', margin + 105, y + 5);
        doc.text('BALANCE', margin + 150, y + 5);
        y += 7;

        monthlyData.forEach((row, i) => {
          checkPageBreak(7);
          if (i % 2 === 0) { doc.setFillColor(22, 22, 22); filledRect(margin, y, contentW, 6.5); }
          const bal = row.ingresos - row.gastos;
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...white);
          doc.text(row.month, margin + 3, y + 4.5);
          doc.setTextColor(34, 197, 94);
          doc.text(`$${row.ingresos.toLocaleString('es-MX')}`, margin + 55, y + 4.5);
          doc.setTextColor(239, 68, 68);
          doc.text(`$${row.gastos.toLocaleString('es-MX')}`, margin + 105, y + 4.5);
          doc.setTextColor(bal >= 0 ? 34 : 239, bal >= 0 ? 197 : 68, bal >= 0 ? 94 : 68);
          doc.text(`$${bal.toLocaleString('es-MX')}`, margin + 150, y + 4.5);
          y += 6.5;
        });
        y += 10;
      }

      // ── Cash Flow Predictions ─────────────────────────────────────
      if (prediction?.predictions?.length > 0) {
        checkPageBreak(30);
        sectionTitle('5. Proyección de Flujo de Caja (IA — Próximos 3 meses)');

        // Trend badge
        const trendColors = { positiva: [34, 197, 94], negativa: [239, 68, 68], estable: [100, 100, 100] };
        const trendBg = { positiva: [20, 50, 20], negativa: [50, 15, 15], estable: [30, 30, 30] };
        const tc = trendColors[prediction.trend] || gray;
        const tb = trendBg[prediction.trend] || [30, 30, 30];
        doc.setFillColor(...tb);
        filledRoundedRect(margin, y, 55, 12, 2, 2);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...tc);
        doc.text(`TENDENCIA: ${(prediction.trend || '').toUpperCase()}`, margin + 4, y + 8);
        y += 18;

        // Prediction table header
        doc.setFillColor(...lightGray);
        filledRect(margin, y, contentW, 7);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...gold);
        doc.text('MES PROYECTADO', margin + 3, y + 5);
        doc.text('INGRESOS EST.', margin + 60, y + 5);
        doc.text('GASTOS EST.', margin + 110, y + 5);
        doc.text('BALANCE EST.', margin + 152, y + 5);
        y += 7;

        let projTotalIngresos = 0;
        let projTotalGastos = 0;
        prediction.predictions.forEach((p, i) => {
          checkPageBreak(8);
          const bal = p.ingresos_pred - p.gastos_pred;
          projTotalIngresos += p.ingresos_pred;
          projTotalGastos += p.gastos_pred;
          if (i % 2 === 0) { doc.setFillColor(22, 22, 22); filledRect(margin, y, contentW, 7); }
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...white);
          doc.text(p.month, margin + 3, y + 5);
          doc.setTextColor(34, 197, 94);
          doc.text(`$${p.ingresos_pred.toLocaleString('es-MX')}`, margin + 60, y + 5);
          doc.setTextColor(239, 68, 68);
          doc.text(`$${p.gastos_pred.toLocaleString('es-MX')}`, margin + 110, y + 5);
          doc.setTextColor(bal >= 0 ? 34 : 239, bal >= 0 ? 197 : 68, bal >= 0 ? 94 : 68);
          doc.text(`$${bal.toLocaleString('es-MX')}`, margin + 152, y + 5);
          y += 7;
        });

        // Totals row
        checkPageBreak(10);
        const projBal = projTotalIngresos - projTotalGastos;
        doc.setFillColor(...lightGray);
        filledRect(margin, y, contentW, 9);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...gold);
        doc.text('TOTAL PROYECTADO (3 MESES)', margin + 3, y + 6);
        doc.setTextColor(34, 197, 94);
        doc.text(`$${projTotalIngresos.toLocaleString('es-MX')}`, margin + 60, y + 6);
        doc.setTextColor(239, 68, 68);
        doc.text(`$${projTotalGastos.toLocaleString('es-MX')}`, margin + 110, y + 6);
        doc.setTextColor(projBal >= 0 ? 34 : 239, projBal >= 0 ? 197 : 68, projBal >= 0 ? 94 : 68);
        doc.text(`$${projBal.toLocaleString('es-MX')}`, margin + 152, y + 6);
        y += 14;

        // Methodology note
        if (prediction.trend_note) {
          checkPageBreak(20);
          doc.setFillColor(20, 25, 20);
          const noteLines = doc.splitTextToSize(`Análisis IA: ${prediction.trend_note}`, contentW - 8);
          const noteH = noteLines.length * 4.5 + 10;
          filledRoundedRect(margin, y, contentW, noteH, 2, 2);
          doc.setFillColor(...gold);
          filledRoundedRect(margin, y, 3, noteH, 2, 2);
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...white);
          doc.text(noteLines, margin + 7, y + 7);
          y += noteH + 10;
        }
      }

      // ── Audit Report ──────────────────────────────────────────────
      if (auditReport) {
        checkPageBreak(30);
        sectionTitle('6. Diagnóstico de Auditoría IA');

        // Score box
        doc.setFillColor(...lightGray);
        filledRoundedRect(margin, y, 50, 28, 3, 3);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...gold);
        doc.text(`${auditReport.health_score}`, margin + 25, y + 17, { align: 'center' });
        doc.setFontSize(7);
        doc.setTextColor(...gray);
        doc.text('HEALTH SCORE / 100', margin + 25, y + 24, { align: 'center' });

        const infoX = margin + 56;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...white);
        doc.text(auditReport.health_label || '', infoX, y + 8);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...gray);
        const summaryLines = doc.splitTextToSize(auditReport.summary || '', contentW - 60);
        doc.text(summaryLines, infoX, y + 15);
        y += 34;

        // KPI row
        const auditKpis = [
          { label: 'MARGEN', value: `${auditReport.margin_percent?.toFixed(1)}%` },
          { label: 'EFICIENCIA', value: `${auditReport.efficiency_ratio?.toFixed(1)}%` },
          { label: 'EC. CONTABLE', value: auditReport.equation_valid ? 'VÁLIDA' : 'DISCREPANCIA' },
        ];
        const akW = contentW / 3;
        auditKpis.forEach((k, i) => {
          const colX = margin + i * akW;
          doc.setFillColor(22, 22, 22);
          filledRoundedRect(colX, y, akW - 3, 16, 2, 2);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...gold);
          doc.text(k.label, colX + 4, y + 6);
          doc.setFontSize(10);
          doc.setTextColor(...white);
          doc.text(k.value, colX + 4, y + 13);
        });
        y += 22;

        // Diagnosis paragraph
        checkPageBreak(20);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...gold);
        doc.text('DIAGNÓSTICO', margin, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...white);
        const diagLines = doc.splitTextToSize(auditReport.diagnosis || '', contentW);
        doc.text(diagLines, margin, y);
        y += diagLines.length * 4.5 + 6;

        // Alerts
        if (auditReport.alerts?.length > 0) {
          checkPageBreak(16);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...gold);
          doc.text('ALERTAS', margin, y);
          y += 5;
          auditReport.alerts.forEach(a => {
            checkPageBreak(10);
            const bgCol = a.severity === 'high' ? [80, 20, 20] : a.severity === 'medium' ? [70, 55, 10] : [15, 30, 60];
            doc.setFillColor(...bgCol);
            const alertLines = doc.splitTextToSize(`• ${a.message}`, contentW - 6);
            filledRoundedRect(margin, y, contentW, alertLines.length * 4.5 + 6, 1.5, 1.5);
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...white);
            doc.text(alertLines, margin + 3, y + 5);
            y += alertLines.length * 4.5 + 9;
          });
        }

        // Recommendations
        if (auditReport.recommendations?.length > 0) {
          checkPageBreak(16);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...gold);
          doc.text('RECOMENDACIONES', margin, y);
          y += 5;
          auditReport.recommendations.forEach((r, i) => {
            checkPageBreak(16);
            doc.setFillColor(20, 30, 20);
            const recLines = doc.splitTextToSize(r.description || '', contentW - 30);
            const boxH = recLines.length * 4.2 + 14;
            filledRoundedRect(margin, y, contentW, boxH, 2, 2);
            doc.setFillColor(...gold);
            filledRoundedRect(margin, y, 3, boxH, 2, 2);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...white);
            doc.text(`${i + 1}. ${r.title || ''}`, margin + 6, y + 7);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...gray);
            doc.text(recLines, margin + 6, y + 13);
            if (r.priority) {
              doc.setFontSize(6.5);
              doc.setTextColor(...gold);
              doc.text(r.priority.toUpperCase(), pageW - margin - 3, y + 7, { align: 'right' });
            }
            y += boxH + 4;
          });
        }
      }

      // ── Footer on all pages ───────────────────────────────────────
      const totalPages = doc.internal.getNumberOfPages();
      for (let p = 2; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFillColor(10, 10, 10);
        filledRect(0, pageH - 12, pageW, 12);
        doc.setFillColor(...gold);
        filledRect(0, pageH - 12, pageW, 0.5);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...gray);
        doc.text('GEMAILLA AI  —  Documento Confidencial', margin, pageH - 5);
        doc.text(`Página ${p - 1} de ${totalPages - 1}`, pageW - margin, pageH - 5, { align: 'right' });
      }

      const fileName = `Reporte_${company.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
      doc.save(fileName);

      toast({ title: 'Reporte generado', description: `${fileName} descargado exitosamente.` });
    } finally {
      setGenerating(false);
    }
  };

  const generateExcel = () => {
    setGenerating(true);
    try {
      const totalIngresos = transactions.filter(t => t.type === 'ingreso').reduce((s, t) => s + (t.amount || 0), 0);
      const totalGastos = transactions.filter(t => t.type === 'gasto').reduce((s, t) => s + (t.amount || 0), 0);
      const balance = totalIngresos - totalGastos;

      // Build CSV content (opens in Excel)
      const rows = [];
      rows.push(['GEMAILLA AI — REPORTE FINANCIERO', '', '', '', '']);
      rows.push([`Empresa: ${company.name}`, '', '', '', '']);
      rows.push([`RFC: ${company.rfc || 'N/A'}`, '', '', '', '']);
      rows.push([`Fecha: ${format(new Date(), "d 'de' MMMM yyyy", { locale: es })}`, '', '', '', '']);
      rows.push(['', '', '', '', '']);
      rows.push(['RESUMEN FINANCIERO', '', '', '', '']);
      rows.push(['Ingresos Totales', totalIngresos, '', '', '']);
      rows.push(['Gastos Totales', totalGastos, '', '', '']);
      rows.push(['Balance Neto', balance, '', '', '']);
      rows.push(['Margen (%)', totalIngresos > 0 ? ((balance / totalIngresos) * 100).toFixed(2) : '0.00', '', '', '']);
      rows.push(['', '', '', '', '']);
      rows.push(['TRANSACCIONES', '', '', '', '']);
      rows.push(['Tipo', 'Descripción', 'Categoría', 'Fecha', 'Monto', 'Estado', 'Método de Pago']);
      transactions.forEach(tx => {
        rows.push([
          tx.type === 'ingreso' ? 'Ingreso' : 'Gasto',
          tx.description || '-',
          (tx.category || '-').replace(/_/g, ' '),
          tx.date || '-',
          tx.amount || 0,
          tx.status || '-',
          (tx.paymentMethod || '-').replace(/_/g, ' ')
        ]);
      });

      if (documents.length > 0) {
        rows.push(['', '', '', '', '']);
        rows.push(['DOCUMENTOS', '', '', '', '']);
        rows.push(['Título', 'Tipo', 'Estado', 'Fecha', 'Total', 'RFC Emisor']);
        documents.forEach(doc => {
          rows.push([
            doc.title || '-',
            doc.docType || '-',
            doc.status || '-',
            doc.docDate || '-',
            doc.total || '-',
            doc.rfc_emisor || '-'
          ]);
        });
      }

      if (auditReport) {
        rows.push(['', '', '', '', '']);
        rows.push(['AUDITORÍA IA', '', '', '', '']);
        rows.push(['Health Score', auditReport.health_score || '-', '', '', '']);
        rows.push(['Calificación', auditReport.health_label || '-', '', '', '']);
        rows.push(['Margen', `${auditReport.margin_percent?.toFixed(1)}%`, '', '', '']);
        rows.push(['Eficiencia', `${auditReport.efficiency_ratio?.toFixed(1)}%`, '', '', '']);
        rows.push(['Diagnóstico', auditReport.diagnosis || '-', '', '', '']);
        if (auditReport.recommendations?.length > 0) {
          rows.push(['', '', '', '', '']);
          rows.push(['RECOMENDACIONES', '', '', '', '']);
          auditReport.recommendations.forEach((r, i) => {
            rows.push([`${i + 1}. ${r.title}`, r.description, r.priority, '', '']);
          });
        }
      }

      // Convert to CSV with BOM for Excel UTF-8
      const csvContent = '\uFEFF' + rows.map(row =>
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Reporte_${company.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast({ title: 'Excel generado', description: 'Archivo CSV descargado (compatible con Excel).' });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          disabled={generating || !company}
          variant="outline"
          className="border-primary/40 text-primary hover:bg-primary/10 hover:border-primary gap-2"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          {generating ? 'Generando...' : 'Exportar Reporte'}
          <ChevronDown className="w-3 h-3 ml-1 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={generatePDF} className="gap-2 cursor-pointer">
          <FileText className="w-4 h-4 text-primary" />
          Descargar PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={generateExcel} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          Descargar Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, Download, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { parseSpreadsheetFile, validateRequiredColumns } from '@/features/imports/spreadsheetImport';
import { importTransactions, prepareTransactionImport, recordTransactionImportFailure } from '@/app/useCases/financeUseCases';
import { runTransactionImport, shouldStartTransactionImport } from '@/features/erp/services/transactionImportPresenter';

const EXPECTED_COLUMNS = ['tipo', 'monto', 'descripcion', 'fecha', 'categoria', 'metodo_pago'];

export default function ImportTransactions({ companyId, onSuccess }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState('upload'); // upload | preview | done
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const fileRef = useRef();
  const { toast } = useToast();

  const reset = () => { setStep('upload'); setRows([]); setErrors([]); setImportedCount(0); };

  const handleFile = async (file) => {
    if (!file) return;
    if (!companyId) {
      toast({ title: 'Empresa requerida', description: 'Selecciona una empresa antes de importar transacciones.', variant: 'destructive' });
      return;
    }
    setStep('processing');
    try {
      const parsed = await parseSpreadsheetFile(file);
      const columnErrors = validateRequiredColumns(parsed, ['monto']);
      if (columnErrors.length) throw new Error(columnErrors.join(' '));
      processRows(parsed, file);
    } catch (err) {
      setStep('upload');
      toast({ title: 'Error en la importación', description: err.message, variant: 'destructive' });
      await recordTransactionImportFailure({
        companyId,
        fileName: file.name,
        errorCount: 1,
        errors: [err.message],
      }).catch(() => null);
    }
  };

  const processRows = (parsed, file) => {
    const prepared = prepareTransactionImport({ rows: parsed, companyId });
    if (!prepared.rows.length) {
      recordTransactionImportFailure({
        companyId,
        fileName: file.name,
        errorCount: prepared.errors.length,
        errors: prepared.errors,
      }).catch(() => null);
    }
    setRows(prepared.rows);
    setErrors(prepared.errors);
    setStep('preview');
  };

  const handleImport = () => {
    if (!shouldStartTransactionImport(rows, importing)) return;

    return runTransactionImport({
      rows,
      companyId,
      fileName: fileRef.current?.files?.[0]?.name,
      errors,
      importTransactions,
      setImportedCount,
      setImporting,
      setStep,
      toast,
      onSuccess,
    });
  };

  const downloadTemplate = () => {
    const csv = [
      'tipo,monto,descripcion,fecha,categoria,metodo_pago',
      'ingreso,15000,Venta de software,2026-05-01,ventas,transferencia',
      'gasto,3500,Renta oficina,2026-05-01,renta,transferencia',
      'gasto,8000,Nomina empleados,2026-05-01,nómina,transferencia',
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'plantilla_transacciones.csv';
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <>
      <Button variant="outline" onClick={() => { setOpen(true); reset(); }} className="border-border gap-2">
        <FileSpreadsheet className="w-4 h-4" /> Importar Excel/CSV
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" /> Importar Transacciones
            </DialogTitle>
          </DialogHeader>

          {/* Upload step */}
          {(step === 'upload' || step === 'processing') && (
            <div className="space-y-4">
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-border rounded-2xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
              >
                {step === 'processing' ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">Extrayendo datos del archivo...</p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium text-foreground mb-1">Arrastra tu archivo aquí o haz clic para seleccionar</p>
                    <p className="text-xs text-muted-foreground">Soporta CSV y Excel (.xlsx/.xls)</p>
                  </>
                )}
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                  onChange={e => handleFile(e.target.files[0])} />
              </div>

              <div className="flex items-center justify-between p-3 bg-secondary/40 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-foreground">¿No tienes el formato correcto?</p>
                  <p className="text-xs text-muted-foreground">Descarga nuestra plantilla CSV con ejemplos.</p>
                </div>
                <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5 shrink-0">
                  <Download className="w-3.5 h-3.5" /> Plantilla
                </Button>
              </div>

              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Columnas requeridas:</p>
                <div className="flex flex-wrap gap-1.5">
                  {EXPECTED_COLUMNS.map(c => <span key={c} className="bg-secondary px-2 py-0.5 rounded-full">{c}</span>)}
                </div>
              </div>
            </div>
          )}

          {/* Preview step */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-green-400 font-medium">{rows.length} filas válidas</span>
                </div>
                {errors.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm text-yellow-400 font-medium">{errors.length} errores omitidos</span>
                  </div>
                )}
              </div>

              {errors.length > 0 && (
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3 text-xs text-yellow-400 space-y-0.5 max-h-24 overflow-y-auto">
                  {errors.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              )}

              <div className="border border-border rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-secondary/60 sticky top-0">
                    <tr>
                      {['Tipo', 'Monto', 'Descripción', 'Fecha', 'Categoría'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-muted-foreground font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t border-border hover:bg-secondary/30">
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded-full ${r.type === 'ingreso' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                            {r.type}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-medium text-foreground">${r.amount.toLocaleString()}</td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[180px] truncate">{r.description || '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.date}</td>
                        <td className="px-3 py-2 text-muted-foreground">{r.category}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between gap-3">
                <Button variant="outline" onClick={reset} className="border-border gap-1.5">
                  <X className="w-4 h-4" /> Cancelar
                </Button>
                <Button onClick={handleImport} disabled={importing || rows.length === 0}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {importing ? 'Importando...' : `Importar ${rows.length} transacciones`}
                </Button>
              </div>
            </div>
          )}

          {/* Done step */}
          {step === 'done' && (
            <div className="py-10 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">¡Importación completada!</p>
                <p className="text-sm text-muted-foreground">{importedCount} transacciones importadas exitosamente.</p>
              </div>
              <Button onClick={() => { setOpen(false); reset(); }} className="bg-primary text-primary-foreground">
                Cerrar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
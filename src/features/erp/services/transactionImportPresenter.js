export function shouldStartTransactionImport(rows, importing) {
  return rows.length > 0 && importing !== true;
}

export async function runTransactionImport({
  rows,
  companyId,
  fileName,
  errors = [],
  importTransactions,
  setImportedCount,
  setImporting,
  setStep,
  toast,
  onSuccess,
}) {
  setImporting(true);
  try {
    const created = await importTransactions({
      rows,
      companyId,
      importLog: {
        fileName: fileName || 'transacciones.csv',
        errorCount: errors.length,
        status: errors.length ? 'partial' : 'success',
        errors,
      },
    });
    setImportedCount(created.length);
    setStep('done');
    onSuccess?.();
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : 'No se pudieron guardar las transacciones. Intenta de nuevo.';
    toast({
      title: 'Error al importar transacciones',
      description: message,
      variant: 'destructive',
    });
    setStep('preview');
  } finally {
    setImporting(false);
  }
}

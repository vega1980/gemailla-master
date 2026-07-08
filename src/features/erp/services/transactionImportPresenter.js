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
  if (!rows.length) return;

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
    toast({
      title: 'Error al importar transacciones',
      description: error.message || 'No se pudieron guardar las transacciones. Intenta de nuevo.',
      variant: 'destructive',
    });
    setStep('preview');
  } finally {
    setImporting(false);
  }
}

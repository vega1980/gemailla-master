import React, { useState } from 'react';
import { firebase } from '@/api/firebaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCompany } from '@/lib/companyContext';
import { createImportLog, parseSpreadsheetFile, validateRequiredColumns } from '@/features/imports/spreadsheetImport';

export default function ClientImporter() {
  const [uploading, setUploading] = useState(false);
  const [imported, setImported] = useState(null);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const { activeCompany } = useCompany();

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setImported(null);

    try {
      if (!activeCompany?.id) {
        throw new Error('Selecciona una empresa antes de importar clientes.');
      }

      const parsedRows = await parseSpreadsheetFile(file);
      const columnErrors = validateRequiredColumns(parsedRows, ['name']);
      if (columnErrors.length) throw new Error(columnErrors.join(' '));

      const rowErrors = [];
      const clientsToCreate = parsedRows.reduce((valid, client, index) => {
        const name = String(client.name || '').trim();
        if (!name) {
          rowErrors.push(`Fila ${index + 2}: name es requerido.`);
          return valid;
        }
        valid.push({
          name,
          email: client.email || '',
          phone: client.phone || '',
          rfc: client.rfc || '',
          segment: client.segment || 'potencial',
          industry: client.industry || '',
          address: client.address || '',
          assignedTo: client.assignedto || client.assignedTo || '',
          total_revenue: Number(client.total_revenue || 0),
          notes: client.notes || '',
          companyId: activeCompany.id,
          status: 'activo',
        });
        return valid;
      }, []);

      if (!clientsToCreate.length) {
        await createImportLog({ firebase, companyId: activeCompany.id, type: 'clients', file, validCount: 0, errorCount: rowErrors.length, status: 'failed', errors: rowErrors });
        throw new Error(`No hay clientes válidos para importar. ${rowErrors.slice(0, 3).join(' ')}`);
      }

      const created = await firebase.entities.CRMClient.bulkCreate(clientsToCreate);

      await createImportLog({ firebase, companyId: activeCompany.id, type: 'clients', file, validCount: created.length, errorCount: rowErrors.length, status: rowErrors.length ? 'partial' : 'success', errors: rowErrors });

      setImported(created.length);
      toast({
        title: 'Importación exitosa',
        description: `${created.length} cliente(s) importado(s) correctamente${rowErrors.length ? `; ${rowErrors.length} fila(s) omitida(s)` : ''}`,
      });
    } catch (err) {
      if (activeCompany?.id) {
        await createImportLog({ firebase, companyId: activeCompany.id, type: 'clients', file, validCount: 0, errorCount: 1, status: 'failed', errors: [err.message] }).catch(() => null);
      }
      setError(err.message);
      toast({
        title: 'Error en la importación',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = ['name', 'email', 'phone', 'rfc', 'segment', 'industry', 'address', 'assignedTo', 'total_revenue', 'notes'];
    const example = ['Cliente Ejemplo SA', 'contacto@ejemplo.com', '+52 55 1234 5678', 'XAXX010101000', 'premium', 'tecnología', 'Av. Reforma 123', 'Juan Pérez', '500000', 'Cliente desde 2024'];
    const csvContent = [headers.join(','), example.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_clientes.csv';
    a.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-primary" />
          Importar Clientes
        </CardTitle>
        <CardDescription>
          Sube un archivo Excel o CSV con tu lista de clientes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
            id="client-upload"
          />
          <label htmlFor="client-upload">
            <Button asChild disabled={uploading}>
              <span>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                {uploading ? 'Importando...' : 'Seleccionar Archivo'}
              </span>
            </Button>
          </label>
          <Button variant="outline" onClick={downloadTemplate}>
            Descargar Plantilla
          </Button>
        </div>

        {imported !== null && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              {imported} cliente(s) importado(s) exitosamente
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-muted-foreground">
          <p><strong>Columnas soportadas:</strong> name*, email, phone, rfc, segment, industry, address, assignedTo, total_revenue, notes</p>
          <p>*name es requerido</p>
        </div>
      </CardContent>
    </Card>
  );
}
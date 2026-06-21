import React, { useState } from 'react';
import { firebase } from '@/api/firebaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCompany } from '@/lib/companyContext';

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

      // Upload file
      const { storagePath } = await firebase.integrations.Core.UploadFile({ file, companyId: activeCompany.id });

      // Define expected schema for clients
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          rfc: { type: 'string' },
          segment: { type: 'string' },
          industry: { type: 'string' },
          address: { type: 'string' },
          assignedTo: { type: 'string' },
          total_revenue: { type: 'number' },
          notes: { type: 'string' }
        },
        required: ['name']
      };

      // Extract data from file
      const extraction = await firebase.integrations.Core.ExtractDataFromUploadedFile({
        storagePath,
        json_schema: schema
      });

      if (extraction.status === 'error') {
        throw new Error(extraction.details);
      }

      const clientsData = Array.isArray(extraction.output) ? extraction.output : [extraction.output];

      // Bulk create clients
      const clientsToCreate = clientsData.map(client => ({
        ...client,
        companyId: activeCompany.id,
        status: 'activo',
        segment: client.segment || 'potencial'
      }));

      const created = await firebase.entities.CRMClient.bulkCreate(clientsToCreate);

      setImported(created.length);
      toast({
        title: 'Importación exitosa',
        description: `${created.length} cliente(s) importado(s) correctamente`,
      });
    } catch (err) {
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
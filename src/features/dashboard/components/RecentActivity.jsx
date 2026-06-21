import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileText, ArrowUpDown, Brain, Building2, Shield, UserPlus } from 'lucide-react';

const actionIcons = {
  document_upload: FileText,
  document_analyze: Brain,
  transaction_create: ArrowUpDown,
  company_create: Building2,
  audit_run: Shield,
  member_add: UserPlus,
};

const actionLabels = {
  document_upload: 'Documento subido',
  document_analyze: 'Documento analizado',
  transaction_create: 'Transacción creada',
  company_create: 'Empresa creada',
  audit_run: 'Auditoría ejecutada',
  member_add: 'Miembro agregado',
  ai_query: 'Consulta IA',
  login: 'Inicio de sesión',
};

export default function RecentActivity({ logs }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">Actividad Reciente</h3>
      <div className="space-y-3">
        {logs.slice(0, 8).map((log) => {
          const Icon = actionIcons[log.action] || FileText;
          return (
            <div key={log.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
              <div className="p-1.5 rounded-md bg-primary/10 shrink-0 mt-0.5">
                <Icon className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">{actionLabels[log.action] || log.action}</p>
                {log.details && <p className="text-xs text-muted-foreground truncate">{log.details}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {log.userName || log.userEmail} · {log.createdAt ? format(new Date(log.createdAt), 'dd MMM, HH:mm', { locale: es }) : ''}
                </p>
              </div>
            </div>
          );
        })}
        {logs.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Sin actividad reciente</p>
        )}
      </div>
    </div>
  );
}
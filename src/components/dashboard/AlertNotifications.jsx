import React, { useState } from 'react';
import { firebase } from '@/api/firebaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Bell, Mail, MessageCircle, Send, Loader2, CheckCircle2, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function AlertNotifications({ alerts = [], company }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [channels, setChannels] = useState(['email']);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const { toast } = useToast();

  const criticalCount = alerts.filter(a => a.level === 'critical').length;
  const warningCount = alerts.filter(a => a.level === 'warning').length;
  const hasAlerts = criticalCount + warningCount > 0;

  const toggleChannel = (ch) => {
    setChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);
  };

  const sendNotifications = async () => {
    if (!channels.length) return;
    if (channels.includes('email') && !email) { toast({ title: 'Ingresa un email', variant: 'destructive' }); return; }
    if (channels.includes('whatsapp') && !phone) { toast({ title: 'Ingresa un número de WhatsApp', variant: 'destructive' }); return; }

    setSending(true);
    setResult(null);

    const res = await firebase.functions.invoke('sendAlertNotification', {
      alerts: alerts.filter(a => a.level === 'critical' || a.level === 'warning'),
      company_name: company?.name || 'Mi Empresa',
      channels,
      recipient_email: channels.includes('email') ? email : null,
      recipient_phone: channels.includes('whatsapp') ? phone : null,
    });

    const data = res?.data || res;
    setResult(data);
    setSending(false);

    // Auto-open WhatsApp if URL provided
    if (data?.results?.whatsapp_url) {
      window.open(data.results.whatsapp_url, '_blank');
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={`gap-2 border-border relative ${hasAlerts ? 'border-primary/40 text-primary' : ''}`}
      >
        <Bell className="w-4 h-4" />
        Notificar Alertas
        {hasAlerts && (
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
            {criticalCount + warningCount}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" /> Enviar Alertas Predictivas
            </DialogTitle>
          </DialogHeader>

          {!hasAlerts ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">Sin alertas activas</p>
              <p className="text-xs text-muted-foreground mt-1">Tu empresa no tiene alertas críticas o advertencias en este momento.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Alert summary */}
              <div className="p-3 bg-secondary/50 rounded-xl space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Se enviarán estas alertas:</p>
                {criticalCount > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                    <span className="text-red-400 font-medium">{criticalCount} alerta{criticalCount > 1 ? 's' : ''} crítica{criticalCount > 1 ? 's' : ''}</span>
                  </div>
                )}
                {warningCount > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" />
                    <span className="text-yellow-400 font-medium">{warningCount} advertencia{warningCount > 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>

              {/* Channel selector */}
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">Canal de Notificación</Label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'email', icon: Mail, label: 'Email', desc: 'Reporte HTML completo' },
                    { key: 'whatsapp', icon: MessageCircle, label: 'WhatsApp', desc: 'Mensaje directo' },
                  ].map(({ key, icon: Icon, label, desc }) => (
                    <button
                      key={key}
                      onClick={() => toggleChannel(key)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        channels.includes(key)
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-secondary/30 hover:border-border/80'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mb-1.5 ${channels.includes(key) ? 'text-primary' : 'text-muted-foreground'}`} />
                      <p className={`text-sm font-medium ${channels.includes(key) ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Contact inputs */}
              {channels.includes('email') && (
                <div>
                  <Label>Email destinatario</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="gerente@empresa.com"
                    className="bg-secondary border-border mt-1.5"
                  />
                </div>
              )}

              {channels.includes('whatsapp') && (
                <div>
                  <Label>Número WhatsApp (con código de país)</Label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+52 55 1234 5678"
                    className="bg-secondary border-border mt-1.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Se abrirá WhatsApp Web con el mensaje listo para enviar.</p>
                </div>
              )}

              {/* Result */}
              {result?.sent && (
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl space-y-1">
                  {result.results?.email === 'sent' && (
                    <div className="flex items-center gap-2 text-sm text-green-400">
                      <CheckCircle2 className="w-4 h-4" /> Email enviado correctamente
                    </div>
                  )}
                  {result.results?.whatsapp_url && (
                    <div className="flex items-center gap-2 text-sm text-green-400">
                      <CheckCircle2 className="w-4 h-4" /> WhatsApp abierto con mensaje listo
                      <a href={result.results.whatsapp_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={sendNotifications}
                disabled={sending || !channels.length}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? 'Enviando...' : 'Enviar Notificaciones'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
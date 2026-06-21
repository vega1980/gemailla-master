import React, { useState } from 'react';
import { PLAN_CONFIG, useSubscription } from '@/lib/subscriptionContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Sparkles, Zap, Loader2, Star, AlertTriangle, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const plans = [
  {
    id: 'basic',
    name: 'Basic',
    price: { monthly: PLAN_CONFIG.basic.monthlyPrice, annual: PLAN_CONFIG.basic.annualPrice },
    icon: Zap,
    color: 'border-border',
    description: 'Todo lo esencial para comenzar.',
    features: ['Dashboard financiero', 'Gestión de documentos', 'ERP básico', 'Registro de transacciones', 'Hasta 3 empresas'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: { monthly: PLAN_CONFIG.pro.monthlyPrice, annual: PLAN_CONFIG.pro.annualPrice },
    icon: Sparkles,
    color: 'border-violet-500',
    badge: 'Más popular',
    description: 'Inteligencia financiera avanzada.',
    features: ['Todo lo de Basic', 'Predicciones de flujo de caja', 'Análisis What-If', 'Alertas proactivas IA', 'Reportes PDF', 'Hasta 10 empresas'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: { monthly: PLAN_CONFIG.enterprise.monthlyPrice, annual: PLAN_CONFIG.enterprise.annualPrice },
    icon: Crown,
    color: 'border-amber-500',
    badge: 'Todo incluido',
    description: 'El poder total de GEMAILLA AI.',
    features: ['Todo lo de Pro', 'Consultor Virtual IA', 'Consultas ilimitadas', 'Empresas ilimitadas', 'Soporte prioritario'],
  },
];

export default function MyPlan() {
  const { subscription, plan: currentPlan } = useSubscription();
  const [billing, setBilling] = useState(subscription?.billingCycle || 'monthly');
  const [loading, setLoading] = useState(null);
  const [showCancel, setShowCancel] = useState(false);

  const requestPlanChange = (planId) => {
    if (planId === currentPlan) return;
    setLoading(planId);
    window.location.href = `mailto:soporte@gemailla.com?subject=Cambio de plan GEMAILLA AI&body=Solicito cambiar mi plan a ${planId} con facturación ${billing}.`;
    setLoading(null);
  };

  const requestCancellation = () => {
    window.location.href = 'mailto:soporte@gemailla.com?subject=Cancelación de suscripción GEMAILLA AI';
    setShowCancel(false);
  };

  const daysLeft = subscription?.endDate
    ? Math.max(0, Math.ceil((new Date(subscription.endDate) - new Date()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="space-y-8">
      {/* Current plan status */}
      {subscription && (
        <div className="bg-card border border-primary/30 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
                <Star className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">Plan Actual</p>
                <p className="text-xl font-bold text-foreground capitalize">{subscription.plan}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="border-primary/40 text-primary capitalize text-xs">
                    {subscription.billingCycle === 'annual' ? 'Anual' : 'Mensual'}
                  </Badge>
                  <Badge className={`text-xs ${subscription.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400'}`}>
                    {subscription.status === 'active' ? 'Activo' : 'Cancelado'}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="text-right">
              {subscription.endDate && (
                <>
                  <p className="text-xs text-muted-foreground">Renueva / vence el</p>
                  <p className="text-sm font-medium text-foreground">
                    {format(new Date(subscription.endDate), "d 'de' MMMM, yyyy", { locale: es })}
                  </p>
                  {daysLeft !== null && daysLeft <= 7 && (
                    <p className="text-xs text-yellow-400 flex items-center justify-end gap-1 mt-1">
                      <AlertTriangle className="w-3 h-3" /> {daysLeft} días restantes
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
          {subscription.status === 'active' && currentPlan !== 'basic' && (
            <div className="mt-4 pt-4 border-t border-border flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowCancel(true)} className="text-muted-foreground hover:text-destructive gap-2">
                <XCircle className="w-4 h-4" /> Cancelar suscripción
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Cancel confirmation */}
      {showCancel && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-5">
          <p className="text-sm font-semibold text-foreground mb-2">⚠️ ¿Confirmar cancelación?</p>
          <p className="text-sm text-muted-foreground mb-4">La cancelación ya no se aplica desde el frontend. Soporte validará la solicitud y confirmará el cambio de forma segura.</p>
          <div className="flex gap-3">
            <Button size="sm" variant="destructive" onClick={requestCancellation} disabled={loading === 'cancel'} className="gap-2">
              {loading === 'cancel' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
              Sí, cancelar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowCancel(false)}>No, mantener plan</Button>
          </div>
        </div>
      )}

      {/* Billing toggle */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border">
          {['monthly', 'annual'].map((b) => (
            <button key={b} onClick={() => setBilling(b)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${billing === b ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'}`}>
              {b === 'monthly' ? 'Mensual' : 'Anual'}
              {b === 'annual' && <span className="ml-2 text-xs text-emerald-500 font-semibold">−20%</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((p, i) => {
          const Icon = p.icon;
          const isCurrent = currentPlan === p.id;
          const price = p.price[billing];

          return (
            <motion.div key={p.id}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className={`relative rounded-2xl border-2 ${p.color} bg-card p-6 flex flex-col gap-5 ${isCurrent ? 'ring-2 ring-primary/40' : ''}`}>
              {p.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className={`${p.id === 'pro' ? 'bg-violet-500 text-white' : 'bg-amber-500 text-white'} shadow-sm`}>{p.badge}</Badge>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${p.id === 'pro' ? 'bg-violet-500/15' : p.id === 'enterprise' ? 'bg-amber-500/15' : 'bg-muted'}`}>
                  <Icon className={`w-5 h-5 ${p.id === 'pro' ? 'text-violet-400' : p.id === 'enterprise' ? 'text-amber-400' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{p.name}</h3>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                </div>
              </div>
              <div>
                <span className="text-3xl font-bold text-foreground">{price === 0 ? 'Gratis' : `$${price.toLocaleString()}`}</span>
                {price > 0 && <span className="text-sm text-muted-foreground ml-1">MXN / {billing === 'annual' ? 'año' : 'mes'}</span>}
              </div>
              <ul className="space-y-2 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <Button onClick={() => requestPlanChange(p.id)} disabled={isCurrent || loading === p.id}
                className={`w-full gap-2 ${isCurrent ? 'bg-muted text-muted-foreground cursor-default' : p.id === 'pro' ? 'bg-violet-600 hover:bg-violet-700 text-white' : p.id === 'enterprise' ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
                {loading === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : isCurrent ? '✓ Plan actual' : `Seleccionar ${p.name}`}
              </Button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
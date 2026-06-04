import React, { useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { firebase } from '@/api/firebaseClient';
import { useAuth } from '@/lib/AuthContext';
import { PLAN_CONFIG, useSubscription } from '@/lib/subscriptionContext';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Sparkles, Zap, Loader2, Star, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

const plans = [
  {
    id: 'basic',
    name: 'Basic',
    price: { monthly: PLAN_CONFIG.basic.monthlyPrice, annual: PLAN_CONFIG.basic.annualPrice },
    icon: Zap,
    color: 'border-border',
    badge: null,
    description: 'Todo lo esencial para comenzar a gestionar tus finanzas.',
    features: [
      'Dashboard financiero',
      'Gestión de documentos',
      'ERP básico',
      'Registro de transacciones',
      'Auditoría de actividad',
      'Hasta 3 empresas',
    ],
    locked: [],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: { monthly: PLAN_CONFIG.pro.monthlyPrice, annual: PLAN_CONFIG.pro.annualPrice },
    icon: Sparkles,
    color: 'border-violet-500',
    badge: 'Más popular',
    description: 'Inteligencia financiera avanzada para equipos que crecen.',
    features: [
      'Todo lo de Basic',
      'Predicciones de flujo de caja',
      'Análisis de escenarios What-If',
      'Alertas proactivas con IA',
      'Reportes avanzados en PDF',
      'Hasta 10 empresas',
    ],
    locked: [],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: { monthly: PLAN_CONFIG.enterprise.monthlyPrice, annual: PLAN_CONFIG.enterprise.annualPrice },
    icon: Crown,
    color: 'border-amber-500',
    badge: 'Todo incluido',
    description: 'El poder total de GEMAILLA AI para grandes operaciones.',
    features: [
      'Todo lo de Pro',
      'Asistente de IA personalizado',
      'Consultas ilimitadas a IA',
      'Contexto financiero completo',
      'Empresas ilimitadas',
      'Soporte prioritario',
    ],
    locked: [],
  },
];

export default function Subscriptions() {
  const { user } = useAuth();
  const { subscription, plan: currentPlan, reload } = useSubscription();
  const [billing, setBilling] = useState('monthly');
  const [loading, setLoading] = useState(null);
  const userUid = user?.uid || user?.id;

  const handleDeleteAccount = async () => {
    const [subsByUid, subsByEmail] = await Promise.all([
      userUid
        ? firebase.entities.Subscription.filter({ userUid, status: 'active' }).catch(() => [])
        : [],
      user?.email
        ? firebase.entities.Subscription.filter({ userEmail: user.email, status: 'active' }).catch(() => [])
        : [],
    ]);
    const subsById = new Map();
    [...subsByUid, ...subsByEmail, subscription].forEach((sub) => {
      if (sub?.id) subsById.set(sub.id, sub);
    });

    await Promise.all(
      Array.from(subsById.values()).map((sub) =>
        firebase.entities.Subscription.update(sub.id, {
          userUid: sub.userUid || userUid || null,
          userEmail: sub.userEmail || user?.email || '',
          status: 'cancelled',
        }),
      ),
    );
    await firebase.auth.logout();
  };

  const handleSelect = async (planId) => {
    if (planId === currentPlan) return;
    if (!userUid) throw new Error('Usuario sin UID válido.');
    setLoading(planId);
    const today = new Date();
    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + (billing === 'annual' ? 12 : 1));

    if (subscription?.id) {
      await firebase.entities.Subscription.update(subscription.id, {
        userUid,
        userEmail: user.email,
        plan: planId,
        billingCycle: billing,
        startDate: format(today, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        status: 'active',
      });
    } else {
      await firebase.entities.Subscription.create({
        userUid,
        userEmail: user.email,
        plan: planId,
        billingCycle: billing,
        startDate: format(today, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        status: 'active',
      });
    }

    await reload();
    setLoading(null);
    toast.success(`Plan actualizado a ${planId.charAt(0).toUpperCase() + planId.slice(1)}`);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Suscripciones"
        description="Elige el plan que mejor se adapte a tu empresa."
      />

      {/* Current Plan Banner */}
      {subscription && (
        <div className="mb-8 p-4 rounded-xl border border-primary/30 bg-primary/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Star className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Plan actual: <span className="text-primary capitalize">{subscription.plan}</span>
              </p>
              {subscription.endDate && (
                <p className="text-xs text-muted-foreground">
                  Vence el {format(new Date(subscription.endDate), "d 'de' MMMM, yyyy", { locale: es })}
                </p>
              )}
            </div>
          </div>
          <Badge variant="outline" className="capitalize border-primary/40 text-primary">
            {subscription.billingCycle === 'annual' ? 'Anual' : 'Mensual'}
          </Badge>
        </div>
      )}

      {/* Billing Toggle */}
      <div className="flex justify-center mb-10">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border">
          {['monthly', 'annual'].map((b) => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${billing === b ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {b === 'monthly' ? 'Mensual' : 'Anual'}
              {b === 'annual' && (
                <span className="ml-2 text-xs text-emerald-500 font-semibold">−20%</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((p, i) => {
          const Icon = p.icon;
          const isCurrent = currentPlan === p.id;
          const price = p.price[billing];

          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`relative rounded-2xl border-2 ${p.color} bg-card p-6 flex flex-col gap-5 ${p.id === 'pro' ? 'shadow-lg shadow-violet-500/10' : ''}`}
            >
              {p.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className={`${p.id === 'pro' ? 'bg-violet-500 text-white' : 'bg-amber-500 text-white'} shadow-sm`}>
                    {p.badge}
                  </Badge>
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
                <span className="text-3xl font-bold text-foreground">
                  {price === 0 ? 'Gratis' : `$${price.toLocaleString()}`}
                </span>
                {price > 0 && (
                  <span className="text-sm text-muted-foreground ml-1">
                    MXN / {billing === 'annual' ? 'año' : 'mes'}
                  </span>
                )}
              </div>

              <ul className="space-y-2.5 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-base text-muted-foreground">
                    <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleSelect(p.id)}
                disabled={isCurrent || loading === p.id}
                className={`w-full gap-2 ${isCurrent ? 'bg-muted text-muted-foreground cursor-default' : p.id === 'pro' ? 'bg-violet-600 hover:bg-violet-700 text-white' : p.id === 'enterprise' ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
              >
                {loading === p.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isCurrent ? (
                  'Plan actual'
                ) : (
                  `Seleccionar ${p.name}`
                )}
              </Button>
            </motion.div>
          );
        })}
      </div>

      {/* Feature comparison note */}
      <div className="mt-10 p-5 rounded-xl border border-border bg-muted/20 text-center">
        <p className="text-sm text-muted-foreground">
          🔒 <strong>Pro</strong>: predicciones de ventas y flujo de caja con IA &nbsp;|&nbsp;
          👑 <strong>Enterprise</strong>: asistente de IA personalizado con contexto completo de tu empresa
        </p>
      </div>

      {/* Danger Zone */}
      <div className="mt-10 p-5 rounded-xl border border-destructive/30 bg-destructive/5">
        <h3 className="text-sm font-semibold text-destructive mb-1">Zona de peligro</h3>
        <p className="text-xs text-muted-foreground mb-4">Esta acción es permanente e irreversible. Tu cuenta y datos serán eliminados.</p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="gap-2">
              <Trash2 className="w-4 h-4" />
              Eliminar cuenta
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar tu cuenta?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Se cancelará tu suscripción y se cerrará tu sesión inmediatamente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAccount}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Sí, eliminar cuenta
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, Crown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/lib/subscriptionContext';

const planLabels = { basic: 'Basic', pro: 'Pro', enterprise: 'Enterprise' };
const planColors = {
  pro: 'from-violet-500/20 to-purple-500/20 border-violet-500/30',
  enterprise: 'from-amber-500/20 to-orange-500/20 border-amber-500/30',
};
const planIcons = { pro: Sparkles, enterprise: Crown };

export default function PlanGate({ requiredPlan, featureName, children }) {
  const { plan, loading } = useSubscription();

  if (loading) return null;

  const planOrder = { basic: 0, pro: 1, enterprise: 2 };
  const hasAccess = planOrder[plan] >= planOrder[requiredPlan];

  if (hasAccess) return children;

  const Icon = planIcons[requiredPlan] || Lock;
  const gradientClass = planColors[requiredPlan] || 'from-muted/20 to-muted/10 border-border';

  return (
    <div className={`relative rounded-2xl border bg-gradient-to-br ${gradientClass} p-8 flex flex-col items-center justify-center text-center gap-4 min-h-[320px]`}>
      <div className="w-14 h-14 rounded-full bg-background/60 flex items-center justify-center border border-border/60">
        <Icon className="w-7 h-7 text-primary" />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">
          Requiere plan {planLabels[requiredPlan]}
        </p>
        <h3 className="text-lg font-semibold text-foreground mb-1">{featureName}</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Esta función está disponible a partir del plan <strong>{planLabels[requiredPlan]}</strong>. Actualiza tu suscripción para acceder.
        </p>
      </div>
      <Link to="/subscriptions">
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
          <Crown className="w-4 h-4" />
          Ver planes
        </Button>
      </Link>
    </div>
  );
}
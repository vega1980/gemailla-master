import React from 'react';
import { useSubscription } from '@/lib/subscriptionContext';
import { Button } from '@/components/ui/button';
import { Lock, Sparkles, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getPredictionGateStatus, PredictionGateStatus } from './predictionGatePolicy';

/**
 * Wraps any prediction/AI feature.
 * - Shows remaining predictions counter when near limit
 * - Blocks access with upgrade CTA when limit reached or plan insufficient
 *
 * Props:
 *   children       – the feature content
 *   requiredPlan   – 'pro' | 'enterprise' (default 'pro')
 *   featureName    – human label shown in the gate message
 *   compact        – shows a small inline banner instead of full gate
 */
export default function PredictionGate({ children, requiredPlan = 'pro', featureName = 'Predicciones IA', compact = false }) {
  const {
    plan,
    planCfg,
    predictionsRemaining,
    predictionCountAvailable,
    isAtLimit,
    loading,
    reload,
  } = useSubscription();

  const PLAN_ORDER = { basic: 0, pro: 1, enterprise: 2 };
  const hasRequiredPlan = PLAN_ORDER[plan] >= PLAN_ORDER[requiredPlan];
  const gateStatus = getPredictionGateStatus({
    loading,
    hasRequiredPlan,
    predictionCountAvailable,
    isAtLimit,
  });

  if (gateStatus === PredictionGateStatus.LOADING) return null;

  // Fully blocked: wrong plan
  if (gateStatus === PredictionGateStatus.PLAN_REQUIRED) {
    if (compact) {
      return (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
          <Lock className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs text-amber-400 flex-1">
            <strong>{featureName}</strong> requiere plan {requiredPlan === 'pro' ? 'Pro' : 'Enterprise'}.
          </span>
          <Button asChild size="sm" className="bg-primary text-primary-foreground h-7 text-xs px-3 shrink-0">
            <Link to="/subscriptions">Actualizar</Link>
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
          <Lock className="w-7 h-7 text-amber-400" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{featureName}</h3>
        <p className="text-sm text-muted-foreground max-w-xs mb-6">
          Pásate a <strong className="text-primary">{requiredPlan === 'pro' ? 'Pro' : 'Enterprise'}</strong> para ver el futuro de tus ventas y acceder a predicciones ilimitadas con IA.
        </p>
        <Button asChild className="bg-primary text-primary-foreground gap-2">
          <Link to="/subscriptions">
            <Sparkles className="w-4 h-4" />
            Ver planes y precios
          </Link>
        </Button>
      </div>
    );
  }

  // Never render prediction controls until the current quota is verified.
  if (gateStatus === PredictionGateStatus.QUOTA_UNAVAILABLE) {
    if (compact) {
      return (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
          <Lock className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs text-amber-400 flex-1">
            No se pudo verificar el límite de predicciones. Vuelve a intentarlo.
          </span>
          <Button size="sm" variant="outline" className="h-7 text-xs px-3 shrink-0" onClick={reload}>
            Reintentar
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
          <Lock className="w-7 h-7 text-amber-400" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Límite sin verificar</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          No podemos habilitar predicciones hasta comprobar el consumo mensual de tu plan.
        </p>
        <Button variant="outline" onClick={reload}>Reintentar verificación</Button>
      </div>
    );
  }

  // Right plan but limit reached
  if (gateStatus === PredictionGateStatus.LIMIT_REACHED) {
    if (compact) {
      return (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-red-500/20 bg-red-500/5">
          <TrendingUp className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-xs text-red-400 flex-1">
            Límite mensual de predicciones alcanzado ({planCfg.predictionLimit}).
          </span>
          <Button asChild size="sm" className="bg-primary text-primary-foreground h-7 text-xs px-3 shrink-0">
            <Link to="/subscriptions">Ampliar plan</Link>
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
          <TrendingUp className="w-7 h-7 text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Límite mensual alcanzado</h3>
        <p className="text-sm text-muted-foreground max-w-xs mb-6">
          Has usado las <strong className="text-foreground">{planCfg.predictionLimit} predicciones</strong> de tu plan <strong>{planCfg.label}</strong> este mes. Pásate a Enterprise para predicciones ilimitadas.
        </p>
        <Button asChild className="bg-primary text-primary-foreground gap-2">
          <Link to="/subscriptions"><Sparkles className="w-4 h-4" />Ampliar a Enterprise</Link>
        </Button>
      </div>
    );
  }

  // Allowed — show remaining counter if close to limit
  const showCounter = planCfg.predictionLimit !== Infinity && predictionsRemaining <= 5;

  return (
    <div className="space-y-3">
      {showCounter && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-xs text-amber-400">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          Te quedan <strong>{predictionsRemaining}</strong> predicciones este mes en tu plan {planCfg.label}.
          <Link to="/subscriptions" className="underline ml-auto">Ampliar</Link>
        </div>
      )}
      {children}
    </div>
  );
}

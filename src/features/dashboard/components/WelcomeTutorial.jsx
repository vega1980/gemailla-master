import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, LayoutDashboard, FileText, ArrowUpDown, Shield, Brain, Building2, FlaskConical, BarChart3, Users, Rocket, Handshake, UserCog, Activity, Crown, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const tutorialSteps = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    description: 'Tu panel de control principal. Aquí verás el resumen financiero de tu empresa, incluyendo ingresos, gastos, balance neto y proyecciones de flujo de caja.',
    features: ['KPIs en tiempo real', 'Gráficas de flujo financiero', 'Alertas proactivas', 'Análisis IA semanal'],
    color: 'from-amber-400 to-amber-600'
  },
  {
    icon: FileText,
    title: 'Documentos',
    description: 'Gestiona todos tus documentos fiscales. Sube facturas, recibos y contratos para que nuestra IA los analice automáticamente.',
    features: ['Carga de PDF y XML', 'Extracción automática de datos', 'Clasificación inteligente', 'Búsqueda avanzada'],
    color: 'from-blue-400 to-blue-600'
  },
  {
    icon: ArrowUpDown,
    title: 'ERP',
    description: 'Sistema de planificación de recursos empresariales. Controla transacciones, inventarios y operaciones diarias.',
    features: ['Registro de ingresos y gastos', 'Categorización automática', 'Control de flujo de efectivo', 'Reportes personalizables'],
    color: 'from-green-400 to-green-600'
  },
  {
    icon: Shield,
    title: 'Auditoría',
    description: 'Módulo de auditoría y cumplimiento. Verifica que todo esté en orden para evitar problemas fiscales.',
    features: ['Detección de anomalías', 'Alertas de cumplimiento', 'Reportes de auditoría', 'Seguimiento de cambios'],
    color: 'from-purple-400 to-purple-600'
  },
  {
    icon: Brain,
    title: 'IA Asistente',
    description: 'Tu asistente financiero impulsado por inteligencia artificial. Haz preguntas en lenguaje natural sobre tus finanzas.',
    features: ['Consultas en español', 'Análisis contextual', 'Recomendaciones personalizadas', 'Historial de conversaciones'],
    color: 'from-pink-400 to-pink-600'
  },
  {
    icon: Building2,
    title: 'Empresas',
    description: 'Gestiona múltiples empresas desde una sola cuenta. Cambia entre ellas fácilmente.',
    features: ['Configuración de empresa', 'Gestión de miembros', 'Permisos por rol', 'Datos separados por empresa'],
    color: 'from-indigo-400 to-indigo-600'
  },
  {
    icon: FlaskConical,
    title: 'Análisis Predictivo',
    description: 'Predice el futuro financiero de tu negocio con modelos de machine learning avanzados.',
    features: ['Proyección de ventas', 'Detección de anomalías', 'Análisis de churn', 'Escenarios what-if'],
    color: 'from-teal-400 to-teal-600'
  },
  {
    icon: BarChart3,
    title: 'Hub Financiero',
    description: 'Centro avanzado de análisis financiero. Estados financieros, presupuestos y gestión de riesgos.',
    features: ['Estado de resultados', 'Balance general', 'Presupuestos', 'Gestión de riesgos'],
    color: 'from-orange-400 to-orange-600'
  },
  {
    icon: Users,
    title: 'Panel Cliente',
    description: 'Portal para que tus clientes consulten su información, planes y alertas personaladas.',
    features: ['Acceso de solo lectura', 'Alertas de stock', 'Tendencias personalizadas', 'Gestión de plan'],
    color: 'from-cyan-400 to-cyan-600'
  },
  {
    icon: Rocket,
    title: 'Estrategia & Ops',
    description: 'Herramientas de optimización de procesos y seguimiento de proyectos estratégicos.',
    features: ['Seguimiento de proyectos', 'Optimización de procesos', 'KPIs estratégicos', 'Automatizaciones'],
    color: 'from-red-400 to-red-600'
  },
  {
    icon: Handshake,
    title: 'CRM',
    description: 'Gestión de relaciones con clientes. Controla ventas, interacciones y oportunidades de negocio.',
    features: ['Pipeline de ventas', 'Historial de clientes', 'Seguimiento de interacciones', 'Gestión de deals'],
    color: 'from-emerald-400 to-emerald-600'
  },
  {
    icon: UserCog,
    title: 'RRHH y Talento',
    description: 'Administración de empleados, nómina y evaluaciones de desempeño.',
    features: ['Directorio de empleados', 'Gestión de nómina', 'Evaluaciones de desempeño', 'Control de asistencia'],
    color: 'from-violet-400 to-violet-600'
  },
  {
    icon: Activity,
    title: 'Log de Actividad',
    description: 'Registro detallado de todas las acciones realizadas en la plataforma.',
    features: ['Auditoría completa', 'Filtros por usuario', 'Línea de tiempo', 'Exportación de datos'],
    color: 'from-slate-400 to-slate-600'
  },
  {
    icon: Crown,
    title: 'Suscripciones',
    description: 'Gestiona tu plan y suscripción. Actualiza o cancela cuando lo necesites.',
    features: ['Planes disponibles', 'Historial de pagos', 'Facturación', 'Gestión de membresía'],
    color: 'from-yellow-400 to-yellow-600'
  }
];

export default function WelcomeTutorial({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    const seen = localStorage.getItem('gemailla_tutorial_seen');
    if (!seen) {
      setIsOpen(true);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setHasSeenTutorial(true);
    localStorage.setItem('gemailla_tutorial_seen', 'true');
    setIsOpen(false);
    if (onComplete) onComplete();
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleReplay = () => {
    setCurrentStep(0);
    setIsOpen(true);
  };

  // Expose replay function via custom event for external triggers
  useEffect(() => {
    const handleReplayEvent = () => handleReplay();
    window.addEventListener('gemailla:replay-tutorial', handleReplayEvent);
    return () => window.removeEventListener('gemailla:replay-tutorial', handleReplayEvent);
  }, []);

  const currentData = tutorialSteps[currentStep];
  const Icon = currentData.icon;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0" style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)', border: '1px solid rgba(197,160,89,0.3)' }}>
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'rgba(197,160,89,0.2)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, var(--${currentData.color.replace('from-', '').replace(' to-', '-')})` }}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-display font-bold" style={{ color: '#c5a059' }}>
                  {currentStep === 0 ? '¡Bienvenido a GEMAILLA IA!' : currentData.title}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {currentStep === 0 ? 'Tu plataforma de asesoría empresarial' : `Paso ${currentStep + 1} de ${tutorialSteps.length}`}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSkip} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {currentStep === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #c5a059, #8b6914)', boxShadow: '0 0 30px rgba(197,160,89,0.4)' }}>
                      <LayoutDashboard className="w-12 h-12 text-white" />
                    </div>
                    <h3 className="text-2xl font-display font-bold mb-4" style={{ color: '#fef3c7' }}>
                      La Evolución de la Asesoría Empresarial
                    </h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      GEMAILLA IA combina inteligencia artificial con herramientas financieras avanzadas para impulsar tu negocio.
                    </p>
                    <div className="grid grid-cols-2 gap-3 max-w-md mx-auto mb-6">
                      <div className="p-3 rounded-lg border" style={{ borderColor: 'rgba(197,160,89,0.2)', background: 'rgba(197,160,89,0.05)' }}>
                        <CheckCircle className="w-5 h-5 mx-auto mb-2" style={{ color: '#c5a059' }} />
                        <p className="text-xs font-medium" style={{ color: '#e8d5a3' }}>14 Módulos</p>
                      </div>
                      <div className="p-3 rounded-lg border" style={{ borderColor: 'rgba(197,160,89,0.2)', background: 'rgba(197,160,89,0.05)' }}>
                        <CheckCircle className="w-5 h-5 mx-auto mb-2" style={{ color: '#c5a059' }} />
                        <p className="text-xs font-medium" style={{ color: '#e8d5a3' }}>IA Integrada</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                      {currentData.description}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {currentData.features.map((feature, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="flex items-center gap-2 p-3 rounded-lg border"
                          style={{ borderColor: 'rgba(197,160,89,0.2)', background: 'rgba(197,160,89,0.05)' }}
                        >
                          <CheckCircle className="w-4 h-4 shrink-0" style={{ color: '#c5a059' }} />
                          <span className="text-sm" style={{ color: '#e8d5a3' }}>{feature}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t" style={{ borderColor: 'rgba(197,160,89,0.2)' }}>
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="gap-2"
              style={{ borderColor: 'rgba(197,160,89,0.3)', color: currentStep === 0 ? 'transparent' : '#c5a059' }}
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </Button>

            <div className="flex gap-2">
              {tutorialSteps.map((_, idx) => (
                <div
                  key={idx}
                  className="w-2 h-2 rounded-full transition-all"
                  style={{
                    background: idx === currentStep ? '#c5a059' : 'rgba(197,160,89,0.3)',
                    width: idx === currentStep ? '24px' : '8px'
                  }}
                />
              ))}
            </div>

            <Button
              onClick={handleNext}
              className="gap-2"
              style={{ background: 'linear-gradient(135deg, #c5a059, #8b6914)', color: '#050505' }}
            >
              {currentStep === tutorialSteps.length - 1 ? 'Comenzar' : 'Siguiente'}
              {currentStep < tutorialSteps.length - 1 && <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCompany } from '@/lib/companyContext';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  Menu, Brain, LayoutDashboard, FileText, ArrowUpDown, Shield,
  Building2, Activity, Crown, FlaskConical, BarChart3, Users,
  Rocket, Handshake, UserCog, ChevronLeft,
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/documents', label: 'Documentos', icon: FileText },
  { path: '/erp', label: 'ERP', icon: ArrowUpDown },
  { path: '/audit', label: 'Auditoría', icon: Shield },
  { path: '/ai', label: 'IA Asistente', icon: Brain },
  { path: '/companies', label: 'Empresas', icon: Building2 },
  { path: '/predictive', label: 'Análisis Predictivo', icon: FlaskConical },
  { path: '/finance', label: 'Hub Financiero', icon: BarChart3 },
  { path: '/client', label: 'Panel Cliente', icon: Users },
  { path: '/operations', label: 'Estrategia & Ops', icon: Rocket },
  { path: '/crm', label: 'CRM', icon: Handshake },
  { path: '/hr', label: 'Recursos Humanos', icon: UserCog },
  { path: '/activity', label: 'Log', icon: Activity },
  { path: '/subscriptions', label: 'Suscripciones', icon: Crown },
];

export default function MobileHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { activeCompany } = useCompany();
  const [open, setOpen] = useState(false);
  const isHome = location.pathname === '/' || location.pathname === '/dashboard';

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-cyan-100 bg-white/95 px-3 shadow-sm backdrop-blur-xl md:hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {!isHome ? (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-2 py-1.5 text-xs font-semibold text-cyan-800"
          >
            <ChevronLeft className="h-4 w-4" /> Atrás
          </button>
        ) : (
          <img src="/assets/logo-emblem.png" alt="GEMAILLA IA" className="h-10 w-10 shrink-0 object-contain" />
        )}
        <div className="min-w-0">
          <p className="gold-title truncate font-display text-base font-bold tracking-[0.08em]">GEMAILLA IA</p>
          <p className="truncate text-[10px] font-medium uppercase tracking-[0.16em] text-cyan-700">
            Inteligencia empresarial
          </p>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Abrir menú" className="border border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[86vw] max-w-80 overflow-y-auto border-l border-cyan-100 bg-white p-0">
          <div className="border-b border-cyan-100 bg-gradient-to-br from-cyan-50 to-amber-50/70 p-5">
            <div className="mb-3 flex items-center gap-3">
              <img src="/assets/logo-emblem.png" alt="GEMAILLA IA" className="h-11 w-11 object-contain" />
              <div>
                <p className="gold-title font-display text-lg font-bold tracking-wider">GEMAILLA IA</p>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-700">Panel empresarial</p>
              </div>
            </div>
            {activeCompany && (
              <div className="flex items-center gap-2 rounded-xl border border-cyan-200 bg-white/80 px-3 py-2">
                <Building2 className="h-3.5 w-3.5 text-cyan-700" />
                <p className="truncate text-xs font-semibold text-slate-700">{activeCompany.name}</p>
              </div>
            )}
          </div>
          <nav className="space-y-1 p-3 pb-8">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                    isActive
                      ? 'border-cyan-200 bg-gradient-to-r from-cyan-50 to-amber-50 text-cyan-800'
                      : 'border-transparent text-slate-500 hover:bg-cyan-50 hover:text-slate-800'
                  }`}
                >
                  <span className={`rounded-lg p-1.5 ${isActive ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-50 text-slate-400'}`}>
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-sm font-semibold">{item.label}</span>
                  {isActive && <span className="h-2 w-2 rounded-full bg-amber-400" />}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}

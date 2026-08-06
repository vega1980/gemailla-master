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
  { path: '/companies', label: 'Empresas', icon: Building2 },
  { path: '/documents', label: 'Documentos', icon: FileText },
  { path: '/erp', label: 'ERP', icon: ArrowUpDown },
  { path: '/audit', label: 'Auditoría', icon: Shield },
  { path: '/ai', label: 'IA Asistente', icon: Brain },
  { path: '/finance', label: 'Finanzas', icon: BarChart3 },
  { path: '/predictive', label: 'Análisis Predictivo', icon: FlaskConical },
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
      className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-amber-400/70 bg-[linear-gradient(100deg,#003843,#002b35)] px-3 text-white shadow-[0_8px_20px_rgba(0,41,51,0.22)] md:hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {!isHome ? (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 rounded-lg border border-amber-400/60 bg-white/10 px-2 py-1.5 text-xs font-semibold text-white"
          >
            <ChevronLeft className="h-4 w-4" /> Atrás
          </button>
        ) : (
          <img src="/assets/logo-emblem-metallic.png" alt="GEMAILLA IA" className="h-10 w-10 shrink-0 object-contain" />
        )}
        <div className="min-w-0">
          <p className="metallic-gray-title truncate font-display text-base font-bold tracking-[0.08em]">GEMAILLA IA</p>
          <p className="truncate text-[9px] font-semibold uppercase tracking-[0.1em] text-amber-200/90">
            La evolución de la asesoría empresarial
          </p>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Abrir menú" className="border border-amber-400/60 bg-white/10 text-white hover:bg-cyan-500/20 hover:text-cyan-100">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[86vw] max-w-80 overflow-y-auto border-l border-amber-400/70 bg-[linear-gradient(180deg,#003843,#00252e)] p-0 text-white">
          <div className="border-b border-white/10 bg-black/10 p-5">
            <div className="mb-3 flex items-center gap-3">
              <img src="/assets/logo-emblem-metallic.png" alt="GEMAILLA IA" className="h-11 w-11 object-contain" />
              <div>
                <p className="metallic-gray-title font-display text-lg font-bold tracking-wider">GEMAILLA IA</p>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-amber-200/90">La evolución de la asesoría empresarial</p>
              </div>
            </div>
            {activeCompany && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-400/50 bg-white/10 px-3 py-2">
                <Building2 className="h-3.5 w-3.5 text-amber-300" />
                <p className="truncate text-xs font-semibold text-white/85">{activeCompany.name}</p>
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
                      ? 'border-cyan-300/80 bg-gradient-to-r from-cyan-500/35 to-transparent text-white shadow-[0_5px_14px_rgba(0,216,230,0.16)]'
                      : 'border-transparent text-white/72 hover:border-amber-400/30 hover:bg-white/[0.07] hover:text-white'
                  }`}
                >
                  <span className={`rounded-lg p-1.5 ${isActive ? 'bg-cyan-300/20 text-cyan-200' : 'bg-white/[0.06] text-amber-100/75'}`}>
                    <item.icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-sm font-semibold">{item.label}</span>
                  {isActive && <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.75)]" />}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}

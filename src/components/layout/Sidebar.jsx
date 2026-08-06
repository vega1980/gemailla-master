import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCompany } from '@/lib/companyContext';
import {
  LayoutDashboard, FileText, ArrowUpDown, Shield, Brain,
  Building2, Activity, ChevronLeft, ChevronRight, LogOut,
  ChevronDown, Crown, FlaskConical, BarChart3, Users, Rocket,
  Handshake, UserCog,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { firebase } from '@/api/firebaseClient';

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

export default function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation();
  const { companies, activeCompany, switchCompany } = useCompany();

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-full flex-col border-r border-amber-500/70 bg-[linear-gradient(180deg,#003742_0%,#002d37_48%,#00252e_100%)] text-white shadow-[10px_0_30px_rgba(0,41,51,0.18)] transition-all duration-300 ${collapsed ? 'w-[76px]' : 'w-[272px]'}`}
    >
      <div className="border-b border-white/10 px-4 py-5">
        {!collapsed ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <img src="/assets/logo-emblem-metallic.png" alt="GEMAILLA IA" className="h-32 w-32 object-contain drop-shadow-[0_9px_13px_rgba(0,0,0,0.5)]" />
            <div>
              <p className="metallic-gray-title font-display text-[11px] font-bold uppercase leading-4 tracking-[0.08em]">
                La evolución de la asesoría empresarial
              </p>
              <p className="metallic-gray-title mt-1 font-display text-[25px] font-bold tracking-[0.05em]">GEMAILLA IA</p>
            </div>
          </div>
        ) : (
          <img src="/assets/logo-emblem-metallic.png" alt="GEMAILLA IA" className="mx-auto h-14 w-14 object-contain drop-shadow-[0_5px_8px_rgba(0,0,0,0.45)]" />
        )}
      </div>

      {!collapsed && activeCompany && (
        <div className="border-b border-white/10 p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label={`Empresa activa: ${activeCompany.name}`}
                className="flex w-full items-center gap-2 rounded-xl border border-amber-400/50 bg-black/15 px-3 py-2.5 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all hover:border-cyan-300 hover:bg-cyan-950/50"
              >
                <Building2 className="h-4 w-4 shrink-0 text-amber-300" />
                <span className="flex-1 truncate text-left text-xs font-semibold text-white/85">{activeCompany.name}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/55" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60 border-cyan-100 bg-white">
              {companies.map((company) => (
                <DropdownMenuItem key={company.id} onClick={() => switchCompany(company)}>
                  <Building2 className="mr-2 h-4 w-4 text-cyan-700" />
                  {company.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 py-3">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={`group relative flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-200 ${collapsed ? 'justify-center' : ''} ${
                isActive
                  ? 'border-cyan-300/90 bg-gradient-to-r from-cyan-500/35 via-cyan-400/18 to-transparent text-white shadow-[0_5px_16px_rgba(0,216,230,0.18),inset_0_1px_0_rgba(255,255,255,0.14)]'
                  : 'border-transparent text-white/72 hover:-translate-y-0.5 hover:border-amber-400/30 hover:bg-white/[0.07] hover:text-white'
              }`}
            >
              {isActive && <span className="absolute left-0 h-7 w-1 rounded-r-full bg-gradient-to-b from-cyan-300 to-amber-300 shadow-[0_0_10px_rgba(103,232,249,0.8)]" />}
              <item.icon className={`h-[19px] w-[19px] shrink-0 ${isActive ? 'text-cyan-200 drop-shadow-[0_0_6px_rgba(103,232,249,0.8)]' : 'text-amber-100/80 group-hover:text-amber-300'}`} />
              {!collapsed && <span className="text-[14px] font-semibold tracking-wide">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
        className="absolute -right-3 top-24 flex h-7 w-7 items-center justify-center rounded-full border border-amber-400 bg-[#00343f] text-amber-200 shadow-[0_4px_12px_rgba(0,0,0,0.28)] hover:scale-105 hover:border-cyan-300 hover:text-cyan-200"
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>

      <div className="border-t border-white/10 p-3">
        <div className={`flex items-center gap-3 rounded-xl border border-amber-400/60 bg-black/15 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${collapsed ? 'justify-center' : ''}`}>
          <Shield className="h-5 w-5 shrink-0 text-amber-300" />
          {!collapsed && (
            <div className="flex flex-1 items-center justify-between">
              <span className="text-xs font-semibold text-white/80">Seguridad empresarial</span>
              <button
                type="button"
                onClick={() => firebase.auth.logout()}
                aria-label="Cerrar sesión"
                className="rounded-lg p-2 text-white/60 hover:bg-red-500/15 hover:text-red-300"
                title="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

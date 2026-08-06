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

export default function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation();
  const { companies, activeCompany, switchCompany } = useCompany();

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-full flex-col border-r border-cyan-100 bg-white/95 shadow-[8px_0_32px_rgba(15,43,58,0.06)] backdrop-blur-xl transition-all duration-300 ${collapsed ? 'w-[72px]' : 'w-[280px]'}`}
    >
      <div className="border-b border-cyan-100 px-4 py-5">
        {!collapsed ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <img src="/assets/logo-emblem.png" alt="GEMAILLA IA" className="h-20 w-20 object-contain drop-shadow-[0_6px_12px_rgba(180,134,11,0.24)]" />
            <div>
              <p className="font-display text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                Inteligencia que transforma
              </p>
              <p className="gold-title mt-1 font-display text-xl font-bold tracking-[0.1em]">GEMAILLA IA</p>
            </div>
          </div>
        ) : (
          <img src="/assets/logo-emblem.png" alt="GEMAILLA IA" className="mx-auto h-11 w-11 object-contain" />
        )}
      </div>

      {!collapsed && activeCompany && (
        <div className="border-b border-cyan-100 p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label={`Empresa activa: ${activeCompany.name}`}
                className="flex w-full items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50/70 px-3 py-2.5 text-sm transition-colors hover:bg-cyan-50"
              >
                <Building2 className="h-4 w-4 shrink-0 text-cyan-700" />
                <span className="flex-1 truncate text-left text-xs font-semibold text-slate-700">{activeCompany.name}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
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

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={`group relative flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all ${collapsed ? 'justify-center' : ''} ${
                isActive
                  ? 'border-cyan-200 bg-gradient-to-r from-cyan-50 to-amber-50/70 text-cyan-800 shadow-sm'
                  : 'border-transparent text-slate-500 hover:border-cyan-100 hover:bg-cyan-50/60 hover:text-slate-800'
              }`}
            >
              {isActive && <span className="absolute left-0 h-6 w-1 rounded-r-full bg-gradient-to-b from-cyan-500 to-amber-400" />}
              <item.icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-cyan-600' : 'text-slate-400 group-hover:text-cyan-600'}`} />
              {!collapsed && <span className="text-sm font-semibold tracking-wide">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
        className="absolute -right-3 top-24 flex h-7 w-7 items-center justify-center rounded-full border border-amber-300 bg-white text-amber-700 shadow-md transition-transform hover:scale-105"
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>

      <div className="border-t border-cyan-100 p-3">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <img src="/assets/logo-emblem.png" alt="GEMAILLA IA" className="h-9 w-9 shrink-0 object-contain" />
          {!collapsed && (
            <div className="flex flex-1 items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Sesión segura</span>
              <button
                type="button"
                onClick={() => firebase.auth.logout()}
                aria-label="Cerrar sesión"
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
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

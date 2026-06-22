import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCompany } from '@/lib/companyContext';
import {
  Activity,
  ArrowUpDown,
  BarChart3,
  Brain,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crown,
  FileText,
  FlaskConical,
  Handshake,
  LayoutDashboard,
  LogOut,
  Rocket,
  Shield,
  UserCog,
  Users,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
      className={`fixed left-0 top-0 z-40 flex h-full flex-col border-r border-zinc-800/80 bg-zinc-950 transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div
        className={`border-b border-zinc-800/80 ${
          collapsed ? 'p-3' : 'px-5 py-6'
        }`}
      >
        {collapsed ? (
          <div className="flex justify-center">
            <img
              src="/assets/logo-emblem.png"
              alt="GEMAILLA IA"
              className="h-10 w-10 object-contain"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <img
              src="/assets/logo-emblem.png"
              alt="GEMAILLA IA"
              className="h-20 w-20 object-contain"
            />

            <span className="mt-3 text-sm font-semibold tracking-[0.16em] text-[#F3E5AB]">
              GEMAILLA IA
            </span>

            <span className="mt-1 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
              La evolución de la asesoría
            </span>
          </div>
        )}
      </div>

      {!collapsed && activeCompany && (
        <div className="border-b border-zinc-800/80 px-3 py-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label={`Empresa activa: ${activeCompany.name}`}
                className="flex w-full items-center gap-2 rounded-lg border border-[rgba(243,229,171,0.10)] bg-zinc-900/50 px-3 py-2.5 text-sm transition-colors hover:border-zinc-700 hover:bg-zinc-900"
              >
                <Building2 className="h-4 w-4 shrink-0 text-zinc-400" />

                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-xs font-medium text-zinc-200">
                    {activeCompany.name}
                  </p>
                </div>

                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="start"
              className="w-56 border-zinc-800 bg-zinc-950 text-zinc-200"
            >
              {companies.map((company) => (
                <DropdownMenuItem
                  key={company.id}
                  onClick={() => switchCompany(company)}
                  className="cursor-pointer focus:bg-zinc-900 focus:text-[#F3E5AB]"
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  {company.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={`relative flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                collapsed ? 'justify-center rounded-lg' : ''
              } ${
                isActive
                  ? 'text-[#F3E5AB] before:absolute before:bottom-2 before:left-0 before:top-2 before:w-0.5 before:rounded-r before:bg-[#F3E5AB]'
                  : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />

              {!collapsed && (
                <span className="font-medium tracking-wide">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800/80 p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-zinc-400 transition-colors hover:bg-zinc-900/50 hover:text-[#F3E5AB] ${
            collapsed ? 'justify-center' : ''
          }`}
          aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span className="text-sm">Contraer menú</span>
            </>
          )}
        </button>

        <button
          onClick={() => firebase.auth.logout()}
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className={`mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-zinc-400 transition-colors hover:bg-zinc-900/50 hover:text-zinc-200 ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <LogOut className="h-4 w-4" />

          {!collapsed && <span className="text-sm">Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}

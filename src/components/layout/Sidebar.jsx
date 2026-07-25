import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCompany } from '@/lib/companyContext';
import {
  LayoutDashboard, FileText, ArrowUpDown, Shield, Brain,
  Building2, Activity, ChevronLeft, ChevronRight, LogOut,
  ChevronDown, Crown, FlaskConical, BarChart3, Users, Rocket, Handshake, UserCog,
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
  { path: '/operations', label: 'Estrategia y Operaciones', icon: Rocket },
  { path: '/crm', label: 'CRM', icon: Handshake },
  { path: '/hr', label: 'Recursos Humanos', icon: UserCog },
  { path: '/activity', label: 'Actividad', icon: Activity },
  { path: '/subscriptions', label: 'Suscripciones', icon: Crown },
];

export default function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation();
  const { companies, activeCompany, switchCompany } = useCompany();

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-full flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}
      style={{
        background: 'linear-gradient(180deg, rgba(1,12,14,0.99) 0%, rgba(2,22,24,0.98) 55%, rgba(1,10,12,0.99) 100%)',
        borderRight: '1px solid rgba(216,166,62,0.55)',
        boxShadow: '12px 0 40px rgba(0,0,0,0.38), 1px 0 20px rgba(26,213,211,0.08)',
      }}
    >
      <div
        className="flex items-center justify-center border-b px-3 py-5"
        style={{ borderColor: 'rgba(214,163,57,0.28)' }}
      >
        {!collapsed ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <img
              src="/assets/logo-emblem.png"
              alt="GEMAILLA IA"
              className="h-20 w-20 object-contain"
              style={{ filter: 'drop-shadow(0 0 14px rgba(222,170,62,0.32))' }}
            />
            <span className="gold-title font-display text-xl font-bold tracking-[0.12em]">GEMAILLA IA</span>
            <p className="text-[0.64rem] uppercase tracking-[0.18em]" style={{ color: 'rgba(239,205,126,0.78)' }}>
              La evolución de la asesoría empresarial
            </p>
          </div>
        ) : (
          <img src="/assets/logo-emblem.png" alt="GEMAILLA IA" className="h-11 w-11 object-contain" />
        )}
      </div>

      {!collapsed && activeCompany && (
        <div className="border-b px-3 py-3" style={{ borderColor: 'rgba(214,163,57,0.2)' }}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label={`Empresa activa: ${activeCompany.name}`}
                className="w-full rounded-xl px-3 py-2.5 text-sm"
                style={{
                  background: 'linear-gradient(135deg, rgba(14,131,132,0.16), rgba(211,157,48,0.08))',
                  border: '1px solid rgba(43,220,218,0.22)',
                }}
              >
                <span className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 shrink-0" style={{ color: '#2be1df' }} />
                  <span className="min-w-0 flex-1 truncate text-left text-xs font-semibold" style={{ color: '#f1dfb6' }}>
                    {activeCompany.name}
                  </span>
                  <ChevronDown className="h-3 w-3 shrink-0" style={{ color: '#d5a33d' }} />
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {companies.map((company) => (
                <DropdownMenuItem key={company.id} onClick={() => switchCompany(company)}>
                  <Building2 className="mr-2 h-4 w-4" />
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
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 ${collapsed ? 'justify-center' : ''}`}
              style={isActive ? {
                background: 'linear-gradient(90deg, rgba(20,213,211,0.24), rgba(20,213,211,0.08))',
                border: '1px solid rgba(43,225,223,0.55)',
                color: '#effffc',
                boxShadow: '0 0 18px rgba(43,225,223,0.16), inset 3px 0 0 #28e0de',
              } : {
                color: 'rgba(221,232,226,0.7)',
                border: '1px solid transparent',
              }}
            >
              <item.icon
                className="h-5 w-5 shrink-0"
                style={{
                  color: isActive ? '#5ff7f2' : '#29c9c8',
                  filter: isActive ? 'drop-shadow(0 0 8px rgba(55,235,232,0.62))' : 'none',
                }}
              />
              {!collapsed && <span className="truncate text-sm font-semibold tracking-wide">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-24 flex h-6 w-6 items-center justify-center rounded-full"
        style={{ background: '#061719', border: '1px solid rgba(225,174,66,0.7)', color: '#e1b74d' }}
        aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>

      <div className="border-t p-3" style={{ borderColor: 'rgba(214,163,57,0.24)' }}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && (
            <div>
              <p className="text-xs font-semibold" style={{ color: '#e9d49f' }}>Sesión activa</p>
              <p className="text-[0.65rem]" style={{ color: 'rgba(57,214,211,0.7)' }}>Entorno empresarial</p>
            </div>
          )}
          <button
            onClick={() => firebase.auth.logout()}
            aria-label="Cerrar sesión"
            className="rounded-lg p-2"
            style={{ color: '#d9a743', border: '1px solid rgba(217,167,67,0.2)' }}
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

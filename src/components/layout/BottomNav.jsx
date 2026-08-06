import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ArrowUpDown, FileText, Brain } from 'lucide-react';

const items = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/erp', label: 'ERP', icon: ArrowUpDown },
  { path: '/documents', label: 'Documentos', icon: FileText },
  { path: '/ai', label: 'IA', icon: Brain },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around border-t border-amber-400/60 bg-[linear-gradient(100deg,#003843,#002b35)] text-white shadow-[0_-8px_24px_rgba(0,41,51,0.2)] md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)', height: 'calc(60px + env(safe-area-inset-bottom))' }}
    >
      {items.map(({ path, label, icon: Icon }) => {
        const isActive = location.pathname === path;
        return (
          <Link key={path} to={path} className="flex h-full flex-1 flex-col items-center justify-center gap-0.5">
            <span className={`rounded-lg p-1.5 transition-colors ${isActive ? 'bg-cyan-400/20 text-cyan-200' : 'text-white/55'}`}>
              <Icon className="h-5 w-5" />
            </span>
            <span className={`text-[10px] font-semibold ${isActive ? 'text-white' : 'text-white/55'}`}>{label}</span>
            {isActive && <span className="absolute bottom-1 h-1 w-5 rounded-full bg-gradient-to-r from-cyan-300 to-amber-300 shadow-[0_0_7px_rgba(103,232,249,0.7)]" />}
          </Link>
        );
      })}
    </nav>
  );
}

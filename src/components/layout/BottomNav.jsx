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
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around border-t border-cyan-100 bg-white/95 shadow-[0_-8px_24px_rgba(15,43,58,0.08)] backdrop-blur-xl md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)', height: 'calc(60px + env(safe-area-inset-bottom))' }}
    >
      {items.map(({ path, label, icon: Icon }) => {
        const isActive = location.pathname === path;
        return (
          <Link key={path} to={path} className="flex h-full flex-1 flex-col items-center justify-center gap-0.5">
            <span className={`rounded-lg p-1.5 transition-colors ${isActive ? 'bg-cyan-50 text-cyan-700' : 'text-slate-400'}`}>
              <Icon className="h-5 w-5" />
            </span>
            <span className={`text-[10px] font-semibold ${isActive ? 'text-cyan-800' : 'text-slate-400'}`}>{label}</span>
            {isActive && <span className="absolute bottom-1 h-1 w-5 rounded-full bg-gradient-to-r from-cyan-500 to-amber-400" />}
          </Link>
        );
      })}
    </nav>
  );
}

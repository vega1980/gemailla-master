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
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t"
      style={{
        background: 'linear-gradient(180deg, rgba(3,22,24,0.97) 0%, rgba(1,10,12,0.99) 100%)',
        borderColor: 'rgba(215,165,59,0.48)',
        boxShadow: '0 -12px 30px rgba(0,0,0,0.35), 0 -1px 18px rgba(35,221,219,0.08)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        height: 'calc(60px + env(safe-area-inset-bottom))',
      }}
    >
      {items.map(({ path, label, icon: Icon }) => {
        const isActive = location.pathname === path;
        return (
          <Link
            key={path}
            to={path}
            className="flex flex-1 flex-col items-center justify-center gap-1 h-full"
          >
            <div
              className="rounded-xl p-1.5"
              style={isActive ? {
                background: 'rgba(31,216,214,0.16)',
                border: '1px solid rgba(53,232,229,0.42)',
                boxShadow: '0 0 14px rgba(41,221,218,0.2)',
              } : { border: '1px solid transparent' }}
            >
              <Icon
                className="h-5 w-5"
                style={{ color: isActive ? '#5ff7f2' : 'rgba(40,197,196,0.62)' }}
              />
            </div>
            <span
              className="text-[0.6rem] font-semibold"
              style={{ color: isActive ? '#edcf83' : 'rgba(215,224,220,0.5)' }}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

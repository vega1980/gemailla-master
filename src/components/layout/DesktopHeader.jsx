import React from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, CircleUserRound } from 'lucide-react';

const pageTitles = {
  '/dashboard': ['Dashboard', 'Visión integral de tu empresa'],
  '/companies': ['Empresas', 'Administración empresarial'],
  '/documents': ['Documentos', 'Control documental seguro'],
  '/erp': ['ERP · Finanzas', 'Registro de ingresos y gastos'],
  '/audit': ['Auditoría', 'Cumplimiento y control'],
  '/ai': ['IA Asistente', 'Inteligencia aplicada a tu empresa'],
  '/ai-assistant': ['IA Asistente', 'Inteligencia aplicada a tu empresa'],
  '/predictive': ['Análisis Predictivo', 'Proyecciones para mejores decisiones'],
  '/predictive-analysis': ['Análisis Predictivo', 'Proyecciones para mejores decisiones'],
  '/finance': ['Hub Financiero', 'Indicadores y planeación financiera'],
  '/financial-hub': ['Hub Financiero', 'Indicadores y planeación financiera'],
  '/client': ['Panel Cliente', 'Seguimiento y servicio empresarial'],
  '/client-panel': ['Panel Cliente', 'Seguimiento y servicio empresarial'],
  '/operations': ['Estrategia y Operaciones', 'Eficiencia empresarial'],
  '/crm': ['CRM', 'Relaciones y oportunidades comerciales'],
  '/hr': ['Recursos Humanos', 'Gestión del talento'],
  '/activity': ['Actividad', 'Historial de acciones'],
  '/activity-log': ['Actividad', 'Historial de acciones'],
  '/subscriptions': ['Suscripciones', 'Planes y capacidad empresarial'],
};

export default function DesktopHeader() {
  const location = useLocation();
  const [title, description] = pageTitles[location.pathname] || ['GEMAILLA IA', 'La evolución de la asesoría empresarial'];

  return (
    <header className="circuit-header sticky top-0 z-30 hidden h-[116px] items-center justify-between px-7 md:flex lg:h-[132px] lg:px-10">
      <div className="min-w-0 pr-28 lg:pr-32">
        <h1 className="font-display text-[28px] font-bold leading-none text-[#102f49] lg:text-[34px]">{title}</h1>
        <p className="mt-3 font-display text-[13px] font-semibold uppercase tracking-[0.09em] text-[#a66f08]">{description}</p>
      </div>

      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <img
          src="/assets/logo-emblem-metallic.png"
          alt="Emblema GEMAILLA IA"
          className="h-28 w-28 object-contain drop-shadow-[0_8px_8px_rgba(105,67,0,0.35)] lg:h-36 lg:w-36"
        />
      </div>

      <div className="flex items-center gap-5 text-[#b57b0b]">
        <button
          type="button"
          aria-label="Ver notificaciones"
          className="relative rounded-full border border-amber-300/70 bg-white/75 p-3 shadow-[0_5px_12px_rgba(89,64,8,0.12),inset_0_1px_0_white] hover:-translate-y-0.5 hover:border-cyan-400 hover:text-cyan-700"
        >
          <Bell className="h-6 w-6" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full border border-white bg-red-500" />
        </button>
        <span className="h-9 w-px bg-gradient-to-b from-transparent via-amber-400 to-transparent" aria-hidden="true" />
        <button
          type="button"
          aria-label="Abrir perfil"
          className="rounded-full border border-amber-400 bg-gradient-to-br from-white to-amber-50 p-2.5 shadow-[0_5px_12px_rgba(89,64,8,0.14),inset_0_1px_0_white] hover:-translate-y-0.5 hover:border-cyan-400 hover:text-cyan-700"
        >
          <CircleUserRound className="h-7 w-7" />
        </button>
      </div>
    </header>
  );
}

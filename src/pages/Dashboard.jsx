import { useMemo, useState } from 'react';
import {
  BarChart3,
  Bell,
  Briefcase,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  DollarSign,
  File,
  FileBarChart,
  Grid3X3,
  Layers,
  Mail,
  Menu,
  Search,
  Settings,
  Star,
  User,
  Users,
} from 'lucide-react';

const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: Grid3X3 },
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'proyectos', label: 'Proyectos', icon: CheckSquare },
  { id: 'asesorias', label: 'Asesorías', icon: Layers },
  { id: 'finanzas', label: 'Finanzas', icon: FileBarChart },
  { id: 'reportes', label: 'Reportes', icon: BarChart3 },
  { id: 'documentos', label: 'Documentos', icon: File },
  { id: 'equipo', label: 'Equipo', icon: Users },
  { id: 'calendario', label: 'Calendario', icon: Calendar },
  { id: 'configuracion', label: 'Configuración', icon: Settings },
];

const agenda = [
  { time: '09:00 AM', title: 'Reunión estratégica', detail: 'Cliente: Grupo Inversiones Andinas', tone: 'blue' },
  { time: '11:00 AM', title: 'Presentación de propuesta', detail: 'Cliente: Corporación Horizonte', tone: 'orange' },
  { time: '02:00 PM', title: 'Análisis financiero', detail: 'Proyecto: Expansión 2025', tone: 'purple' },
];

const initialTasks = [
  { id: 1, title: 'Revisar informe financiero Q2', detail: 'Grupo Inversiones Andinas', tone: 'cyan', done: true },
  { id: 2, title: 'Enviar propuesta estratégica', detail: 'Corporación Horizonte', tone: 'purple', done: true },
  { id: 3, title: 'Actualizar proyecciones 2025', detail: 'Proyecto Expansión', tone: 'gold', done: false },
  { id: 4, title: 'Preparar presentación directorio', detail: 'Manufacturas del Sur', tone: 'pink', done: true },
];

const activities = [
  { icon: User, tone: 'blue', title: 'Nuevo cliente registrado', detail: 'TechSolutions S.A.C.', time: 'hace 2h' },
  { icon: File, tone: 'purple', title: 'Documento aprobado', detail: 'Plan Estratégico 2025', time: 'hace 4h' },
  { icon: DollarSign, tone: 'green', title: 'Pago recibido', detail: 'Consultoría Financiera', time: 'hace 6h' },
  { icon: Briefcase, tone: 'gold', title: 'Proyecto actualizado', detail: 'Reestructuración Operativa', time: 'hace 1d' },
];

const metrics = [
  { id: 'clientes', icon: Users, label: 'Clientes activos', value: '124', change: '18%', trend: [10, 17, 13, 21, 18, 24, 23, 30], accent: 'blue' },
  { id: 'proyectos', icon: Briefcase, label: 'Proyectos en curso', value: '28', change: '22%', trend: [13, 16, 14, 20, 18, 23, 21, 26], accent: 'purple' },
  { id: 'ingresos', icon: DollarSign, label: 'Ingresos del mes', value: '$285,750', change: '24%', trend: [11, 9, 15, 12, 20, 18, 25, 30], accent: 'cyan' },
  { id: 'satisfaccion', icon: Star, label: 'Satisfacción clientes', value: '4.9/5', change: '0.4', trend: [11, 15, 13, 21, 20, 26, 25, 32], accent: 'gold' },
];

const summary = [
  { icon: Briefcase, label: 'Ingresos acumulados', value: '$1,920,450', change: '20.5%', accent: 'blue' },
  { icon: CheckSquare, label: 'Proyectos completados', value: '15', change: '15%', accent: 'purple' },
  { icon: Circle, label: 'Clientes satisfechos', value: '96%', change: '8%', accent: 'cyan' },
  { icon: Clock, label: 'Horas de asesoría', value: '1,248', change: '12%', accent: 'gold' },
];

function BrandMark({ size = 132, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 120 120" fill="none" aria-label="GEMAILLA IA">
      <defs>
        <linearGradient id="gemaillaGoldA" x1="18" y1="12" x2="98" y2="104" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF5BB" />
          <stop offset=".32" stopColor="#E5A627" />
          <stop offset=".55" stopColor="#FFF3B0" />
          <stop offset=".78" stopColor="#B96B0D" />
          <stop offset="1" stopColor="#F5C044" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="51" stroke="url(#gemaillaGoldA)" strokeWidth="3.4" />
      <circle cx="60" cy="60" r="45" stroke="#F7D46B" strokeOpacity=".5" strokeWidth=".65" />
      <path d="M60 15v90M30 28c5 12 9 28 9 32s-4 20-9 32M90 28c-5 12-9 28-9 32s4 20 9 32" stroke="url(#gemaillaGoldA)" strokeWidth="2.2" />
      <path d="M19 43c13 3 23 12 27 22-5 7-8 17-8 26M101 43C88 46 78 55 74 65c5 7 8 17 8 26" stroke="url(#gemaillaGoldA)" strokeWidth="2" />
      <path d="M37 20c8 10 15 15 23 15s15-5 23-15M37 100c8-10 15-15 23-15s15 5 23 15" stroke="url(#gemaillaGoldA)" strokeWidth="2" />
      <path d="M45 39h30M45 81h30M47 42v35M73 42v35" stroke="url(#gemaillaGoldA)" strokeWidth="1.45" />
      <path d="M52 44v31M68 44v31M51 48h18M51 73h18" stroke="#FFF2B6" strokeOpacity=".6" strokeWidth=".7" />
    </svg>
  );
}

function Sparkline({ values, accent, id }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const points = values.map((value, index) => {
    const x = 5 + (index * 90) / (values.length - 1);
    const y = 39 - ((value - min) / Math.max(max - min, 1)) * 29;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 48" className="sparkline" aria-hidden="true">
      <defs>
        <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor={`var(--${accent})`} stopOpacity=".42" />
          <stop offset="1" stopColor={`var(--${accent})`} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`5,44 ${points} 95,44`} fill={`url(#area-${id})`} />
      <polyline points={points} fill="none" stroke={`var(--${accent})`} strokeWidth="1.8" />
    </svg>
  );
}

function RevenueChart() {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Nov', 'Dic'];
  const bars = [177, 138, 167, 213, 222, 291, 267, 313, 354, 402, 464];
  const line = [117, 180, 234, 279, 284, 332, 364, 389, 430, 489, 545];
  const max = 560;
  const x = (index) => 31 + index * 42;
  const y = (value) => 194 - (value / max) * 158;
  const points = line.map((value, index) => `${x(index)},${y(value)}`).join(' ');

  return (
    <div className="revenue-chart" role="img" aria-label="Ingresos y crecimiento mensual">
      <svg viewBox="0 0 500 238" preserveAspectRatio="none">
        <defs>
          <linearGradient id="barBlue" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#1B9CEB" /><stop offset="1" stopColor="#083D87" /></linearGradient>
          <linearGradient id="linePink" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#F13C9D" /><stop offset="1" stopColor="#FF61B3" /></linearGradient>
        </defs>
        {[0, 100, 200, 300, 400, 500].map((value) => <g key={value}><line x1="31" y1={y(value)} x2="484" y2={y(value)} stroke="rgba(175,207,225,.17)" strokeDasharray="2 4" /><text x="4" y={y(value) + 4} fill="#AAB8BF" fontSize="10">{value === 0 ? '$0' : `$${value}K`}</text></g>)}
        {bars.map((value, index) => <rect key={months[index]} x={x(index) - 10} y={y(value)} width="20" height={194 - y(value)} rx="1.5" fill="url(#barBlue)" opacity=".95" />)}
        <polyline points={points} fill="none" stroke="url(#linePink)" strokeWidth="2" />
        {line.map((value, index) => <circle key={`point-${months[index]}`} cx={x(index)} cy={y(value)} r="3.1" fill="#E92D90" stroke="#FFD5E9" strokeWidth="1" />)}
        <g transform={`translate(${x(10) - 103} ${y(line[10]) - 46})`}><rect width="95" height="43" rx="6" fill="#06131B" stroke="#8F671C" /><text x="9" y="17" fill="#FDBE24" fontSize="12">$285,750</text><text x="9" y="32" fill="#BCC6CC" fontSize="9">Junio 2024</text></g>
        {months.map((month, index) => <text key={month} x={x(index) - 10} y="216" fill="#B6C0C6" fontSize="10">{month}</text>)}
      </svg>
    </div>
  );
}

function MetricCard({ metric }) {
  const Icon = metric.icon;
  return (
    <article className="metric-card">
      <div className="metric-top"><span className={`metric-icon ${metric.accent}`}><Icon size={23} /></span><span>{metric.label}</span></div>
      <div className="metric-main"><div><strong>{metric.value}</strong><small><b>↑ {metric.change}</b> vs mes anterior</small></div><Sparkline values={metric.trend} accent={metric.accent} id={metric.id} /></div>
    </article>
  );
}

export default function Dashboard({ onNavigate }) {
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('Este año');
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [tasks, setTasks] = useState(initialTasks);

  const visibleActivities = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const source = showAllActivity ? activities : activities.slice(0, 4);
    if (!normalized) return source;
    return source.filter((item) => `${item.title} ${item.detail}`.toLowerCase().includes(normalized));
  }, [search, showAllActivity]);

  const chooseMenu = (item) => {
    setActiveMenu(item.id);
    setMobileSidebarOpen(false);
    if (typeof onNavigate === 'function') onNavigate(item.id);
  };

  return (
    <>
      <style>{dashboardStyles}</style>
      <div className="gemailla-dashboard">
        <aside className={`dashboard-sidebar ${mobileSidebarOpen ? 'is-open' : ''}`} aria-label="Navegación principal">
          <div className="brand-block"><BrandMark size={112} className="sidebar-brand-mark" /><div className="brand-tagline">LA EVOLUCIÓN DE<br />LA ASESORÍA EMPRESARIAL</div><div className="brand-name">GEMAILLA IA</div></div>
          <nav className="side-navigation">
            {navigation.map((item) => { const Icon = item.icon; return <button type="button" key={item.id} className={`nav-item ${activeMenu === item.id ? 'active' : ''}`} onClick={() => chooseMenu(item)}><Icon size={21} /><span>{item.label}</span></button>; })}
          </nav>
          <blockquote className="sidebar-quote"><span className="quote-mark">“</span><p>Estrategia, innovación y visión para transformar negocios en legado.</p><i /></blockquote>
        </aside>

        {mobileSidebarOpen && <button type="button" className="sidebar-backdrop" aria-label="Cerrar menú" onClick={() => setMobileSidebarOpen(false)} />}

        <main className="dashboard-main">
          <header className="dashboard-header">
            <div className="header-title"><button type="button" className="menu-button" aria-label="Abrir menú" onClick={() => setMobileSidebarOpen(true)}><Menu size={28} /></button><h1>DASHBOARD</h1></div>
            <div className="header-actions">
              <label className="search-box"><Search size={21} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar..." aria-label="Buscar en la actividad" /></label>
              <div className="header-popover-wrap"><button type="button" className="top-action" aria-label="Notificaciones" aria-expanded={showNotifications} onClick={() => { setShowNotifications((value) => !value); setShowMessages(false); }}><Bell size={27} /><b>3</b></button>{showNotifications && <div className="header-popover"><strong>Notificaciones</strong><p>3 tareas requieren atención.</p><p>Nuevo documento aprobado.</p></div>}</div>
              <div className="header-popover-wrap"><button type="button" className="top-action" aria-label="Mensajes" aria-expanded={showMessages} onClick={() => { setShowMessages((value) => !value); setShowNotifications(false); }}><Mail size={27} /><b>2</b></button>{showMessages && <div className="header-popover"><strong>Mensajes nuevos</strong><p>Corporación Horizonte respondió.</p><p>Grupo Andinas envió documentos.</p></div>}</div>
            </div>
          </header>

          <div className="dashboard-content-grid">
            <section className="workspace" aria-label="Resumen ejecutivo">
              <article className="hero-card"><div className="hero-copy"><span className="eyebrow">BIENVENIDO DE VUELTA</span><h2>Director Estratégico</h2><span className="hero-rule" /><p>Hoy es un buen día para seguir construyendo empresas extraordinarias.</p><button type="button" className="outline-gold-button" onClick={() => document.getElementById('executive-summary')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>Ver resumen ejecutivo <ChevronRight size={20} /></button></div><div className="hero-logo-wrap"><div className="hero-light-ring" /><BrandMark size={211} className="hero-brand-mark" /><div className="logo-pedestal"><i /><b /></div></div></article>
              <section className="metrics-grid" aria-label="Indicadores principales">{metrics.map((metric) => <MetricCard key={metric.id} metric={metric} />)}</section>
              <section className="chart-grid">
                <article className="panel-card chart-card"><div className="panel-heading"><div><h3>Ingresos y crecimiento</h3><div className="legend-row"><span><i className="legend-swatch blue" />Ingresos</span><span><i className="legend-swatch pink" />Crecimiento</span></div></div><div className="period-control"><button type="button" onClick={() => setShowPeriodMenu((value) => !value)} aria-expanded={showPeriodMenu}>{period}<ChevronDown size={17} /></button>{showPeriodMenu && <div className="period-menu">{['Este año', 'Últimos 6 meses', 'Últimos 30 días'].map((option) => <button type="button" key={option} onClick={() => { setPeriod(option); setShowPeriodMenu(false); }}>{option}</button>)}</div>}</div></div><RevenueChart /></article>
                <article className="panel-card distribution-card"><div className="panel-heading"><h3>Distribución de servicios</h3><button type="button" className="compact-period">Este año <ChevronDown size={16} /></button></div><div className="distribution-content"><div className="donut-chart" aria-label="48 proyectos distribuidos por servicio"><div><span>Total</span><strong>48</strong><small>Proyectos</small></div></div><ul className="service-list"><li><span><i className="dot blue" />Consultoría Estratégica</span><b>35%</b></li><li><span><i className="dot purple" />Finanzas Corporativas</span><b>25%</b></li><li><span><i className="dot cyan" />Gestión Operativa</span><b>20%</b></li><li><span><i className="dot orange" />Transformación Digital</span><b>15%</b></li><li><span><i className="dot gray" />Otros Servicios</span><b>5%</b></li></ul></div></article>
              </section>
              <section id="executive-summary" className="summary-panel" aria-label="Resumen ejecutivo anual">{summary.map((item) => { const Icon = item.icon; return <div className="summary-item" key={item.label}><span className={`summary-icon ${item.accent}`}><Icon size={25} /></span><div><small>{item.label}</small><strong>{item.value}</strong><em>↑ {item.change} <span>vs año anterior</span></em></div></div>; })}</section>
            </section>

            <aside className="right-column" aria-label="Agenda y actividad">
              <article className="side-card agenda-card"><div className="side-card-heading"><h3>Agenda de hoy</h3><button type="button" onClick={() => setShowCalendar((value) => !value)}>{showCalendar ? 'Ocultar agenda' : 'Ver calendario'}</button></div><div className={`agenda-list ${showCalendar ? 'expanded' : ''}`}>{agenda.map((item) => <button type="button" key={item.time} className="agenda-item"><i className={`agenda-dot ${item.tone}`} /><div><strong>{item.time}</strong></div><div className="agenda-copy"><b>{item.title}</b><span>{item.detail}</span></div><ChevronRight size={19} /></button>)}{showCalendar && <div className="calendar-preview"><Calendar size={19} />Calendario semanal disponible</div>}</div></article>
              <article className="side-card tasks-card"><div className="side-card-heading"><h3>Tareas pendientes</h3><button type="button" onClick={() => setTasks((current) => current.map((task) => ({ ...task, done: true })))}>Ver todas</button></div><div className="task-list">{tasks.map((task) => <button type="button" key={task.id} className={`task-item ${task.done ? 'done' : ''}`} onClick={() => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, done: !item.done } : item))}><i className={`task-line ${task.tone}`} /><span className={`task-check ${task.tone}`}><CheckSquare size={19} /></span><span className="task-copy"><b>{task.title}</b><small>{task.detail}</small></span><i className={`task-state ${task.tone}`} /></button>)}</div></article>
              <article className="side-card activity-card"><div className="side-card-heading"><h3>Actividad reciente</h3></div><div className="activity-list">{visibleActivities.length ? visibleActivities.map((item) => { const Icon = item.icon; return <div className="activity-item" key={`${item.title}-${item.time}`}><span className={`activity-icon ${item.tone}`}><Icon size={19} /></span><div><b>{item.title}</b><small>{item.detail}</small></div><time>{item.time}</time></div>; }) : <p className="empty-search">No hay actividad para “{search}”.</p>}</div><button type="button" className="full-activity-button" onClick={() => setShowAllActivity((value) => !value)}>{showAllActivity ? 'Mostrar menos actividad' : 'Ver toda la actividad'}</button></article>
            </aside>
          </div>
        </main>
      </div>
    </>
  );
}

const dashboardStyles = `
  .gemailla-dashboard { --line: rgba(178, 128, 38, .54); --gold: #f6b924; --gold-soft: #ffd56d; --blue: #0b9cf5; --purple: #a84af4; --cyan: #00d9dc; --pink: #ec2b91; --orange: #f3a51b; --green: #3bd854; min-height: 100vh; display: grid; grid-template-columns: 214px minmax(0, 1fr); color: #f2f5f5; background: radial-gradient(circle at 44% 0%, rgba(0, 171, 191, .16), transparent 29%), radial-gradient(circle at 92% 18%, rgba(0, 96, 142, .11), transparent 33%), #02090e; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  .gemailla-dashboard *, .gemailla-dashboard *::before, .gemailla-dashboard *::after { box-sizing: border-box; } .gemailla-dashboard button, .gemailla-dashboard input { font: inherit; } .gemailla-dashboard button { color: inherit; cursor: pointer; }
  .dashboard-sidebar { min-height: 100vh; position: sticky; top: 0; height: 100vh; padding: 21px 10px 35px; border-right: 1px solid rgba(190, 135, 32, .53); background: radial-gradient(circle at 50% 14%, rgba(245, 181, 20, .12), transparent 14%), linear-gradient(115deg, rgba(0, 31, 40, .87), rgba(1, 8, 12, .98) 62%); display: flex; flex-direction: column; overflow-y: auto; z-index: 20; }
  .brand-block { text-align: center; padding: 0 4px 18px; } .sidebar-brand-mark { display: block; margin: 0 auto 7px; filter: drop-shadow(0 0 9px rgba(245, 181, 20, .38)); } .brand-tagline { color: #f2d99f; font-family: Georgia, serif; font-size: 13px; line-height: 1.2; } .brand-name { margin-top: 4px; color: var(--gold); font-family: Georgia, serif; font-weight: 700; font-size: 20px; letter-spacing: 1.05px; }
  .side-navigation { display: grid; gap: 5px; } .nav-item { min-height: 49px; width: 100%; border: 1px solid transparent; background: transparent; border-radius: 9px; display: flex; align-items: center; gap: 15px; padding: 0 14px; color: #f3f4f1; font-size: 15px; text-align: left; transition: .18s ease; } .nav-item:hover { background: rgba(252, 188, 36, .08); border-color: rgba(246, 185, 36, .24); } .nav-item.active { background: linear-gradient(90deg, rgba(207, 132, 0, .75), rgba(120, 75, 3, .62)); border-color: #e8a708; box-shadow: inset 0 0 22px rgba(255, 186, 27, .12), 0 0 20px rgba(252, 183, 17, .09); }
  .sidebar-quote { margin: auto 6px 0; border: 1px solid rgba(176, 120, 27, .55); border-radius: 10px; padding: 13px 14px 21px; background: linear-gradient(160deg, rgba(2, 29, 40, .72), rgba(2, 10, 15, .84)); text-align: center; } .quote-mark { display: block; color: var(--gold); font-family: Georgia, serif; font-size: 38px; height: 29px; line-height: 1; } .sidebar-quote p { margin: 8px 0 14px; color: #e5e7e8; font-size: 14px; line-height: 1.66; } .sidebar-quote i { display: block; width: 45px; height: 2px; margin: auto; background: var(--gold); }
  .dashboard-main { min-width: 0; padding: 20px 25px 31px 26px; } .dashboard-header { min-height: 45px; display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 18px; } .header-title { display: flex; align-items: center; gap: 25px; } .header-title h1 { margin: 0; color: #f5c236; font-family: Georgia, serif; font-size: 21px; letter-spacing: .2px; font-weight: 700; } .menu-button { border: 0; background: transparent; color: var(--gold); padding: 4px 1px; display: inline-flex; }
  .header-actions { display: flex; align-items: center; gap: 18px; } .search-box { width: min(328px, 28vw); height: 44px; display: flex; align-items: center; gap: 10px; border: 1px solid rgba(175, 121, 32, .53); border-radius: 11px; padding: 0 13px; background: rgba(3, 11, 16, .72); color: #f4f5f4; } .search-box input { min-width: 0; width: 100%; background: transparent; border: 0; outline: 0; color: #f4f5f4; font-size: 14px; } .header-popover-wrap { position: relative; } .top-action { position: relative; width: 42px; height: 42px; display: grid; place-items: center; padding: 0; border: 0; background: transparent; color: #f6f6f4; } .top-action b { position: absolute; right: -1px; top: -1px; min-width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; background: #f4b32d; color: #1e180a; font-size: 11px; } .header-popover { position: absolute; right: 0; top: 48px; width: 245px; z-index: 50; padding: 14px; border: 1px solid rgba(202, 144, 35, .72); border-radius: 9px; background: #07151b; box-shadow: 0 18px 35px rgba(0,0,0,.42); }
  .dashboard-content-grid { display: grid; grid-template-columns: minmax(0, 1fr) 343px; gap: 17px; } .workspace, .right-column { min-width: 0; } .workspace { display: grid; gap: 17px; } .right-column { display: grid; align-content: start; gap: 14px; }
  .hero-card, .panel-card, .metric-card, .side-card, .summary-panel { border: 1px solid var(--line); border-radius: 11px; background: linear-gradient(145deg, rgba(5, 26, 34, .93), rgba(2, 10, 15, .98)); box-shadow: inset 0 1px 0 rgba(255,255,255,.015), 0 8px 24px rgba(0,0,0,.16); } .hero-card { position: relative; min-height: 264px; overflow: hidden; display: flex; align-items: stretch; padding: 31px; background: linear-gradient(128deg, #071a22 0%, #06242d 34%, #050f15 72%, #02080c 100%); } .hero-card::before { content: ""; position: absolute; inset: -57% -2% -44% 25%; background: repeating-radial-gradient(ellipse at 64% 64%, transparent 0 47px, rgba(12, 130, 149, .27) 48px 76px, transparent 77px 108px); transform: rotate(-13deg); opacity: .9; } .hero-copy { position: relative; z-index: 1; max-width: 410px; } .eyebrow { display: block; color: var(--gold); font-size: 14px; letter-spacing: 1.15px; } .hero-copy h2 { margin: 6px 0 14px; font-family: Georgia, serif; font-size: clamp(31px, 3vw, 41px); font-weight: 400; line-height: 1.08; } .hero-rule { display: block; width: 52px; height: 2px; background: var(--gold); margin-bottom: 18px; } .hero-copy p { margin: 0 0 21px; max-width: 325px; font-size: 16px; line-height: 1.55; } .outline-gold-button, .side-card-heading button, .compact-period { border: 1px solid rgba(213, 150, 30, .78); border-radius: 8px; background: rgba(2, 12, 16, .46); color: #f9c138; } .outline-gold-button { min-height: 39px; padding: 0 15px; display: inline-flex; align-items: center; gap: 22px; color: #eef0ef; font-size: 14px; } .hero-logo-wrap { position: relative; z-index: 1; flex: 1; min-width: 220px; display: grid; place-items: center; } .hero-brand-mark { position: relative; z-index: 2; filter: drop-shadow(0 0 15px rgba(255, 194, 45, .36)); transform: translateY(-9px); } .hero-light-ring { position: absolute; width: 206px; height: 206px; border-radius: 50%; border: 1px solid rgba(236, 174, 40, .17); box-shadow: 0 0 43px 14px rgba(245, 169, 22, .13); } .logo-pedestal { position: absolute; z-index: 1; bottom: 0; width: 225px; height: 44px; border-radius: 50%; border: 1px solid rgba(43, 151, 169, .48); background: radial-gradient(ellipse at center, rgba(121, 180, 194, .44), rgba(2, 28, 38, .78) 44%, rgba(0, 8, 12, .93) 76%); transform: perspective(140px) rotateX(57deg); } .logo-pedestal i { position: absolute; inset: 9px 28px; border-radius: 50%; border: 1px solid rgba(247, 191, 44, .75); } .logo-pedestal b { position: absolute; width: 2px; height: 43px; left: 50%; top: -5px; background: linear-gradient(transparent, #f8c23f, transparent); }
  .metrics-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 13px; } .metric-card { min-height: 164px; padding: 12px 17px 14px; overflow: hidden; } .metric-top { display: flex; align-items: center; gap: 10px; font-size: 14px; white-space: nowrap; } .metric-icon, .activity-icon { width: 37px; height: 37px; border-radius: 50%; display: grid; place-items: center; } .metric-icon.blue, .summary-icon.blue, .activity-icon.blue { color: #28b3ff; background: radial-gradient(circle at 35% 28%, rgba(34, 147, 255, .54), rgba(2, 55, 107, .76)); } .metric-icon.purple, .summary-icon.purple, .activity-icon.purple { color: #d37cff; background: radial-gradient(circle at 35% 28%, rgba(145, 56, 231, .63), rgba(49, 15, 94, .8)); } .metric-icon.cyan, .summary-icon.cyan, .activity-icon.green { color: #00f1e7; background: radial-gradient(circle at 35% 28%, rgba(0, 176, 170, .5), rgba(0, 65, 69, .85)); } .metric-icon.gold, .summary-icon.gold, .activity-icon.gold { color: #ffe275; background: radial-gradient(circle at 35% 28%, rgba(215, 147, 35, .54), rgba(88, 54, 8, .86)); } .metric-main { height: calc(100% - 46px); display: flex; align-items: end; justify-content: space-between; gap: 8px; } .metric-main strong { display: block; font-family: Georgia, serif; font-size: 30px; font-weight: 400; line-height: 1; white-space: nowrap; } .metric-main small { display: block; margin-top: 12px; color: #d1d6d8; font-size: 11px; } .metric-main small b { color: var(--green); font-size: 13px; } .sparkline { width: 86px; height: 54px; margin-bottom: 2px; overflow: visible; }
  .chart-grid { display: grid; grid-template-columns: 1.05fr 1fr; gap: 13px; } .panel-card { min-height: 290px; padding: 15px 18px 12px; } .panel-heading { position: relative; display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; } .panel-heading h3, .side-card-heading h3 { margin: 0; color: #f8c537; font-size: 17px; font-weight: 500; } .legend-row { display: flex; gap: 20px; margin-top: 16px; font-size: 13px; } .legend-row span { display: inline-flex; align-items: center; gap: 7px; } .legend-swatch { width: 13px; height: 8px; border-radius: 2px; display: inline-block; } .legend-swatch.blue { background: linear-gradient(180deg, #21a6f7, #0c438a); } .legend-swatch.pink { background: linear-gradient(90deg, #ff2d89, #f764bc); } .period-control { position: relative; } .period-control > button, .compact-period { min-height: 32px; padding: 0 10px; display: flex; align-items: center; gap: 7px; font-size: 12px; } .period-menu { position: absolute; top: 36px; right: 0; z-index: 10; width: 165px; padding: 5px; border: 1px solid rgba(194, 133, 27, .75); border-radius: 7px; background: #06161d; } .period-menu button { display: block; width: 100%; padding: 9px; border: 0; border-radius: 5px; color: #e7ebec; background: transparent; text-align: left; font-size: 12px; } .revenue-chart { height: 218px; margin-top: 1px; } .revenue-chart svg { width: 100%; height: 100%; overflow: visible; }
  .distribution-content { display: grid; grid-template-columns: 180px minmax(185px, 1fr); align-items: center; gap: 15px; min-height: 235px; } .donut-chart { width: 180px; height: 180px; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(#0b92ed 0 35%, #7132d0 35% 60%, #19a8a2 60% 80%, #f0a61a 80% 95%, #9ca4a8 95% 100%); } .donut-chart > div { width: 111px; height: 111px; border-radius: 50%; display: grid; align-content: center; justify-items: center; background: #061218; } .donut-chart span, .donut-chart small { color: #e1e7e9; font-size: 12px; } .donut-chart strong { font-family: Georgia, serif; color: #f5bd2b; font-size: 30px; line-height: 1.1; font-weight: 400; } .service-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 17px; font-size: 13px; } .service-list li { display: flex; justify-content: space-between; gap: 7px; } .service-list li span { display: inline-flex; align-items: center; gap: 9px; } .dot { width: 11px; height: 11px; border-radius: 50%; display: inline-block; box-shadow: 0 0 7px currentColor; } .dot.blue { color: #159eef; background: #159eef; }.dot.purple { color: #9c45ef; background: #9c45ef; }.dot.cyan { color: #10c5c2; background: #10c5c2; }.dot.orange { color: #f7a71e; background: #f7a71e; }.dot.gray { color: #bdc4c5; background: #bdc4c5; }
  .summary-panel { min-height: 136px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 23px 19px; } .summary-item { min-width: 0; display: flex; align-items: center; gap: 15px; padding: 0 20px; border-left: 1px solid rgba(178, 142, 81, .43); } .summary-item:first-child { border-left: 0; padding-left: 0; } .summary-icon { flex: 0 0 auto; width: 51px; height: 51px; border: 1.5px solid currentColor; border-radius: 50%; display: grid; place-items: center; background: transparent; } .summary-item small { display: block; font-size: 12px; white-space: nowrap; } .summary-item strong { display: block; margin: 4px 0 6px; font-family: Georgia, serif; font-size: 24px; font-weight: 400; white-space: nowrap; } .summary-item em { display: block; color: var(--green); font-style: normal; font-size: 12px; white-space: nowrap; } .summary-item em span { color: #d3d9db; }
  .side-card { padding: 16px 17px; } .agenda-card { min-height: 234px; } .tasks-card { min-height: 304px; } .activity-card { min-height: 341px; } .side-card-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; } .side-card-heading button { min-height: 33px; padding: 0 11px; font-size: 12px; white-space: nowrap; } .agenda-list { margin-top: 11px; display: grid; gap: 10px; } .agenda-item { width: 100%; min-height: 45px; display: grid; grid-template-columns: 13px 70px minmax(0, 1fr) 16px; align-items: start; gap: 9px; padding: 4px 0; border: 0; background: transparent; text-align: left; } .agenda-dot { width: 12px; height: 12px; margin-top: 4px; border-radius: 50%; box-shadow: 0 0 8px currentColor; } .agenda-dot.blue { color: #149bf3; background: #149bf3; } .agenda-dot.orange { color: #f4a51f; background: #f4a51f; } .agenda-dot.purple { color: #9145e3; background: #9145e3; } .agenda-copy { min-width: 0; display: grid; gap: 4px; } .agenda-copy b, .agenda-copy span, .task-copy b, .task-copy small, .activity-item b, .activity-item small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .agenda-copy b, .task-copy b, .activity-item b { color: #f4f6f6; font-size: 13px; font-weight: 400; } .agenda-copy span, .task-copy small, .activity-item small { color: #bac1c4; font-size: 11.5px; } .calendar-preview { border-top: 1px solid rgba(177, 127, 38, .36); padding-top: 9px; display: flex; align-items: center; gap: 8px; font-size: 12px; }
  .task-list { margin-top: 11px; display: grid; } .task-item { width: 100%; min-height: 62px; display: grid; grid-template-columns: 5px 24px minmax(0, 1fr) 19px; align-items: center; gap: 10px; padding: 0; border: 0; border-bottom: 1px solid rgba(138, 138, 111, .25); background: transparent; text-align: left; } .task-line { align-self: stretch; width: 2px; margin: 7px 0; background: currentColor; } .task-line.cyan, .task-check.cyan, .task-state.cyan { color: #0cd2d5; } .task-line.purple, .task-check.purple, .task-state.purple { color: #a33bfa; } .task-line.gold, .task-check.gold, .task-state.gold { color: #eda91d; } .task-line.pink, .task-check.pink, .task-state.pink { color: #ec287f; } .task-check { width: 22px; height: 22px; display: grid; place-items: center; } .task-copy { min-width: 0; display: grid; gap: 4px; } .task-state { width: 18px; height: 18px; border: 1.5px solid currentColor; border-radius: 50%; }
  .activity-list { margin-top: 14px; display: grid; gap: 14px; } .activity-item { display: grid; grid-template-columns: 37px minmax(0, 1fr) auto; align-items: center; gap: 11px; } .activity-icon.green { color: #3df1b0; } .activity-item time { color: #c2c8c9; font-size: 11px; white-space: nowrap; } .empty-search { color: #b8c1c4; font-size: 13px; line-height: 1.5; } .full-activity-button { width: 100%; min-height: 39px; margin-top: 18px; border: 1px solid rgba(203, 143, 28, .7); border-radius: 8px; background: rgba(7, 17, 21, .6); color: #ffc536; font-size: 14px; }
  .sidebar-backdrop { display: none; }
  @media (max-width: 1375px) { .dashboard-main { padding-left: 20px; padding-right: 20px; } .dashboard-content-grid { grid-template-columns: minmax(0, 1fr) 315px; } .metric-main strong { font-size: 26px; } .distribution-content { grid-template-columns: 163px minmax(0, 1fr); } .donut-chart { width: 163px; height: 163px; } }
  @media (max-width: 1160px) { .dashboard-content-grid { grid-template-columns: 1fr; } .right-column { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 13px; } .side-card { min-height: auto; } .agenda-item { grid-template-columns: 13px 1fr 16px; } .agenda-item > div:nth-of-type(1), .task-state, .activity-item time { display: none; } .task-item { grid-template-columns: 5px 21px minmax(0, 1fr); } .activity-item { grid-template-columns: 37px minmax(0, 1fr); } }
  @media (max-width: 960px) { .gemailla-dashboard { grid-template-columns: 1fr; } .dashboard-sidebar { position: fixed; left: 0; top: 0; width: 245px; transform: translateX(-103%); transition: transform .22s ease; box-shadow: 18px 0 50px rgba(0,0,0,.55); } .dashboard-sidebar.is-open { transform: translateX(0); } .sidebar-backdrop { display: block; position: fixed; z-index: 19; inset: 0; border: 0; background: rgba(0,0,0,.55); } .dashboard-main { padding: 17px; } }
  @media (max-width: 760px) { .dashboard-header { align-items: flex-start; gap: 10px; } .header-actions { gap: 7px; } .search-box { width: 184px; } .header-title h1 { font-size: 18px; } .hero-card { min-height: 262px; padding: 24px; } .hero-logo-wrap { position: absolute; right: -36px; bottom: -6px; opacity: .62; transform: scale(.76); transform-origin: bottom right; } .hero-copy { max-width: 69%; } .metrics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .chart-grid, .right-column { grid-template-columns: 1fr; } .summary-panel { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 0; } .summary-item:nth-child(3) { border-left: 0; padding-left: 0; } }
  @media (max-width: 540px) { .dashboard-main { padding: 13px 11px 22px; } .search-box { display: none; } .hero-card { padding: 22px 18px; } .hero-copy { max-width: 86%; } .hero-copy h2 { font-size: 30px; } .hero-copy p { font-size: 14px; max-width: 240px; } .hero-logo-wrap { opacity: .34; right: -76px; transform: scale(.69); } .metrics-grid { grid-template-columns: 1fr; } .metric-card { min-height: 130px; } .chart-grid { grid-template-columns: 1fr; } .distribution-content { grid-template-columns: 1fr; justify-items: center; padding: 15px 0 5px; } .service-list { width: 100%; } .summary-panel { grid-template-columns: 1fr; padding: 16px; } .summary-item, .summary-item:nth-child(3) { padding: 13px 0; border-left: 0; border-top: 1px solid rgba(178, 142, 81, .35); } .summary-item:first-child { border-top: 0; } }
`;

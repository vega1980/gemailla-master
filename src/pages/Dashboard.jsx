import React, { useMemo } from 'react';
import { firebase } from '@/api/firebaseClient';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/lib/companyContext';
import { Link } from 'react-router-dom';
import { Building2, Search, Bell, HelpCircle, AlertTriangle, CheckCircle, Clock, DollarSign, BarChart3, Zap, FileText, Calculator, Shield, TrendingUp, Users, Briefcase, PieChart as PieChartIcon } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function Dashboard() {
  const { activeCompany, loading: companyLoading, companies = [] } = useCompany();

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', activeCompany?.id],
    queryFn: () => firebase.entities.Transaction.filter({ companyId: activeCompany.id }),
    enabled: !!activeCompany
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', activeCompany?.id],
    queryFn: () => firebase.entities.Document.filter({ companyId: activeCompany.id }),
    enabled: !!activeCompany
  });

  const { data: kpis = [] } = useQuery({
    queryKey: ['kpis', activeCompany?.id],
    queryFn: () => firebase.entities.KPI.filter({ companyId: activeCompany.id }),
    enabled: !!activeCompany
  });


  const monthlyData = useMemo(() => {
    const buckets = Array.from({ length: 6 }, (_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - index));
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        value: 0,
      };
    });

    const bucketByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

    transactions.forEach((transaction) => {
      const rawDate = transaction.date || transaction.createdAt || transaction.updatedAt;
      const date = rawDate ? new Date(rawDate) : null;
      if (!date || Number.isNaN(date.getTime())) return;

      const bucket = bucketByKey.get(`${date.getFullYear()}-${date.getMonth()}`);
      if (!bucket) return;

      const amount = Number(transaction.amount) || 0;
      bucket.value += transaction.type === 'gasto' ? -amount : amount;
    });

    return buckets.map((bucket) => ({ value: Math.max(bucket.value, 0) }));
  }, [transactions]);

  if (companyLoading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: '#050505' }}>
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>);

  }

  const totalIngresos = transactions.filter((t) => t.type === 'ingreso').reduce((s, t) => s + (t.amount || 0), 0);
  const alertCount = kpis.filter((k) => k.status === 'critico' || k.status === 'en_riesgo').length;
  const processingTasks = transactions.filter((t) => t.status === 'pending').length;

  return (
    <div className="min-h-screen" style={{ background: '#050505' }}>
      {/* Header */}
      <div className="border-b" style={{ borderColor: 'rgba(197,160,89,0.2)' }}>
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4 flex-1">
            <button className="text-muted-foreground hover:text-foreground">☰</button>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(197,160,89,0.5)' }} />
              <input
                type="text"
                placeholder="Buscar empresas, documentos..."
                className="w-full bg-secondary border pl-10 pr-4 py-2 rounded-lg text-sm"
                style={{ borderColor: 'rgba(197,160,89,0.2)', color: 'rgba(200,190,170,0.7)' }} />
              
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative">
              <Bell className="w-5 h-5" style={{ color: '#f0d080' }} />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />
            </button>
            <button><HelpCircle className="w-5 h-5 text-muted-foreground" /></button>
            <div className="flex items-center gap-2 pl-4 border-l" style={{ borderColor: 'rgba(197,160,89,0.2)' }}>
              <span className="text-sm" style={{ color: 'rgba(232,213,163,0.8)' }}>GEMAILLA IA</span>
              <span className="text-xs" style={{ color: 'rgba(197,160,89,0.6)' }}>● Conectado</span>
              <div className="w-8 h-8 rounded-full" style={{ background: 'linear-gradient(135deg, #f0d080, #c5a059)' }} />
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Quick Access Modules - Highlighted */}
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-4" style={{ color: '#f0d080', letterSpacing: '0.05em' }}>ACCESOS DIRECTOS</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
            { path: '/erp', label: 'ERP', icon: Calculator, color: '#f0d080' },
            { path: '/audit', label: 'Auditoría', icon: Shield, color: '#c5a059' },
            { path: '/documents', label: 'Documentos', icon: FileText, color: '#e8c97a' },
            { path: '/finance', label: 'Finanzas', icon: TrendingUp, color: '#f0d080' },
            { path: '/crm', label: 'CRM', icon: Users, color: '#c5a059' },
            { path: '/hr', label: 'Recursos Humanos', icon: Briefcase, color: '#e8c97a' },
            { path: '/operations', label: 'Operaciones', icon: BarChart3, color: '#f0d080' },
            { path: '/predictive', label: 'Análisis Predictivo', icon: PieChartIcon, color: '#c5a059' }].
            map((module, idx) =>
            <Link key={idx} to={module.path} className="group">
                <div className="rounded-xl p-3 text-center transition-all duration-300 hover:scale-105" style={{
                background: 'linear-gradient(135deg, rgba(197,160,89,0.1) 0%, rgba(197,160,89,0.05) 100%)',
                border: '1px solid rgba(197,160,89,0.2)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
              }}>
                  <module.icon className="w-6 h-6 mx-auto mb-2" style={{ color: module.color }} />
                  <p className="text-xs font-semibold" style={{ color: 'rgba(232,213,163,0.9)' }}>{module.label}</p>
                </div>
              </Link>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-6 gap-4 mb-6">
          {[
          { label: 'EMPRESAS ACTIVAS', value: companies.length, change: '+18%', icon: Building2, color: '#f0d080' },
          { label: 'DOCUMENTOS PROCESADOS', value: documents.length, change: '+24%', icon: BarChart3, color: '#c5a059' },
          { label: 'ANÁLISIS IA', value: kpis.length, change: '+12%', icon: Zap, color: '#e8c97a' },
          { label: 'ALERTAS ACTIVAS', value: alertCount, change: '-5%', icon: AlertTriangle, color: '#f0d080' },
          { label: 'TAREAS EN PROCESO', value: processingTasks, change: '+7%', icon: Clock, color: '#c5a059' },
          { label: 'AHORRO ESTIMADO', value: `$${(totalIngresos * 0.15).toLocaleString()}`, change: '+32%', icon: DollarSign, color: '#e8c97a' }].
          map((card, idx) =>
          <div key={idx} className="rounded-2xl p-5" style={{
            background: 'linear-gradient(135deg, rgba(197,160,89,0.08) 0%, rgba(197,160,89,0.02) 100%)',
            border: '1px solid rgba(197,160,89,0.2)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
          }}>
              <div className="flex items-start justify-between mb-4">
                <span className="text-xs font-bold uppercase" style={{ color: 'rgba(197,160,89,0.7)', letterSpacing: '0.05em' }}>{card.label}</span>
                <card.icon className="w-4 h-4" style={{ color: card.color, opacity: 0.6 }} />
              </div>
              <p className="text-3xl font-bold mb-3" style={{ color: card.color }}>{card.value}</p>
              <ResponsiveContainer width="100%" height={40}>
                <LineChart data={monthlyData} className="text-[#ef1a1a]">
                  <Line type="monotone" dataKey="value" stroke={card.color} dot={false} strokeWidth={2} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-3 flex justify-between items-center text-xs">
                <span style={{ color: 'rgba(200,190,170,0.5)' }}>Este mes</span>
                <span style={{ color: '#4caf50' }}>{card.change}</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 rounded-2xl p-6" style={{
            background: 'linear-gradient(135deg, rgba(197,160,89,0.08) 0%, rgba(197,160,89,0.03) 100%)',
            border: '1px solid rgba(197,160,89,0.25)',
            boxShadow: '0 4px 24px rgba(197,160,89,0.1)'
          }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold uppercase" style={{ color: '#f0d080', letterSpacing: '0.05em' }}>EMPRESAS</h3>
              <div className="flex gap-2">
                <Link to="/companies" className="text-xs" style={{ color: '#f0d080', textDecoration: 'underline' }}>Ver todas</Link>
                <Link to="/companies" className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'linear-gradient(135deg, #f0d080, #c5a059)', color: '#050505', fontWeight: '600' }}>+ Nueva</Link>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(197,160,89,0.3)' }}>
                    <th className="text-left py-3" style={{ color: '#f0d080', fontWeight: '600' }}>EMPRESA</th>
                    <th className="text-left py-3" style={{ color: '#f0d080', fontWeight: '600' }}>SECTOR</th>
                    <th className="text-left py-3" style={{ color: '#f0d080', fontWeight: '600' }}>ESTADO</th>
                    <th className="text-left py-3" style={{ color: '#f0d080', fontWeight: '600' }}>RIESGO</th>
                    <th className="text-left py-3" style={{ color: '#f0d080', fontWeight: '600' }}>ÚLTIMO ANÁLISIS</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.slice(0, 4).map((c) =>
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(197,160,89,0.15)' }}>
                      <td className="py-3 font-semibold" style={{ color: '#e8d5a3' }}>{c.name}</td>
                      <td style={{ color: 'rgba(200,190,170,0.8)' }}>{c.industry || '-'}</td>
                      <td><span className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: 'rgba(76,175,80,0.25)', color: '#4caf50', border: '1px solid rgba(76,175,80,0.3)' }}>Activa</span></td>
                      <td><span className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: 'rgba(76,175,80,0.25)', color: '#4caf50', border: '1px solid rgba(76,175,80,0.3)' }}>Bajo</span></td>
                      <td style={{ color: 'rgba(200,190,170,0.6)' }}>Hoy, 09:15 AM</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl p-6" style={{
              background: 'linear-gradient(135deg, rgba(197,160,89,0.08) 0%, rgba(197,160,89,0.03) 100%)',
              border: '1px solid rgba(197,160,89,0.25)',
              boxShadow: '0 4px 24px rgba(197,160,89,0.1)'
            }}>
              <h3 className="text-sm font-bold uppercase mb-4" style={{ color: '#f0d080', letterSpacing: '0.05em' }}>ANÁLISIS EN TIEMPO REAL</h3>
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={[{ value: 92 }, { value: 8 }]} innerRadius={60} outerRadius={90} startAngle={90} endAngle={-270} dataKey="value">
                      <Cell fill="#f0d080" />
                      <Cell fill="rgba(197,160,89,0.2)" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <p className="text-center text-3xl font-bold mt-3" style={{ color: '#f0d080', textShadow: '0 0 20px rgba(240,208,128,0.3)' }}>92%</p>
                <p className="text-xs" style={{ color: 'rgba(200,190,170,0.7)' }}>Tiempo: 00:21:24</p>
              </div>
              <div className="mt-4 space-y-2 text-xs">
                <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4" style={{ color: '#4caf50' }} /><span style={{ color: 'rgba(200,190,170,0.9)' }}>Saturación de datos</span></div>
                <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4" style={{ color: '#4caf50' }} /><span style={{ color: 'rgba(200,190,170,0.9)' }}>Validación documentaria</span></div>
                <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4" style={{ color: '#4caf50' }} /><span style={{ color: 'rgba(200,190,170,0.9)' }}>Análisis financiero</span></div>
              </div>
            </div>

            <div className="rounded-2xl p-6" style={{
              background: 'linear-gradient(135deg, rgba(197,160,89,0.08) 0%, rgba(197,160,89,0.03) 100%)',
              border: '1px solid rgba(197,160,89,0.25)',
              boxShadow: '0 4px 24px rgba(197,160,89,0.1)'
            }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold uppercase" style={{ color: '#f0d080', letterSpacing: '0.05em' }}>ALERTAS ACTIVAS</h3>
                <Link to="/audit" className="text-xs" style={{ color: '#f0d080', textDecoration: 'underline' }}>Ver todas</Link>
              </div>
              <div className="space-y-3 text-xs">
                {[
                { type: 'warning', title: 'Riesgo Tributario Alto', desc: 'Declaración IVA' },
                { type: 'info', title: 'Inconsistencia detectada', desc: 'Logística Andina S.A.C.' }].
                map((alert, idx) =>
                <div key={idx} className="flex gap-2 p-3 rounded-xl" style={{ background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.2)' }}>
                    <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: alert.type === 'warning' ? '#f44336' : '#2196f3' }} />
                    <div>
                      <p className="font-semibold" style={{ color: '#e8d5a3' }}>{alert.title}</p>
                      <p style={{ color: 'rgba(200,190,170,0.6)' }}>{alert.desc}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl p-6" style={{
          background: 'linear-gradient(135deg, rgba(197,160,89,0.08) 0%, rgba(197,160,89,0.03) 100%)',
          border: '1px solid rgba(197,160,89,0.25)',
          boxShadow: '0 4px 24px rgba(197,160,89,0.1)'
        }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase" style={{ color: '#f0d080', letterSpacing: '0.05em' }}>ACTIVIDAD RECIENTE</h3>
            <Link to="/activity" className="text-xs" style={{ color: '#f0d080', textDecoration: 'underline' }}>Ver todas</Link>
          </div>
          <div className="grid grid-cols-4 gap-4 text-xs text-center">
            {[
            { label: 'Análisis completados', value: '15 hoy', icon: CheckCircle },
            { label: 'Documentos cargados', value: 'Estudios Q1.pdf', icon: FileText },
            { label: 'Alerta emitida', value: 'Riesgo Tributario', icon: AlertTriangle },
            { label: 'Reporte generado', value: 'Resumen Mayo 2025', icon: BarChart3 }].
            map((item, idx) =>
            <div key={idx} className="rounded-xl p-4" style={{ background: 'rgba(197,160,89,0.08)', border: '1px solid rgba(197,160,89,0.15)' }}>
                <item.icon className="w-5 h-5 mx-auto mb-2" style={{ color: '#c5a059' }} />
                <p className="font-semibold" style={{ color: '#e8d5a3' }}>{item.label}</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(200,190,170,0.6)' }}>{item.value}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center px-6 py-4 border-t text-xs" style={{ borderColor: 'rgba(197,160,89,0.1)', color: 'rgba(200,190,170,0.5)' }}>
        <p>GEMAILLA IA © 2025</p>
        <div className="flex gap-4">
          <span>Última sync: Hoy, 03:15 AM</span>
          <span>Soporte 24/7</span>
        </div>
      </div>
    </div>);

}
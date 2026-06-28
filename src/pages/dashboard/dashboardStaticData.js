import {
  BarChart3,
  Briefcase,
  Calculator,
  FileText,
  PieChart as PieChartIcon,
  Shield,
  TrendingUp,
  Users,
} from 'lucide-react';

const GOLD = '#f0d080';
const MUTED_GOLD = '#c5a059';
const SOFT_GOLD = '#e8c97a';

export const QUICK_MODULES = [
  { path: '/erp', label: 'ERP', icon: Calculator, color: GOLD },
  { path: '/audit', label: 'Auditoría', icon: Shield, color: MUTED_GOLD },
  { path: '/documents', label: 'Documentos', icon: FileText, color: SOFT_GOLD },
  { path: '/finance', label: 'Finanzas', icon: TrendingUp, color: GOLD },
  { path: '/crm', label: 'CRM', icon: Users, color: MUTED_GOLD },
  { path: '/hr', label: 'Recursos Humanos', icon: Briefcase, color: SOFT_GOLD },
  { path: '/operations', label: 'Operaciones', icon: BarChart3, color: GOLD },
  { path: '/predictive', label: 'Análisis Predictivo', icon: PieChartIcon, color: MUTED_GOLD },
];

# Métricas de arquitectura

Generado: 2026-07-13T05:45:46.525Z

## Resumen

| Métrica | Valor |
| --- | --- |
| Archivos medidos | 235 |
| Dependencias internas | 532 |
| Paquetes externos importados | 66 |
| Grupos de líneas duplicadas | 30 |

## Top acoplamiento entre módulos

| Relación | Imports |
| --- | --- |
| src:modules -> src:components | 67 |
| src:components -> src:lib | 49 |
| feature:crm -> src:components | 30 |
| src:modules -> src:lib | 29 |
| src:components -> src:components | 27 |
| feature:hr -> src:components | 21 |
| feature:operations -> src:components | 21 |
| feature:finance -> src:components | 16 |
| feature:erp -> src:components | 14 |
| feature:dashboard -> src:components | 12 |
| src:domain -> src:domain | 12 |
| src:modules -> src:modules | 11 |
| src:infrastructure -> src:infrastructure | 8 |
| src:modules -> src:app | 8 |
| feature:client -> src:components | 7 |

## Hotspots por fan-in/fan-out

| Archivo | Entrantes | Salientes | Score |
| --- | --- | --- | --- |
| src/components/ui/button.jsx | 55 | 1 | 56 |
| src/lib/utils.js | 45 | 0 | 45 |
| src/api/firebaseClient.js | 30 | 10 | 40 |
| src/lib/companyContext.jsx | 21 | 6 | 27 |
| src/components/ui/badge.jsx | 21 | 1 | 22 |
| src/lib/companyEntityQueries.js | 20 | 1 | 21 |
| src/components/ui/input.jsx | 19 | 1 | 20 |
| src/components/ui/dialog.jsx | 18 | 1 | 19 |
| src/components/ui/select.jsx | 18 | 1 | 19 |
| src/app/providers/AuthProvider.jsx | 16 | 1 | 17 |
| src/modules/documents/pages/DocumentsPage.jsx | 1 | 16 | 17 |
| src/modules/ai/pages/AIAssistantPage.jsx | 1 | 14 | 15 |
| src/components/shared/EmptyState.jsx | 14 | 0 | 14 |
| src/lib/observability.js | 10 | 4 | 14 |
| src/modules/companies/pages/CompaniesPage.jsx | 1 | 13 | 14 |

## Paquetes externos más importados

| Paquete | Imports |
| --- | --- |
| react | 127 |
| lucide-react | 85 |
| date-fns | 48 |
| @modules/ai | 25 |
| @tanstack/react-query | 17 |
| framer-motion | 17 |
| recharts | 15 |
| firebase | 14 |
| react-markdown | 13 |
| react-router-dom | 13 |
| sonner | 12 |
| class-variance-authority | 9 |
| @radix-ui/react-slot | 4 |
| zod | 4 |
| @modules/dashboard | 3 |

## Duplicación textual candidata

| Ocurrencias | Archivos | Línea normalizada |
| --- | --- | --- |
| 21 | src/features/client/components/ChurnPanel.jsx<br>src/features/client/components/StockAlerts.jsx<br>src/features/client/components/TrendsPanel.jsx<br>src/features/crm/components/ClientSegments.jsx<br>src/features/crm/components/DealPipeline.jsx<br>src/features/finance/components/BudgetPlanner.jsx<br>src/features/hr/components/PayrollManager.jsx<br>src/features/hr/components/PerformanceManager.jsx | `<div className="bg-card border border-border rounded-2xl p-5">` |
| 19 | src/features/crm/components/ClientDirectory.jsx<br>src/features/crm/components/ClientList.jsx<br>src/features/crm/components/DealPipeline.jsx<br>src/features/crm/components/InteractionHistory.jsx<br>src/features/dashboard/components/AlertNotifications.jsx<br>src/features/dashboard/components/WelcomeTutorial.jsx<br>src/features/hr/components/EmployeeDirectory.jsx<br>src/features/hr/components/PayrollManager.jsx | `<div className="grid grid-cols-2 gap-3">` |
| 19 | src/features/crm/components/ClientDirectory.jsx<br>src/features/crm/components/ClientList.jsx<br>src/features/crm/components/DealPipeline.jsx<br>src/features/crm/components/InteractionHistory.jsx<br>src/features/hr/components/EmployeeDirectory.jsx<br>src/features/hr/components/PayrollManager.jsx<br>src/features/hr/components/PerformanceManager.jsx<br>src/features/operations/components/ProjectTracker.jsx | `<SelectTrigger className="mt-1 bg-secondary border-border"><SelectValue /></SelectTrigger>` |
| 18 | src/components/layout/MobileHeader.jsx<br>src/features/client/components/MyPlan.jsx<br>src/features/crm/components/ClientImporter.jsx<br>src/features/dashboard/components/ProactiveAlerts.jsx<br>src/features/dashboard/components/WeeklyInsights.jsx<br>src/features/dashboard/components/WelcomeTutorial.jsx<br>src/features/dashboard/components/WhatIfScenario.jsx<br>src/features/erp/components/ImportTransactions.jsx | `<div className="flex items-center gap-3">` |
| 16 | src/features/client/components/ChurnPanel.jsx<br>src/features/client/components/StockAlerts.jsx<br>src/features/client/components/TrendsPanel.jsx<br>src/features/crm/components/ClientSegments.jsx<br>src/features/dashboard/components/WeeklyInsights.jsx<br>src/features/dashboard/components/WelcomeAnalysis.jsx<br>src/features/finance/components/ReportDownloader.jsx<br>src/features/finance/components/RiskManagement.jsx | `const [loading, setLoading] = useState(false);` |
| 13 | functions/config.js<br>functions/handlers/aiHandler.js<br>functions/handlers/companyInviteHandler.js<br>functions/handlers/companyMembershipClaimsHandler.js<br>functions/handlers/companyMetricsAggregationHandler.js<br>functions/handlers/documentContextBuilder.js<br>functions/handlers/orphanDocumentStorageCleanup.js<br>functions/handlers/syncCompanyClaimsHandler.js | `const admin = require('firebase-admin');` |
| 12 | src/features/client/components/StockAlerts.jsx<br>src/features/dashboard/components/CategoryBreakdown.jsx<br>src/features/dashboard/components/WeeklyInsights.jsx<br>src/features/finance/components/RiskManagement.jsx<br>src/features/hr/components/PerformanceManager.jsx<br>src/features/predictive/components/AnomalyDetector.jsx<br>src/features/predictive/components/WhatIfAdvanced.jsx<br>src/features/support/components/AutoReports.jsx | `<div className="flex items-center gap-2">` |
| 12 | src/features/client/components/ChurnPanel.jsx<br>src/features/crm/components/ClientDirectory.jsx<br>src/features/crm/components/DealPipeline.jsx<br>src/features/dashboard/components/WhatIfScenario.jsx<br>src/features/finance/components/FinancialStatements.jsx<br>src/features/finance/components/GoogleSheetsExporter.jsx<br>src/features/hr/components/EmployeeDirectory.jsx<br>src/features/operations/components/ProjectTracker.jsx | `<div className="flex items-center justify-between">` |
| 12 | src/features/client/components/ChurnPanel.jsx<br>src/features/client/components/StockAlerts.jsx<br>src/features/client/components/TrendsPanel.jsx<br>src/features/crm/components/ClientList.jsx<br>src/features/crm/components/ClientSegments.jsx<br>src/features/crm/components/DealPipeline.jsx<br>src/features/hr/components/EmployeeDirectory.jsx<br>src/features/hr/components/PayrollManager.jsx | `const fmt = (n) => \`$${(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}\`;` |
| 11 | src/components/layout/MobileHeader.jsx<br>src/features/crm/components/ClientDirectory.jsx<br>src/features/crm/components/DealPipeline.jsx<br>src/features/crm/components/InteractionHistory.jsx<br>src/features/dashboard/components/AlertNotifications.jsx<br>src/features/dashboard/components/ConsultorVirtual.jsx<br>src/features/erp/components/ImportTransactions.jsx<br>src/features/hr/components/EmployeeDirectory.jsx | `const [open, setOpen] = useState(false);` |
| 10 | src/features/client/components/ChurnPanel.jsx<br>src/features/client/components/TrendsPanel.jsx<br>src/features/crm/components/ClientList.jsx<br>src/features/crm/components/ClientSegments.jsx<br>src/features/crm/components/DealPipeline.jsx<br>src/features/finance/components/BudgetPlanner.jsx<br>src/features/hr/components/EmployeeDirectory.jsx<br>src/features/hr/components/PayrollManager.jsx | `<div key={label} className="bg-card border border-border rounded-2xl p-4">` |
| 10 | src/features/operations/components/ProcessOptimizer.jsx<br>src/features/operations/components/ProjectTracker.jsx<br>src/features/operations/components/StrategicKPIs.jsx | `background: 'linear-gradient(135deg, rgba(197,160,89,0.06) 0%, rgba(197,160,89,0.02) 100%)',` |
| 10 | src/features/operations/components/ProcessOptimizer.jsx<br>src/features/operations/components/ProjectTracker.jsx<br>src/features/operations/components/StrategicKPIs.jsx | `border: '1px solid rgba(197,160,89,0.15)',` |
| 10 | src/features/dashboard/components/ConsultorVirtual.jsx<br>src/features/dashboard/components/WeeklyInsights.jsx<br>src/features/dashboard/components/WelcomeAnalysis.jsx<br>src/features/finance/components/RiskManagement.jsx<br>src/features/reports/components/ReportGenerator.jsx<br>src/features/support/components/ClientDashboardShare.jsx<br>src/features/support/components/SupportChatbot.jsx<br>src/modules/audit/pages/AuditPage.jsx | `const totalGastos = transactions.filter(t => t.type === 'gasto').reduce((s, t) => s + (t.amount || 0), 0);` |
| 10 | src/features/dashboard/components/ConsultorVirtual.jsx<br>src/features/dashboard/components/WeeklyInsights.jsx<br>src/features/dashboard/components/WelcomeAnalysis.jsx<br>src/features/finance/components/RiskManagement.jsx<br>src/features/reports/components/ReportGenerator.jsx<br>src/features/support/components/ClientDashboardShare.jsx<br>src/features/support/components/SupportChatbot.jsx<br>src/modules/audit/pages/AuditPage.jsx | `const totalIngresos = transactions.filter(t => t.type === 'ingreso').reduce((s, t) => s + (t.amount || 0), 0);` |

> Estas métricas son una línea base previa a refactors. No son una orden automática de cambio: usa los hotspots para priorizar revisiones con contexto de producto y riesgo.

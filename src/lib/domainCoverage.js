// @ts-check

/**
 * Mapa canónico de cobertura por dominio funcional.
 *
 * Mantiene visible qué dominios de negocio tienen entidades persistidas y
 * consultas multiempresa, para que la verificación no dependa solo de checks
 * de infraestructura Firebase.
 */
export const DOMAIN_COVERAGE = Object.freeze({
  core: Object.freeze({
    label: 'Núcleo multiempresa',
    entities: Object.freeze(['User', 'Company', 'CompanyMember', 'AuditLog']),
    companyQueries: Object.freeze(['auditLogs']),
  }),
  documents: Object.freeze({
    label: 'Gestión documental',
    entities: Object.freeze(['Document']),
    companyQueries: Object.freeze(['documents']),
  }),
  imports: Object.freeze({
    label: 'Importaciones de hojas de cálculo',
    entities: Object.freeze(['ImportLog']),
    companyQueries: Object.freeze([]),
  }),
  finance: Object.freeze({
    label: 'Finanzas y suscripciones',
    entities: Object.freeze(['Transaction', 'Subscription', 'PredictionLog']),
    companyQueries: Object.freeze(['transactions', 'subscriptions']),
  }),
  crm: Object.freeze({
    label: 'CRM',
    entities: Object.freeze(['CRMClient', 'CRMDeal', 'CRMInteraction']),
    companyQueries: Object.freeze(['crmClients', 'crmDeals', 'crmInteractions']),
  }),
  hr: Object.freeze({
    label: 'Recursos humanos',
    entities: Object.freeze(['Employee', 'Payroll', 'PerformanceReview']),
    companyQueries: Object.freeze(['employees', 'payrolls', 'performanceReviews']),
  }),
  operations: Object.freeze({
    label: 'Operaciones',
    entities: Object.freeze(['KPI', 'Project', 'ProjectTask']),
    companyQueries: Object.freeze(['kpis', 'projects', 'projectTasks']),
  }),
  support: Object.freeze({
    label: 'Soporte',
    entities: Object.freeze(['SupportTicket']),
    companyQueries: Object.freeze(['supportTickets']),
  }),
  ai: Object.freeze({
    label: 'IA y predicción',
    entities: Object.freeze(['AIConversation', 'PredictionLog']),
    companyQueries: Object.freeze(['aiConversations']),
  }),
  observability: Object.freeze({
    label: 'Observabilidad operacional',
    entities: Object.freeze(['ObservabilityEvent']),
    companyQueries: Object.freeze([]),
  }),
});

export const DOMAIN_NAMES = Object.freeze(Object.keys(DOMAIN_COVERAGE));

export const getCoveredEntitiesByDomain = () => new Set(
  Object.values(DOMAIN_COVERAGE).flatMap((domain) => domain.entities),
);

export const getCoveredCompanyQueriesByDomain = () => new Set(
  Object.values(DOMAIN_COVERAGE).flatMap((domain) => domain.companyQueries),
);

// Shared business values. Archived is reserved for archive operations.
export const DOMAIN_ENUMS = Object.freeze({
  crmClientStatus: ['prospecto', 'activo', 'inactivo', 'archived'], dealStage: ['prospecto', 'contactado', 'calificado', 'propuesta', 'negociacion', 'ganado', 'perdido', 'cerrado_ganado', 'cerrado_perdido', 'archived'],
  interactionType: ['llamada', 'email', 'reunion', 'mensaje', 'nota'], employeeStatus: ['activo', 'inactivo', 'vacaciones', 'baja', 'archived'],
  employmentType: ['tiempo_completo', 'medio_tiempo', 'contrato', 'practicante'], payrollStatus: ['pendiente', 'procesando', 'pagado', 'cancelado', 'archived'],
  kpiFrequency: ['semanal', 'mensual', 'trimestral', 'anual'],
  kpiStatus: ['alcanzado', 'en_curso', 'en_riesgo', 'critico', 'archived'], projectStatus: ['planificado', 'en_curso', 'pausado', 'completado', 'cancelado', 'archived'],
  taskStatus: ['pendiente', 'en_curso', 'bloqueado', 'completado', 'archived'], priority: ['baja', 'media', 'alta', 'critica'], ticketStatus: ['abierto', 'en_proceso', 'resuelto', 'cerrado', 'archived'],
});

export const DOMAIN_FORM_OPTIONS = Object.freeze({
  crmClientStatus: DOMAIN_ENUMS.crmClientStatus.filter(value => value !== 'archived'),
  interactionType: DOMAIN_ENUMS.interactionType,
  employmentType: DOMAIN_ENUMS.employmentType,
  payrollStatus: DOMAIN_ENUMS.payrollStatus.filter(value => value !== 'archived'),
  kpiFrequency: DOMAIN_ENUMS.kpiFrequency,
});

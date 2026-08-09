// @ts-check
import { z } from 'zod';

export const DOMAIN_LIMITS = Object.freeze({ shortText: 180, longText: 5000, money: 1_000_000_000, percent: 100 });
export const DOMAIN_ENUMS = Object.freeze({
  crmClientStatus: ['prospecto', 'activo', 'inactivo', 'archived'], dealStage: ['prospecto', 'calificado', 'propuesta', 'negociacion', 'ganado', 'perdido', 'archived'],
  interactionType: ['llamada', 'email', 'reunion', 'mensaje', 'nota'], employeeStatus: ['activo', 'inactivo', 'vacaciones', 'baja', 'archived'],
  employmentType: ['tiempo_completo', 'medio_tiempo', 'contrato', 'practicante'], payrollStatus: ['pendiente', 'procesando', 'pagado', 'cancelado', 'archived'],
  kpiStatus: ['alcanzado', 'en_curso', 'en_riesgo', 'critico', 'archived'], projectStatus: ['planificado', 'en_curso', 'pausado', 'completado', 'cancelado', 'archived'],
  taskStatus: ['pendiente', 'en_curso', 'bloqueado', 'completado', 'archived'], priority: ['baja', 'media', 'alta', 'critica'], ticketStatus: ['abierto', 'en_proceso', 'resuelto', 'cerrado', 'archived'],
});

const required = (max = 180) => z.string().trim().min(1).max(max);
const optional = (max = 5000) => z.string().trim().max(max).optional();
const optionalEmail = z.preprocess(v => v === '' ? undefined : v, z.string().email().max(254).optional());
const money = z.number().finite().min(0).max(DOMAIN_LIMITS.money);
const date = z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?$/);
const audit = { createdAt: z.unknown().optional(), updatedAt: z.unknown().optional(), createdBy: z.string().nullable().optional(), updatedBy: z.string().nullable().optional(), archivedAt: z.unknown().optional() };
const envelope = { companyId: required(), ownerUid: optional(180), ...audit };
const strict = shape => z.object(shape).strict();
/** @param {string[]} values */
const enumeration = values => z.enum(/** @type {[string, ...string[]]} */ (values));

export const crmClientSchema = strict({ ...envelope, name: required(), email: optionalEmail, phone: optional(40), rfc: optional(20), segment: optional(50), status: enumeration(DOMAIN_ENUMS.crmClientStatus), industry: optional(100), address: optional(500), assignedTo: optional(), total_revenue: money.optional(), notes: optional() });
export const crmDealSchema = strict({ ...envelope, clientId: optional(), client_name: optional(), title: required(), stage: enumeration(DOMAIN_ENUMS.dealStage), amount: money.optional(), probability: z.number().min(0).max(100), expectedClose: optional(10), assignedTo: optional(), description: optional(), notes: optional() });
export const crmInteractionSchema = strict({ ...envelope, clientId: required(), clientName: optional(), type: enumeration(DOMAIN_ENUMS.interactionType), date, summary: optional(), subject: optional(), notes: optional(), outcome: optional(), nextAction: optional(), nextActionDate: optional(10) }).refine(v => v.summary || v.subject, 'La interacción requiere summary o subject');
export const employeeSchema = strict({ ...envelope, fullName: required(), email: optionalEmail, phone: optional(40), department: optional(100), position: optional(100), employmentType: enumeration(DOMAIN_ENUMS.employmentType), status: enumeration(DOMAIN_ENUMS.employeeStatus), hireDate: optional(10), baseSalary: money.optional(), rfc: optional(20), curp: optional(30), imssNumber: optional(30), bankAccount: optional(50), bank: optional(100), emergency_contact: optional(300), notes: optional() });
export const payrollSchema = strict({ ...envelope, employeeId: required(), employeeName: optional(), period: date, period_type: z.enum(['semanal', 'quincenal', 'mensual']), baseSalary: money, bonuses: money, overtime: money, deductions_imss: money, deductions_isr: money, other_deductions: money, netPay: money, status: enumeration(DOMAIN_ENUMS.payrollStatus), paymentDate: optional(10), notes: optional() });
export const performanceReviewSchema = strict({ ...envelope, employeeId: required(), employeeName: optional(), reviewer: optional(), period: required(), reviewDate: date, score_productivity: z.number().min(0).max(10), score_quality: z.number().min(0).max(10), score_teamwork: z.number().min(0).max(10), score_punctuality: z.number().min(0).max(10), score_leadership: z.number().min(0).max(10), strengths: optional(), areas_improvement: optional(), goals_next_period: optional(), overallRating: z.enum(['excepcional', 'bueno', 'satisfactorio', 'necesita_mejora', 'insatisfactorio']), salary_adjustment: z.number().min(-100).max(100), notes: optional() });
export const kpiSchema = strict({ ...envelope, name: required(), category: optional(100), target: z.number().finite(), current: z.number().finite(), unit: optional(30), frequency: z.enum(['semanal', 'mensual', 'trimestral', 'anual']), status: enumeration(DOMAIN_ENUMS.kpiStatus), owner: optional(), notes: optional() });
export const projectSchema = strict({ ...envelope, name: required(), description: optional(), status: enumeration(DOMAIN_ENUMS.projectStatus), priority: enumeration(DOMAIN_ENUMS.priority), owner: optional(), startDate: optional(10), endDate: optional(10), budget: money.optional(), spent: money.optional(), progress: z.number().min(0).max(100) });
export const projectTaskSchema = strict({ ...envelope, projectId: required(), title: required(), description: optional(), status: enumeration(DOMAIN_ENUMS.taskStatus), priority: enumeration(DOMAIN_ENUMS.priority), assignee: optional(), dueDate: optional(10), estimatedHours: z.number().min(0).max(100000).optional() });
export const supportTicketSchema = strict({ ...envelope, subject: required(), description: required(5000), category: optional(100), status: enumeration(DOMAIN_ENUMS.ticketStatus), priority: z.enum(['baja', 'media', 'alta', 'urgente']), resolved_date: optional(10) });

export const mutableCollectionSchemas = Object.freeze({ crmClients: crmClientSchema, crmDeals: crmDealSchema, crmInteractions: crmInteractionSchema, employees: employeeSchema, payroll: payrollSchema, performanceReviews: performanceReviewSchema, kpis: kpiSchema, projects: projectSchema, projectTasks: projectTaskSchema, supportTickets: supportTicketSchema });
export function validateDomainWrite(collectionName, value) { return mutableCollectionSchemas[collectionName]?.parse(value) ?? value; }

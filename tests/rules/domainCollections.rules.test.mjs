import { beforeEach, describe, it } from 'node:test';
import { assertAllowed, assertDenied, clearFirestore, firestoreDelete, firestoreDomainPatch, firestoreDomainSet, firestorePatch, firestoreSet, seedCompany } from './rules-test-utils.mjs';

const companyId = 'domain-company';
const editor = { uid: 'domain-editor', claims: {} };
const fixtures = {
  crmClients: { companyId, name: 'Cliente', status: 'activo' },
  crmDeals: { companyId, title: 'Venta', stage: 'propuesta', probability: 50 },
  crmInteractions: { companyId, clientId: 'c1', type: 'llamada', date: '2026-08-08', summary: 'Seguimiento' },
  employees: { companyId, fullName: 'Ada', employmentType: 'tiempo_completo', status: 'activo' },
  payroll: { companyId, employeeId: 'e1', period: '2026-08', period_type: 'mensual', baseSalary: 10, bonuses: 0, overtime: 0, deductions_imss: 0, deductions_isr: 0, other_deductions: 0, netPay: 10, status: 'pendiente' },
  performanceReviews: { companyId, employeeId: 'e1', period: '2026-Q3', reviewDate: '2026-08-08', score_productivity: 7, score_quality: 7, score_teamwork: 7, score_punctuality: 7, score_leadership: 7, overallRating: 'bueno', salary_adjustment: 0 },
  kpis: { companyId, name: 'MRR', target: 10, current: 5, frequency: 'mensual', status: 'en_curso' },
  projects: { companyId, name: 'Migración', status: 'en_curso', priority: 'alta', progress: 50 },
  projectTasks: { companyId, projectId: 'p1', title: 'Plan', status: 'pendiente', priority: 'media' },
  supportTickets: { companyId, subject: 'Ayuda', description: 'Detalle', status: 'abierto', priority: 'media' },
};
const businessUpdates = { crmClients: { name: 'Cliente actualizado' }, crmDeals: { probability: 75 }, crmInteractions: { summary: 'Seguimiento actualizado' }, employees: { fullName: 'Ada Lovelace' }, payroll: { netPay: 9 }, performanceReviews: { score_quality: 8 }, kpis: { current: 7 }, projects: { progress: 60 }, projectTasks: { title: 'Plan actualizado' }, supportTickets: { description: 'Detalle actualizado' } };

describe('contratos reales de las diez colecciones', () => {
  beforeEach(async () => { await clearFirestore(); await seedCompany({ companyId, ownerUid: 'owner', memberships: [{ userUid: editor.uid, role: 'editor', status: 'active' }] }); });
  for (const [collection, fixture] of Object.entries(fixtures)) {
    it(`${collection} permite contrato y rechaza faltantes, tipos y campos desconocidos`, async () => {
      await assertAllowed(firestoreDomainSet(`${collection}/ok`, fixture, editor), `${collection} válido`);
      const required = Object.keys(fixture).find(key => key !== 'companyId'); const missing = { ...fixture }; delete missing[required];
      await assertDenied(firestoreDomainSet(`${collection}/missing`, missing, editor), `${collection} requerido`);
      await assertDenied(firestoreDomainSet(`${collection}/type`, { ...fixture, [required]: 42 }, editor), `${collection} tipo`);
      await assertDenied(firestoreDomainSet(`${collection}/unknown`, { ...fixture, injected: true }, editor), `${collection} desconocido`);
      await assertDenied(firestoreDomainSet(`${collection}/tenant`, { ...fixture, companyId: 'foreign' }, editor), `${collection} tenant`);
      await assertAllowed(firestoreDomainPatch(`${collection}/ok`, businessUpdates[collection], editor), `${collection} update de negocio válido`);
      await assertDenied(firestoreDomainPatch(`${collection}/ok`, { companyId: 'foreign' }, editor), `${collection} companyId inmutable`);
      await assertDenied(firestoreDomainPatch(`${collection}/ok`, { ownerUid: 'attacker' }, editor), `${collection} ownerUid inmutable`);
      await assertDenied(firestoreDomainPatch(`${collection}/ok`, { createdBy: 'attacker' }, editor), `${collection} createdBy inmutable`);
    });
  }
});

describe('logs backend-only', () => {
  beforeEach(async () => { await clearFirestore(); await seedCompany({ companyId, ownerUid: 'owner', memberships: [{ userUid: editor.uid, role: 'editor', status: 'active' }] }); });
  for (const collection of ['auditLogs', 'predictionLogs', 'aiAuditLogs', 'aiCostLogs', 'aiUsage']) {
    it(`bloquea escrituras cliente en ${collection}`, async () => {
      const path = `${collection}/direct`;
      await assertDenied(firestoreSet(path, { companyId, ownerUid: editor.uid }, editor), `${collection} create`);
      await assertAllowed(firestoreSet(path, { companyId, ownerUid: editor.uid }), `${collection} seed backend`);
      await assertDenied(firestorePatch(path, { companyId, ownerUid: editor.uid, changed: true }, editor), `${collection} update`);
      await assertDenied(firestoreDelete(path, editor), `${collection} delete`);
    });
  }
});

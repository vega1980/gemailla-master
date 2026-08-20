import { beforeEach, describe, it } from 'node:test';
import { assertAllowed, assertDenied, clearFirestore, firestoreDelete, firestoreDomainPatch, firestoreDomainSet, firestoreGet, firestorePatch, firestoreSet, firestoreSetWithServerTimestamps, seedCompany } from './rules-test-utils.mjs';

const companyId = 'domain-company';
const editor = { uid: 'domain-editor', claims: {} };
const fixtures = {
  crmClients: { companyId, name: 'Cliente', status: 'activo' },
  crmDeals: { companyId, title: 'Venta', stage: 'contactado', probability: 25 },
  crmInteractions: { companyId, clientId: 'c1', type: 'llamada', date: '2026-08-08', summary: 'Seguimiento' },
  employees: { companyId, fullName: 'Ada', employmentType: 'tiempo_completo', status: 'activo' },
  payroll: { companyId, employeeId: 'e1', period: '2026-08', period_type: 'mensual', baseSalary: 10, bonuses: 0, overtime: 0, deductions_imss: 0, deductions_isr: 0, other_deductions: 0, netPay: 10, status: 'pendiente' },
  performanceReviews: { companyId, employeeId: 'e1', period: '2026-Q3', reviewDate: '2026-08-08', score_productivity: 7, score_quality: 7, score_teamwork: 7, score_punctuality: 7, score_leadership: 7, overallRating: 'bueno', salary_adjustment: 0 },
  kpis: { companyId, name: 'MRR', target: 10, current: 5, frequency: 'mensual', status: 'en_curso' },
  projects: { companyId, name: 'Migración', status: 'en_curso', priority: 'alta', progress: 50, team: ['Ada'], tags: ['importado'] },
  projectTasks: { companyId, projectId: 'p1', title: 'Plan', status: 'pendiente', priority: 'media' },
  supportTickets: { companyId, subject: 'Ayuda', description: 'Detalle', status: 'abierto', priority: 'media' },
};
const businessUpdates = { crmClients: { name: 'Cliente actualizado' }, crmDeals: { probability: 75 }, crmInteractions: { summary: 'Seguimiento actualizado' }, employees: { fullName: 'Ada Lovelace' }, payroll: { netPay: 9 }, performanceReviews: { score_quality: 8 }, kpis: { current: 7 }, projects: { progress: 60 }, projectTasks: { title: 'Plan actualizado' }, supportTickets: { description: 'Detalle actualizado' } };
const boundaries = {
  crmClients: { text: 'name', enum: 'status', number: ['total_revenue', 0, 1_000_000_000] }, crmDeals: { text: 'title', enum: 'stage', number: ['probability', 0, 100], date: 'expectedClose' }, crmInteractions: { text: 'clientId', enum: 'type', date: 'date' },
  employees: { text: 'fullName', enum: 'employmentType', number: ['baseSalary', 0, 1_000_000_000], date: 'hireDate' }, payroll: { text: 'employeeId', enum: 'status', number: ['netPay', 0, 1_000_000_000], date: 'period' },
  performanceReviews: { text: 'employeeId', enum: 'overallRating', number: ['score_quality', 0, 10], date: 'reviewDate' }, kpis: { text: 'name', enum: 'status', number: ['target', -1_000_000_000, 1_000_000_000] }, projects: { text: 'name', enum: 'priority', number: ['progress', 0, 100], date: 'startDate' },
  projectTasks: { text: 'title', enum: 'priority', number: ['estimatedHours', 0, 100000], date: 'dueDate' }, supportTickets: { text: 'subject', enum: 'priority', date: 'resolved_date' },
};

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
      const boundary = boundaries[collection];
      await assertAllowed(firestoreDomainSet(`${collection}/text-min`, { ...fixture, [boundary.text]: 'x' }, editor), `${collection} texto mínimo`);
      await assertAllowed(firestoreDomainSet(`${collection}/text-max`, { ...fixture, [boundary.text]: 'x'.repeat(180) }, editor), `${collection} texto máximo`);
      await assertDenied(firestoreDomainSet(`${collection}/text-over`, { ...fixture, [boundary.text]: 'x'.repeat(181) }, editor), `${collection} texto sobre máximo`);
      await assertDenied(firestoreDomainSet(`${collection}/enum`, { ...fixture, [boundary.enum]: 'inventado' }, editor), `${collection} enum inválido`);
      if (boundary.number) {
        const [field, min, max] = boundary.number;
        await assertAllowed(firestoreDomainSet(`${collection}/number-min`, { ...fixture, [field]: min }, editor), `${collection} número mínimo`);
        await assertAllowed(firestoreDomainSet(`${collection}/number-max`, { ...fixture, [field]: max }, editor), `${collection} número máximo`);
        await assertDenied(firestoreDomainSet(`${collection}/number-over`, { ...fixture, [field]: max + 1 }, editor), `${collection} número sobre máximo`);
        await assertDenied(firestoreDomainSet(`${collection}/number-string`, { ...fixture, [field]: String(min) }, editor), `${collection} string numérico`);
      }
      if (boundary.date) await assertDenied(firestoreDomainSet(`${collection}/date`, { ...fixture, [boundary.date]: '2026-99-99x' }, editor), `${collection} fecha inválida`);
      await assertAllowed(firestoreDomainPatch(`${collection}/ok`, businessUpdates[collection], editor), `${collection} update de negocio válido`);
      await assertDenied(firestoreDomainPatch(`${collection}/ok`, { companyId: 'foreign' }, editor), `${collection} companyId inmutable`);
      await assertDenied(firestoreDomainPatch(`${collection}/ok`, { ownerUid: 'attacker' }, editor), `${collection} ownerUid inmutable`);
      await assertDenied(firestoreDomainPatch(`${collection}/ok`, { createdBy: 'attacker' }, editor), `${collection} createdBy inmutable`);
    });
  }
});

describe('logs backend-only', () => {
  beforeEach(async () => { await clearFirestore(); await seedCompany({ companyId, ownerUid: 'owner', memberships: [{ userUid: editor.uid, role: 'editor', status: 'active' }] }); });
  for (const collection of ['auditLogs', 'predictionLogs', 'aiAuditLogs', 'aiCostLogs', 'aiUsage', 'aiMonthlyUsage']) {
    it(`bloquea escrituras cliente en ${collection}`, async () => {
      const path = `${collection}/direct`;
      await assertDenied(firestoreSet(path, { companyId, ownerUid: editor.uid }, editor), `${collection} create`);
      await assertAllowed(firestoreSet(path, { companyId, ownerUid: editor.uid }), `${collection} seed backend`);
      await assertDenied(firestorePatch(path, { companyId, ownerUid: editor.uid, changed: true }, editor), `${collection} update`);
      await assertDenied(firestoreDelete(path, editor), `${collection} delete`);
    });
  }
});

describe('observabilidad de frontend con contrato inmutable', () => {
  const validEvent = { eventName: 'frontend_error', severity: 'ERROR', source: 'frontend', correlationId: 'corr-domain-1', ownerUid: editor.uid, companyId, route: '/dashboard', errorName: 'TypeError', errorMessage: 'Fallo controlado de prueba', retentionDays: 90 };
  beforeEach(async () => { await clearFirestore(); await seedCompany({ companyId, ownerUid: 'owner', memberships: [{ userUid: editor.uid, role: 'editor', status: 'active' }] }); });

  it('permite un evento válido y bloquea su modificación y borrado', async () => {
    await assertAllowed(firestoreSetWithServerTimestamps('observabilityEvents/valid', validEvent, editor), 'evento válido');
    await assertAllowed(firestoreGet('observabilityEvents/valid', editor), 'lectura de evento propio');
    await assertDenied(firestorePatch('observabilityEvents/valid', { severity: 'CRITICAL' }, editor), 'actualización de observabilidad');
    await assertDenied(firestoreDelete('observabilityEvents/valid', editor), 'borrado de observabilidad');
  });

  it('rechaza timestamps de cliente, campos desconocidos y datos ajenos', async () => {
    await assertDenied(firestoreSet('observabilityEvents/client-time', { ...validEvent, createdAt: '2026-08-09T00:00:00.000Z' }, editor), 'timestamp de cliente');
    await assertDenied(firestoreSetWithServerTimestamps('observabilityEvents/unknown', { ...validEvent, prompt: 'contenido sensible' }, editor), 'campo desconocido');
    await assertDenied(firestoreSetWithServerTimestamps('observabilityEvents/wrong-owner', { ...validEvent, ownerUid: 'attacker' }, editor), 'owner ajeno');
    await assertDenied(firestoreSetWithServerTimestamps('observabilityEvents/wrong-company', { ...validEvent, companyId: 'foreign' }, editor), 'empresa ajena');
    await assertDenied(firestoreSetWithServerTimestamps('observabilityEvents/wrong-enum', { ...validEvent, severity: 'INFO' }, editor), 'severidad inválida');
  });
});

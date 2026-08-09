import test from 'node:test';
import assert from 'node:assert/strict';
import { mutableCollectionSchemas } from '../../src/shared/validation/domainSchemas.js';

const fixtures = {
  crmClients: { companyId: 'acme', name: 'Cliente', status: 'activo' },
  crmDeals: { companyId: 'acme', title: 'Venta', stage: 'propuesta', probability: 50 },
  crmInteractions: { companyId: 'acme', clientId: 'c1', type: 'llamada', date: '2026-08-08', summary: 'Seguimiento' },
  employees: { companyId: 'acme', fullName: 'Ada', employmentType: 'tiempo_completo', status: 'activo' },
  payroll: { companyId: 'acme', employeeId: 'e1', period: '2026-08', period_type: 'mensual', baseSalary: 10, bonuses: 0, overtime: 0, deductions_imss: 0, deductions_isr: 0, other_deductions: 0, netPay: 10, status: 'pendiente' },
  performanceReviews: { companyId: 'acme', employeeId: 'e1', period: '2026-Q3', reviewDate: '2026-08-08', score_productivity: 7, score_quality: 7, score_teamwork: 7, score_punctuality: 7, score_leadership: 7, overallRating: 'bueno', salary_adjustment: 0 },
  kpis: { companyId: 'acme', name: 'MRR', target: 10, current: 5, frequency: 'mensual', status: 'en_curso' },
  projects: { companyId: 'acme', name: 'Migración', status: 'en_curso', priority: 'alta', progress: 50 },
  projectTasks: { companyId: 'acme', projectId: 'p1', title: 'Plan', status: 'pendiente', priority: 'media' },
  supportTickets: { companyId: 'acme', subject: 'Ayuda', description: 'Detalle', status: 'abierto', priority: 'media' },
};

for (const [collection, schema] of Object.entries(mutableCollectionSchemas)) {
  test(`${collection}: acepta contrato, rechaza campos desconocidos y enum inválido`, () => {
    assert.doesNotThrow(() => schema.parse(fixtures[collection]));
    assert.throws(() => schema.parse({ ...fixtures[collection], injected: true }), /Unrecognized key/);
    const enumField = collection === 'crmDeals' ? 'stage' : collection === 'crmInteractions' ? 'type' : collection === 'employees' ? 'employmentType' : collection === 'performanceReviews' ? 'overallRating' : collection === 'projects' || collection === 'projectTasks' || collection === 'supportTickets' ? 'priority' : 'status';
    assert.throws(() => schema.parse({ ...fixtures[collection], [enumField]: 'inventado' }));
  });
}

test('los contratos numéricos no convierten strings silenciosamente', () => {
  assert.throws(() => mutableCollectionSchemas.projects.parse({ ...fixtures.projects, progress: '50' }));
  assert.throws(() => mutableCollectionSchemas.crmDeals.parse({ ...fixtures.crmDeals, probability: '50' }));
  assert.throws(() => mutableCollectionSchemas.payroll.parse({ ...fixtures.payroll, netPay: '10' }));
});

const boundaries = {
  crmClients: { text: 'name' }, crmDeals: { text: 'title', number: ['probability', 0, 100] }, crmInteractions: { text: 'clientId', date: 'date' },
  employees: { text: 'fullName', number: ['baseSalary', 0, 1_000_000_000] }, payroll: { text: 'employeeId', number: ['netPay', 0, 1_000_000_000], date: 'period' },
  performanceReviews: { text: 'employeeId', number: ['score_quality', 0, 10], date: 'reviewDate' }, kpis: { text: 'name' }, projects: { text: 'name', number: ['progress', 0, 100] },
  projectTasks: { text: 'title', number: ['estimatedHours', 0, 100000] }, supportTickets: { text: 'subject' },
};
for (const [collection, boundary] of Object.entries(boundaries)) {
  test(`${collection}: mínimos, máximos, fecha y actualización de negocio`, () => {
    const schema = mutableCollectionSchemas[collection]; const fixture = fixtures[collection];
    assert.doesNotThrow(() => schema.parse({ ...fixture, [boundary.text]: 'x' }));
    assert.doesNotThrow(() => schema.parse({ ...fixture, [boundary.text]: 'x'.repeat(180) }));
    assert.throws(() => schema.parse({ ...fixture, [boundary.text]: 'x'.repeat(181) }));
    if (boundary.number) { const [field, min, max] = boundary.number; assert.doesNotThrow(() => schema.parse({ ...fixture, [field]: min })); assert.doesNotThrow(() => schema.parse({ ...fixture, [field]: max })); assert.throws(() => schema.parse({ ...fixture, [field]: max + 1 })); }
    if (boundary.date) assert.throws(() => schema.parse({ ...fixture, [boundary.date]: '2026-99-99x' }));
  });
}

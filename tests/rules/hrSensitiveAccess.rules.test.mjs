import { beforeEach, describe, it } from 'node:test';
import {
  assertAllowed,
  assertDenied,
  clearFirestore,
  firestoreDomainPatch,
  firestoreDomainSet,
  firestoreGet,
  firestoreSet,
  seedCompany,
} from './rules-test-utils.mjs';

const companyA = 'hr-company-a';
const companyB = 'hr-company-b';
const owner = { uid: 'hr-owner', claims: {} };
const director = { uid: 'hr-director', claims: {} };
const admin = { uid: 'hr-admin', claims: {} };
const editor = { uid: 'hr-editor', claims: {} };
const viewer = { uid: 'hr-viewer', claims: {} };
const invitado = { uid: 'hr-invitado', claims: {} };

const fixtures = {
  employees: { companyId: companyA, fullName: 'Ada', employmentType: 'tiempo_completo', status: 'activo', baseSalary: 100, rfc: 'RFC', curp: 'CURP', imssNumber: 'IMSS', bankAccount: '1234' },
  payroll: { companyId: companyA, employeeId: 'employee-1', period: '2026-08', period_type: 'mensual', baseSalary: 100, bonuses: 0, overtime: 0, deductions_imss: 0, deductions_isr: 0, other_deductions: 0, netPay: 100, status: 'pendiente' },
  performanceReviews: { companyId: companyA, employeeId: 'employee-1', period: '2026-Q3', reviewDate: '2026-08-08', score_productivity: 8, score_quality: 8, score_teamwork: 8, score_punctuality: 8, score_leadership: 8, overallRating: 'bueno', salary_adjustment: 0 },
};

describe('acceso mínimo a datos sensibles de personal', () => {
  beforeEach(async () => {
    await clearFirestore();
    await seedCompany({
      companyId: companyA,
      ownerUid: owner.uid,
      memberships: [
        { userUid: director.uid, role: 'director' },
        { userUid: admin.uid, role: 'admin' },
        { userUid: editor.uid, role: 'editor' },
        { userUid: viewer.uid, role: 'viewer' },
        { userUid: invitado.uid, role: 'invitado' },
      ],
    });
    await seedCompany({ companyId: companyB, ownerUid: 'other-owner' });
    for (const [collection, fixture] of Object.entries(fixtures)) {
      await assertAllowed(firestoreSet(`${collection}/seed`, fixture), `backend seed ${collection}`);
    }
  });

  for (const actor of [owner, director, admin]) {
    for (const [collection, fixture] of Object.entries(fixtures)) {
      it(`${actor.uid} puede leer y administrar ${collection}`, async () => {
        await assertAllowed(firestoreGet(`${collection}/seed`, actor), `${actor.uid} read ${collection}`);
        await assertAllowed(firestoreDomainSet(`${collection}/${actor.uid}`, fixture, actor), `${actor.uid} create ${collection}`);
        await assertAllowed(firestoreDomainPatch(`${collection}/${actor.uid}`, collection === 'employees' ? { fullName: 'Ada B' } : collection === 'payroll' ? { netPay: 90 } : { score_quality: 9 }, actor), `${actor.uid} update ${collection}`);
      });
    }
  }

  for (const actor of [editor, viewer, invitado]) {
    for (const collection of Object.keys(fixtures)) {
      it(`${actor.uid} no puede leer ni escribir ${collection}`, async () => {
        await assertDenied(firestoreGet(`${collection}/seed`, actor), `${actor.uid} read ${collection}`);
        await assertDenied(firestoreDomainSet(`${collection}/${actor.uid}`, fixtures[collection], actor), `${actor.uid} create ${collection}`);
        const update = collection === 'employees' ? { fullName: 'Blocked' } : collection === 'payroll' ? { netPay: 1 } : { score_quality: 1 };
        await assertDenied(firestoreDomainPatch(`${collection}/seed`, update, actor), `${actor.uid} update ${collection}`);
      });
    }
  }

  for (const collection of Object.keys(fixtures)) {
    it(`un administrador de A no puede leer ${collection} de B`, async () => {
      await assertAllowed(firestoreSet(`${collection}/foreign`, { ...fixtures[collection], companyId: companyB }), `backend seed foreign ${collection}`);
      await assertDenied(firestoreGet(`${collection}/foreign`, admin), `cross-tenant ${collection}`);
    });
  }
});

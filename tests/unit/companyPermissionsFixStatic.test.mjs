import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const membershipService = await readFile(new URL('../../src/features/companies/services/companyMembershipService.js', import.meta.url), 'utf8');
const repositorySource = await readFile(new URL('../../src/infrastructure/firebase/repositories/createRepository.js', import.meta.url), 'utf8');
const firebaseClient = await readFile(new URL('../../src/api/firebaseClient.js', import.meta.url), 'utf8');
const rules = await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8');
const auditLogger = await readFile(new URL('../../src/lib/auditLogger.js', import.meta.url), 'utf8');
const toastSource = await readFile(new URL('../../src/components/ui/use-toast.jsx', import.meta.url), 'utf8');
const importTransactions = await readFile(new URL('../../src/features/erp/components/ImportTransactions.jsx', import.meta.url), 'utf8');

describe('carga segura de empresas por membresía', () => {
  it('consulta primero membresías activas del usuario y no lista companies', () => {
    assert.match(membershipService, /CompanyMember\.filter\(\{\s*userUid,\s*status: ACTIVE_STATUS,\s*\}\)/s);
    assert.doesNotMatch(membershipService, /Company\.list\(/);
    assert.doesNotMatch(membershipService, /request\.auth\.token\.companyId/);
  });

  it('carga empresas concretas por getDoc y no por getDocs(collection companies)', () => {
    assert.match(repositorySource, /Promise\.all\(idChunk\.map\(\(id\) => getDoc\(doc\(db, collectionName, id\)\)\)\)/);
    assert.doesNotMatch(repositorySource, /where\(documentId\(\), 'in', idChunk\)/);
  });

  it('soporta varias empresas y claims desactualizados al partir de companyMembers', () => {
    assert.match(membershipService, /new Set\(memberships\.map\(\(member\) => member\.companyId\)/);
    assert.match(membershipService, /loadCompaniesForMemberships\(memberships, options\)/);
  });
});

describe('creación atómica de empresa y membresía', () => {
  it('usa transacción y crea membresía inicial activa con rol owner existente', () => {
    assert.match(firebaseClient, /await runTransaction\(db, async \(transaction\) => \{\s*transaction\.set\(companyRef, companyPayload\);\s*transaction\.set\(membershipRef, membershipPayload\);\s*\}\);/s);
    assert.match(firebaseClient, /role: membershipData\.role \|\| 'owner'/);
    assert.match(firebaseClient, /status: membershipData\.status \|\| 'active'/);
  });
});

describe('reglas de Firestore multiempresa', () => {
  it('empresa concreta solo se lee con membresía activa', () => {
    assert.match(rules, /function canReadCompany\(companyId\) \{\s*return isNonEmptyString\(companyId\)\s*&& isActiveMember\(companyId\);\s*\}/s);
    assert.match(rules, /membershipData\(companyId\)\.get\('status', null\) == 'active'/);
  });

  it('auditLogs no admite escritura directa del cliente', () => {
    assert.match(rules, /match \/auditLogs\/\{logId\} \{\s*allow read: if hasCompanyId\(resource\.data\) && canManageCompany\(resource\.data\.companyId\);\s*allow write: if false;\s*\}/s);
  });
});

describe('auditoría y toasts', () => {
  it('auditLogger frontend no escribe en AuditLog desde navegador', () => {
    assert.doesNotMatch(auditLogger, /AuditLog\.create/);
    assert.match(auditLogger, /audit_log_client_skipped/);
  });

  it('errores duplicados reutilizan id estable y la importación limpia errores previos', () => {
    assert.match(toastSource, /function stableToastId/);
    assert.match(toastSource, /existingIndex >= 0/);
    assert.match(toastSource, /const TOAST_REMOVE_DELAY = 8000/);
    assert.match(importTransactions, /dismiss\('error:import-transactions'\)/);
    assert.match(importTransactions, /id: 'error:import-transactions'/);
  });
});

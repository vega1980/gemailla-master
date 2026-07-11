#!/usr/bin/env node

/**
 * Backfill previo a despliegue:
 * crea/actualiza companyEntitlements/{companyId} desde suscripciones legacy.
 *
 * Uso seguro:
 *   node scripts/backfill-company-entitlements.mjs --dry-run
 *   node scripts/backfill-company-entitlements.mjs --apply
 *
 * El documento público para miembros NO incluye secretos de Stripe, IDs internos
 * sensibles ni datos de pago. Solo copia campos mínimos de entitlement.
 */

import admin from '../functions/node_modules/firebase-admin/lib/index.js';
import { pathToFileURL } from 'node:url';

const MIGRATION_VERSION = 1;
const ACTIVE_STATUSES = new Set(['active', 'trialing', 'activo']);
const DEFAULT_GRACE_DAYS = Number(process.env.ENTITLEMENT_BACKFILL_GRACE_DAYS || 7);
const PAGE_SIZE = Number(process.env.ENTITLEMENT_BACKFILL_PAGE_SIZE || 250);

function parseArgs(argv) {
  return {
    apply: argv.includes('--apply'),
    dryRun: argv.includes('--dry-run') || !argv.includes('--apply'),
  };
}

function toIsoDate(value) {
  if (!value) return null;
  const date = typeof value?.toDate === 'function'
    ? value.toDate()
    : value instanceof Date
      ? value
      : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function addDaysIso(isoDate, days) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function sanitizeEntitlement({ companyId, subscription }) {
  const plan = String(subscription.plan || 'basic').toLowerCase();
  const currentPeriodEnd = toIsoDate(
    subscription.currentPeriodEnd
      || subscription.current_period_end
      || subscription.endDate
      || subscription.expiresAt,
  );

  return {
    companyId,
    plan,
    status: ACTIVE_STATUSES.has(String(subscription.status || '').toLowerCase()) ? 'active' : 'inactive',
    aiAccess: typeof subscription.aiAccess === 'boolean'
      ? subscription.aiAccess
      : ['pro', 'enterprise'].includes(plan),
    currentPeriodEnd,
    graceUntil: toIsoDate(subscription.graceUntil) || (currentPeriodEnd ? addDaysIso(currentPeriodEnd, DEFAULT_GRACE_DAYS) : null),
    source: 'legacy-subscription-backfill',
    updatedAt: new Date().toISOString(),
    migrationVersion: MIGRATION_VERSION,
  };
}

async function main() {
  const { apply, dryRun } = parseArgs(process.argv.slice(2));
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();
  const byCompany = new Map();
  const report = {
    subscriptionsWithoutCompanyId: [],
    duplicateCompanies: [],
    ambiguousCompanies: [],
  };
  let scannedSubscriptions = 0;
  let cursor = null;

  do {
    let query = db.collection('subscriptions').orderBy('__name__').limit(PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    if (page.empty) break;

    page.forEach((doc) => {
      scannedSubscriptions += 1;
      const subscription = { id: doc.id, ...(doc.data() || {}) };
      const companyId = String(subscription.companyId || '').trim();
      if (!companyId) {
        report.subscriptionsWithoutCompanyId.push(doc.id);
        return;
      }
      if (!byCompany.has(companyId)) byCompany.set(companyId, []);
      byCompany.get(companyId).push(subscription);
    });

    cursor = page.docs.at(-1);
  } while (cursor);

  const selected = new Map();
  for (const [companyId, subscriptions] of byCompany.entries()) {
    const sorted = subscriptions
      .map((subscription) => ({
        subscription,
        sortDate: toIsoDate(subscription.updatedAt || subscription.createdAt || subscription.currentPeriodEnd) || '',
      }))
      .sort((a, b) => b.sortDate.localeCompare(a.sortDate) || String(b.subscription.id).localeCompare(String(a.subscription.id)));

    if (subscriptions.length > 1) {
      report.duplicateCompanies.push({
        companyId,
        subscriptionIds: subscriptions.map((subscription) => subscription.id),
      });
      if (sorted.length > 1 && sorted[0].sortDate === sorted[1].sortDate) {
        report.ambiguousCompanies.push({
          companyId,
          reason: 'multiple_subscriptions_share_latest_sort_date',
          subscriptionIds: sorted.filter((entry) => entry.sortDate === sorted[0].sortDate).map((entry) => entry.subscription.id),
        });
        continue;
      }
    }

    selected.set(companyId, sorted[0].subscription);
  }

  const result = {
    scannedSubscriptions,
    plannedEntitlements: selected.size,
    skippedAmbiguousCompanies: report.ambiguousCompanies.length,
    subscriptionsWithoutCompanyId: report.subscriptionsWithoutCompanyId.length,
    duplicateCompanies: report.duplicateCompanies.length,
    written: 0,
    dryRun,
  };

  for (const [companyId, subscription] of selected.entries()) {
    const entitlement = sanitizeEntitlement({ companyId, subscription });
    if (apply) {
      await db.collection('companyEntitlements').doc(companyId).set(entitlement);
      result.written += 1;
    } else {
      console.log(JSON.stringify({ dryRun: true, path: `companyEntitlements/${companyId}`, entitlement }));
    }
  }

  console.log(JSON.stringify({ eventName: 'company_entitlements_backfill_report', ...report }));
  console.log(JSON.stringify({ eventName: 'company_entitlements_backfill_completed', ...result }));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

#!/usr/bin/env node
import admin from '../functions/node_modules/firebase-admin/lib/index.js';
const apply = process.argv.includes('--apply'); const projectArg = process.argv.find(arg => arg.startsWith('--project=')); const projectId = projectArg?.slice(10);
if (!projectId) throw new Error('Se exige --project=PROJECT_ID incluso en dry-run.');
if (apply && !process.argv.includes('--confirm=BACKFILL_LOG_EXPIRY')) throw new Error('Apply exige --confirm=BACKFILL_LOG_EXPIRY.');
if (!admin.apps.length) admin.initializeApp({ projectId }); const db = admin.firestore();
const days = { auditLogs: 2555, aiAuditLogs: 90, aiCostLogs: 90, aiUsage: 90, predictionLogs: 90, observabilityEvents: 90 }; const summary = {};
function originalMillis(data) { for (const value of [data.createdAt, data.timestamp, data.fecha_generacion]) { if (value?.toMillis) return value.toMillis(); const millis = Date.parse(value); if (Number.isFinite(millis)) return millis; } return null; }
for (const [name, retentionDays] of Object.entries(days)) {
  let cursor = null; let scanned = 0; let eligible = 0; let updated = 0; let missingOriginalDate = 0;
  while (true) { let query = db.collection(name).orderBy(admin.firestore.FieldPath.documentId()).limit(250); if (cursor) query = query.startAfter(cursor); const page = await query.get(); if (page.empty) break; const batch = db.batch(); let batchUpdates = 0; for (const document of page.docs) { scanned += 1; const data = document.data(); if (data.expiresAt !== undefined) continue; const origin = originalMillis(data); if (data.legalHold !== true && origin === null) { missingOriginalDate += 1; continue; } eligible += 1; if (apply) { batch.update(document.ref, data.legalHold === true ? { expiresAt: null } : { expiresAt: admin.firestore.Timestamp.fromMillis(origin + retentionDays * 86400000) }); updated += 1; batchUpdates += 1; } } if (apply && batchUpdates) await batch.commit(); cursor = page.docs.at(-1); }
  summary[name] = { scanned, eligible, updated, missingOriginalDate };
}
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', projectId, summary }, null, 2));

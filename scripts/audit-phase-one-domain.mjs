#!/usr/bin/env node
import admin from '../functions/node_modules/firebase-admin/lib/index.js';
import { mutableCollectionSchemas } from '../src/shared/validation/domainSchemas.js';
if (process.argv.includes('--apply')) throw new Error('Este inventario no elimina ni transforma campos. Solo admite --dry-run.');
if (!admin.apps.length) admin.initializeApp(); const db = admin.firestore(); const report = {};
for (const [collectionName, schema] of Object.entries(mutableCollectionSchemas)) {
  let cursor = null; let scanned = 0; const incompatible = [];
  while (true) { let query = db.collection(collectionName).orderBy(admin.firestore.FieldPath.documentId()).limit(250); if (cursor) query = query.startAfter(cursor); const page = await query.get(); if (page.empty) break; for (const document of page.docs) { scanned += 1; const result = schema.safeParse(document.data()); if (!result.success) incompatible.push({ id: document.id, issues: result.error.issues.map(issue => ({ path: issue.path.join('.'), code: issue.code })) }); } cursor = page.docs.at(-1); }
  report[collectionName] = { scanned, incompatibleCount: incompatible.length, incompatible };
}
console.log(JSON.stringify({ mode: 'dry-run', report }, null, 2));

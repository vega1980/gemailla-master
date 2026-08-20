const { FieldValue, Timestamp } = require('firebase-admin/firestore');
const firebaseAdmin = require('../firebaseAdmin');
const PLAN_LIMITS = Object.freeze({ basic: 5, pro: 50, enterprise: Infinity });
async function predictionLogHandler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  try {
    const appToken = String(req.get('x-firebase-appcheck') || ''); const authToken = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!appToken || !authToken) return res.status(401).json({ error: 'Autenticación y App Check requeridos.' });
    let user; try { await firebaseAdmin.getAdminAppCheck().verifyToken(appToken); user = await firebaseAdmin.getAdminAuth().verifyIdToken(authToken); } catch { return res.status(401).json({ error: 'Auth o App Check inválido.' }); }
    const companyId = String(req.body?.companyId || ''); const type = String(req.body?.type || 'general'); const result = String(req.body?.result || ''); const correlationId = String(req.body?.correlationId || '');
    if (!/^[A-Za-z0-9_-]{1,180}$/.test(companyId) || !/^[A-Za-z0-9._:-]{8,160}$/.test(correlationId) || type.length > 80 || result.length > 500) return res.status(400).json({ error: 'Predicción inválida.' });
    const db = firebaseAdmin.getAdminFirestore(); const member = await db.collection('companyMembers').doc(`${companyId}_${user.uid}`).get();
    if (!member.exists || member.data().status !== 'active') return res.status(403).json({ error: 'Membresía activa requerida.' });
    const entitlement = await db.collection('companyEntitlements').doc(companyId).get(); const plan = entitlement.exists ? String(entitlement.data().plan || 'basic') : 'basic'; const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.basic;
    const monthKey = new Date().toISOString().slice(0, 7); const id = `${companyId}_${user.uid}_${correlationId}`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 500); const ref = db.collection('predictionLogs').doc(id);
    const outcome = await db.runTransaction(async transaction => { const existing = await transaction.get(ref); if (existing.exists) return 'duplicate'; const countQuery = db.collection('predictionLogs').where('companyId', '==', companyId).where('userUid', '==', user.uid).where('monthKey', '==', monthKey); const current = await transaction.get(countQuery); if (Number.isFinite(limit) && current.size >= limit) return 'limit'; transaction.create(ref, { companyId, ownerUid: user.uid, userUid: user.uid, userEmail: user.email || '', monthKey, planAtCreation: plan, tipo_prediccion: type, resultado_ia: result, correlationId, createdAt: FieldValue.serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 90 * 86400000) }); return 'created'; });
    if (outcome === 'limit') return res.status(403).json({ error: 'Límite mensual de predicciones excedido.' });
    return res.status(outcome === 'duplicate' ? 200 : 201).json({ success: true, duplicate: outcome === 'duplicate', id });
  } catch (error) { console.error('prediction_log_failed', error); return res.status(500).json({ error: 'No se pudo registrar la predicción.' }); }
}
module.exports = { PLAN_LIMITS, predictionLogHandler };

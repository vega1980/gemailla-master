import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as firestoreLimit,
  orderBy,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { createAuditMutationMiddleware } from '@/infrastructure/firebase/mutations/auditMutationMiddleware';

function serializeDocument(snapshot) {
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export function createRepository({
  db,
  entityName,
  collectionName,
  getCurrentUser,
  getCurrentUserUid,
  isArchivedRecord,
  keepVisibleRecords,
  normalizeData,
  normalizeFilters,
  normalizeKey,
  nowIso,
}) {
  const col = () => collection(db, collectionName);
  const mutations = createAuditMutationMiddleware({ getCurrentUserUid, nowIso });

  function newId() {
    return doc(col()).id;
  }

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function serializeDocSnapshot(snapshot) {
  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

function serializeQuerySnapshot(snapshot) {
  return snapshot.docs.map(serializeDocSnapshot);
}

function buildQuery(collectionRef, options = {}) {
  /** @type {import('firebase/firestore').QueryConstraint[]} */
  const constraints = [];

  if (Array.isArray(options.where)) {
    for (const condition of options.where) {
      constraints.push(where(condition.field, condition.operator, condition.value));
    }
  }

  if (options.orderBy) {
    constraints.push(orderBy(options.orderBy.field, options.orderBy.direction || 'asc'));
  }

  if (options.cursor) {
    constraints.push(startAfter(options.cursor));
  }

  async function create(data = {}) {
    const user = getCurrentUser();
    const userUid = getCurrentUserUid();
    const normalized = normalizeData(data);
    const payload = {
      ...normalized,
      ownerUid: normalized.ownerUid || userUid || null,
      status: normalized.status || 'active',
    };

    if (entityName === 'User' && (payload.uid || userUid)) {
      const id = payload.uid || userUid;
      const { payload: auditedPayload } = await mutations.set(doc(db, collectionName, id), { ...payload, uid: id }, { merge: true });
      return { id, ...auditedPayload, uid: id };
    }

    return serializeDocSnapshot(snapshot);
  };

  const list = async (options) => {
    if (!options || Object.keys(options).length === 0) {
      const snapshot = await getDocs(collectionRef);
      return serializeQuerySnapshot(snapshot);
    }

    if (entityName === 'CompanyMember') {
      payload.userEmail = payload.userEmail || user?.email || '';
      payload.userUid = payload.userUid || (payload.userEmail === user?.email ? userUid : null);
      payload.role = payload.role || 'invitado';
      payload.companyId = payload.companyId || null;
      payload.status = payload.status || 'active';

      const docId = payload.companyId && payload.userUid
        ? `${payload.companyId}_${payload.userUid}`
        : payload.companyId && payload.userEmail
          ? `${payload.companyId}_${payload.userEmail.toLowerCase().replace(/[^a-z0-9._-]/g, '_')}`
          : null;

      if (docId) {
        const { payload: auditedPayload } = await mutations.set(doc(db, collectionName, docId), payload, { merge: true });
        return { id: docId, ...auditedPayload };
      }

      if (value) constraints.push(firestoreLimit(value));

      const snapshot = await getDocs(constraints.length ? query(collectionRef, ...constraints) : collectionRef);
      return serializeQuerySnapshot(snapshot);
    }

    const { refDoc, payload: auditedPayload } = await mutations.add(col(), payload);
    return { id: refDoc.id, ...auditedPayload };
  }

  async function createWithId(id, data = {}) {
    const safeId = String(id || '').trim();
    if (!safeId) throw new Error('No se puede crear el registro sin ID.');

    const userUid = getCurrentUserUid();
    const normalized = normalizeData(data);
    const payload = {
      ...normalized,
      ownerUid: normalized.ownerUid || userUid || null,
      status: normalized.status || 'active',
    };

    const { payload: auditedPayload } = await mutations.set(doc(db, collectionName, safeId), payload);
    return { id: safeId, ...auditedPayload };
  }

  async function bulkCreate(items = []) {
    if (!Array.isArray(items) || items.length === 0) return [];
    const batch = writeBatch(db);
    const created = [];
    const userUid = getCurrentUserUid();

    items.forEach((item) => {
      const refDoc = doc(col());
      const payload = {
        ...normalizeData(item),
        ownerUid: item.ownerUid || userUid,
        status: item.status || 'active',
      };
      const auditedPayload = mutations.batchSet(batch, refDoc, payload);
      created.push({ id: refDoc.id, ...auditedPayload });
    });

    const documentRef = await addDoc(collectionRef, dataWithAudit);

  async function update(id, data = {}) {
    const { payload } = await mutations.update(doc(db, collectionName, id), normalizeData(data));
    return { id, ...payload };
  }

  async function softDelete(id) {
    const userUid = getCurrentUserUid();
    const payload = {
      status: 'archived',
      deletedAt: nowIso(),
      deletedBy: userUid,
    };
    const { payload: auditedPayload } = await mutations.update(doc(db, collectionName, id), payload);
    return { id, ...auditedPayload };
  }

  return {
    get: getById,
    getById,
    list,
    filter,
    create,
    createWithId,
    bulkCreate,
    update,
    softDelete,
    newId,
    delete: softDelete,
  };
};

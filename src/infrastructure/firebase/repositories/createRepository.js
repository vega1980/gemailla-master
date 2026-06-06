// @ts-check

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

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

  function newId() {
    return doc(col()).id;
  }

  async function list(options = {}) {
    const snapshot = await getDocs(col());
    const records = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    return entityName === 'User' ? records : keepVisibleRecords(records, options.includeArchived);
  }

  async function filter(filters = {}, orderByField = null, limitCount = null, options = {}) {
    const normalizedFilters = normalizeFilters(filters);
    const constraints = [];

    for (const [key, value] of Object.entries(normalizedFilters)) {
      if (value !== undefined && value !== null && value !== 'all') {
        constraints.push(where(key, '==', value));
      }
    }

    if (orderByField) {
      const direction = String(orderByField).startsWith('-') ? 'desc' : 'asc';
      const field = normalizeKey(String(orderByField).replace(/^-/, ''));
      constraints.push(orderBy(field, direction));
    }

    if (limitCount) constraints.push(limit(limitCount));

    const q = constraints.length ? query(col(), ...constraints) : col();
    const snapshot = await getDocs(q);
    const records = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    return ('status' in normalizedFilters) || entityName === 'User'
      ? records
      : keepVisibleRecords(records, options.includeArchived);
  }

  async function getRaw(id) {
    const snap = await getDoc(doc(db, collectionName, id));
    return serializeDocument(snap);
  }

  async function get(id, options = {}) {
    const record = await getRaw(id);
    return options.includeArchived || !isArchivedRecord(record) ? record : null;
  }

  async function create(data = {}) {
    const user = getCurrentUser();
    const userUid = getCurrentUserUid();
    const normalized = normalizeData(data);
    const payload = {
      ...normalized,
      ownerUid: normalized.ownerUid || userUid || null,
      createdAt: normalized.createdAt || nowIso(),
      updatedAt: nowIso(),
      status: normalized.status || 'active',
    };

    if (entityName === 'User' && (payload.uid || userUid)) {
      const id = payload.uid || userUid;
      await setDoc(doc(db, collectionName, id), { ...payload, uid: id }, { merge: true });
      return { id, ...payload, uid: id };
    }

    if (entityName === 'Company') {
      payload.ownerUid = userUid || payload.ownerUid || null;
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
        await setDoc(doc(db, collectionName, docId), payload, { merge: true });
        return { id: docId, ...payload };
      }
    }

    const refDoc = await addDoc(col(), payload);
    return { id: refDoc.id, ...payload };
  }

  async function createWithId(id, data = {}) {
    const safeId = String(id || '').trim();
    if (!safeId) throw new Error('No se puede crear el registro sin ID.');

    const userUid = getCurrentUserUid();
    const normalized = normalizeData(data);
    const payload = {
      ...normalized,
      ownerUid: normalized.ownerUid || userUid || null,
      createdAt: normalized.createdAt || nowIso(),
      updatedAt: nowIso(),
      status: normalized.status || 'active',
    };

    await setDoc(doc(db, collectionName, safeId), payload);
    return { id: safeId, ...payload };
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
        createdAt: item.createdAt || nowIso(),
        updatedAt: nowIso(),
        status: item.status || 'active',
      };
      batch.set(refDoc, payload);
      created.push({ id: refDoc.id, ...payload });
    });

    await batch.commit();
    return created;
  }

  async function update(id, data = {}) {
    const payload = {
      ...normalizeData(data),
      updatedAt: nowIso(),
    };
    await updateDoc(doc(db, collectionName, id), payload);
    return { id, ...payload };
  }

  async function softDelete(id) {
    const userUid = getCurrentUserUid();
    const payload = {
      status: 'archived',
      deletedAt: nowIso(),
      deletedBy: userUid,
      updatedAt: nowIso(),
    };
    await updateDoc(doc(db, collectionName, id), payload);
    return { id, ...payload };
  }

  return {
    list,
    filter,
    get,
    getRaw,
    newId,
    create,
    createWithId,
    bulkCreate,
    update,
    softDelete,
    delete: softDelete,
  };
}

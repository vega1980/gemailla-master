import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  writeBatch
} from 'firebase/firestore';
import { db } from '@/firebase';
import { createAuditMutationMiddleware } from '@/infrastructure/firebase/mutations/auditMutationMiddleware';

/**
 * Generador de repositorio CRUD genérico y agnóstico al dominio.
 * @param {string} collectionName
 */
export const createRepository = (collectionName) => {
  const collectionRef = collection(db, collectionName);
  const auditMiddleware = createAuditMutationMiddleware();

  const serializeSnapshot = (snapshot) => snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));

  const normalizeFilters = (filters = {}) => Object.entries(filters)
    .filter(([, filterValue]) => filterValue !== undefined && filterValue !== null && filterValue !== 'all' && filterValue !== '')
    .flatMap(([filterField, filterValue]) => {
      const values = Array.isArray(filterValue) ? filterValue : [filterValue];
      return values
        .filter((currentValue) => currentValue !== undefined && currentValue !== null && currentValue !== 'all' && currentValue !== '')
        .map((currentValue) => {
          if (currentValue && typeof currentValue === 'object') {
            return where(filterField, currentValue.operator || currentValue.op || '==', currentValue.value);
          }
          return where(filterField, '==', currentValue);
        });
    });

  const normalizeOrder = (sort) => {
    if (!sort) return null;
    const direction = String(sort).startsWith('-') ? 'desc' : 'asc';
    return orderBy(String(sort).replace(/^-/, ''), direction);
  };

  const newId = () => doc(collectionRef).id;

  const softDelete = async (id) => {
    const docRef = doc(db, collectionName, id);
    const deleteData = auditMiddleware.withUpdateAuditFields({
      deleted: true,
      deletedAt: new Date().toISOString()
    });
    await updateDoc(docRef, deleteData);
    return { id, ...deleteData };
  };

  return {
    get: async (id) => {
      const docRef = doc(db, collectionName, id);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    },

    list: async () => {
      const snapshot = await getDocs(collectionRef);
      return serializeSnapshot(snapshot);
    },

    filter: async (field, operator, value) => {
      if (field && typeof field === 'object' && !Array.isArray(field)) {
        /** @type {import('firebase/firestore').QueryConstraint[]} */
        const constraints = normalizeFilters(field);
        const sortConstraint = normalizeOrder(operator);
        if (sortConstraint) constraints.push(sortConstraint);

        if (value) constraints.push(limit(value));

        const snapshot = await getDocs(constraints.length ? query(collectionRef, ...constraints) : collectionRef);
        return serializeSnapshot(snapshot);
      }

      const q = query(collectionRef, where(field, operator, value));
      const snapshot = await getDocs(q);
      return serializeSnapshot(snapshot);
    },


    paginate: async ({ filters = {}, orderBy: sort, limit: pageSize = 25, cursor = null } = {}) => {
      const constraints = normalizeFilters(filters);
      const sortConstraint = normalizeOrder(sort);
      if (sortConstraint) constraints.push(sortConstraint);
      if (cursor) constraints.push(startAfter(cursor));
      constraints.push(limit(pageSize + 1));

      const snapshot = await getDocs(query(collectionRef, ...constraints));
      const docs = snapshot.docs.slice(0, pageSize);
      const hasMore = snapshot.docs.length > pageSize;

      return {
        items: docs.map((item) => ({ id: item.id, ...item.data() })),
        cursor: docs.length ? docs[docs.length - 1] : null,
        hasMore,
      };
    },

    create: async (data) => {
      const dataWithAudit = auditMiddleware.withCreateAuditFields(data);
      const docRef = await addDoc(collectionRef, dataWithAudit);
      return { id: docRef.id, ...dataWithAudit };
    },

    createWithId: async (id, data) => {
      const docRef = doc(db, collectionName, id);
      const dataWithAudit = auditMiddleware.withCreateAuditFields(data);
      await setDoc(docRef, dataWithAudit);
      return { id, ...dataWithAudit };
    },

    bulkCreate: async (items = []) => {
      if (!Array.isArray(items) || items.length === 0) return [];

      const batch = writeBatch(db);
      const created = items.map((item) => {
        const docRef = doc(collectionRef);
        const dataWithAudit = auditMiddleware.withCreateAuditFields(item);
        batch.set(docRef, dataWithAudit);
        return { id: docRef.id, ...dataWithAudit };
      });

      await batch.commit();
      return created;
    },

    update: async (id, data) => {
      const docRef = doc(db, collectionName, id);
      const dataWithAudit = auditMiddleware.withUpdateAuditFields(data);
      await updateDoc(docRef, dataWithAudit);
      return { id, ...dataWithAudit };
    },

    softDelete,

    newId,

    // Alias legacy explícito: las reglas de Firebase bloquean borrado físico,
    // así que `delete` conserva el contrato anterior delegando en softDelete.
    delete: softDelete
  };
};

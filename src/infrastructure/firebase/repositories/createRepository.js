import {
  addDoc,
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit as firestoreLimit,
  orderBy,
  query,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '@/firebase';
import { createAuditMutationMiddleware } from '@/infrastructure/firebase/mutations/auditMutationMiddleware';
import { normalizeObjectFilters } from '@/infrastructure/firebase/repositories/filterValidation';
import { ensureCorrelationId, logFrontendEvent } from '@/lib/observability';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const MAX_BATCH_SIZE = 450;
const MAX_IN_QUERY_VALUES = 30;
const ABORT_ERROR_NAME = 'AbortError';
const DOCUMENT_ID_ORDER_FIELD = documentId();

function normalizeLimit(value) {
  const parsed = Number(value || DEFAULT_PAGE_SIZE);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(parsed, MAX_PAGE_SIZE);
}

export function chunkArray(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw new DOMException('Firestore batch query aborted', ABORT_ERROR_NAME);
}

function isAbortError(error) {
  return error?.name === ABORT_ERROR_NAME || error?.message === 'Aborted';
}

function nowMs() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function normalizeParentCorrelationId(parentCorrelationId) {
  return parentCorrelationId ? ensureCorrelationId(parentCorrelationId, 'parent') : undefined;
}

function createBatchQueryMetrics(collectionName, operation, requestedCount, chunkCount, correlationId, parentCorrelationId) {
  const startTime = nowMs();
  const normalizedCorrelationId = ensureCorrelationId(correlationId, 'batch');
  const normalizedParentCorrelationId = normalizeParentCorrelationId(parentCorrelationId);

  return {
    completed(returnedCount) {
      logFrontendEvent('batch_query_completed', {
        correlationId: normalizedCorrelationId,
        parentCorrelationId: normalizedParentCorrelationId,
        collection: collectionName,
        operation,
        requestedCount,
        returnedCount,
        durationMs: Math.round(nowMs() - startTime),
        chunks: chunkCount,
      });
    },
    failed(error) {
      logFrontendEvent('batch_query_failed', {
        correlationId: normalizedCorrelationId,
        parentCorrelationId: normalizedParentCorrelationId,
        collection: collectionName,
        operation,
        requestedCount,
        durationMs: Math.round(nowMs() - startTime),
        chunks: chunkCount,
        error: error?.message || 'Unknown batch query error',
      }, 'error');
    },
    aborted() {
      logFrontendEvent('batch_query_aborted', {
        correlationId: normalizedCorrelationId,
        parentCorrelationId: normalizedParentCorrelationId,
        collection: collectionName,
        operation,
        requestedCount,
        durationMs: Math.round(nowMs() - startTime),
        chunks: chunkCount,
      }, 'warn');
    },
  };
}

function serializeDocSnapshot(snapshot) {
  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

function isArchivedRecord(record) {
  return record?.status === 'archived' || record?.deleted === true;
}

function filterActiveRecords(records) {
  return records.filter((record) => !isArchivedRecord(record));
}

function serializeQuerySnapshot(snapshot) {
  return filterActiveRecords(snapshot.docs.map(serializeDocSnapshot));
}

function buildQuery(collectionRef, options = {}) {
  /** @type {import('firebase/firestore').QueryConstraint[]} */
  const constraints = [];

  if (Array.isArray(options.where)) {
    for (const condition of options.where) {
      constraints.push(where(condition.field, condition.operator, condition.value));
    }
  }

  const orderClauses = Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy].filter(Boolean);
  for (const orderClause of orderClauses) {
    constraints.push(orderBy(orderClause.field, orderClause.direction || 'asc'));
  }

  if (options.cursor) {
    constraints.push(startAfter(options.cursor));
  }

  constraints.push(firestoreLimit(normalizeLimit(options.limit)));

  return query(collectionRef, ...constraints);
}

function requireCompanyId(companyId, operation) {
  const normalizedCompanyId = String(companyId || '').trim();
  if (!normalizedCompanyId) {
    throw new Error(`${operation} requiere companyId explícito.`);
  }
  return normalizedCompanyId;
}

function isDocumentIdOrderClause(orderClause) {
  return orderClause?.field === DOCUMENT_ID_ORDER_FIELD || orderClause?.field === '__name__';
}

function normalizeOrderBy(orderByOption) {
  const clauses = Array.isArray(orderByOption)
    ? [...orderByOption]
    : orderByOption
      ? [orderByOption]
      : [{ field: 'createdAt', direction: 'desc' }];

  if (!clauses.some(isDocumentIdOrderClause)) {
    clauses.push({ field: DOCUMENT_ID_ORDER_FIELD, direction: clauses.at(-1)?.direction || 'desc' });
  }

  return clauses;
}

function normalizeDomainListOptions(options = {}) {
  const normalizedOptions = {
    ...options,
    where: Array.isArray(options.where) ? options.where : [],
    limit: normalizeLimit(options.limit),
    orderBy: normalizeOrderBy(options.orderBy),
  };

  return normalizedOptions;
}

function assertBoundedListOptions(options, operation) {
  const hasWhere = Array.isArray(options?.where) && options.where.length > 0;
  const hasLimit = options?.limit !== undefined && options?.limit !== null;
  const normalizedOrderClauses = normalizeOrderBy(options?.orderBy);
  const hasStableOrder = normalizedOrderClauses.some(isDocumentIdOrderClause);

  if (!hasWhere || !hasLimit || !hasStableOrder) {
    throw new Error(`${operation} requiere filtros, límite explícito y orden estable con desempate por documentId.`);
  }
}

function buildCompanyOptions(companyId, options = {}, extraWhere = []) {
  const normalizedCompanyId = requireCompanyId(companyId, 'La consulta por compañía');
  const normalizedOptions = normalizeDomainListOptions(options);

  return {
    ...normalizedOptions,
    where: [
      { field: 'companyId', operator: '==', value: normalizedCompanyId },
      ...extraWhere,
      ...normalizedOptions.where,
    ],
  };
}

export const createRepository = (collectionName) => {
  const collectionRef = collection(db, collectionName);
  const auditMiddleware = createAuditMutationMiddleware({
    getCurrentUserUid: () => auth.currentUser?.uid || null,
    nowIso: () => new Date().toISOString(),
  });

  const newId = () => doc(collectionRef).id;

  const getById = async (id) => {
    const snapshot = await getDoc(doc(db, collectionName, id));

    if (!snapshot.exists()) {
      return null;
    }

    return serializeDocSnapshot(snapshot);
  };


  const getMany = async (ids = [], options = {}) => {
    if (!Array.isArray(ids)) {
      throw new TypeError('getMany espera un arreglo de ids');
    }

    const uniqueIds = [...new Set(ids.filter(Boolean).map(String))];
    if (uniqueIds.length === 0) return [];

    const { signal } = options;
    const correlationId = ensureCorrelationId(options.correlationId, 'batch');
    const idChunks = chunkArray(uniqueIds, MAX_IN_QUERY_VALUES);
    const metrics = createBatchQueryMetrics(collectionName, 'getMany', uniqueIds.length, idChunks.length, correlationId, options.parentCorrelationId);
    const results = [];

    try {
      for (const idChunk of idChunks) {
        throwIfAborted(signal);
        const snapshots = await Promise.all(idChunk.map((id) => getDoc(doc(db, collectionName, id))));
        throwIfAborted(signal);
        results.push(...filterActiveRecords(snapshots.filter((snapshot) => snapshot.exists()).map(serializeDocSnapshot)));
      }
    } catch (error) {
      if (isAbortError(error)) {
        metrics.aborted();
        return [];
      }
      metrics.failed(error);
      throw error;
    }

    const resultsById = new Map(results.map((record) => [record.id, record]));
    const orderedResults = uniqueIds.map((id) => resultsById.get(id)).filter(Boolean);
    metrics.completed(orderedResults.length);
    return orderedResults;
  };

  const filterIn = async (field, values = [], filters = {}, options = {}) => {
    if (!Array.isArray(values)) {
      throw new TypeError('filterIn espera un arreglo de valores');
    }

    const uniqueValues = [...new Set(values.filter(Boolean))];
    if (uniqueValues.length === 0) return [];

    const extraFilters = normalizeObjectFilters(filters, collectionName)
      .filter(([filterField]) => filterField !== field);
    const { signal } = options;
    const correlationId = ensureCorrelationId(options.correlationId, 'batch');
    const valueChunks = chunkArray(uniqueValues, MAX_IN_QUERY_VALUES);
    const metrics = createBatchQueryMetrics(collectionName, 'filterIn', uniqueValues.length, valueChunks.length, correlationId, options.parentCorrelationId);
    const results = [];

    try {
      for (const valueChunk of valueChunks) {
        throwIfAborted(signal);
        const constraints = [where(field, 'in', valueChunk)];
        extraFilters.forEach(([filterField, filterValue]) => {
          constraints.push(where(filterField, '==', filterValue));
        });
        const snapshot = await getDocs(query(collectionRef, ...constraints));
        throwIfAborted(signal);
        results.push(...serializeQuerySnapshot(snapshot));
      }
    } catch (error) {
      if (isAbortError(error)) {
        metrics.aborted();
        return [];
      }
      metrics.failed(error);
      throw error;
    }

    const resultsById = new Map(results.map((record) => [record.id, record]));
    const dedupedResults = Array.from(resultsById.values());
    metrics.completed(dedupedResults.length);
    return dedupedResults;
  };

  /**
   * @deprecated Usa listByCompany, listPageByCompany o findByCompanyAndStatus.
   * list() solo se conserva para llamadas legacy con opciones explícitas y acotadas.
   */
  const list = async (options) => {
    if (!options || Object.keys(options).length === 0) {
      throw new Error(`Lectura no acotada bloqueada: ${collectionName}.list() requiere filtros, límite y orden explícitos.`);
    }
    assertBoundedListOptions(options, `${collectionName}.list()`);
    const normalizedOptions = normalizeDomainListOptions(options);

    const snapshot = await getDocs(buildQuery(collectionRef, normalizedOptions));
    const pageSize = normalizedOptions.limit;

    return {
      items: serializeQuerySnapshot(snapshot),
      lastCursor: snapshot.docs.at(-1) || null,
      hasMore: snapshot.docs.length === pageSize,
    };
  };

  const listByCompany = (companyId, options = {}) => list(buildCompanyOptions(companyId, options));

  const listByFilters = (filters, options = {}) => {
    const normalizedFilters = normalizeObjectFilters(filters, collectionName);

    if (normalizedFilters.length === 0) {
      throw new Error(`${collectionName}.listByFilters() requiere filtros explícitos.`);
    }

    return list({
      where: normalizedFilters.map(([filterField, filterValue]) => ({
        field: filterField,
        operator: '==',
        value: filterValue,
      })),
      limit: normalizeLimit(options.limit),
      orderBy: options.orderBy || {
        field: DOCUMENT_ID_ORDER_FIELD,
        direction: 'asc',
      },
      cursor: options.cursor || null,
    });
  };

  const listPageByCompany = (companyId, cursor = null, limit = DEFAULT_PAGE_SIZE) => list(buildCompanyOptions(companyId, {
    cursor,
    limit,
  }));

  const findByCompanyAndStatus = (companyId, status, options = {}) => {
    const normalizedStatus = String(status || '').trim();
    if (!normalizedStatus) throw new Error('findByCompanyAndStatus requiere status explícito.');

    return list(buildCompanyOptions(companyId, options, [
      { field: 'status', operator: '==', value: normalizedStatus },
    ]));
  };

  const filter = async (field, operator, value) => {
    if (field && typeof field === 'object' && !Array.isArray(field)) {
      const normalizedFilters = normalizeObjectFilters(field, collectionName);

      if (normalizedFilters.length === 0) {
        throw new Error(`${collectionName}.filter() requiere filtros explícitos.`);
      }

      /** @type {import('firebase/firestore').QueryConstraint[]} */
      const constraints = normalizedFilters
        .map(([filterField, filterValue]) => where(filterField, '==', filterValue));

      if (operator) {
        const normalizedOrder = String(operator);
        const direction = normalizedOrder.startsWith('-') ? 'desc' : 'asc';
        constraints.push(orderBy(normalizedOrder.replace(/^-/, ''), direction));
      }

      constraints.push(firestoreLimit(normalizeLimit(value)));

      const snapshot = await getDocs(query(collectionRef, ...constraints));
      return serializeQuerySnapshot(snapshot);
    }

    const snapshot = await getDocs(
      query(
        collectionRef,
        where(field, operator, value),
        firestoreLimit(DEFAULT_PAGE_SIZE),
      ),
    );
    return serializeQuerySnapshot(snapshot);
  };

  const create = async (data, id = null) => {
    const dataWithAudit = auditMiddleware.withCreateAuditFields(data);

    if (id) {
      const documentRef = doc(db, collectionName, id);
      await setDoc(documentRef, dataWithAudit);

      return {
        id,
        ...dataWithAudit,
      };
    }

    const documentRef = await addDoc(collectionRef, dataWithAudit);

    return {
      id: documentRef.id,
      ...dataWithAudit,
    };
  };

  const createWithId = (id, data) => create(data, id);

  const update = async (id, data) => {
    const documentRef = doc(db, collectionName, id);
    const dataWithAudit = auditMiddleware.withUpdateAuditFields(data);
    await updateDoc(documentRef, dataWithAudit);

    return {
      id,
      ...dataWithAudit,
    };
  };

  const bulkCreate = async (items = []) => {
    if (!Array.isArray(items)) {
      throw new TypeError('bulkCreate espera un arreglo');
    }

    if (items.length === 0) return [];

    const created = [];

    for (const chunk of chunkArray(items, MAX_BATCH_SIZE)) {
      const batch = writeBatch(db);

      for (const item of chunk) {
        const documentRef = doc(collectionRef);
        const dataWithAudit = auditMiddleware.withCreateAuditFields(item);
        batch.set(documentRef, dataWithAudit);
        created.push({ id: documentRef.id, ...dataWithAudit });
      }

      await batch.commit();
    }

    return created;
  };

  const archive = async (id) => {
    const archiveData = auditMiddleware.withUpdateAuditFields({
      status: 'archived',
      archivedAt: new Date().toISOString(),
    });

    await updateDoc(doc(db, collectionName, id), archiveData);
    return { id, ...archiveData };
  };

  return {
    get: getById,
    getById,
    getMany,
    filterIn,
    list,
    listByFilters,
    listByCompany,
    listPageByCompany,
    findByCompanyAndStatus,
    filter,
    create,
    createWithId,
    bulkCreate,
    update,
    archive,
    newId,
  };
};

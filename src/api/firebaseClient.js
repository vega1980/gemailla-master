import app, { auth, db, storage } from '@/firebase';
export { app, auth, db, storage } from '@/firebase';

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

const ENTITY_COLLECTIONS = Object.freeze({
  User: 'users',
  Company: 'companies',
  CompanyMember: 'companyMembers',
  Document: 'documents',
  Transaction: 'transactions',
  AuditLog: 'auditLogs',
  CRMClient: 'crmClients',
  CRMDeal: 'crmDeals',
  CRMInteraction: 'crmInteractions',
  Employee: 'employees',
  Payroll: 'payroll',
  PerformanceReview: 'performanceReviews',
  KPI: 'kpis',
  Subscription: 'subscriptions',
  PredictionLog: 'predictionLogs',
  AIConversation: 'aiConversations',
  Project: 'projects',
  ProjectTask: 'projectTasks',
  SupportTicket: 'supportTickets',
});

const LEGACY_FIELD_MAP = Object.freeze({
  company_id: 'companyId',
  client_id: 'clientId',
  project_id: 'projectId',
  employee_id: 'employeeId',
  owner_uid: 'ownerUid',
  user_email: 'userEmail',
  user_name: 'userName',
  full_name: 'fullName',
  created_date: 'createdAt',
  updated_date: 'updatedAt',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  start_date: 'startDate',
  end_date: 'endDate',
  due_date: 'dueDate',
  doc_type: 'docType',
  doc_date: 'docDate',
  content_type: 'contentType',
  size_bytes: 'fileSize',
  fiscal_regime: 'fiscalRegime',
  payment_date: 'paymentDate',
  payment_method: 'paymentMethod',
  employee_name: 'employeeName',
  assigned_to: 'assignedTo',
  base_salary: 'baseSalary',
  net_pay: 'netPay',
  billing_cycle: 'billingCycle',
  expected_close: 'expectedClose',
  last_contact: 'lastContact',
  next_action: 'nextAction',
  next_action_date: 'nextActionDate',
  estimated_hours: 'estimatedHours',
  estimated_cost: 'estimatedCost',
  error_message: 'errorMessage',
  review_date: 'reviewDate',
  overall_rating: 'overallRating',
  imss_number: 'imssNumber',
  hire_date: 'hireDate',
  employment_type: 'employmentType',
  bank_account: 'bankAccount',
  is_recurring: 'isRecurring',
});

const ALLOWED_UPLOAD_TYPES = new Set([
  'application/pdf',
  'text/xml',
  'application/xml',
]);

const MAX_UPLOAD_SIZE = 15 * 1024 * 1024;

export const DOCUMENT_STATUSES = Object.freeze({
  UPLOADED: 'uploaded',
  PENDING: 'pending',
  PROCESSING: 'processing',
  ANALYZED: 'analyzed',
  ERROR: 'error',
  ARCHIVED: 'archived',
  AI_DISABLED: 'ai_disabled',
});

const AI_DISABLED_RESPONSE_STATUSES = new Set([
  'disabled',
  DOCUMENT_STATUSES.AI_DISABLED,
]);

export function isAiDisabledResponse(response = {}) {
  if (!response || typeof response !== 'object') return false;

  if (response.disabled === true) return true;
  if (typeof response.status === 'string' && AI_DISABLED_RESPONSE_STATUSES.has(response.status)) return true;
  if (response.documentStatus === DOCUMENT_STATUSES.AI_DISABLED) return true;

  const nestedResponse = response.data || response.result;
  return nestedResponse && nestedResponse !== response
    ? isAiDisabledResponse(nestedResponse)
    : false;
}

function nowIso() {
  return new Date().toISOString();
}

function getCurrentUser() {
  return auth.currentUser || null;
}

function getCurrentUserUid() {
  const user = getCurrentUser();
  return user?.uid || user?.id || null;
}

function sanitizeFileName(name = 'archivo') {
  return String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 160) || 'archivo';
}

function sanitizePathSegment(value, fallback) {
  return sanitizeFileName(value).replace(/\.+/g, '.').replace(/^\.+|\.+$/g, '') || fallback;
}

function isArchivedRecord(record) {
  return record?.status === DOCUMENT_STATUSES.ARCHIVED || record?.status === 'archived';
}

function keepVisibleRecords(records, includeArchived = false) {
  return includeArchived ? records : records.filter((item) => !isArchivedRecord(item));
}

function normalizeKey(key) {
  return LEGACY_FIELD_MAP[key] || key;
}

function normalizeData(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;

  const output = {};
  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = normalizeKey(rawKey);
    const value = rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)
      ? normalizeData(rawValue)
      : rawValue;
    output[key] = value;
  }

  delete output.fileUrl;
  delete output.downloadUrl;
  delete output.downloadURL;
  delete output.file_url;
  delete output.publicUrl;

  return output;
}

function normalizeFilters(filters = {}) {
  return normalizeData(filters);
}

function withAuditFields(data = {}, mode = 'create') {
  const user = getCurrentUser();
  const userUid = getCurrentUserUid();
  const timestamp = nowIso();
  const payload = normalizeData(data);

  if (mode === 'create') {
    payload.createdAt = payload.createdAt || timestamp;
    payload.status = payload.status || 'active';
    if (userUid && !payload.ownerUid) payload.ownerUid = userUid;
    if (user?.email && !payload.userEmail && ['CompanyMember'].includes(payload.entityName)) payload.userEmail = user.email;
  }

  payload.updatedAt = timestamp;
  return payload;
}

function serializeDocument(snapshot) {
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function getAuthHeader() {
  const user = getCurrentUser();
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

function aiDisabledPayload(reason = 'Las funciones de IA están desactivadas porque no hay backend seguro configurado.') {
  return {
    disabled: true,
    status: 'disabled',
    documentStatus: DOCUMENT_STATUSES.AI_DISABLED,
    message: reason,
    summary: reason,
    response: reason,
  };
}

async function invokeLLM(params = {}) {
  const endpoint = import.meta.env.VITE_LLM_ENDPOINT;
  const frontendOpenAiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (frontendOpenAiKey) {
    return aiDisabledPayload('IA no configurada: no se permite exponer claves privadas directamente en el navegador. Usa un backend seguro.');
  }

  if (!endpoint) {
    return aiDisabledPayload('IA no configurada: configura VITE_LLM_ENDPOINT apuntando a un backend seguro.');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await getAuthHeader()),
    },
    body: JSON.stringify(params),
  });

  const raw = await response.text();
  let payload = {};
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch (_error) {
      payload = { message: raw };
    }
  }

  if (!response.ok) {
    const message = payload?.error || payload?.message || `Error HTTP ${response.status} al llamar IA.`;
    throw new Error(message);
  }

  return payload?.data || payload?.result || payload;
}

async function extractDataFromUploadedFile() {
  return {
    status: 'disabled',
    output: [],
    details: 'La extracción automática de archivos requiere backend seguro. El módulo queda degradado sin romper la app.',
  };
}

async function uploadFile({ file, companyId, documentId, folder = 'documents' } = {}) {
  if (!file) throw new Error('No se recibió ningún archivo para subir.');

  const user = getCurrentUser();
  if (!user) throw new Error('Debes iniciar sesión para subir archivos.');

  if (file.size > MAX_UPLOAD_SIZE) {
    throw new Error('El archivo supera el límite permitido de 15MB.');
  }

  const contentType = file.type || 'application/octet-stream';
  const extension = String(file.name || '').split('.').pop()?.toLowerCase();
  const looksLikeXml = ['xml'].includes(extension);
  const looksLikePdf = ['pdf'].includes(extension);

  if (!ALLOWED_UPLOAD_TYPES.has(contentType) && !looksLikeXml && !looksLikePdf) {
    throw new Error('Formato no permitido. Solo se aceptan archivos PDF o XML.');
  }

  const safeName = sanitizeFileName(file.name);
  const safeCompanyId = sanitizePathSegment(String(companyId || '').trim(), '');
  if (!safeCompanyId) {
    throw new Error('No se puede subir el archivo sin una empresa activa. Falta companyId.');
  }

  const safeFolder = folder === 'documents' ? 'documents' : 'documents';
  const safeDocumentId = sanitizePathSegment(documentId || '', '');
  if (!safeDocumentId) {
    throw new Error('No se puede subir el archivo sin un ID de documento preasignado.');
  }
  const storagePath = `companies/${safeCompanyId}/${safeFolder}/${safeDocumentId}/${safeName}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file, { contentType });

  return {
    storagePath,
    fileName: file.name,
    contentType,
    fileSize: file.size,
  };
}

async function getDocumentAccessUrl(storagePath) {
  const safeStoragePath = String(storagePath || '').trim();
  if (!safeStoragePath) {
    throw new Error('No se puede abrir el documento sin storagePath.');
  }

  const allowedDocumentPath = /^companies\/[^/]+\/documents\/[^/]+\/.+$/;
  if (!allowedDocumentPath.test(safeStoragePath) || /^https?:\/\//i.test(safeStoragePath)) {
    throw new Error('Ruta de documento inválida. Usa storagePath interno, no URLs públicas.');
  }

  const fileRef = ref(storage, safeStoragePath);
  return getDownloadURL(fileRef);
}

async function invokeFunction(name, payload = {}) {
  const endpoint = import.meta.env.VITE_FUNCTIONS_ENDPOINT || import.meta.env.VITE_LLM_ENDPOINT;
  if (!endpoint) {
    return {
      data: {
        success: false,
        disabled: true,
        message: `Función ${name} desactivada: falta backend seguro.`,
        results: {},
      },
    };
  }

  const response = await fetch(`${endpoint.replace(/\/$/, '')}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await getAuthHeader()),
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || data?.message || `No se pudo ejecutar ${name}.`);
  return { data };
}

const connectors = {
  connectAppUser: async () => {
    throw new Error('Conectores externos desactivados: requiere backend seguro.');
  },
  disconnectAppUser: async () => ({ success: true, disabled: true }),
};

const agents = {
  createConversation: async ({ metadata = {}, agent_name: agentName = 'assistant' } = {}) => {
    const payload = withAuditFields({
      agentName,
      metadata,
      ownerUid: getCurrentUserUid(),
      messages: [],
      status: 'active',
    });
    const refDoc = await addDoc(collection(db, 'aiConversations'), payload);
    return { id: refDoc.id, ...payload };
  },

  addMessage: async (conversation, message) => {
    const conversationId = typeof conversation === 'string' ? conversation : conversation?.id;
    if (!conversationId) throw new Error('Conversación inválida.');

    const refDoc = doc(db, 'aiConversations', conversationId);
    const snap = await getDoc(refDoc);
    const current = snap.exists() ? snap.data() : {};
    const messages = Array.isArray(current.messages) ? [...current.messages] : [];
    messages.push({ ...message, createdAt: nowIso() });

    if (message?.role === 'user') {
      const aiResponse = await invokeLLM({ prompt: message.content });
      messages.push({
        role: 'assistant',
        content: typeof aiResponse === 'string' ? aiResponse : aiResponse?.response || aiResponse?.message || 'IA desactivada temporalmente.',
        createdAt: nowIso(),
      });
    }

    await updateDoc(refDoc, { messages, updatedAt: nowIso() });
    return { id: conversationId, messages };
  },

  subscribeToConversation: (conversationId, callback) => {
    if (!conversationId) return () => {};
    return onSnapshot(doc(db, 'aiConversations', conversationId), (snap) => {
      callback(snap.exists() ? { id: snap.id, ...snap.data() } : { id: conversationId, messages: [] });
    });
  },
};

function createRepository(entityName, collectionName) {
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

export const firebase = {
  entities: Object.fromEntries(
    Object.entries(ENTITY_COLLECTIONS).map(([entityName, collectionName]) => [
      entityName,
      createRepository(entityName, collectionName),
    ]),
  ),
  integrations: {
    Core: {
      InvokeLLM: invokeLLM,
      UploadFile: uploadFile,
      GetDocumentAccessUrl: getDocumentAccessUrl,
      ExtractDataFromUploadedFile: extractDataFromUploadedFile,
    },
  },
  functions: {
    invoke: invokeFunction,
  },
  connectors,
  agents,
  auth: {
    me: async () => {
      const user = getCurrentUser();
      if (!user) return null;
      const userUid = getCurrentUserUid();
      return {
        id: userUid,
        uid: userUid,
        email: user.email,
        fullName: user.displayName || user.email,
        role: 'user',
      };
    },
    logout: async (redirectUrl) => {
      await auth.signOut();
      if (redirectUrl) window.location.href = redirectUrl;
    },
  },
  collections: ENTITY_COLLECTIONS,
};

export default firebase;

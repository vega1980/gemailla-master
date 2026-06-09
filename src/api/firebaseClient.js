import { auth, db } from '@/firebase';
export { default as app, auth, db, storage } from '@/firebase';
import { DOCUMENT_STATUSES, AI_DISABLED_RESPONSE_STATUSES } from '@/features/documents/constants/documentStatuses';
import { ENTITY_COLLECTIONS } from '@/infrastructure/firebase/repositories/entityCollections';
import { normalizeData, normalizeFilters, normalizeKey } from '@/infrastructure/firebase/repositories/normalization';
import { createRepository } from '@/infrastructure/firebase/repositories/createRepository';
import { getDocumentAccessUrl, uploadFile } from '@/infrastructure/firebase/storage/documentStorage';
export { DOCUMENT_STATUSES } from '@/features/documents/constants/documentStatuses';

import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore';
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

function isArchivedRecord(record) {
  return record?.status === DOCUMENT_STATUSES.ARCHIVED || record?.status === 'archived';
}

function keepVisibleRecords(records, includeArchived = false) {
  return includeArchived ? records : records.filter((item) => !isArchivedRecord(item));
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
  const endpoint = import.meta.env.VITE_LLM_ENDPOINT || '/api/ai';
  const frontendOpenAiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (frontendOpenAiKey) {
    return aiDisabledPayload('IA no configurada: no se permite exponer claves privadas directamente en el navegador. Usa un backend seguro.');
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
    } catch {
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

export const firebase = {
  entities: Object.fromEntries(
    Object.entries(ENTITY_COLLECTIONS).map(([entityName, collectionName]) => [
      entityName,
      createRepository({
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
      }),
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

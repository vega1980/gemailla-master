import { auth, db } from '@/firebase';
export { default as app, auth, db, storage } from '@/firebase';
import { DOCUMENT_STATUSES, AI_DISABLED_RESPONSE_STATUSES } from '@/features/documents/constants/documentStatuses';
import { ENTITY_COLLECTIONS } from '@/infrastructure/firebase/repositories/entityCollections';
import { normalizeData } from '@/infrastructure/firebase/repositories/normalization';
import { createAuditMutationMiddleware } from '@/infrastructure/firebase/mutations/auditMutationMiddleware';
import { createRepository } from '@/infrastructure/firebase/repositories/createRepository';
import { getDocumentAccessUrl, uploadFile } from '@/infrastructure/firebase/storage/documentStorage';
import { ensureCorrelationId, getReleaseMetadata, logFrontendEvent, persistObservabilityEvent } from '@/lib/observability';
export { DOCUMENT_STATUSES } from '@/features/documents/constants/documentStatuses';

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
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

const mutations = createAuditMutationMiddleware({ getCurrentUserUid, nowIso });

function withCreateDefaults(data = {}) {
  const payload = normalizeData(data);
  payload.status = payload.status || 'active';
  if (!payload.ownerUid) payload.ownerUid = getCurrentUserUid();
  return payload;
}

async function getAuthHeader() {
  const user = getCurrentUser();
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

function aiDisabledPayload(reason = 'Las funciones de IA están desactivadas porque no hay backend seguro configurado.', correlationId = ensureCorrelationId('', 'ai')) {
  return {
    disabled: true,
    status: 'disabled',
    documentStatus: DOCUMENT_STATUSES.AI_DISABLED,
    message: reason,
    summary: reason,
    response: reason,
    correlationId,
    release: getReleaseMetadata(),
  };
}

async function invokeLLM(params = {}) {
  const correlationId = ensureCorrelationId(params.correlationId, 'ai');
  const endpoint = import.meta.env.VITE_LLM_ENDPOINT || '/api/ai';
  const frontendOpenAiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (frontendOpenAiKey) {
    return aiDisabledPayload('IA no configurada: no se permite exponer claves privadas directamente en el navegador. Usa un backend seguro.', correlationId);
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Correlation-Id': correlationId,
      ...(await getAuthHeader()),
    },
    body: JSON.stringify({
      ...params,
      correlationId,
      release: getReleaseMetadata(),
    }),
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
    logFrontendEvent('ai_request_failed', { correlationId, status: response.status, message }, 'error');
    await persistObservabilityEvent('ai_request_failed', {
      correlationId,
      severity: 'ERROR',
      source: 'frontend',
      status: response.status,
      message,
    }).catch(() => null);
    throw new Error(`${message} (correlationId: ${correlationId})`);
  }

  logFrontendEvent('ai_request_completed', { correlationId, status: response.status });
  const result = payload?.data || payload?.result || payload;
  if (result && typeof result === 'object') return { ...result, correlationId: result.correlationId || correlationId };
  return { response: result, correlationId };
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


async function syncUserProfile(profile = {}) {
  const user = getCurrentUser();
  const userUid = profile.uid || profile.id || getCurrentUserUid();
  if (!userUid) throw new Error('No se puede sincronizar el perfil sin UID.');

  const payload = normalizeData({
    ...profile,
    uid: userUid,
    email: profile.email || user?.email || '',
    fullName: profile.fullName || profile.displayName || user?.displayName || user?.email || '',
    status: profile.status || 'active',
  });
  delete payload.id;

  const dataWithAudit = mutations.withCreateAuditFields(payload);
  const userRef = doc(db, 'users', userUid);

  await runTransaction(db, async (transaction) => {
    transaction.set(userRef, dataWithAudit, { merge: true });
  });

  return { id: userUid, ...dataWithAudit, uid: userUid };
}

async function createCompanyWithInitialOwner(companyData = {}, membershipData = {}) {
  const user = getCurrentUser();
  const userUid = membershipData.userUid || companyData.ownerUid || getCurrentUserUid();
  if (!userUid) throw new Error('No se puede crear la empresa sin UID de propietario.');

  const companyRef = doc(collection(db, 'companies'));
  const membershipRef = doc(db, 'companyMembers', `${companyRef.id}_${userUid}`);

  const companyPayload = mutations.withCreateAuditFields(normalizeData({
    ...companyData,
    ownerUid: userUid,
    status: companyData.status || 'active',
  }));

  const membershipPayload = mutations.withCreateAuditFields(normalizeData({
    ...membershipData,
    companyId: companyRef.id,
    userUid,
    userEmail: membershipData.userEmail || user?.email || '',
    userName: membershipData.userName || user?.displayName || user?.email || '',
    role: membershipData.role || 'director',
    status: membershipData.status || 'active',
  }));

  await runTransaction(db, async (transaction) => {
    transaction.set(companyRef, companyPayload);
    transaction.set(membershipRef, membershipPayload);
  });

  return {
    id: companyRef.id,
    ...companyPayload,
    initialOwnerMembership: { id: membershipRef.id, ...membershipPayload },
  };
}

function buildEntities() {
  const entities = Object.fromEntries(
    Object.entries(ENTITY_COLLECTIONS).map(([entityName, collectionName]) => [
      entityName,
      createRepository(collectionName),
    ]),
  );

  entities.User = {
    ...entities.User,
    syncUserProfile,
  };

  entities.Company = {
    ...entities.Company,
    createCompanyWithInitialOwner,
  };

  return entities;
}

const agents = {
  createConversation: async ({ metadata = {}, agent_name: agentName = 'assistant' } = {}) => {
    const payload = withCreateDefaults({
      agentName,
      metadata,
      ownerUid: getCurrentUserUid(),
      messages: [],
      status: 'active',
    });
    const { refDoc, payload: auditedPayload } = await mutations.add(collection(db, 'aiConversations'), payload);
    return { id: refDoc.id, ...auditedPayload };
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
      const correlationId = ensureCorrelationId(message.correlationId, 'ai');
      const aiResponse = await invokeLLM({ prompt: message.content, correlationId });
      messages.push({
        role: 'assistant',
        correlationId,
        release: getReleaseMetadata(),
        content: typeof aiResponse === 'string' ? aiResponse : aiResponse?.response || aiResponse?.message || 'IA desactivada temporalmente.',
        createdAt: nowIso(),
      });
    }

    await mutations.update(refDoc, { messages });
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
  entities: buildEntities(),
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

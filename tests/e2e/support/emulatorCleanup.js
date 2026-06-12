const DEFAULT_PROJECT_ID = 'demo-gemailla-e2e';
const DEFAULT_FIRESTORE_HOST = '127.0.0.1:8080';
const DEFAULT_AUTH_HOST = '127.0.0.1:9099';

function normalizeEmulatorHost(value, fallback) {
  const host = value || fallback;
  return host.startsWith('http://') || host.startsWith('https://') ? host : `http://${host}`;
}

export function getE2EProjectId() {
  return process.env.VITE_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || DEFAULT_PROJECT_ID;
}

export async function clearFirestoreEmulator(request, { projectId = getE2EProjectId() } = {}) {
  const firestoreBaseUrl = normalizeEmulatorHost(process.env.FIRESTORE_EMULATOR_HOST, DEFAULT_FIRESTORE_HOST);
  const response = await request.delete(
    `${firestoreBaseUrl}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { headers: { Authorization: 'Bearer owner' } },
  );

  if (!response.ok()) {
    throw new Error(
      `No se pudo limpiar Firestore emulator para ${projectId}: ${response.status()} ${await response.text()}`,
    );
  }
}

export async function clearAuthEmulator(request, { projectId = getE2EProjectId() } = {}) {
  const authBaseUrl = normalizeEmulatorHost(process.env.FIREBASE_AUTH_EMULATOR_HOST, DEFAULT_AUTH_HOST);
  const response = await request.delete(`${authBaseUrl}/emulator/v1/projects/${projectId}/accounts`);

  if (!response.ok()) {
    throw new Error(
      `No se pudo limpiar Auth emulator para ${projectId}: ${response.status()} ${await response.text()}`,
    );
  }
}

export async function clearFirebaseEmulators(request, options) {
  await Promise.all([
    clearFirestoreEmulator(request, options),
    clearAuthEmulator(request, options),
  ]);
}

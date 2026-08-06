import { initializeApp } from 'firebase/app';
import { getToken, initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

const runtimeConfig = typeof window !== 'undefined' ? window.GEMAILLA_FIREBASE_CONFIG || {} : {};

const PLACEHOLDER_PATTERN = /^(TU_|YOUR_|<|\$\{)/i;

function normalizeConfigValue(value) {
  if (typeof value !== 'string') return undefined;
  const trimmedValue = value.trim();
  if (!trimmedValue || PLACEHOLDER_PATTERN.test(trimmedValue)) return undefined;
  return trimmedValue;
}

function getConfigValue(envValue, runtimeValue) {
  return normalizeConfigValue(envValue) || normalizeConfigValue(runtimeValue);
}

function shouldUseFirebaseEmulators(projectId) {
  if (typeof window === 'undefined') return false;
  const setting = window.GEMAILLA_USE_FIREBASE_EMULATORS;
  if (setting === true || setting === 'true') return true;
  if (setting === false || setting === 'false') return false;
  const hostname = window.location.hostname;
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  return isLocalHost && String(projectId || '').startsWith('demo-');
}

const firebaseConfig = {
  apiKey: getConfigValue(import.meta.env.VITE_FIREBASE_API_KEY, runtimeConfig.apiKey),
  authDomain: getConfigValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, runtimeConfig.authDomain),
  projectId: getConfigValue(import.meta.env.VITE_FIREBASE_PROJECT_ID, runtimeConfig.projectId),
  storageBucket: getConfigValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, runtimeConfig.storageBucket),
  messagingSenderId: getConfigValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, runtimeConfig.messagingSenderId),
  appId: getConfigValue(import.meta.env.VITE_FIREBASE_APP_ID, runtimeConfig.appId),
};

const appCheckSiteKey = getConfigValue(
  import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY,
  runtimeConfig.appCheckSiteKey,
);

const useFirebaseEmulators = shouldUseFirebaseEmulators(firebaseConfig.projectId);

if (useFirebaseEmulators && !firebaseConfig.projectId) {
  firebaseConfig.projectId = 'demo-gemailla-local';
}

const requiredConfigKeys = useFirebaseEmulators
  ? ['projectId']
  : ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const missingConfigKeys = requiredConfigKeys.filter((key) => !firebaseConfig[key]);

if (missingConfigKeys.length > 0) {
  throw new Error(
    `Configuración de Firebase incompleta. Faltan: ${missingConfigKeys.join(', ')}. `
    + 'Define las variables VITE_FIREBASE_* con valores reales.',
  );
}

export const app = initializeApp(firebaseConfig);

function isLocalDevelopment() {
  if (typeof window === 'undefined' || !import.meta.env.DEV) return false;
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

function initializeConfiguredAppCheck() {
  if (useFirebaseEmulators) return null;

  if (!appCheckSiteKey) {
    throw new Error(
      'Configuración de App Check incompleta. Falta VITE_FIREBASE_APPCHECK_SITE_KEY.',
    );
  }

  if (isLocalDevelopment()) {
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  return initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const appCheck = initializeConfiguredAppCheck();
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
export const storage = getStorage(app);

export async function getAppCheckHeaders() {
  if (!appCheck) return {};

  try {
    const result = await getToken(appCheck, false);
    return result.token ? { 'X-Firebase-AppCheck': result.token } : {};
  } catch (_error) {
    return {};
  }
}

if (useFirebaseEmulators && !globalThis.__GEMAILLA_FIREBASE_EMULATORS__) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  globalThis.__GEMAILLA_FIREBASE_EMULATORS__ = true;
}

export default app;

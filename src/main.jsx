import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/styles/index.css';
import { installGlobalErrorTracking } from '@/lib/observability';

function ensureRuntimeConfigDefaults() {
  window.GEMAILLA_FIREBASE_CONFIG = window.GEMAILLA_FIREBASE_CONFIG || {};
  window.GEMAILLA_USE_FIREBASE_EMULATORS = window.GEMAILLA_USE_FIREBASE_EMULATORS ?? 'auto';
  window.GEMAILLA_RELEASE = window.GEMAILLA_RELEASE || {};
}

async function loadOptionalRuntimeConfig() {
  ensureRuntimeConfigDefaults();

  try {
    const response = await fetch('/app-config.js', { cache: 'no-store' });
    if (response.status === 404) return;

    if (!response.ok) {
      console.warn(`No se pudo cargar /app-config.js (HTTP ${response.status}). Se usarán variables de entorno/defaults.`);
      return;
    }

    const configScript = await response.text();
    if (!configScript.trim()) return;

    const script = document.createElement('script');
    script.text = configScript;
    document.head.appendChild(script);
    script.remove();
    ensureRuntimeConfigDefaults();
  } catch (error) {
    console.warn('No se pudo cargar /app-config.js. Se usarán variables de entorno/defaults.', error);
  }
}

async function bootstrap() {
  installGlobalErrorTracking();
  await loadOptionalRuntimeConfig();

  const { default: App } = await import('@/app/App.jsx');

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

bootstrap();

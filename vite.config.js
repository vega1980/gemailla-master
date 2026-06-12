import path from 'path';
import { fileURLToPath } from 'url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import packageJson from './package.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


function getGitSha() {
  return process.env.GIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'unknown';
}

function getBuildId() {
  return process.env.BUILD_ID || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_RUN_ID || 'local';
}

const vendorChunkGroups = [
  { name: 'react-vendor', packages: ['react', 'react-dom', 'react-router-dom'] },
  { name: 'firebase-vendor', packages: ['firebase', '@firebase'] },
  { name: 'query-vendor', packages: ['@tanstack'] },
  { name: 'motion-vendor', packages: ['framer-motion'] },
  { name: 'charts-vendor', packages: ['recharts', 'd3-'] },
  { name: 'jspdf-vendor', packages: ['jspdf'] },
  { name: 'html2canvas-vendor', packages: ['html2canvas'] },
  { name: 'dompurify-vendor', packages: ['dompurify'] },
  { name: 'radix-vendor', packages: ['@radix-ui'] },
  { name: 'icons-vendor', packages: ['lucide-react'] },
  { name: 'date-vendor', packages: ['date-fns', 'moment'] },
];

function getVendorChunkName(id) {
  if (!id.includes('node_modules')) return undefined;
  const normalizedId = id.replace(/\\/g, '/');
  const matchedGroup = vendorChunkGroups.find(({ packages: packageNames }) =>
    packageNames.some((packageName) => normalizedId.includes(`/node_modules/${packageName}`)),
  );
  return matchedGroup?.name;
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION || packageJson.version),
    __BUILD_ID__: JSON.stringify(getBuildId()),
    __GIT_SHA__: JSON.stringify(getGitSha()),
    __DEPLOY_ENV__: JSON.stringify(process.env.DEPLOY_ENV || process.env.NODE_ENV || 'development'),
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: getVendorChunkName,
      },
    },
  },
});

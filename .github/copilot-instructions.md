# Copilot cloud agent instructions for gemailla-master

Trust this file first. Search only when these instructions are incomplete or contradicted by current files.

## Repository summary

GEMAILLA AI is a Spanish-language React/Vite single-page SaaS application backed by Firebase Auth, Firestore, Storage, Hosting, and Firebase Cloud Functions. It implements multi-company business modules (dashboard, CRM, ERP, finance, HR, operations, documents, AI assistant, audit, subscriptions) with tenant-aware security rules and same-origin backend routes. The repo is a JavaScript/JSX project (not TypeScript source, but checked with `tsc` via `jsconfig*.json`), with Tailwind CSS, Radix UI, TanStack Query, Firebase SDK, Firebase Functions CommonJS backend, Node built-in tests, Playwright E2E, and Firebase Emulator Suite tests. Excluding `node_modules`, `.git`, and `dist`, it is about 3.1 MB and ~5,840 files.

## Runtime and setup

- Use Node 20 in CI. `package.json` allows `>=18.19.0`, `functions/package.json` declares Node `20`; prefer Node 20 for cloud work. npm 11 worked locally but emitted `Unknown env config "http-proxy"` warnings; those warnings were non-fatal.
- Java is required for Firestore/Storage emulators. Firebase CLI downloads emulator JARs into `~/.cache/firebase/emulators`.
- Always install root dependencies before validating/building: `npm ci`. In this environment, `npm ci` failed after ~1s with `403 Forbidden - GET https://registry.npmjs.org/react-is`; use existing/cacheable dependencies or rerun in an environment with registry access. If dependencies are already present, validation commands work.
- Optional local runtime config: copy `public/app-config.example.js` to `public/app-config.js` and edit Firebase values. Do not commit `public/app-config.js`. `VITE_FIREBASE_*` env vars override `window.GEMAILLA_FIREBASE_CONFIG`.
- Never put OpenAI/LLM secrets in frontend env vars. `OPENAI_API_KEY` belongs only to Functions/backend; `VITE_OPENAI_API_KEY` is intentionally rejected.

## Validation commands that were run

Use this order for normal PR validation after dependencies are available:

1. `npm run validate:env:all` with CI-safe dummy env values:
   `VITE_FIREBASE_API_KEY=test-firebase-api-key VITE_FIREBASE_AUTH_DOMAIN=demo-gemailla-ci.firebaseapp.com VITE_FIREBASE_PROJECT_ID=demo-gemailla-ci VITE_FIREBASE_STORAGE_BUCKET=demo-gemailla-ci.appspot.com VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890 VITE_FIREBASE_APP_ID=1:1234567890:web:ci OPENAI_API_KEY=sk-test npm run validate:env:all`
2. `npm run validate:secrets`
3. `npm run validate:architecture` (validates Firebase import boundaries, company guards, sensitive VITE vars, and local Firestore indexes; remote index checks need `--project=<id>` and credentials)
4. `npm run lint`
5. `npm run typecheck:core` (the release workflow uses this; full `npm run typecheck` also exists)
6. `npm run build` (Vite build completed in ~20s locally)
7. `npm run test:unit` (49 tests passed locally; AI endpoint tests intentionally print JSON warning/error logs)
8. `npm run test:functions` (runs `node --check` on Functions entry/router)

Firebase emulator rules tests: run `npm run test:rules:emulators` only when emulator downloads/cache are available. Locally this failed with `download failed, status 403: Forbidden` while downloading `cloud-firestore-emulator-v1.21.0.jar`; treat that as an environment/network block, not a functional rules failure. CI pre-downloads with `npx firebase-tools setup:emulators:firestore` and caches `~/.cache/firebase/emulators`.

E2E tests: first run `npm run test:e2e:install` to install Chromium/deps, then `npm run test:e2e:emulators`. The E2E suite uses Firebase Auth/Firestore/Storage emulators and Playwright (`tests/e2e/critical-flows.spec.js`). Headed mode is `npm run test:e2e:headed` or the command shown in `docs/E2E_PLAYWRIGHT.md`.

Run/dev/deploy scripts:
- `npm run dev` starts Vite.
- `npm run preview` previews `dist` after `npm run build`.
- `npm run serve` starts hosting/auth/firestore/storage emulators.
- `npm run deploy`, `npm run deploy:hosting`, and `npm run rules:deploy` require Firebase credentials/project access.
- Functions-only: `cd functions && npm install` when needed, `npm test`, `npm run serve`, `npm run deploy`.

## Architecture and layout

- App entry: `src/main.jsx` installs observability, loads optional `/app-config.js`, then dynamically imports `@/app/App.jsx`. Compatibility root `src/App.jsx` reexports `@/app/App`.
- Firebase initialization: `src/firebase.js`. It reads `VITE_FIREBASE_*`/runtime config, enables emulators automatically on localhost for `demo-*` project IDs, and exports `app`, `auth`, `db`, `storage`.
- Public Firebase facade: `src/api/firebaseClient.js`. Prefer this facade and infrastructure repositories; architecture validation blocks alternate Firebase imports outside approved locations.
- Incremental modular layout: `src/app` for routes/providers, `src/modules/<domain>` for newer pages/components/services, `src/features/<domain>` for feature flows, `src/infrastructure/firebase` for repositories/collections/Storage, and legacy `src/pages`, `src/lib`, `src/components` still exist. Root module files may be shims; preserve compatibility imports.
- Security-sensitive document flow: `src/features/documents/services/uploadDocumentFlow.js`, `src/features/documents/services/analyzeDocumentFlow.js`, `src/infrastructure/firebase/storage/documentStorage.js`, and `src/security/documentFileValidation.js`. Documents create Firestore metadata first, upload PDF/XML <=15 MB under `companies/{companyId}/documents/{documentId}/{fileName}` with matching metadata, then store only `storagePath` (never persisted public/download URLs). Client deletes are logical (`status: "archived"`), not physical.
- Backend: `functions/index.js` exports `ai` and `functionsRouter`; handlers live in `functions/handlers`. Hosting rewrites `/api/ai` and `/api/functions/**` to Functions in `firebase.json`; keep frontend calls same-origin and relative.
- Rules/config: `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `firebase.json`, `vite.config.ts`, `eslint.config.js`, `tailwind.config.js`, `postcss.config.js`, `playwright.config.js`, `jsconfig.json`, `jsconfig.core.json`, `components.json`.
- Tests: unit tests in `tests/unit/*.test.mjs`, rules tests in `tests/rules/*.test.mjs`, E2E in `tests/e2e`, helper `tools/wait-on`, validation scripts in `scripts/`.
- Documentation worth checking for high-risk changes: `README.md`, `docs/ARQUITECTURA.md`, `docs/E2E_PLAYWRIGHT.md`, `docs/VERIFICACION.md`, `docs/ITERACION_ESTABILIZACION.md`, `docs/observability/OBSERVABILITY.md`, and runbooks under `docs/runbooks/`.

## CI expectations

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`/`master`: setup Node 20, `npm ci`, `npm run validate:env:all` with dummy Firebase/OpenAI env, a shell scan for sensitive `VITE_*` variables in `src`, `npm run lint`, and `npm run build`. `.github/workflows/npm-publish-github-packages.yml` additionally runs `npm run typecheck:core` before release publish. `.github/workflows/firebase-security-rules.yml` validates and deploys rules on main/master changes to rules/tests/config; it runs `npm ci`, caches/pre-downloads emulators, `npm run test:rules:emulators`, then deploys rules if Firebase secrets exist.

## Coding guidance

- Keep names descriptive in Spanish/domain terms; avoid ambiguous `x`, `tmp`, `data`, etc.
- Do not add `try/catch` around imports.
- Do not hardcode secrets, API keys, public download URLs, or configurable AI endpoints in frontend code/docs/tests.
- For company-scoped features, preserve `companyId` guards and tenant-aware query keys (for example `companyEntityQueryKey`).
- For Firebase changes, update rules/indexes/tests together when data access patterns change.
- If a visible web change is made, validate with build/tests and capture a screenshot when practical.

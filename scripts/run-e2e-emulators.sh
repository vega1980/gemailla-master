#!/usr/bin/env bash
set -euo pipefail
node scripts/mock-malware-scanner.mjs &
scanner_pid=$!
node scripts/prepare-staging-firebase-config.mjs
trap 'kill "$scanner_pid" 2>/dev/null || true; rm -f .firebase.staging.generated.json' EXIT
export MALWARE_SCANNER_URL="http://127.0.0.1:9399"
export MALWARE_SCANNER_API_KEY="emulator-only"
export CLOUDSDK_CONFIG=/tmp/gemailla-emulator-cloudsdk GCLOUD_PROJECT=demo-gemailla-e2e GOOGLE_CLOUD_PROJECT=demo-gemailla-e2e VERTEX_GEMINI_PROJECT=demo-gemailla-e2e
firebase emulators:exec --config .firebase.staging.generated.json --only auth,firestore,storage,functions,hosting --project demo-gemailla-e2e \
  "wait-on http://127.0.0.1:5000 http://127.0.0.1:5001 http://127.0.0.1:8080 http://127.0.0.1:9099 http://127.0.0.1:9199 && PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5000 VITE_FIREBASE_PROJECT_ID=demo-gemailla-e2e GCLOUD_PROJECT=demo-gemailla-e2e GOOGLE_CLOUD_PROJECT=demo-gemailla-e2e VERTEX_GEMINI_PROJECT=demo-gemailla-e2e npm run test:e2e"

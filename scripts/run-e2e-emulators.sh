#!/usr/bin/env bash
set -euo pipefail
export CLOUDSDK_CONFIG=/tmp/gemailla-emulator-cloudsdk GCLOUD_PROJECT=demo-gemailla-e2e GOOGLE_CLOUD_PROJECT=demo-gemailla-e2e VERTEX_GEMINI_PROJECT=demo-gemailla-e2e
export STORAGE_EMULATOR_HOST=http://127.0.0.1:9199 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
e2e_test_command=${E2E_TEST_COMMAND:-npm run test:e2e}
node scripts/mock-malware-scanner.mjs &
scanner_pid=$!
node scripts/prepare-emulator-firebase-config.mjs
cleanup() {
  kill "$scanner_pid" 2>/dev/null || true
  rm -f .firebase.emulator.generated.json
}
trap cleanup EXIT
firebase emulators:exec --config .firebase.emulator.generated.json --only auth,firestore,storage,functions,hosting,pubsub --project demo-gemailla-e2e \
  "wait-on http://127.0.0.1:5000 http://127.0.0.1:5001 http://127.0.0.1:8080 http://127.0.0.1:9099 http://127.0.0.1:9199 && PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5000 VITE_FIREBASE_PROJECT_ID=demo-gemailla-e2e GCLOUD_PROJECT=demo-gemailla-e2e GOOGLE_CLOUD_PROJECT=demo-gemailla-e2e VERTEX_GEMINI_PROJECT=demo-gemailla-e2e $e2e_test_command"

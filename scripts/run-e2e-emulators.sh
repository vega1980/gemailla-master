#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/e2e-env.sh"
e2e_test_command=${E2E_TEST_COMMAND:-npm run test:e2e}
node scripts/mock-malware-scanner.mjs &
scanner_pid=$!
node scripts/prepare-staging-firebase-config.mjs
cleanup() {
  kill "$scanner_pid" 2>/dev/null || true
  rm -f .firebase.staging.generated.json
}
trap cleanup EXIT
firebase emulators:exec --config .firebase.staging.generated.json --only auth,firestore,storage,functions,hosting,pubsub --project "$VITE_FIREBASE_PROJECT_ID" \
  "wait-on http://127.0.0.1:5000 http://127.0.0.1:5001 http://127.0.0.1:8080 http://127.0.0.1:9099 http://127.0.0.1:9199 && PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:5000 $e2e_test_command"

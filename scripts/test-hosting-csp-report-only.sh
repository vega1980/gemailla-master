#!/usr/bin/env bash
set -euo pipefail
node scripts/prepare-staging-firebase-config.mjs
trap 'rm -f .firebase.staging.generated.json' EXIT
firebase emulators:exec --config .firebase.staging.generated.json --only hosting --project demo-gemailla-csp \
  "curl --fail --silent --head http://127.0.0.1:5000 | tr -d '\r' | grep -i '^Content-Security-Policy-Report-Only:'"

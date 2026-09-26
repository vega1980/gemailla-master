#!/usr/bin/env bash
set -euo pipefail

npm run pretest:rules:emulators

export CLOUDSDK_CONFIG=/tmp/gemailla-emulator-cloudsdk
export GCLOUD_PROJECT=demo-gemailla-local
export GOOGLE_CLOUD_PROJECT=demo-gemailla-local
export VERTEX_GEMINI_PROJECT=demo-gemailla-local

exec firebase emulators:start --only auth,firestore,storage,functions,hosting --project demo-gemailla-local

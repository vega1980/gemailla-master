#!/usr/bin/env bash
set -euo pipefail

BUCKET_NAME="${1:-}"
if [[ -z "$BUCKET_NAME" || ! "$BUCKET_NAME" =~ ^[a-z0-9][a-z0-9._-]*$ ]]; then
  echo "Uso: npm run configure:storage-cors -- <bucket-name>" >&2
  exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud es requerido para configurar CORS en Cloud Storage." >&2
  exit 1
fi

gcloud storage buckets update "gs://${BUCKET_NAME}" --cors-file=storage.cors.json

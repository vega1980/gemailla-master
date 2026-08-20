#!/usr/bin/env bash
set -euo pipefail
project="${1:-${GCLOUD_PROJECT:-}}"
[[ -n "$project" ]] || { echo "Uso: $0 PROJECT_ID" >&2; exit 2; }
[[ "${CONFIRM_TTL_CONFIGURATION:-}" == "yes" ]] || { echo "TTL pendiente: define CONFIRM_TTL_CONFIGURATION=yes tras autorización explícita." >&2; exit 2; }
for group in auditLogs aiAuditLogs aiCostLogs aiUsage predictionLogs observabilityEvents; do
  gcloud firestore fields ttls update expiresAt --collection-group="$group" --enable-ttl --project="$project"
done
gcloud firestore fields ttls list --project="$project"

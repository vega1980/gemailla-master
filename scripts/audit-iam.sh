#!/usr/bin/env bash
set -euo pipefail

project="${1:-${GCLOUD_PROJECT:-}}"
[[ -n "$project" ]] || { echo "Uso: $0 PROJECT_ID" >&2; exit 2; }
command -v gcloud >/dev/null || { echo "gcloud no está instalado" >&2; exit 2; }

policy="$(mktemp)"; accounts="$(mktemp)"; trap 'rm -f "$policy" "$accounts"' EXIT
gcloud projects get-iam-policy "$project" --format=json > "$policy"
gcloud iam service-accounts list --project "$project" --format='value(email)' > "$accounts"

if node -e 'const p=require(process.argv[1]); process.exit(p.bindings?.some(b => ["roles/owner","roles/editor"].includes(b.role)) ? 1 : 0)' "$policy"; then
  echo "OK: no hay roles primitivos Owner/Editor"
else
  echo "ERROR: se detectaron roles primitivos Owner/Editor" >&2; exit 1
fi

while IFS= read -r account; do
  [[ -z "$account" ]] && continue
  count="$(gcloud iam service-accounts keys list --iam-account "$account" --managed-by=user --format='value(name)' | wc -l)"
  [[ "$count" -eq 0 ]] || { echo "ERROR: $account tiene $count claves gestionadas por usuario" >&2; exit 1; }
done < "$accounts"
echo "OK: cuentas sin claves JSON gestionadas por usuario"

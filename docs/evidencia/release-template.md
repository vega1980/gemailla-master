# Evidencia de release `<BUILD_ID>`

- **Fecha UTC:**
- **Responsable:**
- **Proyecto Firebase:** `gemailla-enterprise-staging`
- **URL staging:** `https://gemailla-enterprise-staging.web.app`
- **APP_VERSION:**
- **BUILD_ID:**
- **GIT_SHA:**
- **Rama:**

## Comando de deploy

```bash
STAGING_BASE_URL=https://gemailla-enterprise-staging.web.app npm run deploy:staging
```

## Resultados

| Check | Comando | Resultado | Evidencia |
| --- | --- | --- | --- |
| Entorno | `npm run validate:env` | Pendiente | |
| Unit tests | `npm run test:unit` | Pendiente | |
| Build | `npm run build` | Pendiente | |
| Deploy Firebase | `npx firebase-tools deploy --project gemailla-enterprise-staging --only hosting,functions,firestore:rules,storage --non-interactive` | Pendiente | |
| Smoke staging | `npm run smoke:staging` | Pendiente | |

## Rollback

- **Checklist revisado:** `docs/runbooks/ROLLBACK_CHECKLIST.md`
- **Último build sano:**
- **Commit objetivo para rollback:**
- **Notas:**

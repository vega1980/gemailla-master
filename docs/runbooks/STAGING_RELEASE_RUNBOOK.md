# Runbook de staging reproducible

Este runbook bloquea el crecimiento funcional hasta que cada release tenga un deploy de staging reproducible, smoke tests y evidencia de rollback.

## Proyecto Firebase de staging confirmado

- **Alias Firebase:** `staging` en `.firebaserc`.
- **Proyecto Firebase:** `gemailla-enterprise-staging`.
- **URL esperada:** `https://gemailla-enterprise-staging.web.app`.
- **Override permitido:** `STAGING_FIREBASE_PROJECT` solo para dry-runs controlados o migración formal del proyecto.

El proyecto de staging debe mantenerse separado de producción y usar secretos/variables propios. No se debe desplegar staging contra el alias `default`.

## Deploy automatizado

Comando único:

```bash
STAGING_BASE_URL=https://gemailla-enterprise-staging.web.app npm run deploy:staging
```

El script `scripts/deploy-staging.sh` ejecuta, en orden reproducible:

1. Exporta metadata de release: `DEPLOY_ENV=staging`, `APP_VERSION`, `BUILD_ID` y `GIT_SHA`.
2. Valida entorno frontend con `npm run validate:env`.
3. Ejecuta pruebas unitarias con `npm run test:unit`.
4. Genera build con `npm run build`.
5. Despliega Hosting, Functions, Firestore Rules y Storage Rules con Firebase CLI.
6. Ejecuta smoke tests post-deploy con `npm run smoke:staging`.

## Smoke tests post-deploy

`npm run smoke:staging` requiere `STAGING_BASE_URL` o `PLAYWRIGHT_BASE_URL` y valida:

- Hosting raíz sirve la app React.
- Fallback SPA responde para una ruta inexistente.
- `/api/ai` rechaza tráfico no autenticado, confirmando que el rewrite a Functions está activo y protegido.

## Evidencia obligatoria por release

Crear un archivo por release en `docs/evidencia/release-<BUILD_ID>.md` con:

- Fecha UTC, responsable y ventana de deploy.
- Proyecto Firebase, URL, `APP_VERSION`, `BUILD_ID`, `GIT_SHA` y rama.
- Comando exacto usado para deploy.
- Resultado de `npm run validate:env`, `npm run test:unit`, `npm run build` y `npm run smoke:staging`.
- Identificador o URL del deploy Firebase.
- Capturas o links a logs si hubo incidentes.
- Referencia al checklist de rollback revisado para esa release.

## Gate antes de continuar features

No se habilitan módulos nuevos si falta cualquiera de estos puntos:

- Deploy de staging reproducible ejecutado correctamente.
- Smoke tests post-deploy en verde o bloqueo documentado.
- Checklist de rollback revisado en la misma fecha de release.
- Evidencia registrada en `docs/evidencia/`.

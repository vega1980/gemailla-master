# Checklist de rollback

Checklist vivo para cada release. Debe revisarse antes de desplegar staging y producción, y enlazarse desde la evidencia en `docs/evidencia/`.

## Antes de revertir

- [ ] Declarar severidad y owner.
- [ ] Copiar `correlationId` de un evento afectado.
- [ ] Identificar `APP_VERSION`, `BUILD_ID`, `GIT_SHA` y `DEPLOY_ENV` de la release con fallo.
- [ ] Abrir la evidencia de la release afectada en `docs/evidencia/release-<BUILD_ID>.md`.
- [ ] Confirmar último build sano, commit objetivo y proyecto Firebase afectado.
- [ ] Pausar nuevos despliegues automáticos.
- [ ] Confirmar compatibilidad de migraciones, reglas y secrets con el commit sano.

## Ejecución

- [ ] Revertir hosting al build anterior o ejecutar redeploy del commit sano.
- [ ] Revertir Firebase Functions si el incidente afecta IA/backend.
- [ ] Revertir reglas Firestore/Storage si el incidente afecta documentos/permisos.
- [ ] Mantener variables/secrets compatibles con la release restaurada.
- [ ] Registrar comandos exactos, salida relevante y operador en la evidencia de rollback.

## Validación posterior

- [ ] Ejecutar smoke test de hosting raíz y fallback SPA.
- [ ] Ejecutar smoke test de login.
- [ ] Ejecutar smoke test de upload PDF/XML con `correlationId` visible.
- [ ] Ejecutar smoke test de IA con `correlationId` visible o rechazo 401/403 esperado si no hay sesión.
- [ ] Confirmar que error rate y latencia vuelven bajo umbral.
- [ ] Comunicar resolución con ventana de impacto y release restaurada.

## Comandos de referencia

```bash
# Staging: redeploy reproducible del commit sano
STAGING_BASE_URL=https://gemailla-enterprise-staging.web.app npm run deploy:staging

# Validación post-rollback contra staging ya desplegado
STAGING_BASE_URL=https://gemailla-enterprise-staging.web.app npm run smoke:staging
```

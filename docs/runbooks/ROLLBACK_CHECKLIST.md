# Checklist de rollback

## Antes de revertir

- [ ] Declarar severidad y owner.
- [ ] Copiar `correlationId` de un evento afectado.
- [ ] Identificar `APP_VERSION`, `BUILD_ID`, `GIT_SHA` y `DEPLOY_ENV` de la release con fallo.
- [ ] Confirmar último build sano y commit objetivo.
- [ ] Pausar nuevos despliegues automáticos.

## Ejecución

- [ ] Revertir hosting al build anterior o redeploy del commit sano.
- [ ] Revertir Firebase Functions si el incidente afecta IA/backend.
- [ ] Revertir reglas Firestore/Storage si el incidente afecta documentos/permisos.
- [ ] Mantener variables/secrets compatibles con la release restaurada.

## Validación posterior

- [ ] Ejecutar smoke test de login.
- [ ] Ejecutar smoke test de upload PDF/XML con `correlationId` visible.
- [ ] Ejecutar smoke test de IA con `correlationId` visible.
- [ ] Confirmar que error rate y latencia vuelven bajo umbral.
- [ ] Comunicar resolución con ventana de impacto y release restaurada.

# Observabilidad, trazabilidad y release tracking

## Objetivos cubiertos

1. **Operaciones críticas trazables**: toda operación de IA y subida documental genera o propaga un `correlationId`.
2. **Incidentes detectables**: frontend captura errores globales/render, backend emite logs JSON estructurados y los indicadores de alerta están definidos.
3. **Errores atribuibles a release**: cada evento incluye `APP_VERSION`, `BUILD_ID`, `GIT_SHA` y `DEPLOY_ENV`.
4. **Respuesta definida**: los runbooks enlazados definen owner, severidad, diagnóstico y rollback.

## Campos obligatorios

| Campo | Fuente | Uso |
| --- | --- | --- |
| `correlationId` | `ensureCorrelationId()` o cabecera `X-Correlation-Id` | Une UI, auditoría, Storage, Functions y OpenAI. |
| `appVersion` / `APP_VERSION` | `package.json`, `VITE_APP_VERSION` o runtime config | Identifica la versión funcional. |
| `buildId` / `BUILD_ID` | CI (`BUILD_ID`, `GITHUB_RUN_ID`, `K_REVISION`) | Identifica artefacto desplegado. |
| `gitSha` / `GIT_SHA` | CI (`GIT_SHA`, `GITHUB_SHA`) | Identifica commit exacto. |
| `deployEnv` / `DEPLOY_ENV` | CI/runtime | Separa producción, staging y desarrollo. |

## Flujo de correlationId

- El frontend crea un `correlationId` para `InvokeLLM`, conversaciones IA, análisis documental y uploads.
- El backend acepta `X-Correlation-Id` o `body.correlationId`, lo agrega a logs JSON, respuesta HTTP y metadata enviada a OpenAI.
- Los uploads guardan `correlationId` en el documento Firestore y en `customMetadata` del objeto de Storage.
- La auditoría (`auditLogs`) recibe `correlationId` y metadata de release para búsquedas forenses.

## Error tracking frontend

El frontend instala listeners globales para `error` y `unhandledrejection`, además de un `AppErrorBoundary` para errores de render. Los eventos se escriben en consola como JSON y, cuando hay usuario o empresa, en `observabilityEvents`.

## Logging estructurado backend

Firebase Functions emite una línea JSON por evento operacional con:

- `severity`
- `eventName`
- `timestamp`
- `correlationId`
- `latencyMs`
- `status`
- metadata de release

## Alertas recomendadas

Crear alertas en Cloud Monitoring / Firebase con las siguientes condiciones por `DEPLOY_ENV=production`:

| Alerta | Métrica / filtro | Umbral | Severidad | Owner |
| --- | --- | --- | --- | --- |
| AI error rate | Logs `eventName="ai_request_failed"` y `status>=500` / total `ai_request_completed` | > 2% durante 5 min | SEV2 | Equipo Plataforma/IA |
| AI latencia p95 | `latencyMs` en `ai_request_completed` | p95 > 8s durante 10 min | SEV2 | Equipo Plataforma/IA |
| Frontend errors | `observabilityEvents.eventName="frontend_error"` | > 10 errores únicos en 10 min | SEV3 | Equipo Frontend |
| Upload failures | `eventName="document_upload_failed"` o documentos `status="error"` | > 5 en 10 min | SEV2 | Equipo Documentos |
| Backend unavailable | HTTP 5xx en función `ai` | > 1% durante 5 min | SEV1/SEV2 | Equipo Plataforma |

## Dashboard mínimo

- Error rate IA por release (`gitSha`, `buildId`).
- Latencia p50/p95/p99 de función `ai`.
- Top `correlationId` con fallos.
- Conteo de errores frontend por ruta y release.
- Uploads documentales por estado y empresa.

## Runbooks

- [Incidente IA](../runbooks/AI_INCIDENT_RUNBOOK.md)
- [Incidente documental / uploads](../runbooks/DOCUMENT_UPLOAD_INCIDENT_RUNBOOK.md)
- [Checklist de rollback](../runbooks/ROLLBACK_CHECKLIST.md)

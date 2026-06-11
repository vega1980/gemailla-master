# Observabilidad, trazabilidad y release tracking

## Objetivos cubiertos

1. **Operaciones críticas trazables**: toda operación de IA, subida documental y llamada genérica a Functions genera o propaga un `correlationId`.
2. **Incidentes detectables**: frontend captura errores globales/render, backend emite logs JSON estructurados y los indicadores de alerta están definidos.
3. **Errores atribuibles a release**: cada evento incluye `APP_VERSION`, `BUILD_ID`, `GIT_SHA` y `DEPLOY_ENV`.
4. **Respuesta definida**: los runbooks enlazados definen owner, severidad, diagnóstico y rollback.
5. **Privacidad por defecto**: los logs operacionales se sanitizan antes de escribirse en consola, Cloud Logging u `observabilityEvents`.

## Campos obligatorios

| Campo | Fuente | Uso |
| --- | --- | --- |
| `correlationId` | `ensureCorrelationId()` o cabecera `X-Correlation-Id` | Une UI, auditoría, Storage, Functions y OpenAI. |
| `appVersion` / `APP_VERSION` | `package.json`, `VITE_APP_VERSION` o runtime config | Identifica la versión funcional. |
| `buildId` / `BUILD_ID` | CI (`BUILD_ID`, `GITHUB_RUN_ID`, `K_REVISION`) | Identifica artefacto desplegado. |
| `gitSha` / `GIT_SHA` | CI (`GIT_SHA`, `GITHUB_SHA`) | Identifica commit exacto. |
| `deployEnv` / `DEPLOY_ENV` | CI/runtime | Separa producción, staging y desarrollo. |

## Flujo de correlationId

- El frontend crea un `correlationId` para `InvokeLLM`, conversaciones IA, análisis documental, uploads y llamadas genéricas a Functions.
- `InvokeLLM` envía el mismo ID en `X-Correlation-Id`, body JSON y respuesta normalizada.
- `firebase.functions.invoke()` normaliza el ID, lo envía en `X-Correlation-Id`, lo incluye en el body y lo conserva en errores de red/HTTP.
- El backend acepta `X-Correlation-Id` o `body.correlationId`, lo normaliza para evitar cardinalidad/longitud abusiva, lo agrega a logs JSON, respuesta HTTP y metadata enviada a OpenAI.
- Los uploads guardan `correlationId` en el documento Firestore y en `customMetadata` del objeto de Storage.
- La auditoría (`auditLogs`) recibe `correlationId` y metadata de release para búsquedas forenses.

## Calidad de propagación a verificar

| Caso | Estado esperado | Evidencia |
| --- | --- | --- |
| Reintentos manuales de IA | Reusar el `correlationId` de la operación visible para el usuario o generar uno nuevo solo para un nuevo intento explícito. | Error UI y log backend comparten el mismo ID. |
| Upload documental | Documento Firestore, metadata de Storage y evento frontend comparten el mismo ID. | Buscar por `correlationId` en Firestore/Storage/Cloud Logging. |
| Análisis posterior al upload | `analyzeDocumentFlow()` toma `doc.correlationId` si no recibe uno explícito. | Documento pasa de `pending` a `processing/analyzed` sin cambiar el ID. |
| Llamadas paralelas | Cada operación paralela debe crear su propio ID salvo que sea parte del mismo flujo de negocio. | Topología clara en Cloud Logging por ID. |
| Cloud Logging | Logs backend son JSON en stdout/stderr, por lo que Cloud Logging los indexa como `jsonPayload`. | Filtro `jsonPayload.correlationId="..."`. |

## PII y datos sensibles

Los logs operacionales **no deben contener** prompts completos, documentos, rutas con nombres de archivo, respuestas IA completas, correos, RFCs, tokens, secrets ni URLs descargables.

Controles implementados:

- `logFrontendEvent()` sanitiza payloads antes de escribirlos en consola.
- `persistObservabilityEvent()` sanitiza payloads y ya no persiste `userEmail`; conserva `ownerUid` cuando existe.
- `structuredLog()` de Functions sanitiza payloads antes de emitir JSON a stdout/stderr.
- El backend registra `promptLength`, `status`, `latencyMs`, `model`, `firebaseUid` y `correlationId`, pero no el prompt.
- Los uploads registran `contentType` y `fileSize`, pero no `storagePath` ni nombre original del archivo en eventos operacionales.
- La auditoría de consultas IA registra longitud y cantidad de documentos, no el texto consultado.

> Nota: Firestore puede almacenar contenido funcional necesario para la experiencia del producto (por ejemplo, conversaciones guardadas). Esta política se refiere a logs operacionales y eventos de observabilidad.

## Control de ruido, cardinalidad y costo

Revisión operativa recomendada semanal:

| Riesgo | Revisión | Acción recomendada |
| --- | --- | --- |
| Volumen diario | Bytes/día en Cloud Logging por `eventName` y `deployEnv`. | Reducir logs `INFO` de flujos de alta frecuencia o moverlos a métricas agregadas. |
| Cardinalidad | Conteo de valores distintos por `eventName`, `correlationId`, `companyId`, `route`, `status`. | No agregar campos libres como prompts, nombres de archivo, correos o URLs. |
| Costos | Ingesta y retención por sink/bucket. | Retención corta para debug; retención mayor solo para auditoría necesaria. |
| Filtros | Revisar exclusiones de logs no accionables. | Mantener errores y warnings; muestrear eventos `*_completed` si el volumen crece. |
| Alert fatigue | Número de alertas por semana y falsos positivos. | Ajustar umbrales por p95/p99 y ventanas de 5-10 min. |

## Error tracking frontend

El frontend instala listeners globales para `error` y `unhandledrejection`, además de un `AppErrorBoundary` para errores de render. Los eventos se escriben en consola como JSON y, cuando hay usuario o empresa, en `observabilityEvents` sanitizados.

## Logging estructurado backend

Firebase Functions emite JSON por evento operacional con:

- `severity`
- `eventName`
- `timestamp`
- `correlationId`
- `latencyMs`
- `status`
- metadata de release

Los logs llegan a Cloud Logging como `jsonPayload` al desplegar Functions en Google Cloud/Firebase.

## Cobertura actual y brechas

| Flujo | Cobertura actual | Próxima revisión |
| --- | --- | --- |
| IA / asistente | Instrumentado con `correlationId`, release, latencia, estado y sanitización. | Medir tasa de error por componente IA. |
| Documentos / uploads | Instrumentado en Firestore, Storage metadata y eventos frontend sanitizados. | Validar búsqueda cruzada por ID en incidente real. |
| Functions genéricas | Propagan `correlationId` por header y body. | Añadir logs backend por función específica cuando existan endpoints. |
| Autenticación | Errores globales capturados; sin eventos dedicados. | Añadir eventos `auth_login_failed`, `auth_logout`, `auth_token_refresh_failed` sin email/token. |
| Suscripciones / pagos | Cobertura parcial vía UI/errors. | Instrumentar cambios de plan, checkout y webhooks sin datos de tarjeta. |
| ERP / CRM / HR | Cobertura indirecta por auditoría y errores globales. | Añadir IDs por importaciones masivas y operaciones batch. |
| Importaciones masivas | Cobertura funcional dispersa. | Agregar `importId`, conteos, errores por fila agregados y muestreo. |

## Alertas recomendadas

Crear alertas en Cloud Monitoring / Firebase con las siguientes condiciones por `DEPLOY_ENV=production`:

| Alerta | Métrica / filtro | Umbral | Severidad | Owner |
| --- | --- | --- | --- | --- |
| AI error rate | Logs `eventName="ai_request_failed"` y `status>=500` / total `ai_request_completed` | > 2% durante 5 min | SEV2 | Equipo Plataforma/IA |
| AI latencia p95 | `latencyMs` en `ai_request_completed` | p95 > 8s durante 10 min | SEV2 | Equipo Plataforma/IA |
| Frontend errors | `observabilityEvents.eventName="frontend_error"` | > 10 errores únicos en 10 min | SEV3 | Equipo Frontend |
| Upload failures | `eventName="document_upload_failed"` o documentos `status="error"` | > 5 en 10 min | SEV2 | Equipo Documentos |
| Backend unavailable | HTTP 5xx en función `ai` | > 1% durante 5 min | SEV1/SEV2 | Equipo Plataforma |
| Log ingestion spike | Bytes/minuto por `deployEnv=production` | > 2x baseline durante 15 min | SEV3 | Equipo Plataforma |

## Dashboard mínimo

- Error rate IA por release (`gitSha`, `buildId`).
- Latencia p50/p95/p99 de función `ai`.
- Top `correlationId` con fallos.
- Conteo de errores frontend por ruta y release.
- Uploads documentales por estado y empresa.
- Ingesta de logs por `eventName`, `severity` y `deployEnv`.

## Runbooks

- [Incidente IA](../runbooks/AI_INCIDENT_RUNBOOK.md)
- [Incidente documental / uploads](../runbooks/DOCUMENT_UPLOAD_INCIDENT_RUNBOOK.md)
- [Checklist de rollback](../runbooks/ROLLBACK_CHECKLIST.md)

# Observabilidad, trazabilidad y release tracking

## Objetivos cubiertos

1. **Operaciones críticas trazables**: toda operación de IA, subida documental y llamada genérica a Functions genera o propaga un `correlationId`.
2. **Incidentes detectables**: frontend captura errores globales/render, backend emite logs JSON estructurados y los indicadores de alerta están definidos.
3. **Errores atribuibles a release**: cada evento incluye `APP_VERSION`, `BUILD_ID`, `GIT_SHA` y `DEPLOY_ENV`.
4. **Respuesta definida**: los runbooks enlazados definen owner, severidad, diagnóstico y rollback.
5. **Privacidad por defecto**: los logs operacionales se sanitizan antes de escribirse en consola, Cloud Logging u `observabilityEvents`.
6. **Política verificable de ruido**: los eventos de alto volumen tienen política explícita de persistencia, muestreo y retención para evitar costos innecesarios.

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

La política reusable vive en `src/lib/observabilityPolicy.js` y sus garantías críticas están cubiertas por `npm run test:unit`. La revisión de un incidente no debe aceptar solamente que exista un ID: debe confirmar que el mismo ID atraviesa todos los sistemas relevantes.

| Caso | Estado esperado | Evidencia |
| --- | --- | --- |
| Reintentos manuales de IA | Reusar el `correlationId` de la operación visible para el usuario o generar uno nuevo solo para un nuevo intento explícito. | Error UI y log backend comparten el mismo ID. |
| Upload documental | Documento Firestore, metadata de Storage y evento frontend comparten el mismo ID. | Buscar por `correlationId` en Firestore/Storage/Cloud Logging. |
| Análisis posterior al upload | `analyzeDocumentFlow()` toma `doc.correlationId` si no recibe uno explícito. | Documento pasa de `pending` a `processing/analyzed` sin cambiar el ID. |
| Llamadas paralelas | Cada operación paralela debe crear su propio ID salvo que sea parte del mismo flujo de negocio. | Topología clara en Cloud Logging por ID. |
| Cloud Logging | Logs backend son JSON en stdout/stderr, por lo que Cloud Logging los indexa como `jsonPayload`. | Filtro `jsonPayload.correlationId="..."`. |
| Reintentos automáticos/red | El error conserva el ID original; un reintento automático de la misma acción no debe ocultar el ID fallido. | UI, consola y evento `*_failed` muestran el mismo `correlationId`. |
| Reintentos manuales/nueva intención | Un nuevo click del usuario puede crear un nuevo ID, pero debe quedar claro en auditoría que es otra ejecución. | Dos eventos con IDs distintos y timestamps consecutivos. |

## PII y datos sensibles

Los logs operacionales **no deben contener** prompts completos, documentos, rutas con nombres de archivo, respuestas IA completas, correos, RFCs, tokens, secrets ni URLs descargables.

Controles implementados:

- `sanitizeObservabilityPayload()` centraliza la sanitización para frontend y pruebas unitarias.
- `logFrontendEvent()` sanitiza payloads antes de escribirlos en consola.
- `persistObservabilityEvent()` sanitiza payloads y ya no persiste `userEmail`; conserva `ownerUid` cuando existe.
- `structuredLog()` de Functions sanitiza payloads antes de emitir JSON a stdout/stderr.
- El backend registra `promptLength`, `status`, `latencyMs`, `model`, `firebaseUid` y `correlationId`, pero no el prompt.
- Los uploads registran `contentType` y `fileSize`, pero no `storagePath` ni nombre original del archivo en eventos operacionales.
- Las claves sensibles (`prompt`, `content`, `documentText`, `fileName`, `storagePath`, `downloadUrl`, `email`, `rfc`, `token`, `secret`, `apiKey`) se redactan por nombre de campo; emails/tokens embebidos en mensajes se reemplazan por marcadores.
- La auditoría de consultas IA registra longitud y cantidad de documentos, no el texto consultado.

> Nota: Firestore puede almacenar contenido funcional necesario para la experiencia del producto (por ejemplo, conversaciones guardadas). Esta política se refiere a logs operacionales y eventos de observabilidad.

## Control de ruido, cardinalidad y costo

`getObservabilityEventPolicy()` define por evento si debe persistirse, su muestreo sugerido y la retención operativa. La regla base es: errores y warnings accionables se conservan completos; eventos `*_completed`/`*_started` de alto volumen se dejan como consola JSON o se muestrean antes de persistirlos.

Revisión operativa recomendada semanal:

| Riesgo | Revisión | Acción recomendada |
| --- | --- | --- |
| Volumen diario | Bytes/día en Cloud Logging por `eventName` y `deployEnv`. | Reducir logs `INFO` de flujos de alta frecuencia o moverlos a métricas agregadas. |
| Cardinalidad | Conteo de valores distintos por `eventName`, `correlationId`, `companyId`, `route`, `status`. | No agregar campos libres como prompts, nombres de archivo, correos o URLs. |
| Costos | Ingesta y retención por sink/bucket. | Retención corta para debug; retención mayor solo para auditoría necesaria. |
| Filtros | Revisar exclusiones de logs no accionables. | Mantener errores y warnings; aplicar la política de `sampleRate` para `*_started` y `*_completed`. |
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
| Cloud Functions errors | `resource.type="cloud_function"`, `severity>=ERROR`, `jsonPayload.deployEnv="production"` | 5 errores en 5 min o 5xx > 1% | SEV1/SEV2 | Equipo Plataforma |
| AI failures | Logs `eventName="ai_request_failed"` y `status>=500` / total `ai_request_completed` | > 2% durante 5 min | SEV2 | Equipo Plataforma/IA |
| AI latencia p95 | `latencyMs` en `ai_request_completed` | p95 > 8s durante 10 min | SEV2 | Equipo Plataforma/IA |
| AI tokens/costo diario por empresa | `aiUsage` y `aiCostLogs` agrupados por `companyId` y fecha UTC | 80% de `AI_DAILY_TOKEN_LIMIT` o `AI_DAILY_BUDGET_USD` | SEV2/SEV3 | Equipo Plataforma/FinOps |
| Storage errors | `eventName="document_upload_failed"` / `document_storage_error` o errores `gcs_bucket` | > 5 en 10 min | SEV2 | Equipo Documentos |
| Security rules denials anomaly | `PERMISSION_DENIED` agrupado por `uid`, `companyId` y colección | > 3x baseline 7 días o > 20 por actor en 10 min | SEV2/SEV3 | Equipo Plataforma/Seguridad |
| Frontend errors | `observabilityEvents.eventName="frontend_error"` | > 10 errores únicos en 10 min | SEV3 | Equipo Frontend |
| Log ingestion spike | Bytes/minuto por `deployEnv=production` | > 2x baseline durante 15 min | SEV3 | Equipo Plataforma |
| PII leakage sentinel | Logs con patrones de email/token en `jsonPayload.message` o campos no permitidos | > 0 en 5 min | SEV2 | Equipo Plataforma/Seguridad |

## Dashboard mínimo

La definición operativa versionada vive en [`monitoring-config.json`](./monitoring-config.json) e incluye los widgets obligatorios para `aiUsage`, `aiCostLogs` y `aiAuditLogs`. El tablero mínimo debe mostrar:

- `aiUsage`: tokens reservados/consumidos, solicitudes y costo estimado por `companyId` y fecha UTC.
- `aiCostLogs`: costo estimado, tokens de entrada/salida/totales por `companyId`, proveedor y modelo.
- `aiAuditLogs`: estados, eventos, latencia y `correlationId` por empresa y usuario.
- Error rate IA por release (`gitSha`, `buildId`).
- Latencia p50/p95/p99 de función `ai`.
- Top `correlationId` con fallos.
- Conteo de errores frontend por ruta y release.
- Uploads documentales por estado y empresa.
- Ingesta de logs por `eventName`, `severity` y `deployEnv`.

## Defaults IA revisados

Los defaults permanecen conservadores para estabilización y están reflejados en `functions/handlers/aiHandler.js` y `monitoring-config.json`:

| Variable | Default | Decisión | Motivo operativo |
| --- | ---: | --- | --- |
| `AI_DAILY_TOKEN_LIMIT` | `50000` tokens/día/empresa | Mantener | Acota abuso y costo mientras se obtiene baseline real por empresa. |
| `AI_DAILY_BUDGET_USD` | `5` USD/día/empresa | Mantener | Presupuesto bajo suficiente para operación inicial y alertable al 80%. |
| `AI_RATE_LIMIT_MAX_REQUESTS` | `30` solicitudes por `60000` ms | Mantener | Permite uso interactivo y limita ráfagas por usuario/empresa. |

## Runbooks

- [Incidente IA](../runbooks/AI_INCIDENT_RUNBOOK.md)
- [Incidente documental / uploads](../runbooks/DOCUMENT_UPLOAD_INCIDENT_RUNBOOK.md)
- [Checklist de rollback](../runbooks/ROLLBACK_CHECKLIST.md)

## Checks automatizados mínimos

- `npm run test:unit` valida normalización de `correlationId`, límites de longitud/profundidad/cardinalidad, redacción de PII y política de persistencia/muestreo.
- `npm run lint` debe ejecutarse antes de desplegar para detectar importaciones o payloads inconsistentes.
- `npm run build` confirma que los cambios de instrumentación no rompen el bundle de frontend.

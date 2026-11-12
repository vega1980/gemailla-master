# Plan por archivos

## Verificación del PR 0

Contrato validado con openapi-spec-validator (OpenAPI 3.0.3); validación de arquitectura existente y git diff --check satisfactorios. No se ejecutaron suites de aplicación: este cambio añade documentación y contrato, sin modificar comportamiento.

## PR 0 · Este cambio

- docs/architecture/README.md: cinco piezas y criterios de aceptación.
- docs/architecture/ADR-001.md: límites, stack, identidad, datos y operación.
- docs/architecture/inventory.md y firebase-dependencies.json: base observada.
- docs/architecture/migration.md: corte, conciliación y recuperación.
- contracts/openapi.json: contrato inicial, versionado y protegido por defecto.

## PR 1 · Seguridad y recorrido base

- server/domain/tenancy/: identidades, membresías y roles.
- server/application/: casos de empresa, invitación y documentos.
- server/infrastructure/oidc/: validación mediante biblioteca; proveedor pendiente.
- server/infrastructure/postgres/: transacciones con contexto y repositorios.
- migrations/: tablas, RLS, FK compuestas, roles mínimos y outbox.
- server/transport/http/: rutas desde OpenAPI y validación de entradas/salidas.
- src/infrastructure/http/: adaptadores para módulos migrados.
- tests/integration/: acceso directo SQL y API entre empresas, conexiones reutilizadas, invitaciones y revocación.

## PR 2 · Evaluación y consumo

- server/domain/assessments/: evidencias, reglas versionadas, revisión humana.
- server/infrastructure/{vertex,regulatory}/: extraer adaptador Gemini; adaptar protocolo regulatorio existente.
- server/application/: evaluación, reserva/conciliación de cuota y acciones.
- server/infrastructure/telemetry/: trazas y logs redactados.
- src/modules/{audit,documents,dashboard}/: estados de trabajo, evidencias, revisión y consumo.
- tests/integration/: cuota concurrente, timeout ambiguo, salida inválida, cita inexistente y fallos del motor.

## PR 3 · Operación y despliegue

- server/workers/: escaneo, evaluación, exportación y entrega outbox.
- infra/terraform/: Cloud Run, Cloud SQL, Storage, Tasks, IAM y secretos.
- .github/workflows/: checks actuales + SQL/RLS, contrato y E2E del nuevo flujo; identidad federada y staging aislado.
- scripts/migration/: exportación/importación, manifiestos, conciliación y dry-run.
- docs/runbooks/: indisponibilidad de IA, restauración y corte de Firebase.

La migración de todos los dominios (finanzas, RRHH, CRM, ERP, etc.) requiere incrementos posteriores: estos tres PR no deben presentarse como sustitución completa de Firebase.

## Contrato

OpenAPI es el diseño inicial de la API empresarial, no una API pública ni el contrato privado de next. Este último se define tras verificar el publicador existente. No exponer CRUD genérico para modificar roles, planes, costos o estados de escaneo. Las modificaciones futuras del contrato requieren revisión de compatibilidad y validación automática.

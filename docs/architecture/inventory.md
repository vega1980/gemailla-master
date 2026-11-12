# Inventario observado

Base revisada: `cb81c19d580f922b152b5447272bd31b50c7480b`. Revisión estática, sin acceso a producción ni ejecución de suites de aplicación. Importaciones Firebase indexadas en `firebase-dependencies.json`; el índice no identifica por sí solo todas las dependencias dinámicas o los datos reales.

| Ya existe | Ubicación | Tratamiento |
|---|---|---|
| React y módulos empresariales | src/modules/ | Conservar páginas y componentes; sustituir acceso a datos gradualmente |
| Puertos de repositorio | src/domain/shared/repositoryPorts.js | Extender a casos de uso, sin crear abstracciones duplicadas |
| Repositorios y adaptadores Firebase | src/infrastructure/firebase/ | Sustituir por HTTP en frontend y SQL en backend |
| IA, autorización y registro de costos | functions/handlers/aiHandler.js | Separar HTTP, permisos, presupuesto y ejecución; no afirmar que faltan todos los controles |
| Adaptador Gemini | functions/handlers/geminiVertexAdapter.js | Reutilizar tras revisar dependencias y contrato |
| Presupuestos y autenticación | functions/services/budgetService.js, authService.js | Extraer puertos y preservar pruebas de comportamiento |
| Cuarentena y retención | functions/handlers/quarantineScanner.js, quarantineRetention.js | Preservar estados, sustituir triggers Firebase por eventos/colas autenticados |
| Membresías e invitaciones | functions/handlers/company* y syncCompanyClaimsHandler.js | Migrar claims a identidad OIDC + membresías SQL |
| Auditoría y agregaciones | functions/handlers/domainAuditTriggers.js, companyMetricsAggregationHandler.js | Sustituir triggers por transacciones y outbox |
| Sincronización regulatoria | functions/services/regulatoryPublisher.js, scripts/sync-regulatory.mjs | Conservar contrato existente hasta verificar integración con next |
| Observabilidad frontend | src/lib/observability.js | Eliminar escritura directa a Firestore al migrar este flujo |
| Seguridad Firebase | firestore.rules, storage.rules, tests/rules/ | Mantener durante transición; reemplazar garantías con RLS/API/Storage tests |
| CI, staging y E2E | .github/workflows/ | Ya existe CI con lint, tipos, unitarias, functions, reglas y E2E; ampliar para destino |
| Migraciones actuales | scripts/backfill-*, scripts/migrate-deleted-to-archived.mjs | Inventariar efectos y traducir datos; no ejecutar sobre producción en PR 0 |

## Antes de cortar Firebase

Inventariar colecciones, subcolecciones, índices, identificadores, referencias, volúmenes, retenciones, eventos, objetos y generaciones en un entorno autorizado. La revisión del repositorio no prueba qué recursos están desplegados. Exportar identidades y evaluar si el proveedor elegido soporta su migración; no asumir que las contraseñas son portables. Verificar procesos programados, App Check, CORS, Hosting y variables de entorno. Firebase Auth, Firestore, Functions, Hosting y su SDK desaparecen solo tras migrar sus consumidores; Cloud Storage puede mantenerse usando IAM y SDK de Google Cloud.

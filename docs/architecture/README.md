# Reestructuración de GEMAILLA · PR 0

Estado: propuesta preparada sobre el código; no hay un backend nuevo desplegado.

El producto debe completar: empresa → usuarios → documentos → evaluación con evidencias → revisión → acciones → exportación. La arquitectura sirve a ese recorrido.

## Cinco piezas y aceptación

| Pieza | Responsabilidad | Evidencia de aceptación antes del piloto |
|---|---|---|
| Flujo completo | Empresas, invitaciones, documentos, evaluaciones, acciones, exportaciones | E2E con dos empresas, desde registro hasta descarga autorizada |
| Motor verificable | Norma y versión, evidencia, reglas deterministas y revisión humana | Evaluación reproducible con fixtures revisados por especialista |
| Seguridad | Identidad, pertenencia, permisos, RLS, archivos privados | Pruebas negativas para API, SQL, archivos, jobs y exportaciones |
| Operación | Colas, costos, cuotas, trazas, respaldos y recuperación | Reentrega sin duplicados, concurrencia de cuotas y restauración ensayada |
| Valor comercial | Un segmento y una obligación inicial | Piloto con línea base de tiempo, precisión, costo variable y disposición a pagar |

La selección del segmento, obligación, conjunto de evaluación y metas comerciales queda pendiente de validación con clientes; no se inventan resultados ni cumplimiento legal.

Leer `ADR-001.md`, `inventory.md`, `migration.md` y `implementation-plan.md`. El contrato inicial está en `../../contracts/openapi.json` y describe comportamiento futuro, no endpoints ya disponibles.

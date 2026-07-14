# Línea base de congelamiento - 2026-07-13

## Alcance

Se establece una política temporal de congelamiento funcional. Durante esta fase solo se aceptan correcciones, seguridad, estabilización, observabilidad, pruebas y documentación necesaria.

No se implementan funcionalidades nuevas ni se altera lógica funcional de GEMAILLA en esta línea base.

## Identidad reproducible de la evidencia

- **Commit publicado y auditado:** `d18764ef974fad64869cea44c2b6bc20493a46a3`.
- **Verificación asociada:** GitHub Actions, workflow `CI`, ejecución `329`, conclusión `success`.
- **Node.js usado en la evidencia local:** `v22.22.2`.
- **npm usado en la evidencia local:** `11.4.2`.
- **Configuración de presupuestos:** `performance-budgets.json`.

El SHA `08e53fca5a078a5bebd8c2422282f54d8d12ea96` que aparece en algunos logs fue un identificador temporal del workspace de Codex anterior a la publicación y no existe como objeto en GitHub. No debe utilizarse para identificar el código auditado.

La referencia autoritativa de esta línea base es el commit publicado `d18764ef974fad64869cea44c2b6bc20493a46a3`, que sí existe en el repositorio y tiene una ejecución de CI exitosa vinculada directamente.

## Cambios validados

- `performance-budgets.json` es la única fuente de verdad para los presupuestos.
- `/dashboard` usa `src/modules/dashboard/pages/DashboardPage.jsx`.
- `/finance` usa `src/modules/finance/pages/FinancialHubPage.jsx`.
- Se eliminaron aliases y fallbacks hacia `src/pages`.
- No se modificaron los límites numéricos de bundle.
- La prueba `tests/unit/bundleBudgetConfig.test.mjs` valida rutas modulares, límites intactos, ausencia de compatibilidad legacy y fallo cuando falta una entrada del manifest.

## Resultados confirmados

| Verificación | Resultado |
| --- | --- |
| Lint | PASS |
| Typecheck | PASS |
| Validación de arquitectura | PASS |
| Build | PASS |
| Presupuesto de bundle | PASS |
| Regresión de configuración de bundle | PASS, 4/4 |
| Medición de arquitectura | PASS |
| Instalación limpia raíz | No ejecutada por bloqueo externo del registry |
| Instalación y pruebas de Functions | No ejecutadas por bloqueo externo del registry |
| Reglas con emuladores | No ejecutadas por precondiciones externas |
| E2E con emuladores | No ejecutadas por precondiciones externas |
| Auditorías npm | Bloqueadas por respuesta 403 del endpoint |

## Alcance de la aprobación

No se confirma ningún fallo funcional en las verificaciones ejecutadas. Tampoco se declara reproducibilidad completa desde cero ni preparación final para producción, porque quedaron pendientes la instalación limpia, Functions, reglas, E2E y auditorías npm.

## Métricas actuales

| Métrica | Valor |
| --- | ---: |
| Archivos medidos | 235 |
| Dependencias internas | 532 |
| Paquetes externos importados | 66 |
| Grupos de líneas duplicadas | 30 |

## Presupuestos de bundle

| Ruta | Uso / límite gzip |
| --- | ---: |
| Vendors compartidos | 571.2 kB / 650.0 kB |
| `/dashboard` | 6.3 kB / 95.0 kB |
| `/documents` | 6.6 kB / 120.0 kB |
| `/finance` | 16.8 kB / 180.0 kB |
| `/ai` | 4.8 kB / 140.0 kB |

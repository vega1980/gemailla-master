# Línea base de congelamiento - 2026-07-13

## Alcance y política temporal

Se establece una política temporal de congelamiento funcional. Durante esta fase solo se aceptan correcciones, seguridad, estabilización, observabilidad, pruebas y documentación necesaria.

No se implementan funcionalidades nuevas ni se altera lógica funcional de GEMAILLA en esta línea base.

## Commit y entorno auditado

- **Commit exacto auditado:** `08e53fca5a078a5bebd8c2422282f54d8d12ea96`.
- **Fecha UTC de regeneración:** `2026-07-13T05:45:50Z`.
- **Node.js:** `v22.22.2`.
- **npm:** `11.4.2`.
- **Registry npm configurado:** `https://registry.npmjs.org/`.
- **Archivo real de presupuestos leído por `budgetPath`:** `performance-budgets.json`.

## Cambio de fuente de verdad de presupuestos

`performance-budgets.json` es la única fuente de verdad para los módulos presupuestados. Se actualizaron únicamente los módulos configurados de las rutas existentes:

- `/dashboard`: `src/modules/dashboard/pages/DashboardPage.jsx`.
- `/finance`: `src/modules/finance/pages/FinancialHubPage.jsx`.

No se modificaron `sharedVendorMaxKb`, `routeMaxKb`, `allowedVendors` ni nombres de rutas.

## Eliminación de compatibilidad legacy

`scripts/check-bundle-budgets.js` ya no contiene `moduleAliases`, fallbacks hacia `src/pages`, búsqueda por nombre parcial ni selección automática de chunks parecidos. El script usa directamente `manifest[budget.module]` y reporta `budget.module` si una entrada configurada no existe en el manifest.

La búsqueda final `rg -n "src/pages/Dashboard.jsx|src/pages/FinancialHub.jsx|moduleAliases" scripts tests` no encontró resultados.

## Resultados por comando

Cada log incluye nombre de verificación, fecha UTC, SHA, comando exacto, versiones de Node/npm, salida completa, código de salida y clasificación final.

| Área | Comando | Clasificación | Log | Resultado |
| --- | --- | --- | --- | --- |
| Diagnóstico npm/red | `npm ping`; `npm view unpdf@1.5.1 version`; `npm view firebase-admin@12.7.0 version`; `npm view fast-xml-parser@5.3.4 version` | `BLOCKED_NETWORK` | `npm-network.log` | Todos devuelven exit code `1`; `overall_exit_code=1`; el registry responde `403 Forbidden`. |
| Instalación limpia raíz | `rm -rf node_modules functions/node_modules && npm ci` | `NOT_RUN_PREREQUISITE_FAILED` | `npm-ci.log` | No se ejecuta porque el diagnóstico de red bloquea el registry npm. |
| Instalación limpia Functions | `npm --prefix functions ci` | `NOT_RUN_PREREQUISITE_FAILED` | `functions-npm-ci.log` | No se ejecuta porque el registry npm devuelve `403`; no se cambian dependencias ni locks. |
| Lint | `npm run lint` | `PASS` | `lint.log` | ESLint sin errores. |
| Typecheck completo | `npm run typecheck` | `PASS` | `typecheck.log` | `jsconfig.json` y `tsconfig.critical.json` completan correctamente. |
| Validación arquitectónica | `npm run validate:architecture` | `PASS` | `validate-architecture.log` | Validación local de arquitectura aprobada. |
| Build | `npm run build` | `PASS` | `build.log` | Build Vite completo con dependencias ya presentes en el workspace. |
| Presupuesto de bundle | `npm run budget:bundle` | `PASS` | `bundle-budget.log` | Entradas modulares encontradas en manifest y presupuestos gzip dentro del límite. |
| Prueba de regresión budget | `node --test tests/unit/bundleBudgetConfig.test.mjs` | `PASS` | `bundle-budget-regression.log` | 4 tests pass: rutas modulares, ausencia de legacy, límites intactos y fallo si falta una entrada en manifest. |
| Medición arquitectónica | `npm run measure:architecture` | `PASS` | `measure-architecture.log` | Métricas regeneradas en `docs/architecture/architecture-metrics.*`. |
| Unit completo | `npm run test:unit` | `NOT_RUN_PREREQUISITE_FAILED` | `unit.log` | No se ejecuta porque no se pudo verificar instalación limpia raíz/Functions. |
| Functions | `npm run test:functions` | `NOT_RUN_PREREQUISITE_FAILED` | `functions.log` | No se ejecuta porque `functions/node_modules` no fue instalado desde limpio por bloqueo de registry. |
| Reglas con emuladores | `npm run test:rules:emulators` | `NOT_RUN_PREREQUISITE_FAILED` | `rules-emulators.log` | No se ejecuta por precondiciones de instalación/emuladores no satisfechas en el runner restringido. |
| E2E con emuladores | `npm run test:e2e:emulators` | `NOT_RUN_PREREQUISITE_FAILED` | `e2e-emulators.log` | No se ejecuta por precondiciones de instalación/emuladores no satisfechas en el runner restringido. |
| Auditoría raíz | `npm audit --audit-level=moderate` | `BLOCKED_AUDIT_ENDPOINT` | `audit.log` | Endpoint de advisories devuelve `403 Forbidden`; no se declaran vulnerabilidades ni PASS. |
| Auditoría Functions | `npm --prefix functions audit --audit-level=moderate` | `BLOCKED_AUDIT_ENDPOINT` | `functions-audit.log` | Endpoint de advisories devuelve `403 Forbidden`; no se cambian dependencias. |

## Comandos aprobados

- `npm run lint`
- `npm run typecheck`
- `npm run validate:architecture`
- `npm run build`
- `npm run budget:bundle`
- `node --test tests/unit/bundleBudgetConfig.test.mjs`
- `npm run measure:architecture`

## Fallos reales del código

No se confirma ningún fallo funcional de código en esta ejecución con Node 22. No se declara reproducibilidad completa desde cero ni preparación final para producción porque `npm ci`, instalación de Functions, reglas y E2E con emuladores no pudieron ejecutarse correctamente por bloqueos externos.

## Bloqueos externos o de infraestructura

1. **`BLOCKED_NETWORK`:** `npm ping` y `npm view` contra `https://registry.npmjs.org/` devuelven `403 Forbidden` con exit code individual `1` y `overall_exit_code=1`.
2. **`BLOCKED_AUDIT_ENDPOINT`:** `npm audit` raíz y Functions reciben `403 Forbidden` del endpoint de advisories bulk.
3. **Precondiciones de instalación/emuladores no satisfechas:** no se ejecutan suites dependientes de una instalación limpia ni de emuladores.

## Métricas arquitectónicas actuales

| Métrica | Valor |
| --- | ---: |
| Archivos medidos | 235 |
| Dependencias internas | 532 |
| Paquetes externos importados | 66 |
| Grupos de líneas duplicadas | 30 |

## Tamaños reales de build y estado de presupuesto

| Métrica / ruta | Tamaño |
| --- | ---: |
| Vendors compartidos | 571.2 kB gzip / 650.0 kB |
| `/dashboard` | 6.3 kB gzip / 95.0 kB |
| `/documents` | 6.6 kB gzip / 120.0 kB |
| `/finance` | 16.8 kB gzip / 180.0 kB |
| `/ai` | 4.8 kB gzip / 140.0 kB |

`npm run budget:bundle` queda en `PASS` sin modificar límites de tamaño.

# T1 · Causa raíz de los nueve valores rechazados

Estado: **auditoría completada; corrección funcional pendiente**. Base inspeccionada: `8193917`, sobre el PR #244. Alcance: cinco catálogos de UI y sus contratos de creación/actualización en Zod y las reglas Firestore del repositorio. No se consultaron reglas desplegadas ni datos productivos.

## Conclusión

La causa raíz común es **duplicación de catálogos y falta de reconciliación al introducir validación restrictiva**. Las UI mantienen listas propias; Zod y Firestore mantienen otras copias y coinciden entre sí en los cinco campos. De 23 opciones ofrecidas por la UI, 14 están admitidas y **nueve están fuera de ambos contratos**.

La clasificación demostrada es UI desalineada respecto al contrato vigente. No se puede concluir solo por código que deba ampliarse el esquema o eliminarse la opción: eso requiere decidir la semántica del dominio. No hay evidencia de nueve fallos distintos del validador ni de una discrepancia Zod–Firestore en estos enums.

## Nueve valores y origen exacto

| Nº | Colección / campo | Valor rechazado | Origen UI | Contrato Zod / regla Firestore |
|---|---|---|---|---|
| 1 | crmClients.status | perdido | [ClientList.jsx:29](../../src/features/crm/components/ClientList.jsx#L29), clave de statusConfig | [DOMAIN_ENUMS.crmClientStatus:6](../../src/shared/validation/domainSchemas.js#L6), crmClientSchema:26 / [validCrmClient:382](../../firestore.rules#L382) |
| 2 | crmInteractions.type | cotizacion | [ClientList.jsx:32](../../src/features/crm/components/ClientList.jsx#L32), clave de interactionTypeLabel | [DOMAIN_ENUMS.interactionType:7](../../src/shared/validation/domainSchemas.js#L7), crmInteractionSchema:28 / [validCrmInteraction:384](../../firestore.rules#L384) |
| 3 | crmInteractions.type | pedido | [ClientList.jsx:32](../../src/features/crm/components/ClientList.jsx#L32), mismo catálogo | mismo contrato |
| 4 | crmInteractions.type | soporte | [ClientList.jsx:32](../../src/features/crm/components/ClientList.jsx#L32), mismo catálogo | mismo contrato |
| 5 | crmInteractions.type | otro | [ClientList.jsx:32](../../src/features/crm/components/ClientList.jsx#L32), mismo catálogo | mismo contrato |
| 6 | employees.employmentType | freelance | [EmployeeDirectory.jsx:231](../../src/features/hr/components/EmployeeDirectory.jsx#L231), SelectItem literal | [DOMAIN_ENUMS.employmentType:8](../../src/shared/validation/domainSchemas.js#L8), employeeSchema:29 / [validEmployee:385](../../firestore.rules#L385) |
| 7 | employees.employmentType | temporal | [EmployeeDirectory.jsx:232](../../src/features/hr/components/EmployeeDirectory.jsx#L232), SelectItem literal | mismo contrato |
| 8 | payroll.status | aprobado | [PayrollManager.jsx:18](../../src/features/hr/components/PayrollManager.jsx#L18), statusConfig; [botón Aprobar:300](../../src/features/hr/components/PayrollManager.jsx#L300) | [DOMAIN_ENUMS.payrollStatus:8](../../src/shared/validation/domainSchemas.js#L8), payrollSchema:30 / [validPayroll:386](../../firestore.rules#L386) |
| 9 | kpis.frequency | diario | [StrategicKPIs.jsx:255](../../src/features/operations/components/StrategicKPIs.jsx#L255), array literal del Select | [kpiSchema:32](../../src/shared/validation/domainSchemas.js#L32), enum literal propio / [validKpi:388](../../firestore.rules#L388) |

## Comparación de listas completas

| Campo | Opciones UI | Permitidas por Zod y Firestore, idénticas entre sí |
|---|---|---|
| crmClients.status | activo, inactivo, prospecto, perdido | prospecto, activo, inactivo, archived |
| crmInteractions.type | llamada, email, reunion, cotizacion, pedido, soporte, otro | llamada, email, reunion, mensaje, nota |
| employees.employmentType | tiempo_completo, medio_tiempo, freelance, temporal | tiempo_completo, medio_tiempo, contrato, practicante |
| payroll.status | pendiente, aprobado, pagado | pendiente, procesando, pagado, cancelado, archived |
| kpis.frequency | diario, semanal, mensual, trimestral, anual | semanal, mensual, trimestral, anual |

La diferencia también existe en sentido inverso: algunos valores del contrato no aparecen en el formulario. `archived` es un estado técnico que puede estar correctamente reservado al archivado; su ausencia del Select no demuestra un defecto. Los demás valores requieren revisar el catálogo y el flujo, no inferir equivalencias.

## Camino de rechazo y límite backend

1. ClientList construye sus Select con `Object.entries(statusConfig)` (:235) y `Object.entries(interactionTypeLabel)` (:274). EmployeeDirectory usa SelectItem literales. PayrollManager utiliza statusConfig (:407) y además la transición `updateStatus(id, 'aprobado')` (:300). StrategicKPIs usa un array local.
2. Esos valores se envían sin traducir mediante `firebase.entities.CRMClient`, `CRMInteraction`, `Employee`, `Payroll` o `KPI`.
3. [createRepository:411](../../src/infrastructure/firebase/repositories/createRepository.js#L411) ejecuta `validateDomainWrite` antes de crear. En actualización, [:442](../../src/infrastructure/firebase/repositories/createRepository.js#L442) valida el documento existente combinado con los cambios. El rechazo de enum ocurre antes de persistir; también bloquea el botón Aprobar de nómina.
4. Si se evita el esquema del navegador, las reglas conservan la misma restricción de enum en create/update: crmClients :594/:596, crmInteractions :608/:610, employees :615/:617, payroll :622/:624 y kpis :636/:638. Las comprobaciones de empresa, rol, campos y timestamps siguen siendo condiciones adicionales.

En estos flujos CRUD, el límite del servidor inspeccionado es **Firestore Rules**, no un endpoint CRUD de Cloud Functions. Esta auditoría no demuestra un esquema universal para procesos Admin SDK ni una política desplegada idéntica: compara el código del repositorio. El análisis de reglas es literal; no sustituye su ejecución con emuladores.

## Qué divergencia representa cada grupo

- **Cliente perdido:** catálogo de estados de cliente distinto del contrato. El enum de etapas de negociaciones sí contiene perdido, pero eso no convierte estado de cliente y etapa de negocio en el mismo campo. No traducir automáticamente a inactivo.
- **Interacciones:** la UI mezcla acciones comerciales (cotización/pedido/soporte) con canales, mientras el contrato ofrece canales/notas. Es una divergencia de taxonomía; decidir si se amplía type o se separan tipo de acción y canal.
- **Empleo:** freelance/temporal y contrato/practicante no son alias demostrados. Debe fijarse el significado de employmentType y alinear formularios, almacenamiento y consumidores de RRHH.
- **Nómina aprobada:** la UI implementa pendiente → aprobado → pagado, pero el contrato usa pendiente/procesando/pagado/cancelado. La incompatibilidad afecta un flujo de aprobación, además del Select. Definir la máquina de estados y permisos antes de cambiar la lista.
- **KPI diario:** falta diario en las dos listas de validación. Aquí hay tres arrays independientes: UI, Zod y reglas. Decidir si el producto soporta periodicidad diaria y adaptar el conjunto completo.

Estos puntos explican por qué ampliar todos los enums de forma automática no constituye una corrección de dominio revisada.

## Evidencia histórica

`git blame` localiza las nueve opciones de UI en el snapshot inicial **bd6a23b**, del 3 de junio de 2026, antes de mover los componentes a features. No se afirma que ese snapshot sea su fecha de creación original fuera del historial disponible.

`git log --diff-filter=A` sitúa la introducción de domainSchemas.js en **ca08678**, del 8 de agosto de 2026. Las listas restrictivas de interacciones, empleo, nómina y KPI aparecen en ese cambio y sus reglas correspondientes. **d889995**, del 9 de agosto, modifica zonas de los contratos, pero mantiene los nueve rechazos. La UI no se reconciliaba con esas restricciones. El endurecimiento posterior tampoco añadió comprobación de cobertura de opciones de formulario.

Los valores y rechazos preceden a la actualización a Zod 4 del PR #244. La normalización de opcionales vacíos y el cambio de versión no explican estas discrepancias de pertenencia al enum.

## Auditoría reproducible

Se añadió [scripts/audit-ui-enums.mjs](../../scripts/audit-ui-enums.mjs). Extrae opciones de los archivos JSX con el AST de TypeScript, ejecuta safeParse con los esquemas reales y compara las cláusulas de enum de las reglas. No contiene una segunda lista fija de los nueve valores.

```sh
node scripts/audit-ui-enums.mjs --output=docs/verification/t1/enum-audit.json
```

Resultado guardado en [t1/enum-audit.json](t1/enum-audit.json):

- 5 catálogos y 23 opciones inspeccionados.
- 5 fixtures positivos aceptados por Zod.
- 9 opciones rechazadas por Zod y ausentes en el enum de Firestore.
- Paridad Zod–Firestore en los cinco catálogos.
- Salida del comando: **1**, intencionadamente, porque los defectos siguen presentes. Si cambia la estructura de extracción, el comando falla en vez de asumir listas correctas.

La ejecución no escribe datos. No se repitieron las suites de aplicación para un cambio limitado a auditoría y documentación; lint y la integridad del JSON se comprobaron. La evidencia anterior del PR #245 incluye el fallo de KPI diario en navegador; T1 añade la trazabilidad completa de los nueve valores.

## Cierre de T1 y condición para la siguiente corrección

T1 queda completada: opciones localizadas, esquemas/reglas comparados, causa clasificada y nueve orígenes documentados. No se han ampliado permisos, actualizado catálogos ni migrado datos.

La siguiente corrección debe fijar los valores y transiciones de negocio por campo; compartir el catálogo UI–Zod; mantener o generar reglas equivalentes con verificación de paridad; y añadir casos positivos/negativos y de guardado/actualización para cada valor ofrecido. Debe revisar datos existentes antes de retirar o traducir valores. T1 por sí sola no desbloquea main: permanecen estos rechazos y los demás fallos funcionales del PR #245.

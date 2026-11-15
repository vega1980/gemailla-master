# Verificación funcional módulo por módulo

## Alcance y conclusión

Runtime revisado: **60eec38**, rama del PR #244, todavía sin integrar en main. Node 22.21.1, npm 11.4.2, Chromium Playwright 1.56.1 y Firebase emulado. Datos sintéticos. No se modificó lógica de producto ni producción en esta verificación.

Se ejecutaron **43 casos únicos de navegador**: tras corregir el comprobador y repetir cuatro casos, quedan **40 aprobados y 3 fallidos**. Las 15 rutas y sus pestañas disponibles cargan. Eso no demuestra que los procesos completos funcionen: se reproducen errores en ERP, dashboard y KPI, además de extracción PDF y contratos de formularios. Gemini real sigue sin comprobarse por falta de configuración/credenciales.

## Matriz por módulo

| Módulo | Resultado funcional observado | Pendiente / defecto |
|---|---|---|
| Dashboard | Carga y consulta transacciones | **FALLO:** ingreso confirmado 1000 y gasto 250 producen totalIncome=0, totalExpenses=250 y netCashFlow=750 |
| Empresas | **PASS:** crear desde formulario con opcionales vacíos y conservar tras recarga; cambio de empresa en E2E existente | No se certificó el ciclo completo de invitación/aceptación/revocación |
| Documentos | **PASS:** subir PDF/XML, cuarentena, escaneo mock, apertura y bloqueo viewer | **FALLO:** extractor PDF real incompatible con Node 22; escáner de producción y análisis real pendientes |
| Avisos regulatorios | **PASS:** fixture publicado, captura verificable, permisos e idempotencia en pruebas existentes | No se consultaron fuentes oficiales ni el motor next en vivo |
| ERP | Carga y muestra datos | **FALLO:** registrar ingreso de 123.45 no completa guardado; reglas rechazan payload sin ownerUid |
| Auditoría financiera | **PASS:** sin transacciones, no habilita auditoría; pantalla carga | No se ejecutó auditoría con Gemini ni validación contable/regulatoria |
| Asistente IA | **PASS:** Basic bloquea consulta; rechazo HTTP y auditoría persistente comprobados en E2E existente | Respuesta documental del E2E es simulada; inferencia real pendiente |
| Actividad | **PASS:** evento de transacción generado por backend visible y búsqueda que lo filtra | No se verificaron todos los filtros, retención ni exhaustividad de eventos |
| Suscripciones | **PASS:** muestra plan Basic y no crea permisos de plan al consultar | Selección solicita cambio por mailto; no existe pago automático demostrado |
| Predicciones | **PASS:** Basic bloquea el acceso antes de ejecutar pronóstico | Calidad del pronóstico y consumo real no verificados |
| Finanzas | **PASS:** datos conocidos 1000 − 250 = 750 en UI y PDF descargado; archivo contrastado también con pdftotext | Presupuesto se mantiene en estado React sin guardado observado; proyección usa Math.random; sin validación contable integral |
| Panel cliente | **PASS:** alerta estática correcta para saldo negativo de −500; pestañas cargan | Tendencias/churn/recomendaciones de IA pendientes |
| Operaciones | **PASS:** proyecto guardado y conservado tras recarga | **FALLO:** KPI diario ofrecido en UI es rechazado al guardar |
| CRM | **PASS:** cliente básico guardado y conservado tras recarga; pestañas cargan | **FALLO DE CONTRATO:** estado perdido y cuatro tipos de interacción no aceptados por esquema; ciclo comercial completo pendiente |
| RRHH | **PASS:** empleado básico persistente; nómina fixture de base 1000 produce neto 868 y persiste tras recarga | **FALLO DE CONTRATO:** freelance/temporal y nómina aprobado se rechazan; cálculo fiscal real no certificado |

PASS se limita al comportamiento descrito. No equivale a aprobación total del módulo o de producción. Autenticación y seguridad de rutas se incluyen transversalmente en los E2E existentes; no se verificó identidad productiva.

## Defectos reproducidos

### 1. ERP no puede guardar la transacción del formulario

Pasos: empresa activa como owner → ERP → Nueva Transacción → monto 123.45 y descripción → Registrar. El diálogo permanece abierto y no aparece el registro. La repetición vuelve a fallar.

Causa trazada: `normalizeTransactionDraft` produce companyId y campos financieros, pero no ownerUid. `createRepository` añade campos de auditoría, no ownerUid. `buildEntities` usa ese repositorio sin `withCreateDefaults`. `validTransactionCreate` exige ownerUid; el emulador registra rechazo de create en la regla de transactions. Corregir el contrato en el límite de persistencia con identidad autorizada, sin rebajar las reglas.

### 2. Dashboard pierde ingresos/gastos en el agregado

La segunda comprobación usa dos documentos con status=confirmed y espera a que transactionCount=2. `module-evidence/dashboard-metrics.json` conserva esperado y real: ingresos 1000 esperados, 0 reales; gastos 250 y saldo 750.

`companyMetricsAggregationHandler.js` propaga ZERO_METRIC_FIELDS y ZERO_MONTHLY_FIELDS en cada set con merge, junto a incrementos solo de los campos afectados. El evento de gasto vuelve a escribir totalIncome=0. También puede borrar contadores ajenos al evento. Los ceros deben inicializarse una sola vez o utilizar incrementos que no sobrescriban campos no afectados; verificar actualizaciones, borrados, reentregas y mezcla de eventos.

La captura de UI muestra además las tarjetas en cero aunque el agregado ya tiene gastos y saldo. La consulta usa listByCompany filtrando companyId, mientras la regla de companyMetrics autoriza por el identificador de documento de la ruta. Debe revisarse ese contrato de lectura (por ejemplo, lectura directa del documento autorizado) y evitar que un error de consulta se presente como cero financiero. El reinicio de campos sí está confirmado por el JSON del agregado; esta segunda discrepancia requiere comprobar explícitamente el error de consulta al corregirla.

### 3. Opciones visibles y esquemas no coinciden

Se ejecutó safeParse con los esquemas reales, variando solo el campo de un payload válido. **Nueve valores fallan**:

| Colección | Campo | Valores ofrecidos por UI y rechazados |
|---|---|---|
| crmClients | status | perdido |
| crmInteractions | type | cotizacion, pedido, soporte, otro |
| employees | employmentType | freelance, temporal |
| payroll | status | aprobado |
| kpis | frequency | diario |

No son nueve flujos completos de navegador: son nueve pruebas del contrato real. El KPI diario sí se reprodujo además en navegador: se selecciona diario correctamente, se pulsa Crear KPI y el diálogo no se cierra. La solución requiere alinear catálogo de UI, esquemas y reglas con las decisiones de negocio, sin abrir enums indiscriminadamente.

### 4. La extracción PDF falla bajo el runtime configurado

El PDF financiero generado es válido: tiene cabecera PDF y pdftotext extrae los tres importes. Al invocar el `extractPdfText` real de `functions/handlers/documentContextBuilder.js` con ese archivo bajo Node 22.21.1, el proceso termina con `TypeError: Promise.try is not a function` desde unpdf/pdfjs. La misma incompatibilidad apareció en el lector inicial del comprobador. No es un fallo de exportación: afecta al parser utilizado para contexto documental de IA.

Revisar compatibilidad del parser/runtime y añadir una prueba con PDF real antes de afirmar que el análisis documental funciona. No se aplicaron polyfills ni se cambió el runtime en esta auditoría.

## Uso de Context7

Se contrastaron los criterios con documentación técnica obtenida mediante Context7:

- [Firebase JavaScript SDK: ignoreUndefinedProperties](https://github.com/firebase/firebase-js-sdk/blob/main/docs-devsite/firestore.firestoresettings.md): undefined se rechaza por defecto. No se desactivó esa protección.
- [Playwright 1.56.1: mocks](https://github.com/microsoft/playwright/blob/v1.56.1/docs/src/mock.md): route.fulfill evita llamar a la API real. Por eso no se presenta el E2E simulado como Gemini funcional.
- [Playwright 1.56.1: descargas](https://github.com/microsoft/playwright/blob/v1.56.1/docs/src/api/class-download.md): esperar el evento y comprobar el archivo descargado.
- [Zod 4.6.7: enum](https://github.com/colinhacks/zod/blob/v4.6.7/packages/docs/content/api.mdx): valores fuera del catálogo son rechazados. Los fallos del contrato se comprobaron con la versión instalada.

Context7 aporta documentación, no acceso a producción ni ejecución de pruebas; las evidencias de runtime se obtuvieron por separado.

## Evidencias, correcciones del comprobador y reproducción

`module-evidence/results.json` incluye los casos y ambas ejecuciones. La primera dio 39 PASS / 4 FAIL. Se corrigieron dos problemas del comprobador: fixture de dashboard sin status=confirmed y selector de frecuencia de KPI. El lector PDF inicial también resultó incompatible con Node 22; se comprobó la exportación por sus bytes y con pdftotext independiente. La repetición de cuatro casos dio 1 PASS / 3 FAIL. El resultado consolidado de 43 casos únicos es 40 PASS / 3 FAIL; no se ocultaron las iteraciones iniciales ni se cambiaron expectativas para hacer pasar defectos.

Las capturas de ERP/dashboard/KPI son de la repetición. Se adjuntan PDF, texto extraído, estado real del agregado y resultados de contratos. La fuente de pruebas está en `tests/e2e/module-functional.spec.js`.

```sh
npm run test:e2e:emulators
```

Esa suite debe fallar hasta corregir los defectos reproducidos. El proyecto usa un escáner mock y respuestas de IA interceptadas en un caso existente. No hubo credenciales GCP ni entorno productivo. Se usaron los ajustes locales ya documentados para proxy loopback y puerto Pub/Sub 18085; se restauraron al terminar.

El nuevo PR de verificación se apila sobre el PR #244; no confundir sus resultados con main ni con un despliegue aprobado. Prioridad de corrección: registro ERP, agregados financieros, parser PDF y alineación de opciones/contratos; después inferencia real, procesos avanzados y carga autenticada.

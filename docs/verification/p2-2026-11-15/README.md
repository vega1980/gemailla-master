# P2 · Verificación de servicios reales

Fecha: 15 de noviembre de 2026, America/Mexico_City. Capturas de fuentes aproximadamente a las 14:08 local (20:08 UTC).

Master revisado: **f557fb7** (rama del PR #246, no main). Next: **71be549**. Runtime Master: Node 22.21.1; Next: Node 22.23.1, según sus requisitos. No se desplegó, cobró, envió correo ni modificó información de producción.

## Estado de los seis pendientes

| ID | Módulo | Resultado de esta verificación | Estado P2 |
|---|---|---|---|
| 9 | Avisos regulatorios | Tres fuentes oficiales reales consultadas; 490 registros ingeridos con integridad; cinco páginas exportadas validadas por Master; muestra real DOF publicada y descargada en UI con emuladores | **Parcialmente verificado**. Transporte nativo y operación productiva pendientes |
| 10 | Auditoría financiera | Implementación llama a askLLM con resumen financiero y esquema; no se ejecutó análisis con un modelo real | **Bloqueado por configuración de staging/Vertex** |
| 11 | Asistente IA | Se ejecutó test:gemini:live; su precondición falla porque faltan proyecto/ubicación/modelo. No llegó a llamar al proveedor | **Bloqueado por configuración**, no se atribuye un fallo al modelo |
| 12 | Suscripciones | Cambio y cancelación generan mailto a soporte; no se encontró checkout, proveedor de pagos ni webhook de cobros en los flujos revisados | **Cobro automático no implementado en el flujo actual**. Requiere implementación antes de poder probarlo |
| 13 | Predicciones | El código solicita pronósticos a la misma API de IA; falta llamada real y evaluación contra datos de referencia | **Bloqueado por configuración y validación de calidad pendiente** |
| 14 | Panel cliente | Tendencias, alertas IA y churn usan askLLM; la alerta determinista existente no acredita esas llamadas | **Bloqueado por configuración de staging/Vertex** |

Se mantiene la prioridad P2 indicada: este informe no convierte los pendientes en bloqueantes inmediatos de integración. Tampoco acredita aptitud productiva de esos servicios.

## 9 · Prueba con fuentes oficiales reales

| Fuente | URL | HTTP | Registros extraídos |
|---|---|---|---|
| DOF | https://dof.gob.mx/website/sumario.xml | 200 | 17 |
| Cámara de Diputados | https://www.diputados.gob.mx/LeyesBiblio/index.htm | 200 | 320 |
| SAT | https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/normatividad_rmf_rgce2026.html | 200 | 153 |

Se usaron consultas GET reales con TLS verificado y proxy/CA heredados. No se sustituyeron cuerpos por fixtures. El motor Next recibió los bytes reales a través de su interfaz fetchImpl, conservó tres capturas/observaciones y 490 documentos/versiones/publicaciones en una SQLite local aislada. Su verify devolvió ok=true y no quedaron observaciones pendientes.

Las cinco páginas de exportación, con cursor final 490, pasaron validatePage del publicador real de Master: relaciones, URL, hashes, captura y contrato compartido. Esto valida los registros de las tres fuentes, no solo el primer lote.

La prueba de navegador existente se ejecutó con GEMAILLA_REAL_EXPORT apuntando a una exportación de **un aviso real DOF**, sin recurrir al fixture. Pasó:

- Publicación mediante el publicador real en Firestore/Storage emulados.
- Aviso y enlace oficial visibles en el dashboard.
- Captura descargada cuyo SHA-256 coincide con el artefacto de Next.
- Cambio a una segunda empresa sin mostrar el aviso ni su evidencia.

El aviso observado corresponde al título «Decreto por el que se expide la Ley de Ingresos de la Federación para el Ejercicio Fiscal de 2027». La representación probada es metadata del sumario DOF; no es la descarga ni interpretación del texto jurídico íntegro.

### Límite de transporte

La ejecución nativa del comando engine run contra DOF terminó con ECONNREFUSED al conectar directamente al destino. El transporte HTTPS de Next declara que no usa enrutamiento implícito por proxy; curl sí logró acceder mediante el proxy del entorno. Se conserva el fallo en native-engine-result.json.

Para continuar la verificación se suministró un adaptador de red aislado que ejecuta curl en cada solicitud, restringido a las tres URL configuradas, sin seguir redirecciones y con límites de tiempo/tamaño. No se alteró el transporte del producto ni su política de destinos. Por tanto, **la prueba adaptada no demuestra que el comando nativo vaya a funcionar sin configuración en este entorno o en producción**.

Cobertura de fuentes: tres de las 29 habilitadas del catálogo. El resto no se consultó en esta ejecución. Los metadatos y referencias no determinan vigencia, aplicabilidad ni obligaciones de una empresa.

## 10, 11, 13 y 14 · Dependencia común de Vertex

El entorno reporta que no hay identidad GCP configurada ni variables de proyecto, ubicación y modelo. Tampoco están definidos URL y token de staging. No se reutilizaron credenciales de otra cuenta ni se simularon éxitos de proveedor.

Requisitos para ejecutar las comprobaciones reales:

1. Proyecto, ubicación y modelo aprobados: VERTEX_GEMINI_PROJECT, VERTEX_GEMINI_LOCATION y VERTEX_GEMINI_MODEL.
2. Identidad ADC/workload con acceso al modelo configurada en el entorno. Las credenciales no deben introducirse en chat ni en Git.
3. Staging, usuario/empresa de prueba con plan y cuota de IA, precios aprobados del modelo y tokens de Auth/App Check cuando correspondan.
4. Fixture de datos sintéticos y evidencia de resultado, correlación, consumo, costo estimado y errores. Probar un tenant no autoriza datos de otro.

El smoke disponible:

```sh
npm run test:gemini:live
```

En esta ejecución devuelve exit 1 por su precondición de configuración. No hace skip, fallback ni llamada al proveedor. Su resultado está en gemini-live-result.txt. Una respuesta JSON exitosa de ese smoke no cerraría por sí sola la verificación de los cuatro módulos.

### Criterios de cierre por módulo

- **Auditoría financiera:** ejecutar desde la UI con transacciones conocidas; contrastar totales, margen y ratios; comprobar campos usados por el reporte, recomendaciones y error recuperable. Con ingresos/gastos únicamente no se puede acreditar Activo=Pasivo+Capital: el resultado debe reconocer la información insuficiente o recibir un balance adecuado. Se requiere revisión financiera de la calidad.
- **Asistente IA:** consulta autenticada real en una empresa de prueba; respuesta renderizada, historial persistente, contexto documental autorizado, uso de tokens y cuota conciliados. El extractor PDF tiene además el fallo de compatibilidad ya documentado y no se corrige aquí.
- **Predicciones:** seis periodos futuros coherentes, números finitos y rangos de escenario ordenados, unidad de confianza definida y tratamiento de datos insuficientes. Hacer backtesting contra un periodo reservado y una línea base; generar seis números no demuestra precisión ni calibración.
- **Panel cliente:** ejecutar Tendencias, Alertas IA y Fuga de Clientes con datos conocidos y verificar que las conclusiones corresponden a esos datos. Separar la inferencia del modelo de las alertas calculadas de forma determinista; observar carga, errores y reintentos.

No se ejecutaron esas pruebas de modelo por faltar configuración. No se declara su calidad o rendimiento a partir de fixtures/intercepciones.

## 12 · Cobros: diferencia entre falta de prueba y falta de implementación

Evidencia de código:

- src/modules/subscriptions/pages/SubscriptionsPage.jsx: requestPlanChange asigna un mailto a soporte (:77).
- src/features/client/components/MyPlan.jsx: cambio y cancelación también asignan mailto (:51/:56).
- functions/handlers/functionsRouter.js: registra sincronización de claims, invitaciones, auditoría y predicciones; no registra checkout ni webhook de facturación.
- La búsqueda de términos en package-lock devuelve enlaces de financiación de librerías; no son una integración de pagos.

No se enviaron mensajes ni se ejecutó un cargo. No se configura un proveedor nuevo como parte de una verificación. Para cerrar este P2 debe existir primero el flujo de cobro elegido. Después: checkout en modo de prueba, confirmación servidor/webhook firmado, reentrega idempotente, actualización de entitlement desde servidor, cancelación y pago rechazado. Probar cobros en producción requiere una instrucción específica; esta ejecución no la incluye.

## Evidencias y reproducción

- real-sources-summary.json: procedencia, resultados del motor, hashes y checkpoints.
- http-sources.json: comprobaciones HTTP independientes.
- master-contract-all.json: validación de las cinco páginas y 490 registros.
- real-regulatory-e2e.json y real-dof-notice.png: muestra real en dashboard local.
- native-engine-result.json: fallo de transporte sin adaptador.
- gemini-live-result.txt: precondición fallida, sin inferencia.
- p2-live-source-check.ts.txt y p2-export-pages.ts.txt: scripts temporales usados. Deben situarse en scripts de Next y ajustar las rutas de trabajo para reproducir; no se incorporan al motor como implementación productiva.

Ejemplo del transporte nativo, que falló en esta sesión:

```sh
node --import tsx scripts/run-engine.ts run --source dof-sumario --max-pages 1 --max-batches 1 --max-time-ms 20000 --max-bytes 5242880 --db /ruta/aislada/regulatory.sqlite
```

Después de una exportación real de una sola publicación:

```sh
GEMAILLA_REAL_EXPORT=/ruta/exportacion-real.json E2E_TEST_COMMAND='npx playwright test tests/e2e/regulatory.spec.js' npm run test:e2e:emulators
```

La prueba de navegador de esta ejecución dio **1 PASS / 0 FAIL**, con build previo aprobado. No se repitió toda la suite del producto, porque este cambio solo añade evidencias y documentación. No se tocaron catálogos, reglas o permisos. Se restauraron los ajustes locales del CLI para loopback y el puerto temporal de Pub/Sub. Las capturas completas, cookies de terceros y bundles base64 se conservaron solo como archivos de trabajo; la entrega incluye resúmenes y hashes públicos.

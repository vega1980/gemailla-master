# Verificación ejecutada de GEMAILLA AI

Fecha del cliente: 14 de noviembre de 2026 (America/Mexico_City). Ejecución UTC: 15 de noviembre de 2026. Base de runtime: cb81c19d580f922b152b5447272bd31b50c7480b. Checkout inicial: 4d5533b (PR 0 solo añade documentación/contratos). No se probó un backend PostgreSQL: todavía no está implementado.

## Dictamen

La aplicación Firebase compila y pasan los 12 E2E existentes en emuladores. La comprobación adicional detecta tres formularios que no guardan cuando se dejan opcionales vacíos. No está lista para declarar funcionamiento completo: también hay vulnerabilidades de dependencias, una pérdida reproducida de auditoría de IA y servicios externos todavía sin verificar.

## Resultados ejecutados

| Comprobación | Resultado |
|---|---|
| Node / npm | 22.21.1 / 11.4.2, instalados localmente según repositorio |
| Lint | PASS |
| Typecheck general y crítico | PASS |
| Unitarias | 179 PASS, 0 fallos, 0 omitidas |
| Functions | 152 PASS, 0 fallos, 0 omitidas |
| Arquitectura | PASS; índices remotos omitidos por el propio validador |
| Escaneo de secretos del repositorio | PASS dentro del alcance del script |
| Build Vite | PASS, 19,90 s en la primera compilación |
| Presupuestos gzip | PASS |
| Reglas, ejecución inicial | 106 PASS / 6 FAIL de 112 |
| Reglas, con corrección local del ejecutor | 112 PASS / 0 FAIL / 0 omitidas |
| E2E existentes | 12 PASS / 0 fallos / 0 omitidas |
| Navegación adicional | 15/15 módulos renderizados sin excepciones JS ni HTTP >=400; 1 test PASS |
| Creación/persistencia adicional | 0 PASS / 3 FAIL: cliente CRM, empleado y proyecto con campos opcionales vacíos |
| Auditoría npm de producción del frontend | FAIL: 2 altas |
| Auditoría npm de producción de Functions | FAIL: 1 alta, 6 moderadas, 1 baja |

Los tiempos de checks se midieron con algunas tareas independientes en paralelo; no son benchmarks de CI. La instalación usó los lockfiles, sin actualizar dependencias.

## Seguridad efectiva observada

Las reglas ejecutadas comprueban permisos de empresa, roles, datos sensibles de personal, inmutabilidad de campos, cuarentena y evidencia regulatoria. Los casos negativos cubiertos se rechazaron. Un test que deniega todo no basta: también se verificaron operaciones autorizadas en la repetición completa de 112 casos.

Se enviaron 15 peticiones HTTP reales a /api/ai, sin interceptar el endpoint: cinco anónimas devolvieron 401; cinco con origen inválido devolvieron 403; cinco GET devolvieron 405. Cada respuesta incluyó correlación. Esto no prueba todos los métodos de ataque ni valida criptografía de tokens en producción, porque Firebase Auth está emulado.

El Hosting emulado devolvió X-Content-Type-Options y X-Frame-Options. La CSP del staging solo tiene Content-Security-Policy-Report-Only: observa, no bloquea. El firebase.json base no declara una CSP aplicada. No se inspeccionaron cabeceras del despliegue de producción ni sus IAM.

## Hallazgos prioritarios

### P1 · Tres formularios no guardan con campos opcionales vacíos

Reproducción en UI: entrar como owner de una empresa, abrir Nuevo Cliente / Nuevo Empleado / Nuevo Proyecto, completar solo el nombre (único requisito que habilita el botón) y guardar. En los tres casos el diálogo continúa abierto, no aparece el registro y la comprobación falla antes de poder validar persistencia tras recarga. No se trata de un fallo de selector: los snapshots muestran los campos completos y el botón activado después del clic.

Causa reproducida con los esquemas y el SDK reales: optionalEmail y optionalDate en src/shared/validation/domainSchemas.js transforman cadenas vacías en undefined. createRepository.js entrega directamente el resultado validado a addDoc; el middleware de auditoría propaga los campos. Firestore devuelve invalid-argument por email en CRM/empleados y startDate en proyectos. Evidencia: schema-undefined-diagnostic.json, firestore-undefined-repro.json, persistence-results.json y capturas de formularios fallidos.

Los formularios probados no muestran un error al usuario para este caso. Corrección recomendada: definir representación de ausencia y eliminar claves undefined de forma explícita antes de persistir, preservando las operaciones de borrado intencional; mostrar errores de mutación y probar guardar dejando opcionales vacíos. Revisar además todos los flujos que reutilizan esos esquemas. Los tres fallos reproducidos no significan que ninguna combinación de campos pueda guardarse.

### P1 · Auditoría persistente de IA falla al rechazar solicitudes

Reproducción: POST /api/ai con prompt y sin Authorization sobre Hosting + Functions + Firestore emulados. La API responde correctamente 401, pero el log real registra ai_audit_log_failed porque estimatedTokens es undefined y Firestore no permite ese valor. Evidencia: api-probes.json y audit-log-failure.txt.

Origen: functions/handlers/aiHandler.js, writeAiAuditLog, campos opcionales del payload. Impacto observado: no se persiste la entrada de auditoría de ese rechazo; el log de consola sí queda. Corrección recomendada: omitir campos ausentes o normalizarlos explícitamente y añadir prueba de integración con Firestore real/emulado. No habilitar globalmente ignoreUndefinedProperties como sustituto de un contrato claro.

### P1 · Dependencias de producción con avisos de severidad alta

- re2js: GHSA-gg6h-894w-4m9c, comportamiento cuadrático en lookbehind, transitiva.
- zod: GHSA-mrhx-c7xc-m3w5, agotamiento de memoria por colecciones limitadas excesivas, directa. npm propone actualización mayor: requiere revisión de compatibilidad.
- body-parser (Functions): GHSA-27r3-jxmh-p828, denegación de servicio en cuerpos comprimidos con bytes finales, transitiva.

Los JSON de npm audit incluyen rangos y cadenas afectadas. Severidad del aviso no demuestra explotabilidad de una ruta concreta. No se ejecutó npm audit fix ni se cambiaron lockfiles.

### P2 · Suscripciones no es un cobro automático

src/modules/subscriptions/pages/SubscriptionsPage.jsx implementa el cambio de plan con mailto a soporte. No hay un checkout ni confirmación de pago probados en este flujo. Es una solicitud manual; la página renderizada no demuestra facturación operativa.

### P2 · Proyección presupuestaria no reproducible

src/features/finance/components/BudgetPlanner.jsx aplica Math.random a proyecciones de ingresos y gastos. Cambiar datos/horizonte o remontar puede dar valores distintos sin una hipótesis registrada. No debe presentarse como pronóstico financiero validado. Reemplazar por supuestos explícitos y deterministas, o etiquetarlo claramente como simulación.

### P2 · Cobertura funcional incompleta de procesos avanzados

Navegar a un módulo no valida sus cálculos, importaciones, nómina, predicciones, facturación ni exportaciones. Los flujos documentados en la matriz adjunta diferencian renderización, persistencia y E2E completo. No hay un conjunto de evaluación regulatoria validado por especialista ejecutado aquí.

## Rendimiento medido

- Vendors compartidos: 578,6 KiB gzip / límite 650.
- Dashboard: 4,9 KiB; documentos: 7,2; finanzas: 16,7; IA: 4,8, según el script de presupuestos. No son descargas totales de página: excluyen recursos y parte de los chunks compartidos.
- API anónima: mediana 24,39 ms en cinco muestras; máximo 2204,71 ms al inicio. Origen rechazado: mediana 35,41 ms; método inválido: 16,34 ms. Son respuestas de rechazo sobre loopback, sin Gemini ni carga concurrente; no miden inferencia ni capacidad de producción.
- Las rutas tienen métricas de navegación locales en modules.json, una muestra por ruta. elapsedMs incluye espera de hasta diez segundos por networkidle, por lo que NO debe interpretarse como latencia de carga.
- El fondo enterprise-circuit-bg.png pesa 1.263.731 bytes sin compresión HTTP adicional; conviene optimizar recursos gráficos antes de evaluar móviles.

No se midieron Web Vitals de campo, usuarios concurrentes, p95 de consultas SQL, latencia real de Gemini ni costo facturado. Aprobar presupuesto de bundle no demuestra esos resultados.

## Ajustes del entorno y reproducibilidad

1. Node 22.21.1 y npm 11.4.2 en un prefijo local, Java 21 y Chromium Playwright 141.
2. Cachés npm, Firebase y navegadores bajo el workspace; no secretos de producción.
3. El CLI Firebase 15.34.0 envía lecturas loopback por ProxyAgent. La ejecución inicial produjo seis falsos negativos de Storage. Reproducción --debug identificó Request was cancelled en GET http://127.0.0.1:8080/.../companyMembers/.... Se ajustó únicamente el CLI instalado en node_modules para excluir 127.0.0.1, localhost y [::1] del proxy. El proxy de destinos externos se mantuvo. No se tocaron reglas ni lógica de aplicación. Este resultado requiere ese ajuste del ejecutor en este entorno.
4. El puerto 8085 ya estaba ocupado por un servicio ajeno. Se movió solo el puerto Pub/Sub emulado a 18085 durante E2E; el firebase.json original se restaura al terminar.
5. Proyecto demo-gemailla-e2e, datos sintéticos y escáner mock del propio repositorio. La prueba E2E de IA intercepta /api/ai: comprueba el contrato y actualización de UI, no Vertex. La publicación regulatoria usa fixtures, no fuentes oficiales en vivo.

## Pendiente de verificación externa

Llamada auténtica a Vertex con identidad autorizada, latencia y costos del modelo; motor next con fuentes reales; escáner antimalware productivo; restauración de backups; IAM, cuotas y despliegue real; revisión regulatoria y pruebas de negocio completas de todos los módulos. El entorno no tiene credenciales GCP configuradas. No se desplegó ni modificó producción.

## Matriz de módulos

| Módulo | Evidencia obtenida | Límite o fallo |
|---|---|---|
| Dashboard | Carga, empresa activa y cambio de empresa en E2E | Sin validar todos los cálculos con datos contables de referencia |
| Empresas | Creación con harness y selección en UI | Alta completa por formulario/invitación no verificada E2E |
| Documentos | Carga PDF/XML, cuarentena, escaneo mock, apertura y permisos viewer | Escáner productivo y archivos adversarios reales no probados |
| Avisos regulatorios | Publicación fixture, evidencia verificada y aislamiento E2E | Sin sincronización de fuentes reales ni dictamen regulatorio |
| ERP | Renderizado con empresa activa | Sin E2E de transacción/importación/exportación |
| Auditoría financiera | Renderizado | Sin evaluación real de Gemini ni corrección contable validada |
| Asistente IA | Renderizado y actualización documental mediante respuesta interceptada | No hay inferencia real con Vertex; falla la auditoría persistente de rechazos |
| Actividad | Renderizado; triggers de auditoría operan en emulador durante pruebas | No se valida retención productiva ni auditoría íntegra de todas las operaciones |
| Suscripciones | Renderizado y revisión del código | Cambio manual por mailto; pagos no probados |
| Predicciones | Renderizado | Sin validar pronósticos ni consumo real de IA |
| Finanzas | Renderizado y presupuesto de bundle | Proyecciones con aleatoriedad; cálculos/exportación sin E2E de referencia |
| Panel cliente | Renderizado | Sin prueba completa de sus procesos comerciales |
| Operaciones | Renderizado y clic real para crear proyecto | FAIL con fechas opcionales vacías; no llega a verificar recarga |
| CRM | Renderizado y clic real para crear cliente | FAIL con email opcional vacío; no llega a verificar recarga |
| RRHH | Renderizado y clic real para crear empleado | FAIL con email/fecha opcionales vacíos; nómina no validada |

Las 15 rutas son módulos primarios; no se contaron los alias como módulos adicionales. Renderizado significa contenido en main con empresa activa, no proceso de negocio certificado. La prueba adicional de navegación no captura todos los console.error: registra excepciones pageerror y respuestas HTTP >=400. Se observaron errores de certificado al cargar Google Fonts en trazas de persistencia; son un límite del navegador/proxy del entorno, sin relación demostrada con el fallo de guardado.

## Evidencias y próximos pasos

- summary.json y *-result.txt: comandos, tiempos y resúmenes de comprobaciones.
- e2e-results.json: 12 casos existentes y un caso adicional de navegación; 13 PASS en total.
- persistence-results.json: tres fallos adicionales, conservados sin cambiar expectativas.
- modules.json, api-probes.json, hosting-headers.json: observaciones de runtime.
- audit.json y audit-functions.json: avisos completos de dependencias al ejecutar.
- dashboard.png, documents.png y operations.png: capturas con datos sintéticos.
- *-failure.png y *-failure-context.md: formularios fallidos.
- verification.*.spec.js.txt: fuente de las comprobaciones temporales. Para reproducir, colocar en tests/e2e y ajustar la ruta de salida local; no se incorporan a la suite del producto como parte de esta auditoría.

Orden recomendado: corregir representación de campos opcionales y mensajes de error; corregir la auditoría de IA; resolver dependencias con pruebas de compatibilidad; verificar Vertex/escáner/next reales en staging; ampliar pruebas contables, comerciales y de carga; después establecer el criterio de salida a producción. Estos cambios son recomendaciones, no correcciones aplicadas por este informe.

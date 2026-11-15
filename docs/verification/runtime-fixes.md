# Correcciones y validación antes de producción

## Cambios

- El límite de escritura de dominio omite los campos normalizados a `undefined` al crear registros: CRM, empleados y proyectos pueden dejar vacíos email/fechas opcionales. Los valores presentes siguen validándose; no se desactiva la validación ni se permite acceso adicional en reglas. Las actualizaciones conservan la semántica existente de valores vacíos explícitos.
- Los tres formularios muestran un mensaje si falla la mutación.
- El saneamiento de auditoría omite propiedades `undefined` recursivamente y representa elementos ausentes de arrays como `null`, conservando la redacción de información sensible.
- Zod se actualiza a 4.6.7; se adapta `z.record` y los códigos de error de sus pruebas. Los lockfiles incorporan re2js 2.10.0 y body-parser 2.4.0. No se fuerzan versiones mayores de dependencias transitivas con overrides.

## Pruebas reproducibles

Con Node 22.21.1, npm 11.4.2 y los lockfiles:

```sh
npm ci
npm --prefix functions ci
npm run lint
npm run typecheck
npm run test:unit
npm run test:functions
npm run test:rules:emulators
npm run test:e2e:emulators
npm run budget:bundle
```

`tests/e2e/optional-fields.spec.js` reproduce los tres guardados anteriormente fallidos y comprueba que aparecen después de recargar. `tests/e2e/ai-rejection-audit.spec.js` invoca Functions sobre HTTP y comprueba la entrada de rechazo en Firestore, sin simular la persistencia.

## Gemini real

Configurar mediante secretos/identidad del entorno una identidad ADC con permiso para el modelo, y `VERTEX_GEMINI_PROJECT`, `VERTEX_GEMINI_LOCATION`, `VERTEX_GEMINI_MODEL` de staging. No usar un proyecto demo. No enviar credenciales por chat ni guardarlas en Git.

```sh
npm run test:gemini:live
```

La prueba llama al adaptador real de Vertex, exige JSON válido y tokens reales. No usa respuestas interceptadas ni hace skip si falta configuración. Puede generar consumo facturable (incluido un reintento de timeout del adaptador). Es un smoke del proveedor: no sustituye la comprobación del recorrido autenticado de la aplicación ni una evaluación de calidad regulatoria.

## Carga autenticada de staging

Configurar `LOAD_TARGET_URL` con la URL HTTPS de `/api/ai`, `LOAD_AUTH_TOKEN` con un token vigente de un usuario de prueba, `LOAD_COMPANY_ID` de su empresa con plan/cuota y, si corresponde, `LOAD_APP_CHECK_TOKEN`. Usar una empresa aislada y revisar el presupuesto de IA. Los tokens no se imprimen en el informe.

```sh
npm run test:load:ai
```

Por defecto: 20 solicitudes, cuatro clientes simultáneos, timeout de 10 s, cero errores permitidos y p95 máximo 60 s. Ajustar explícitamente `LOAD_REQUESTS` (1–200), `LOAD_CONCURRENCY` (1–10), `LOAD_TIMEOUT_MS` y `LOAD_MAX_P95_MS` a los objetivos acordados. El script verifica estado `completed`, proveedor Vertex y empresa de la respuesta; errores HTTP, cuotas y timeouts fallan, sin reintentos del generador. No es una prueba de capacidad sostenida, de fugas de memoria ni de todos los módulos. Los límites son los parámetros de esta comprobación, no un SLO aprobado.

Para diagnosticar solamente rechazos en emuladores:

```sh
LOAD_MODE=rejection LOAD_REQUESTS=50 LOAD_CONCURRENCY=5 LOAD_MAX_P95_MS=5000 npm run test:load:ai
```

Este modo requiere loopback, espera 401 y nunca acredita inferencia ni rendimiento productivo. `LOAD_REPORT_PATH` permite guardar un JSON de resultados.

## Puerta de validación

```sh
npm run verify:production-readiness
```

Exige una URL HTTPS remota explícita, ejecuta la auditoría de producción existente, Gemini real y carga autenticada. Fuerza el modo autenticado: un benchmark de rechazos no puede satisfacer esta puerta. Cualquier fallo detiene el comando. La auditoría conserva el nivel `moderate` de la política existente, sin rebajarlo para hacer pasar el cambio.

Pasar estas comprobaciones no acredita por sí solo IAM, restauración, calidad regulatoria, facturación ni aprobación del negocio.

## Resultados de esta ejecución

Pasaron lint, tipos, build, presupuesto de bundle, arquitectura, **180 pruebas unitarias**, **153 de backend**, **112 de reglas** y **16 E2E**, incluidos los tres formularios y la auditoría persistente. Los resultados consolidados están en `runtime-fixes-results.json`. El entorno no tiene proyecto/modelo/credenciales GCP configurados ni URL/token de staging; Gemini real falla por falta de configuración, y la carga autenticada remota queda pendiente.

La carga local de rechazos devolvió 50/50 respuestas 401 con cinco clientes, cero errores y p95 **5059,19 ms**, por encima del umbral de **5000 ms**. Resultado **FAIL** conservado, sin relajar el umbral; incluye arranque frío. No se declara aptitud productiva.

La auditoría de dependencias de producción tiene cero avisos altos/críticos en ambos paquetes y cero avisos en el frontend. Functions conserva seis avisos moderados transitivos en la cadena google-gax/rimraf/glob/minimatch, que bloquean la política de auditoría existente. Se documentan como pendientes; no se cambió la política ni se forzó una actualización mayor no compatible.

Para ejecutar emuladores en este entorno se movió temporalmente Pub/Sub de 8085 (ocupado por otro servicio) a 18085 y se adaptó el CLI instalado para no enviar loopback por el proxy. El proxy externo se mantuvo. Esos ajustes locales no forman parte del cambio de aplicación y se restauran al terminar.

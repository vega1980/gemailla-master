# gemailla-master

Repositorio maestro unificado de GEMAILLA AI: aplicación web estática React/Vite con Firebase como capa principal de identidad, datos, archivos y hosting.

## Stack

- React + Vite
- Firebase Auth
- Firestore
- Firebase Storage
- Firebase Hosting
- TanStack Query para cache de datos en cliente

## Requisitos

- Node.js >= 22 <23
- npm
- Firebase CLI
- Java disponible si vas a ejecutar los emuladores de Firestore/Storage

## Estado del repositorio

El código mantiene una iteración de estabilización: antes de incorporar módulos nuevos deben completarse las validaciones de reglas, staging, E2E, rendimiento, observabilidad y costos descritas en `docs/ITERACION_ESTABILIZACION.md`.

El número de issues y pull requests cambia continuamente y no se conserva como una instantánea en este README. Consulta las pestañas **Issues** y **Pull requests** del repositorio remoto para conocer su estado actual; recuerda que GitHub muestra ambos tipos de elemento en algunos contadores de su API, aunque sean categorías distintas en la interfaz.

## Configuración local

1. Instala dependencias:

```bash
npm ci
npm run hooks:install
```

El segundo comando activa `.githooks/pre-commit` para este clon: comprueba el diff preparado y ejecuta lint antes de cada commit. Debe repetirse en cada clon nuevo.

Instala de forma explícita las dependencias aisladas de Cloud Functions
(incluido `@google/genai`):

```bash
npm --prefix functions ci
```

2. Crea la configuración local de Vite a partir del ejemplo:

```bash
cp .env.example .env.local
```

3. Edita `.env.local` con los siete valores `VITE_FIREBASE_*` del proyecto Firebase de desarrollo, incluida la clave pública de App Check. No agregues endpoints de IA ni secretos: el frontend siempre usa las rutas same-origin `/api/ai` y `/api/functions`.

4. Valida la configuración e inicia Vite:

```bash
npm run validate:env
npm run dev
```

### Configuración en tiempo de ejecución (opcional)

La configuración habitual para desarrollo local es `.env.local`. Como alternativa para una compilación estática ya generada, la aplicación intenta cargar `/app-config.js` al arrancar. El archivo real está ignorado por Git; créalo desde el ejemplo solo si necesitas configurar el despliegue en tiempo de ejecución:

```bash
cp public/app-config.example.js dist/app-config.js
```

Edita `dist/app-config.js` antes de desplegar; Firebase Hosting publica `dist/`. Vite copia los archivos de `public/` a `dist/` durante el build, por lo que, si vuelves a generar la compilación, debes repetir este paso.

Sustituye todos los valores `TU_*` y ajusta `GEMAILLA_USE_FIREBASE_EMULATORS`. Este archivo no se ejecuta como JavaScript arbitrario: el cargador solo acepta las asignaciones literales permitidas. Si no existe, responde `404` o está vacío, la aplicación continúa con los valores `VITE_FIREBASE_*` incorporados por Vite. No mantengas `.env.local` y `app-config.js` con valores contradictorios: para cada valor de Firebase, la variable `VITE_FIREBASE_*` incorporada durante el build tiene precedencia y `app-config.js` actúa como respaldo.

### Validación automática de variables

Para CI, entornos empresariales locales o pipelines sin intervención humana, valida la configuración antes de compilar o ejecutar pruebas con el script Node incluido. El script falla con código `1` si falta alguna variable obligatoria, si conserva placeholders como `TU_*` o si se intenta exponer variables locales de OpenAI en el frontend o backend; no muestra prompts interactivos. Además, `npm run validate:secrets` revisa archivos versionados para bloquear claves API hardcodeadas.

```bash
npm run validate:env          # frontend: VITE_FIREBASE_*
npm run validate:env:functions # backend IA: Vertex por env o runtimeConfig/ai
npm run validate:env:all      # frontend + backend
npm run validate:secrets      # bloquea claves API hardcodeadas en Git
```

El script lee variables del entorno, `.env` y `.env.local`, por lo que puede usarse como paso previo en CI, por ejemplo `npm run validate:env && npm run build`. Si la configuración activa de Functions viene de variables de entorno, define ahí el modelo, `project`, `location` y pricing aprobados de Vertex; si la fuente real es `runtimeConfig/ai`, el validador no exige variables extra.

## Comandos principales

```bash
npm run dev
npm run lint
npm run typecheck
npm run typecheck:core
npm run build
npm run test:rules:emulators
npm run test:e2e:emulators
npm run deploy:hosting
npm run rules:deploy
```

### Puertos de los emuladores

`npm run serve` inicia los servicios locales en los puertos definidos en `firebase.json`:

| Servicio | Puerto |
| --- | ---: |
| Hosting | `5000` |
| Firestore | `8080` |
| Auth | `9099` |
| Storage | `9199` |

> Nota de entorno: si `npm run test:rules:emulators` falla antes de ejecutar las pruebas con `download failed, status 403: Forbidden` al descargar el JAR del emulador (`cloud-firestore-emulator`), trátalo como un bloqueo de red/autenticación del entorno de Firebase CLI, no como un fallo de reglas. Reintenta en un entorno con acceso a la descarga del emulador o con el artefacto cacheado.


## Estructura incremental

La app mantiene las fachadas públicas existentes (`@/api/firebaseClient`, `@/app/providers/AuthProvider`, `@/lib/companyContext` y rutas actuales), pero la lógica nueva se organiza por capas para permitir refactors sin romper imports:

```text
src/app/                         # rutas y composición de providers
src/modules/<dominio>/pages/      # pantallas de cada módulo funcional
src/modules/<dominio>/components/ # componentes propios de cada módulo
src/modules/<dominio>/services/   # servicios y adaptadores del módulo
src/features/documents/           # flujos incrementales del dominio documental
src/features/companies/           # servicios de membresía, rol y empresa activa
src/infrastructure/firebase/      # repositorios, colecciones, normalización y Storage Firebase
src/api/firebaseClient.js         # fachada pública de compatibilidad
```

Las pantallas enrutables viven en `src/modules/<dominio>/pages`; `src/pages` ya no existe. Los imports hacia módulos deben usar el alias canónico `@modules/<dominio>/...` y no se aceptan shims que reexporten implementaciones desde ubicaciones heredadas, `src/lib` o la raíz de un módulo.

### Alias de Vite

Los alias definidos en `vite.config.ts` son:

- `@/`: apunta a `src/`.
- `@modules/`: apunta a `src/modules/`.

## Arquitectura de documentos

El acceso del cliente está definido en `firestore.rules` y `storage.rules`:

1. La app crea la metadata en `documents/{documentId}` con estado `uploading`.
2. La ruta de subida del cliente es `companies/{companyId}/quarantine/{documentId}/{fileName}`. Requiere una membresía activa con rol `owner`, `director`, `admin` o `editor`, un documento de la misma empresa en Firestore y metadata `companyId`/`documentId` coincidente con la ruta.
3. Storage exige un archivo no vacío y de tamaño estrictamente menor que `15 * 1024 * 1024` bytes (15 MiB). Solo acepta PDF/XML con extensión y MIME coincidentes.
4. El cliente puede pasar de `uploading` a `quarantined` o `error`, y de `quarantined` a `error`. No puede asignar `storagePath`, `scanStatus` ni los demás campos reservados del escáner. El escaneo y la promoción corresponden al backend.
5. La ruta final es `companies/{companyId}/documents/{documentId}/{fileName}`. Su lectura exige membresía activa, `scanStatus: "clean"` y un `storagePath` en Firestore que coincida exactamente con el objeto.
6. El cliente no puede leer, modificar ni borrar objetos en cuarentena. En la ruta final tampoco puede crear, modificar ni borrar archivos.
7. Las reglas de Firestore bloquean los campos `fileUrl`, `file_url`, `downloadUrl`, `downloadURL` y `publicUrl` en documentos. La referencia al archivo promovido es `storagePath`.

### Privacidad documental

La propuesta de privacidad de GEMAILLA se basa en que el cliente conserva el control operativo del documento: la interfaz y las reglas no tratan el PDF/XML como un enlace público reutilizable, sino como un recurso privado referenciado por `storagePath`. El frontend solicita acceso solo cuando el usuario autorizado lo necesita y el análisis de IA se enruta por `/api/ai`, un endpoint same-origin protegido por Firebase Auth, validación de empresa/documentos, límites de uso y secretos cargados únicamente en backend.

Las descargas privadas con `getBlob()` requieren aplicar `storage.cors.json` al bucket de producción. La lista coincide con los orígenes oficiales permitidos por Functions y no contiene comodines. Un operador autorizado puede aplicarla explícitamente con `npm run configure:storage-cors -- <bucket-name>`; este paso modifica configuración cloud y no forma parte del build ni se ejecuta automáticamente.

Los documentos tienen acceso restringido por empresa. El backend puede procesarlos y enviarlos al proveedor de IA para su análisis; por tanto, esta implementación no ofrece una garantía Zero-Knowledge.

## IA

No configures claves privadas de OpenAI/LLM en el frontend ni las hardcodees en código, pruebas o documentación. El backend usa Vertex AI Gemini con ADC de Firebase Functions; no declares `OPENAI_API_KEY`, `OPENAI_MODEL` ni variantes con prefijo `VITE_` porque el validador las bloquea.

El repositorio incluye un backend real en `functions/` con Firebase Cloud Functions. La app usa exclusivamente rutas relativas same-origin gestionadas por Firebase Hosting: `/api/ai` para IA y `/api/functions` para funciones internas. Firebase Hosting reescribe esas rutas hacia el backend correspondiente, sin exponer endpoints configurables en el navegador. La función `ai` valida un token Firebase Auth, limita el tamaño del prompt y llama a Vertex AI Gemini desde servidor.

Configuración mínima del backend:

```bash
cd functions
npm ci
firebase deploy --only functions,hosting
```

Configuración de Vertex para Functions:

- La fuente activa puede ser variables de entorno o `runtimeConfig/ai` en Firestore.
- Si usas variables de entorno, define como mínimo `VERTEX_GEMINI_MODEL`, `VERTEX_GEMINI_PROJECT` o `GOOGLE_CLOUD_PROJECT`, `VERTEX_GEMINI_LOCATION` y el pricing aprobado `VERTEX_GEMINI_INPUT_PER_1K_TOKENS_USD`, `VERTEX_GEMINI_CACHED_INPUT_PER_1K_TOKENS_USD`, `VERTEX_GEMINI_OUTPUT_PER_1K_TOKENS_USD`, `VERTEX_GEMINI_REASONING_TOKEN_TREATMENT` y, cuando aplique, `VERTEX_GEMINI_REASONING_PER_1K_TOKENS_USD`.
- `VERTEX_GEMINI_API_VERSION`: opcional; por defecto `v1`.
- `VERTEX_GEMINI_TIMEOUT_MS`: opcional; si no existe usa `AI_REQUEST_TIMEOUT_MS`.
- `ALLOWED_ORIGINS`: lista separada por comas para CORS. Si no se configura, solo se permiten `https://gemailla.com`, `https://www.gemailla.com`, `https://gemailla-enterprise.firebaseapp.com` y `https://gemailla-enterprise.web.app`; cualquier otro `Origin` presente recibe `403`.
- `AI_RATE_LIMIT_WINDOW_MS`: ventana móvil por usuario/empresa para limitar frecuencia; por defecto `60000`.
- `AI_RATE_LIMIT_MAX_REQUESTS`: máximo de solicitudes por usuario/empresa en la ventana; por defecto `30`.
- `AI_DAILY_TOKEN_LIMIT`: tokens reservados diarios por empresa en Firestore (`aiUsage/{YYYY-MM-DD_companyId}`); por defecto `50000`.
- `AI_DAILY_BUDGET_USD`: presupuesto diario estimado por empresa; por defecto `5`.
- `AI_RESERVED_OUTPUT_TOKENS`: reserva de tokens de salida por solicitud; por defecto `1200`.
- `ALLOW_UNAUTHENTICATED_AI=true`: solo para emuladores/desarrollo local sin sesión Firebase.

Las funciones HTTP validan CORS antes de procesar la solicitud, pero CORS no es un control de autenticación: clientes no-navegador como `curl`, scripts o server-to-server pueden omitir el header `Origin` y no reciben `Access-Control-Allow-Origin`. La barrera primaria sigue siendo exigir token Firebase Auth `Bearer`, validar acceso a `companyId`/rol/documentos y registrar límites en Firestore por usuario/empresa (`aiRateLimits`) y por empresa/día (`aiUsage`).

Las rutas de backend no se configuran con variables `VITE_*`: deben permanecer relativas y bajo el mismo origen (`/api/ai` y `/api/functions`). Si necesitas integrar otro proveedor, publícalo detrás de Firebase Hosting/Cloud Functions/Cloud Run y conserva el acceso desde el frontend mediante esas rutas internas.

## Sincronización de avisos regulatorios

`npm run sync:regulatory -- --next-root <ruta-next> --db <archivo.sqlite> --company <empresa> --stream <flujo> --project <proyecto> --bucket <bucket>` publica mediante un operador autorizado.

- La identidad del historial es SHA-256 del primer aviso exportado y validado. No depende de la ruta local. Una copia del mismo historial conserva la identidad; una base diferente debe usar otro flujo.
- Cada continuación comprueba además el hash del último aviso publicado. Los estados antiguos que guardaban `databasePath` se convierten a `schema: 2` únicamente al publicar con cursor y hash coincidentes, comprobados nuevamente dentro de la transacción. No se cambian los avisos ya publicados.
- Antes de subir capturas, se limita a 4 MiB el conjunto JSON de documentos y estado que se escribirá, reservando margen para Firestore. Si excede ese tamaño, el proceso se detiene sin avanzar el cursor. Repite con `--page-size 5` (predeterminado: 25; permitido: 1–100), reduciéndolo más si hace falta.
- Una base sin publicaciones termina con estado `empty` sin escribir en Firebase. Esta sincronización no incorpora IA ni inicia un despliegue.

## Reglas de seguridad

- Fuentes de verdad: `firestore.rules` y `storage.rules`. Los siguientes fragmentos son extractos; sus funciones auxiliares están en esos archivos.
- Firestore permite la lectura general de la empresa a su propietario o a miembros activos. Las escrituras empresariales generales corresponden al propietario o a miembros activos con rol `owner`, `director`, `admin` o `editor`, sujetas al contrato de cada colección. Administración, datos sensibles de personal y datos financieros de IA tienen restricciones adicionales.
- La membresía se consulta en `companyMembers/{companyId}_{uid}` y debe coincidir en `companyId`, `userUid` y estado `active`. Estas reglas no exigen claims `companyId` ni `companyRole` en el token.
- Storage exige membresía activa también al propietario. Para subir exige además uno de los roles de escritura indicados arriba; para leer archivos promovidos exige que estén limpios y que su ruta coincida.
- Los campos del escáner y la promoción de archivos quedan fuera de las escrituras permitidas al cliente. Los avisos regulatorios permiten lectura autorizada, pero no escritura desde el cliente.
- El archivado documental usa `status: "archived"`. No borra el archivo ni impide por sí solo leer un archivo limpio con ruta coincidente y membresía activa.

Fragmentos reales de Firestore:

```text
function isActiveMember(companyId) {
      return membershipExists(companyId)
        && membershipData(companyId).get('companyId', null) == companyId
        && membershipData(companyId).get('userUid', null) == currentUid()
        && membershipData(companyId).get('status', null) == 'active';
    }

function canReadCompany(companyId) {
      return isNonEmptyString(companyId)
        && (isCompanyOwner(companyId) || isActiveMember(companyId));
    }
```

Entrada de documentos en Storage:

```text
match /companies/{companyId}/quarantine/{documentId}/{fileName} {
      allow read, update, delete: if false;
      allow create: if request.resource.size > 0
                    && request.resource.size < 15 * 1024 * 1024
                    && contentTypeMatchesExtension(fileName)
                    && canWriteCompanyDocuments(companyId)
                    && documentExists(companyId, documentId)
                    && isValidMetadata(companyId, documentId);
    }
```

Validación local de las reglas:

```bash
npm run test:rules:emulators
```

## Regla de estabilización

Antes de añadir nuevos módulos al roadmap, la próxima iteración debe dedicarse exclusivamente a estabilización: reglas Firestore/Storage, Emulator Suite, deploy de staging, Lighthouse móvil, Playwright E2E para Auth/Multiempresa/Documentos/IA, monitoreo/alertas y revisión de costos. Ver `docs/ITERACION_ESTABILIZACION.md`.

## Estilo de nombres

Evita nombres ambiguos para variables, parámetros y resultados intermedios. Nombres como `x`, `y`, `tmp`, `data` o `df2` obligan a leer el contexto completo para entender qué representan y dificultan revisar cambios, depurar errores y reutilizar funciones.

Prefiere nombres descriptivos del dominio y de la intención del dato:

```js
// Evita
const data = calcularResumen(transacciones);
const tmp = filtrarActivos(data);

// Prefiere
const resumenFinanciero = calcularResumen(transacciones);
const clientesActivos = filtrarActivos(resumenFinanciero);
```

En análisis o reportes, usa nombres como `ventasMensuales`, `clientesActivos`, `predicciones`, `transaccionesFiltradas` o `resumenPorCategoria`. El linter emite advertencias cuando detecta identificadores ambiguos comunes para reforzar esta convención sin bloquear correcciones heredadas.

## Ubicación y ejecución de pruebas

| Pruebas | Ubicación | Comando desde la raíz |
| --- | --- | --- |
| Unitarias | `tests/unit/*.test.mjs` | `npm run test:unit` |
| Backend | `functions/tests/*.test.js` | `npm run test:functions` |
| Reglas Firebase | `tests/rules/*.test.mjs` | `npm run test:rules:emulators` |
| Flujos completos con Playwright | `tests/e2e/` | `npm run test:e2e:emulators` |

`npm run test:functions` también ejecuta el lint del backend.

Para ejecutar las cuatro suites en orden: `npm run test:emulators`. Si alguna falla, el comando se detiene.

## Pruebas E2E críticas

La suite Playwright cubre los flujos integrados de mayor riesgo: Auth, cambio de empresa, reglas Firebase, Storage, contrato `/api/ai`, restricciones por rol y cierre de sesión. Ver `docs/E2E_PLAYWRIGHT.md`.

## Trabajo con R/RStudio

Si agregas scripts, notebooks o análisis en R, abre el repositorio desde `gemailla-master.Rproj` en lugar de fijar rutas absolutas con `setwd("C:/Users/...")`. Para construir rutas reproducibles dentro del proyecto, usa `here::here()`, por ejemplo:

```r
# install.packages("here") # solo si no está instalado
datos <- read.csv(here::here("data", "archivo.csv"))
```

Esto evita dependencias del equipo local de cada persona y mantiene los flujos de R portables entre desarrollo, CI y despliegue.

### Estilo para pipelines en R

En ejemplos, scripts o notebooks nuevos de R, prefiere el pipe nativo `|>` para cadenas de transformación con `dplyr` cuando no haga falta una característica específica de `magrittr`:

```r
datos |>
  filter(activo) |>
  mutate(total = precio * cantidad)
```

Evita usar `%>%` como opción por defecto:

```r
datos %>%
  filter(activo) %>%
  mutate(total = precio * cantidad)
```

Reserva `%>%` para casos en los que necesites semánticas propias de `magrittr`, como placeholders avanzados o compatibilidad con código heredado que ya dependa de ese paquete.

### Crear errores informativos en R

Cuando un script de R deba detenerse por una condición inválida, evita mensajes genéricos como `stop("error")`. Usa `cli::cli_abort()` con un mensaje principal claro y viñetas informativas para explicar cómo corregir el problema.

```r
# Evita
stop("error")

# Prefiere
cli::cli_abort(
  c(
    "El archivo no existe.",
    "i" = "Verifique la ruta proporcionada."
  )
)
```

Este formato hace que los errores sean accionables: la primera línea describe qué falló y las líneas con prefijos de `cli` (`"i"`, `"x"`, `"!"` o `"*"`) añaden contexto, causa probable o siguiente paso.

### Evitar variables globales en R

No cargues datos en variables globales que luego sean usadas implícitamente por varias funciones. Cada función debe recibir de forma explícita los datos que necesita mediante argumentos, para que el análisis sea testeable, reproducible y fácil de reutilizar con otros conjuntos de datos.

Evita este patrón:

```r
clientes <- readr::read_csv(here::here("data", "clientes.csv"))

analizar_clientes <- function() {
  clientes |>
    dplyr::filter(activo)
}
```

Prefiere pasar los datos como parámetro:

```r
analizar_clientes <- function(clientes) {
  clientes |>
    dplyr::filter(activo)
}

clientes <- readr::read_csv(here::here("data", "clientes.csv"))
resultado <- analizar_clientes(clientes)
```

Si un script necesita leer archivos, separa la importación de la transformación: una función puede encargarse de cargar datos y otra de analizarlos, pero las funciones de análisis no deben depender de objetos definidos fuera de su firma.

### Organización de scripts R

Aplica el criterio **un archivo = una responsabilidad** para que cada script tenga un propósito claro y sea fácil de mantener. Usa nombres descriptivos que indiquen la etapa del flujo de análisis o el resultado que produce.

Una estructura recomendada para scripts compartidos es:

```text
R/
├── import_data.R
├── clean_data.R
├── feature_engineering.R
├── modeling.R
└── reporting.R
```

Mantén en cada archivo solo la lógica de su etapa: importación, limpieza, generación de variables, modelado o reportes. Si una etapa crece demasiado, divide el archivo con nombres igualmente explícitos, por ejemplo `clean_customers.R` y `clean_transactions.R`.

### Reproducibilidad con renv

Para cualquier flujo serio en R, inicializa `renv` desde la raíz del repositorio antes de agregar dependencias o análisis compartidos:

```r
install.packages("renv") # solo la primera vez en cada equipo
renv::init()
```

`renv::init()` crea `renv.lock`, que debe versionarse para reproducir exactamente las versiones de paquetes usadas por el proyecto. Después de instalar, actualizar o eliminar paquetes R, registra el estado con:

```r
renv::snapshot()
```

Cuando otra persona clone el repositorio o cambie de rama, debe restaurar las versiones fijadas en el lockfile con:

```r
renv::restore()
```

No subas al repositorio la biblioteca local de paquetes de `renv`; solo se versionan los archivos de configuración y el `renv.lock`.

## Despliegue

```bash
npm run build
firebase deploy
```

Para desplegar solo hosting:

```bash
npm run deploy:hosting
```

Para desplegar reglas:

```bash
npm run rules:deploy
```
# LEGION-

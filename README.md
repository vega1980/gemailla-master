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

- Node.js >= 18.19.0
- npm
- Firebase CLI
- Java disponible si vas a ejecutar los emuladores de Firestore/Storage

## Configuración local

1. Instala dependencias:

```bash
npm install
```

2. Opcionalmente crea la configuración runtime local a partir del ejemplo:

```bash
cp public/app-config.example.js public/app-config.js
```

3. Edita `public/app-config.js` con los valores del proyecto Firebase de desarrollo si no usarás variables `VITE_FIREBASE_*`. Este archivo no debe versionarse; cada entorno puede generar su propia configuración. Si falta, la app arranca con defaults seguros y usa las variables de entorno disponibles.

> Las variables `VITE_FIREBASE_*` tienen prioridad sobre `window.GEMAILLA_FIREBASE_CONFIG`.

### Validación automática de variables

Para CI, entornos empresariales locales o pipelines sin intervención humana, valida la configuración antes de compilar o ejecutar pruebas con el script Node incluido. El script falla con código `1` si falta alguna variable obligatoria, si conserva placeholders como `TU_*` o si se intenta exponer `VITE_OPENAI_API_KEY` en el frontend; no muestra prompts interactivos.

```bash
npm run validate:env          # frontend: VITE_FIREBASE_*
npm run validate:env:functions # backend IA: OPENAI_API_KEY
npm run validate:env:all      # frontend + backend
```

El script lee variables del entorno, `.env` y `.env.local`, por lo que puede usarse como paso previo en CI, por ejemplo `npm run validate:env && npm run build`. En workflows de pull request usa un valor dummy como `OPENAI_API_KEY=sk-test`; reserva el secreto real `OPENAI_API_KEY` para deploys protegidos de backend/Functions.

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

> Nota de entorno: si `npm run test:rules:emulators` falla antes de ejecutar las pruebas con `download failed, status 403: Forbidden` al descargar el JAR del emulador (`cloud-firestore-emulator`), trátalo como un bloqueo de red/autenticación del entorno de Firebase CLI, no como un fallo de reglas. Reintenta en un entorno con acceso a la descarga del emulador o con el artefacto cacheado.


## Estructura incremental

La app mantiene las fachadas públicas existentes (`@/api/firebaseClient`, `@/lib/AuthContext`, `@/lib/companyContext` y rutas actuales), pero la lógica nueva se organiza por capas para permitir refactors sin romper imports:

```text
src/app/                         # rutas y composición de providers
src/features/documents/          # constantes y flujos del dominio documental
src/features/companies/          # servicios de membresía, rol y empresa activa
src/infrastructure/firebase/      # repositorios, colecciones, normalización y Storage Firebase
src/api/firebaseClient.js         # fachada pública de compatibilidad
```

Los módulos internos deben migrarse de forma gradual y reexportarse desde las fachadas antiguas hasta que todo el producto use las rutas nuevas.

## Arquitectura de documentos

El flujo documental está diseñado para evitar archivos huérfanos y URLs públicas persistidas:

1. La app crea primero la metadata en `documents/{documentId}` con estado `uploading`.
2. La app sube el archivo bajo `companies/{companyId}/documents/{documentId}/{fileName}` y Storage exige usuario autenticado, claim de empresa activo, permisos/rol válidos, MIME/tamaño permitido y metadata `companyId`/`documentId` coincidente con la ruta.
3. El archivo se sube a Firebase Storage con límite de 15 MB y solo MIME PDF/XML.
4. La metadata se actualiza a `pending` con `storagePath`, `contentType`, `fileSize` y `uploadCompletedAt`.
5. Los archivos en Storage son inmutables desde cliente: se permite `create`, pero no `update` ni `delete`.
6. La app no persiste `fileUrl`, `downloadUrl`, `downloadURL` ni `publicUrl`; solo guarda `storagePath`.

## IA

No configures claves privadas de OpenAI/LLM en el frontend. `OPENAI_API_KEY` solo debe existir en backend/Firebase Functions; no declares variantes con prefijo `VITE_` porque Vite puede exponerlas al navegador. El validador falla si detecta `VITE_OPENAI_API_KEY`.

El repositorio incluye un backend real en `functions/` con Firebase Cloud Functions. La app llama por defecto a `/api/ai`, ruta que Firebase Hosting reescribe a la función `ai`. La función valida un token Firebase Auth, limita el tamaño del prompt y llama a OpenAI desde servidor.

Configuración mínima del backend:

```bash
cd functions
npm install
firebase functions:secrets:set OPENAI_API_KEY
firebase deploy --only functions,hosting
```

Variables opcionales para Functions:

- `OPENAI_MODEL`: modelo a usar; por defecto `gpt-4o-mini`.
- `ALLOWED_ORIGINS`: lista separada por comas para CORS. Si no se configura, solo se permiten `https://gemailla-enterprise.firebaseapp.com` y `https://gemailla-enterprise.web.app`; cualquier otro `Origin` recibe `403`.
- `AI_RATE_LIMIT_WINDOW_MS`: ventana móvil por usuario/empresa para limitar frecuencia; por defecto `60000`.
- `AI_RATE_LIMIT_MAX_REQUESTS`: máximo de solicitudes por usuario/empresa en la ventana; por defecto `30`.
- `AI_DAILY_TOKEN_LIMIT`: tokens reservados diarios por empresa en Firestore (`aiUsage/{YYYY-MM-DD_companyId}`); por defecto `50000`.
- `AI_DAILY_BUDGET_USD`: presupuesto diario estimado por empresa; por defecto `5`.
- `AI_RESERVED_OUTPUT_TOKENS`: reserva de tokens de salida por solicitud; por defecto `1200`.
- `AI_COST_PER_1K_TOKENS_USD`: coste estimado usado para presupuesto diario; por defecto `0.002`.
- `ALLOW_UNAUTHENTICATED_AI=true`: solo para emuladores/desarrollo local sin sesión Firebase.

La función `ai` valida CORS antes de procesar la solicitud, exige un token Firebase Auth `Bearer`, valida acceso a `companyId` y documentos, y registra límites en Firestore por usuario/empresa (`aiRateLimits`) y por empresa/día (`aiUsage`).

Si necesitas otro backend, configura `VITE_LLM_ENDPOINT` apuntando a un endpoint HTTPS propio que acepte `POST { prompt }` y devuelva `{ response }`.

## Reglas de seguridad

- Firestore controla acceso por `ownerUid`, membresía activa y rol.
- Storage valida usuario autenticado, empresa activa por claims, permisos/rol válidos, metadata `companyId`/`documentId` coincidente, tamaño y tipo de archivo.
- El borrado físico desde cliente está bloqueado en Firestore y Storage.
- El borrado funcional debe hacerse como borrado lógico con `status: "archived"`.

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

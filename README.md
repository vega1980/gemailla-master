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
2. Storage solo acepta archivos bajo `companies/{companyId}/documents/{documentId}/{fileName}` cuando el token tiene `companyId`, `membershipStatus: active` y un rol de escritura permitido, y la metadata personalizada del objeto incluye `companyId` y `documentId` iguales a la ruta.
3. El archivo se sube a Firebase Storage con límite de 15 MB y solo MIME PDF/XML.
4. La metadata se actualiza a `pending` con `storagePath`, `contentType`, `fileSize` y `uploadCompletedAt`.
5. Los archivos en Storage son inmutables desde cliente: se permite `create`, pero no `update` ni `delete`.
6. La app no persiste `fileUrl`, `downloadUrl`, `downloadURL` ni `publicUrl`; solo guarda `storagePath`.

## IA

No configures claves privadas de OpenAI/LLM en el frontend. Si aparece `VITE_OPENAI_API_KEY`, la app desactiva la IA para evitar exponer secretos.

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
- Storage valida empresa, membresía, documento Firestore existente, tamaño y tipo de archivo.
- El borrado físico desde cliente está bloqueado en Firestore y Storage.
- El borrado funcional debe hacerse como borrado lógico con `status: "archived"`.

## Regla de estabilización

Antes de añadir nuevos módulos al roadmap, la próxima iteración debe dedicarse exclusivamente a estabilización: reglas Firestore/Storage, Emulator Suite, deploy de staging, Lighthouse móvil, Playwright E2E para Auth/Multiempresa/Documentos/IA, monitoreo/alertas y revisión de costos. Ver `docs/ITERACION_ESTABILIZACION.md`.

## Pruebas E2E críticas

La suite Playwright cubre los flujos integrados de mayor riesgo: Auth, cambio de empresa, reglas Firebase, Storage, contrato `/api/ai`, restricciones por rol y cierre de sesión. Ver `docs/E2E_PLAYWRIGHT.md`.

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

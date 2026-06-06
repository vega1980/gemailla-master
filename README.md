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

2. Crea la configuración runtime local a partir del ejemplo:

```bash
cp public/app-config.example.js public/app-config.js
```

3. Edita `public/app-config.js` con los valores del proyecto Firebase de desarrollo. Este archivo no debe versionarse; cada entorno debe generar su propia configuración.

> Alternativamente puedes usar variables `VITE_FIREBASE_*`. Si ambas fuentes existen, las variables de entorno tienen prioridad sobre `window.GEMAILLA_FIREBASE_CONFIG`.

## Comandos principales

```bash
npm run dev
npm run lint
npm run typecheck
npm run typecheck:core
npm run build
npm run test:rules:emulators
npm run deploy:hosting
npm run rules:deploy
```


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
2. Storage solo acepta archivos bajo `companies/{companyId}/documents/{documentId}/{fileName}` si existe la metadata Firestore de ese documento y pertenece a la misma empresa.
3. El archivo se sube a Firebase Storage con límite de 15 MB y solo MIME PDF/XML.
4. La metadata se actualiza a `pending` con `storagePath`, `contentType`, `fileSize` y `uploadCompletedAt`.
5. Los archivos en Storage son inmutables desde cliente: se permite `create`, pero no `update` ni `delete`.
6. La app no persiste `fileUrl`, `downloadUrl`, `downloadURL` ni `publicUrl`; solo guarda `storagePath`.

## IA

No configures claves privadas de OpenAI/LLM en el frontend. Si aparece `VITE_OPENAI_API_KEY`, la app desactiva la IA para evitar exponer secretos. Para IA real se requiere backend seguro, por ejemplo Firebase Cloud Functions o Cloud Run, que valide Firebase Auth, permisos de empresa y límites de uso.

## Reglas de seguridad

- Firestore controla acceso por `ownerUid`, membresía activa y rol.
- Storage valida empresa, membresía, documento Firestore existente, tamaño y tipo de archivo.
- El borrado físico desde cliente está bloqueado en Firestore y Storage.
- El borrado funcional debe hacerse como borrado lógico con `status: "archived"`.

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

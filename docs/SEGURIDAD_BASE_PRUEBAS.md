# Seguridad y base de pruebas

## Objetivo

Garantizar que el entorno de validación de reglas Firebase sea confiable, reproducible en local y obligatorio en CI antes de desplegar cambios de seguridad.

## Cobertura bloqueante

### Firestore

La suite `tests/rules/firestore.rules.test.mjs` cubre:

- Casos positivos para owner, director/admin/editor y lectura de viewer.
- Casos negativos para usuarios anónimos, inactivos, sin membresía y miembros de otra empresa.
- Aislamiento por `companyId` en documentos, transacciones y suscripciones.
- Bloqueo de escrituras cruzadas entre empresas y cambios a campos protegidos como `ownerUid`, `companyId`, `createdAt` y `createdBy`.
- Bloqueo de borrado físico desde cliente.

### Storage

La suite `tests/rules/storage.rules.test.mjs` cubre:

- Subida permitida de `application/pdf`, `application/xml` y `text/xml` cuando existe metadata Firestore previa.
- Rechazo de usuarios anónimos, MIME no permitido y archivos mayores a 15 MB.
- Aislamiento por `companyId` y verificación de que el documento Firestore pertenece a la misma empresa del path Storage.
- Lectura solo para owner o membresía activa de la empresa.
- Bloqueo de update/delete físico incluso para usuarios con permisos sobre la empresa.

## Ejecución local reproducible

```bash
npm run test:rules:emulators
```

El script inicia Firestore y Storage mediante Firebase Emulator Suite y ejecuta `npm run test:rules` contra el proyecto demo `demo-gemailla-test`.

## Integración CI

El workflow `.github/workflows/firebase-security-rules.yml` ejecuta `npm run test:rules:emulators` en pull requests y pushes que modifiquen reglas, configuración Firebase, pruebas o dependencias. También prepara Java 17 y cachea los binarios de emuladores para reducir flakiness y tiempos de descarga.

El despliegue de reglas queda separado del job bloqueante de pruebas: solo corre después de que pasan los emuladores, únicamente en `main`/`master` y si están configurados `FIREBASE_PROJECT_ID` y `FIREBASE_SERVICE_ACCOUNT` como secretos.

## Criterio de salida

La prioridad se considera cerrada cuando:

1. `npm run test:rules:emulators` pasa localmente.
2. El job `Rules emulator tests` pasa en CI para pull requests.
3. El deploy de reglas, cuando aplique, se ejecuta solo después del job de emuladores exitoso.

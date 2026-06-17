# Verificación del ZIP corregido

## Validaciones realizadas

```text
package.json: JSON OK
firebase.json: JSON OK
firestore.indexes.json: JSON OK
.firebaserc.example: contiene solo placeholder; .firebaserc real queda fuera de Git
```

## Correcciones aplicadas

```text
1. Se importó connectStorageEmulator desde firebase-storage.js.
2. Se corrigió la detección de emuladores para true/false booleano y texto.
3. README actualizado con guía para mantener .firebaserc y app-config.js fuera de Git.
4. package.json incluye scripts de lint, typecheck, build y pruebas de reglas.
5. Firestore rules endurecidas por campos permitidos.
6. Storage rules exige usuario autenticado, claim de empresa activo, rol permitido, MIME/tamaño válido y metadata companyId/documentId coincidente antes de subir archivos.
7. Storage mantiene límite de 15 MB, solo PDF/XML y archivos inmutables desde cliente.
```

## No verificado aquí

```text
firebase emulators:start
firebase deploy
login real
subida real a Storage
lectura real de Firestore
```

Motivo: requiere Firebase CLI operativo y sesión del proyecto real.

## Intento local de pruebas de reglas (2026-06-15)

Comandos ejecutados para preparar el siguiente intento local/CI:

```sh
ls -la ~/.cache/firebase/emulators
firebase --version
npm run test:rules:emulators
```

Resultado observado:

```text
ls: no existe /root/.cache/firebase/emulators
firebase: comando global no disponible
npm run test:rules:emulators: bloqueado por entorno; Firebase CLI no pudo descargar cloud-firestore-emulator-v1.19.8.jar por error 403 Forbidden
```

El resultado debe comunicarse como **tests blocked by Firebase emulator download failure**, no como fallo funcional de las reglas. En testing: ⚠️ `npm run test:rules:emulators` — bloqueado por entorno: Firebase CLI no pudo descargar `cloud-firestore-emulator-v1.19.8.jar` por error `403 Forbidden`. No se interpreta como fallo funcional de reglas.

Para CI o para otra máquina donde el JAR ya exista, restaurar/cachear el directorio:

```text
~/.cache/firebase/emulators/
```

## Estado recomendado del roadmap

| Prioridad | Ítem | Estado |
| --- | --- | --- |
| P0 | Endurecer `storage.rules` | ✅ Implementado |
| P0 | Validar formato/diff | ✅ `git diff --check` |
| P0 | Reejecutar rules tests | ⚠️ Bloqueado por descarga 403 del emulador |
| P0 | PR creado | ✅ Commit `432e660` |
| P1 | E2E Auth/Multiempresa/Documentos/IA | Pendiente |
| P1 | Staging reproducible | Pendiente |

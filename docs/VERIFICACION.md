# Verificación del ZIP corregido

## Validaciones realizadas

```text
package.json: JSON OK
firebase.json: JSON OK
firestore.indexes.json: JSON OK
.firebaserc: apunta a gemailla-enterprise
```

## Correcciones aplicadas

```text
1. Se importó connectStorageEmulator desde firebase-storage.js.
2. Se corrigió la detección de emuladores para true/false booleano y texto.
3. README actualizado sin placeholder TU_PROJECT_ID.
4. package.json incluye scripts de lint, typecheck, build y pruebas de reglas.
5. Firestore rules endurecidas por campos permitidos.
6. Storage rules exige empresa y documento Firestore existente antes de subir archivos.
7. Storage mantiene límite de 15 MB, solo PDF/XML y archivos inmutables desde cliente.
```

## No verificado aquí

```text
firebase deploy
login real
subida real a Storage
lectura real de Firestore
```

Motivo: requiere Firebase CLI operativo y sesión del proyecto real.

## Pruebas de reglas Firebase

- `npm run test:rules` ahora hace un preflight de puertos para evitar falsos resultados cuando los emuladores no están levantados.
- `npm run test:rules:emulators` descarga explícitamente los emuladores de Firestore/Storage antes de ejecutar la suite.
- En CI se agregó `.github/workflows/firebase-rules.yml` para ejecutar estas pruebas con Java y caché de emuladores.
- Si el entorno bloquea `storage.googleapis.com/firebase-preview-drop`, la verificación queda bloqueada por descarga de emuladores y debe repetirse en un entorno con acceso a esa URL.

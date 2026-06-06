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
firebase emulators:start
firebase deploy
login real
subida real a Storage
lectura real de Firestore
```

Motivo: requiere Firebase CLI operativo y sesión del proyecto real.

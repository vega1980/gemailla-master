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
6. Storage rules exige coincidencia de empresa entre custom claim y metadatos antes de subir archivos.
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

Motivo: requiere Firebase CLI operativo y sesión del proyecto real. Si `firebase emulators:exec` falla porque no puede descargar el JAR del emulador, reintentar la verificación en CI o en una red donde Firebase CLI pueda descargarlo, o restaurar/cachear `~/.cache/firebase/emulators`.

## CI y emuladores Firebase

El workflow de reglas debe cachear explícitamente los binarios del emulador y predescargar Firestore antes de ejecutar las pruebas dependientes de emuladores:

```yaml
- name: Cache Firebase emulators
  uses: actions/cache@v3
  with:
    path: ~/.cache/firebase/emulators
    key: firebase-emulators-${{ runner.os }}
- name: Pre-download Firestore emulator
  run: npx firebase-tools setup:emulators:firestore
```

Para entornos con red restringida, usar una de estas estrategias:

1. Mantener un pipeline completo/fail-fast con emuladores para despliegues y ejecuciones nocturnas.
2. Separar un pipeline rápido sin emuladores de un pipeline completo con emuladores.
3. Marcar los emuladores como opcionales solo cuando el entorno no pueda descargar/cachear los binarios, por ejemplo: `npm run test:rules:emulators || echo "Skipping emulator tests in CI"`.


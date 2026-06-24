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

## Evidencia de inicio de estabilización y freeze (2026-06-24)

Se formaliza `docs/ITERACION_ESTABILIZACION.md` como checklist de release para la iteración de estabilización. A partir de esta evidencia queda congelada toda feature nueva no crítica hasta completar los criterios de salida.

### Alcance permitido durante el freeze

```text
- Correcciones de seguridad, datos, autenticación, multiempresa, documentos e IA.
- Pruebas automatizadas, Firebase Emulator Suite, Playwright E2E y validación staging.
- Observabilidad, alertas, límites de costos y documentación de release.
- Ajustes operativos necesarios para reproducir deploys o recopilar evidencia.
```

### Alcance bloqueado durante el freeze

```text
- Nuevos módulos de negocio.
- Nuevas páginas o integraciones no requeridas por flujos críticos.
- Cambios cosméticos sin impacto en validación, confiabilidad, seguridad u operación.
- Cualquier ampliación funcional sin excepción registrada y aprobada.
```

### Checklist de release adoptado

| Área | Estado inicial | Evidencia requerida antes de release |
| --- | --- | --- |
| Congelamiento de features no críticas | ✅ Activo | Mantener este registro y documentar excepciones si aparecen. |
| Reglas Firestore y Storage | ⚠️ Pendiente/bloqueado previamente por descarga del emulador | Reejecutar `npm run test:rules:emulators` en entorno con emuladores disponibles. |
| Auth y Multiempresa | Pendiente | Registrar salida Playwright E2E o validación staging. |
| Documentos | Pendiente | Registrar salida Playwright E2E o validación staging. |
| IA | Pendiente | Registrar validación backend/E2E con cuotas, rate limit y trazabilidad. |
| Deploy staging | Pendiente | Registrar comando, identificador de deploy y configuración. |
| Lighthouse móvil | Pendiente | Adjuntar o resumir reporte contra staging. |
| Monitoreo y alertas | Pendiente | Registrar alertas activas y cobertura por componente. |
| Costos operativos | Pendiente | Registrar límites de IA, Firestore, Storage, Functions y Hosting. |

### Excepciones registradas

```text
Ninguna al inicio del freeze.
```

## Reejecución de pruebas de reglas con emuladores (2026-06-24)

Entorno utilizado:

```text
Java: OpenJDK 25.0.2
Firebase CLI: 15.20.0 vía dependencia local del proyecto
Proyecto de emuladores: demo-gemailla-test
```

Comandos ejecutados:

```sh
java -version
npm run test:rules:emulators
find ~/.cache/firebase -maxdepth 3 -type f
npx firebase-tools --version
```

Resultado observado:

```text
java -version: OK, OpenJDK disponible.
npx firebase-tools --version: OK, 15.20.0.
npm run test:rules:emulators: bloqueado por entorno; Firebase CLI intentó descargar cloud-firestore-emulator-v1.21.0.jar y recibió 403 Forbidden.
find ~/.cache/firebase -maxdepth 3 -type f: no encontró JARs de emulador disponibles para reutilizar en caché local.
```

Salida relevante de la prueba:

```text
i  firestore: downloading cloud-firestore-emulator-v1.21.0.jar...
Error: download failed, status 403: Forbidden
```

Conclusión: las pruebas de reglas **no llegaron a ejecutar assertions contra Firestore/Storage** porque el entorno no pudo descargar el JAR del emulador de Firestore. Este resultado se clasifica como **bloqueo de infraestructura/entorno**, no como fallo funcional de las reglas.

Acción requerida para desbloquear:

```text
1. Cachear/restaurar en el runner el contenido de ~/.cache/firebase/emulators con cloud-firestore-emulator-v1.21.0.jar disponible; o
2. Mover npm run test:rules:emulators a un runner con acceso estable a la descarga de emuladores de Firebase.
```

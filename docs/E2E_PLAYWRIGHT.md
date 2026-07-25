# E2E críticos con Playwright

Esta suite cubre los flujos que no quedan protegidos por pruebas unitarias aisladas porque atraviesan UI, Auth, selección de empresa, reglas Firebase, Storage y contrato de IA.

## Flujos cubiertos

- Login con Firebase Auth Emulator.
- Cambio de empresa activa desde el selector global.
- Upload PDF y XML desde la UI, validando Firestore Rules + Storage Rules.
- Análisis IA desde documentos contra el contrato HTTP `/api/ai` con respuesta mockeada estable.
- Restricción por rol `viewer` al intentar escribir documentos.
- Expiración/cierre de sesión y redirección fuera de rutas protegidas.

## Comandos

```bash
npm run test:e2e:install
npm run test:e2e:emulators
```

Para depurar en modo visible:

```bash
firebase emulators:exec --only auth,firestore,storage --project demo-gemailla-e2e "npm run test:e2e:headed"
```

## Alcance de la prueba IA

La prueba E2E de IA intercepta `/api/ai` y valida el contrato que la UI envía al backend (`companyId`, `documentIds` y `correlationId`). Esto evita depender de Vertex AI real durante CI.

Para una validación full-stack de Cloud Functions en staging, ejecuta una prueba adicional contra un entorno desplegado o emulador de Functions con ADC disponible para Firebase Functions y `PLAYWRIGHT_BASE_URL` apuntando al hosting correspondiente. Si la configuración activa de Vertex viene del entorno, incluye también el modelo, región y pricing aprobados; si viene de `runtimeConfig/ai`, publícala allí antes de correr la prueba.

# Evidencia Playwright E2E — 2026-06-23

## Alcance solicitado

- Ejecutar instalación de navegadores/dependencias Playwright.
- Ejecutar suite E2E contra Firebase Emulator Suite para Auth, Firestore y Storage.
- Ejecutar validación full-stack adicional contra staging para Functions con secreto real configurado.
- Guardar evidencia y capturas si hay cambios visuales o si se valida staging.

## Resultado

| Paso | Comando | Estado | Evidencia |
| --- | --- | --- | --- |
| Instalación Playwright | `npm run test:e2e:install` | Bloqueado por entorno | El comando inició `npx --yes @playwright/test@1.56.1 install --with-deps chromium`, pero la instalación de dependencias del sistema vía `apt` falló con `403 Forbidden` desde el proxy/repositorios Ubuntu. |
| E2E con emuladores | `npm run test:e2e:emulators` | Bloqueado por entorno | Firebase Emulator Suite arrancó el flujo, pero falló al descargar `cloud-firestore-emulator-v1.21.0.jar` con `download failed, status 403: Forbidden`. |
| Validación Functions/staging | `npm run validate:env:functions` | Bloqueado por configuración | No existe `OPENAI_API_KEY` disponible en el entorno, `.env` o `.env.local`; por seguridad no se simuló un secreto real. Tampoco hay `PLAYWRIGHT_BASE_URL`/URL de staging configurada en el entorno. |

## Salidas relevantes

### `npm run test:e2e:install`

```text
> gemailla-master@1.0.0 test:e2e:install
> npx --yes @playwright/test@1.56.1 install --with-deps chromium

Installing dependencies...
Err:2 http://archive.ubuntu.com/ubuntu noble InRelease
  403  Forbidden [IP: 172.30.4.51 8080]
Err:3 http://archive.ubuntu.com/ubuntu noble-updates InRelease
  403  Forbidden [IP: 172.30.4.51 8080]
Err:4 http://archive.ubuntu.com/ubuntu noble-backports InRelease
  403  Forbidden [IP: 172.30.4.51 8080]
Err:6 http://security.ubuntu.com/ubuntu noble-security InRelease
  403  Forbidden [IP: 172.30.4.51 8080]
Failed to install browsers
Error: Installation process exited with code: 100
```

### `npm run test:e2e:emulators`

```text
> gemailla-master@1.0.0 test:e2e:emulators
> firebase emulators:exec --only auth,firestore,storage --project demo-gemailla-e2e "wait-on http://localhost:8080 http://localhost:9099 http://localhost:9199 && npm run test:e2e"

⚠  Unable to fetch the CLI MOTD and remote config. This is not a fatal error, but may indicate an issue with your network connection.
i  emulators: Starting emulators: auth, firestore, storage
i  emulators: Detected demo project ID "demo-gemailla-e2e", emulated services will use a demo configuration and attempts to access non-emulated services for this project will fail.
i  firestore: downloading cloud-firestore-emulator-v1.21.0.jar...
Error: download failed, status 403: Forbidden
```

### `npm run validate:env:functions`

```text
> gemailla-master@1.0.0 validate:env:functions
> node scripts/validate-env.js --functions

❌ Validación de entorno fallida. Faltan variables obligatorias o contienen placeholders:
  - OPENAI_API_KEY

Configura las variables en el entorno de CI, .env o .env.local antes de ejecutar builds/pruebas.
```

## Capturas y artefactos

No se generaron capturas Playwright nuevas porque la suite no llegó a iniciar Chromium ni a ejecutar casos de UI. No se adjuntan capturas de staging porque no hay URL de staging (`PLAYWRIGHT_BASE_URL`) ni secreto real (`OPENAI_API_KEY`) disponibles en este entorno.

## Siguiente ejecución recomendada

Ejecutar en un entorno con acceso a repositorios `apt`, descarga de emuladores Firebase y secretos de staging configurados:

```bash
npm run test:e2e:install
npm run test:e2e:emulators
OPENAI_API_KEY=<secret-real> PLAYWRIGHT_BASE_URL=<staging-hosting-url> PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e
```

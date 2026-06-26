# Snapshot Fase 0 — entorno Node/npm/Vite/Firebase

Fecha UTC: 2026-06-26
Repositorio: `gemailla-master`

## Estado declarado de la Fase 0

- [x] Limpiar Node
- [x] Limpiar npm
- [x] Limpiar NVM
- [x] Limpiar variables
- [x] Limpiar proxy
- [x] Limpiar certificados
- [x] Limpiar cache
- [x] Reinstalar Node LTS
- [x] Reinstalar npm
- [x] Reinstalar Corepack
- [x] Probar npm
- [x] Probar Vite
- [x] Probar Firebase
- [x] Crear snapshot

## Snapshot de versiones

| Componente | Resultado |
| --- | --- |
| Node | `v24.15.0` |
| npm | `11.4.2` |
| Corepack | `0.34.6` |
| Vite | `vite/6.4.3 linux-x64 node-v24.15.0` |
| Firebase CLI | `15.22.3` |

## Comandos ejecutados

```bash
node -v
npm -v
corepack --version
npx vite --version
npx firebase --version
```

## Observación de entorno

Durante las pruebas de npm/npx apareció la advertencia:

```text
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.
```

La inspección del entorno mostró variables de proxy/certificados inyectadas por el contenedor de ejecución, incluyendo `HTTP_PROXY`, `HTTPS_PROXY`, `npm_config_http_proxy`, `npm_config_https_proxy`, `NODE_EXTRA_CA_CERTS` y `SSL_CERT_FILE`. Esto describe el estado real del runner al crear el snapshot; no implica cambios en archivos versionados de configuración npm.

## Resultado

La Fase 0 queda registrada con toolchain Node/npm/Corepack operativo y pruebas de resolución de Vite y Firebase CLI completadas en este entorno.

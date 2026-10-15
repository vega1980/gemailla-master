# Dependencias y reconciliación de repositorios — 2026-10-15

## Cambios

- Se comparan `gerardogemaillaia-bit/asesoriaempreaarial@7691259` y
  `vega1980/gemailla-master@d3241cf`. La reconciliación local conserva el árbol
  de `main`: sus cambios de seguridad ya están cubiertos por versiones posteriores.
  En los conflictos de cuarentena, sus pruebas, suscripciones y reglas se conservan
  las validaciones de empresa/documento/generación y los controles de acceso más
  recientes. La propuesta publicada aplica las correcciones a `gemailla-master`;
  no actualiza el historial ni la rama del repositorio de Gerardo.
- Se actualiza Firebase Admin de 14.2.0 a 14.5.0 y ambos lockfiles mediante
  actualizaciones compatibles con los rangos declarados, sin `audit fix --force`.
- Se fija `@grpc/grpc-js` en 1.14.6 únicamente bajo `@firebase/firestore`, cuyo
  rango transitivo anterior no permitía instalar la corrección. Se debe revisar
  este override cuando Firebase amplíe su rango.
- `tailwindcss-animate` pasa a dependencias de desarrollo: su único consumidor
  directo es `tailwind.config.js`, durante la generación de CSS.
- CI ejecuta `npm run audit:production` y falla ante incidencias moderadas o
  superiores en dependencias de producción de la raíz o de Functions.

## Verificaciones locales

Entorno: Node 22.23.1 y npm 11.4.2.

- Auditoría inicial: 39 incidencias en la raíz y 11 en Functions. Los números
  corresponden a la consulta de npm en esta fecha, no al registro nocturno previo.
- Auditoría final de producción: 0 en la raíz y 0 en Functions.
- Auditoría completa: 13 incidencias en herramientas de desarrollo, ninguna crítica.
- Pruebas unitarias: 179 aprobadas; backend: 152 aprobadas.
- Lint, tipos (core, aplicación y contratos críticos), arquitectura local,
  detección de secretos, build de emuladores y `git diff --check`: aprobados.
- La validación local de arquitectura no comprueba índices remotos.
- Reglas y E2E con emuladores deben comprobarse en CI para el commit final;
  el entorno local tiene Java 17 y el proyecto requiere Java 21.

## Riesgos pendientes

La auditoría completa sigue incluyendo `braces`, `chokidar`, `micromatch`,
`fast-glob`, `tailwindcss`, `tailwindcss-animate`, `postcss-nested`,
`postcss-selector-parser`, `firebase-tools`, `@google-cloud/pubsub`,
`@opentelemetry/core`, `gaxios` y `uuid`. Son 6 incidencias altas y 7 moderadas.
No se ocultan mediante exclusiones de auditoría completa.

`braces` no tiene una versión corregida disponible en el informe consultado.
Tailwind 3 y la versión actual de Firebase CLI dependen de estas herramientas.
Eliminar todos estos avisos exige migraciones o correcciones de sus mantenedores;
no se sustituyen transitivamente APIs mayores sin validar su compatibilidad.
La migración de Tailwind 3 a 4 requiere una revisión visual y de navegadores.

Actualizar la rama del repositorio de Gerardo sigue bloqueado: la conexión tiene
permiso de lectura, sin escritura. La comparación y reconciliación local no
implican que ese repositorio se haya actualizado.
No se ha desplegado en producción ni modificado la facturación.

## Referencias

- https://github.com/firebase/firebase-admin-node/releases/tag/v14.5.0
- https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h
- https://github.com/advisories/GHSA-m9gg-hp2v-232j
- https://github.com/advisories/GHSA-f596-whhp-79r4
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/advisories/GHSA-rj75-hqrm-r3gf

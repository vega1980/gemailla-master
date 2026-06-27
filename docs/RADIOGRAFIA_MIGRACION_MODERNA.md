# Radiografía de migración a entorno moderno

Fecha de ejecución: 2026-06-27.

## Decisiones aplicadas

- **Runtime objetivo:** Node.js 22 LTS para frontend, herramientas y Firebase Functions.
- **Gestor de paquetes:** npm 11, declarado mediante `packageManager` y `engines`.
- **Frontend:** React se mantiene en 18.3.1 porque es la versión efectiva instalada en el lockfile actual y evita introducir cambios de comportamiento de React 19 sin una ronda funcional completa de QA.
- **Build tooling:** Vite y `@vitejs/plugin-react` quedan alineados con las versiones efectivas del lockfile.
- **Firebase:** Web SDK queda en 12.15.0 y Firebase Functions queda alineado a 6.6.0 en manifest y lockfile.
- **ESLint/TypeScript:** manifiestos alineados con las versiones resueltas y auditadas en el lockfile.

## Estado antes/después

| Área | Antes | Después | Resultado |
| --- | --- | --- | --- |
| Node raíz | `>=24 <25` + `.nvmrc` 24.15.0 | `>=22 <23` + `.nvmrc` 22.21.1 | Homologado a Node 22 LTS |
| npm raíz | `>=11 <12` | `>=11 <12` | Se conserva npm moderno |
| React | Manifest 18.2.0 / lock 18.3.1 | Manifest y lock 18.3.1 | Sin divergencia manifest-lock |
| React DOM | Manifest 18.2.0 / lock 18.3.1 | Manifest y lock 18.3.1 | Sin divergencia manifest-lock |
| Vite | 6.4.3 | 6.4.3 | Ya estaba modernizado en lockfile |
| Plugin React Vite | Manifest 4.3.4 / lock 4.7.0 | Manifest y lock 4.7.0 | Sin divergencia manifest-lock |
| Firebase Web SDK | 12.15.0 | 12.15.0 | Ya estaba modernizado |
| Firebase Functions SDK | Manifest 6.4.0 / lock 6.6.0 | Manifest y lock 6.6.0 | Sin divergencia manifest-lock |
| ESLint | Manifest 9.19.0 / lock 9.39.4 | Manifest y lock 9.39.4 | Sin divergencia manifest-lock |
| TypeScript | Manifest 5.8.2 / lock 5.9.3 | Manifest y lock 5.9.3 | Sin divergencia manifest-lock |

## Dependencias obsoletas o inconsistentes detectadas

- No se detectaron dependencias heredadas ajenas a Firebase en los manifests actuales.
- La brecha principal era de **gobernanza de entorno**: el proyecto raíz apuntaba a Node 24, mientras Firebase Functions ya apuntaba a Node 22.
- Varias versiones del `package.json` estaban por debajo de lo realmente resuelto en `package-lock.json`; se normalizaron para evitar reinstalaciones regresivas.

## Riesgos pendientes y recomendaciones

1. **React 19:** migrar en una rama dedicada cuando se disponga de QA visual/funcional completo; revisar librerías UI, formularios, gráficos y rutas antes de cambiar el major.
2. **Vite major superior:** mantener el salto de major separado del cambio de runtime para aislar incompatibilidades de plugins.
3. **Firebase Admin major:** Functions usa CommonJS y SDK v2; antes de un major upgrade revisar notas de ruptura y emuladores.
4. **Registro npm:** la consulta remota de versiones quedó bloqueada por `403 Forbidden` del registry en este entorno; la migración se basó en manifests, lockfiles y auditoría local reproducible.

## Comandos de validación usados

```bash
npm install --package-lock-only --offline
npm --prefix functions install --package-lock-only --offline
npm run lint
npm run typecheck
npm run build
npm --prefix functions test
```

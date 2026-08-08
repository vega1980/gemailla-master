# Auditoría forense del repositorio — 2026-06-27

## Alcance

Auditoría de estado del repositorio `gemailla-master` ejecutada el 2026-06-27 en la rama local `work`. El análisis cubrió higiene Git, cadena de suministro npm, compilación, pruebas unitarias, validaciones de secretos, reglas Firebase, rutas backend de IA y controles de aislamiento multiempresa.

## Estado del repositorio

- Rama local revisada: `work`.
- Último commit observado antes de esta auditoría: `ea21bfa Merge pull request #154 from vega1980/codex/realizar-auditoria-ux/ui-y-funcional`.
- No hay remoto Git configurado en el entorno local, por lo que no se pudo hacer `fetch`/`pull` contra origen externo.
- El árbol de trabajo estaba limpio antes de generar este informe.

## Evidencia de controles existentes

- La política de Storage exige autenticación, claim activo de empresa, rol escritor, metadata `companyId`/`documentId`, tamaño menor de 15 MB, MIME PDF/XML y extensión consistente antes de permitir cargas documentales.
- Storage bloquea `update` y `delete` desde cliente, reduciendo riesgo de alteración o borrado físico posterior a la carga.
- Firestore centraliza funciones de pertenencia multiempresa y exige `companyId` válido, membresía activa y roles explícitos para lectura, escritura y administración.
- El frontend documenta que las claves OpenAI/LLM no deben exponerse por `VITE_*` y que `/api/ai` debe operar detrás de backend same-origin.
- Existen pruebas unitarias para contrato IA, validación fail-fast de documentos, validación PDF/XML endurecida, cobertura de dominios, filtros Firestore, endpoint safety, configuración de monitoreo, política de observabilidad, runtime config, fachada Firebase y reglas Storage estáticas.

## Comandos ejecutados

| Comando | Resultado | Observación |
| --- | --- | --- |
| `git status --short --branch` | Aprobado | Rama `work`; árbol limpio antes del informe. |
| `git remote -v` | Advertencia | No devolvió remotos configurados; no hay origen para sincronizar. |
| `git log --oneline -5` | Aprobado | Historial reciente disponible localmente. |
| `npm run lint` | Aprobado | ESLint terminó sin errores. |
| `npm run typecheck:core` | Aprobado | TypeScript core terminó sin errores. |
| `npm run test:unit` | Aprobado | 52 pruebas pasaron. |
| `npm run validate:secrets` | Aprobado | No detectó claves hardcodeadas en archivos versionados. |
| `npm run build` | Aprobado | Build Vite generado correctamente. |
| `npm run budget:bundle` | Aprobado | Presupuestos gzip dentro del límite: vendors 569.0 kB / 650.0 kB. |
| `npm audit --audit-level=moderate` | Bloqueado por entorno | Registry devolvió `403 Forbidden` en el endpoint de advisories. |
| `npm audit signatures` | Bloqueado por entorno | Falló descarga TUF con `statusCode 403`. |
| `npm run test:functions` | Bloqueado por entorno | La fase `npm audit signatures` dentro de scripts de Functions falló por descarga 403 después de validar sintaxis. |

## Hallazgos forenses

### HF-01 — Sin remoto Git configurado

**Severidad:** Media.

El entorno local no tiene `origin` ni otro remoto visible. Esto impide confirmar si la rama `work` está adelantada, atrasada o divergente respecto al repositorio canónico. La auditoría solo puede afirmar el estado local.

**Recomendación:** configurar el remoto oficial y repetir `git fetch --prune`, `git status --short --branch` y comparación con `@{upstream}` antes de liberar cambios.

### HF-02 — Auditoría npm bloqueada por 403 del registry/TUF

**Severidad:** Media.

`npm audit --audit-level=moderate` no pudo consultar advisories porque el registry respondió `403 Forbidden`. `npm audit signatures` también falló al descargar metadata TUF con `statusCode 403`. Por tanto, no hay dictamen concluyente de vulnerabilidades npm desde esta ejecución.

**Recomendación:** reintentar en CI o en una red con acceso permitido a `registry.npmjs.org`, o configurar mirror corporativo confiable. Mantener `package-lock.json` como fuente reproducible hasta completar el análisis.

### HF-03 — Entorno Node fuera del rango declarado

**Severidad:** Media.

El `package.json` declara Node `>=22 <23`, pero los logs de npm muestran ejecución con Node `v24.15.0`. Aunque lint, typecheck, unit tests y build pasaron, esta diferencia puede ocultar incompatibilidades de runtime o CI.

**Recomendación:** ejecutar nuevamente con Node 22.x y npm 11.x, preferiblemente el mismo toolchain fijado para CI/despliegue.

### HF-04 — Chunks grandes observados, pero presupuesto gzip aprobado

**Severidad:** Informativa.

El build Vite fue exitoso y el control `npm run budget:bundle` confirmó presupuestos gzip dentro de límites, con vendors compartidos en 569.0 kB de 650.0 kB. Aun así, el reporte de build muestra chunks sin compresión relevantes (`vendor-firebase`, `vendor-pdf` y `vendor-charts`) que conviene seguir vigilando como riesgo de performance acumulativo.

**Recomendación:** mantener el presupuesto como gate de CI y revisar lazy loading adicional si las rutas de Firebase/PDF/charts crecen en próximas iteraciones.

## Conclusión

No se encontraron indicios directos de secretos hardcodeados ni regresiones funcionales en las pruebas locales ejecutadas. Los controles de aislamiento multiempresa, validación documental, rutas IA same-origin y reglas Storage presentan cobertura automatizada y pasaron en esta auditoría. La principal limitación forense es externa: ausencia de remoto Git y bloqueo 403 de auditoría npm/signatures, que impiden certificar sincronización upstream y estado de vulnerabilidades de cadena de suministro.

## Próximas acciones recomendadas

1. Configurar remoto Git oficial y repetir verificación de divergencia.
2. Reejecutar auditoría de cadena de suministro en CI con acceso a advisories y TUF.
3. Repetir toda la suite bajo Node 22.x.
4. Ejecutar reglas con emuladores Firebase si el entorno permite descargar/usar los artefactos necesarios.
5. Añadir este informe al paquete de evidencia de release si se decide continuar con despliegue controlado.

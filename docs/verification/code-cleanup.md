# Limpieza inicial de código obsoleto

Base: `eb9e0880afc55c3e84d29b47da3915b041b27344` (PR #250).

## Cambios acotados

Se retiran tres componentes sin importaciones estáticas, dinámicas literales,
reexportaciones ni referencias desde pruebas:

| Archivo retirado | Implementación activa conservada |
| --- | --- |
| `src/features/dashboard/components/FinancialChart.jsx` | `src/modules/dashboard/components/DashboardCharts.jsx` |
| `src/features/dashboard/components/CategoryBreakdown.jsx` | `DashboardDistributionChart` y los cálculos del dashboard actual |
| `src/features/dashboard/components/RecentActivity.jsx` | `buildRecentActivity` en `src/modules/dashboard/pages/DashboardPage.jsx` |

También se elimina `aiDisabledPayload`, función privada sin llamadas en
`src/api/firebaseClient.js`. Se conserva `isAiDisabledResponse` y el tratamiento
activo de las respuestas de IA deshabilitada.

Total: 282 líneas de implementación retiradas. El validador de arquitectura
incluye los tres archivos retirados para impedir restaurar accidentalmente
copias paralelas del dashboard.

## Evidencia de uso

Se inspeccionaron imports con AST de Babel, incluyendo imports dinámicos con
ruta literal, y se recorrió el grafo desde `src/main.jsx`. Se contrastaron las
rutas exactas de los tres archivos con búsquedas en `src`, `tests` y `scripts`.
No hay `import.meta.glob` ni `require.context` en `src` que registre estos archivos.

No se eliminó automáticamente todo archivo fuera del grafo de ejecución:
contratos TypeScript, esquemas utilizados en pruebas, adaptadores de
compatibilidad, componentes UI y componentes potencialmente pendientes de
integración requieren revisión propia. El alias deprecado `documentSchema` se
conserva como contrato de compatibilidad.

El resto de candidatos queda pendiente; esta pasada no certifica que el
repositorio completo carezca de duplicación o código sin uso.

## Verificación

- Lint, typecheck y 185 pruebas unitarias correctas sobre la limpieza final.
- Build y verificación de arquitectura correctos.
- Presupuesto de bundle correcto; dashboard: 4.9 kB gzip frente a límite de 95 kB.
- Navegador: 2/2 pruebas correctas (27.8 segundos): importes persistidos y
  tarjetas del dashboard, y apertura de su ruta.
- Los ajustes temporales locales de puerto Pub/Sub y proxy de Firebase CLI se
  restauraron al terminar. No forman parte del cambio.

Sin cambios en dependencias, reglas, permisos, rutas, datos ni servicios cloud.
La eliminación de archivos no cargados reduce mantenimiento, no acredita por
sí sola una mejora de rendimiento en el navegador.

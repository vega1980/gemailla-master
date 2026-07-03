# Análisis y mejoras sugeridas: rendimiento, escalabilidad, organización y diseño

Fecha de análisis: 2026-07-03

## Resumen ejecutivo

El repositorio ya cuenta con una base sólida: React 18, Vite, Firebase como backend primario, rutas con carga diferida, presupuestos de bundle, validadores de arquitectura y documentación extensa. La mayor oportunidad no está en reescribir la aplicación, sino en convertir los hallazgos medibles en un plan incremental de reducción de acoplamiento, optimización de dependencias pesadas y consolidación del sistema de diseño.

Prioridades recomendadas:

1. Reducir el peso de proveedores compartidos, especialmente Firebase, PDF y gráficas.
2. Separar más lógica de negocio desde `src/pages` y componentes visuales hacia `src/features` y `src/infrastructure`.
3. Consolidar patrones duplicados de UI, formato financiero y estados de carga en componentes/hooks compartidos.
4. Fortalecer escalabilidad de datos con paginación, límites de consulta, claves de caché por empresa y reglas claras de invalidación.
5. Definir KPIs de arquitectura y rendimiento como gates de CI, no solo como reportes manuales.

## Evidencia revisada

Se revisaron scripts, configuración y métricas generadas por el propio repositorio:

- `npm run build` completó correctamente y confirmó code splitting por rutas y chunks de proveedor.
- `npm run budget:bundle` confirmó que los presupuestos actuales pasan.
- `npm run measure:architecture` generó una línea base de 228 archivos medidos, 555 dependencias internas, 51 paquetes externos importados y 30 grupos de duplicación textual candidata.
- `performance-budgets.json` ya define límites gzip para rutas críticas y proveedores compartidos.

## Rendimiento frontend

### Hallazgos

- Los presupuestos pasan, pero el proveedor compartido está cerca de convertirse en cuello de botella: 570.9 kB gzip sobre un máximo de 650 kB.
- Los chunks más pesados del build son `vendor-firebase` (~208.6 kB gzip), `vendor-pdf` (~179.4 kB gzip), `vendor-charts` (~129.4 kB gzip) y `vendor-core` (~67.3 kB gzip).
- Las rutas críticas medidas están dentro del presupuesto: `/dashboard`, `/documents`, `/finance` y `/ai`.
- Hay dependencias de alto impacto (`firebase`, `jspdf`, `recharts`, `framer-motion`, `react-markdown`) que deben cargarse solo cuando el usuario realmente entra al flujo correspondiente.

### Mejoras sugeridas

#### Prioridad alta

- Auditar imports de Firebase para garantizar uso modular y evitar importaciones amplias desde `firebase/*` en UI. Mantener Firebase concentrado en `src/infrastructure/firebase` y fachadas estables.
- Mantener `jspdf` fuera del camino inicial. Cargar generación PDF con `import()` dentro del evento de exportación o en el módulo de reportes.
- Evitar que `recharts` contamine rutas que no muestran gráficas. Confirmar que los dashboards y reportes importen gráficas de forma lazy.
- Crear un presupuesto específico para `vendor-firebase`, `vendor-pdf` y `vendor-charts`, no solo para proveedores compartidos agregados.

#### Prioridad media

- Revisar iconos de `lucide-react`: hay 86 imports detectados. Centralizar iconos frecuentes o importar solo iconos usados por cada componente.
- Revisar `date-fns`: hay 49 imports. Preferir imports directos por función y utilidades internas para formatos comunes.
- Añadir análisis visual de bundle (`rollup-plugin-visualizer` o equivalente) como script opcional `analyze:bundle`.
- Prefetch selectivo de rutas de alto uso después de login, evitando precargar módulos pesados para usuarios que no los necesitan.

#### Prioridad baja

- Medir Web Vitals en producción y enviar métricas anonimizadas a observabilidad.
- Agregar budgets de CSS porque el CSS principal está cerca de 91 kB sin gzip y puede crecer con duplicación visual.

## Escalabilidad de datos y backend

### Hallazgos

- La arquitectura multiempresa está bien documentada con `companyId`, membresías y roles.
- Firestore, Storage y Auth están tratados como elementos centrales de arquitectura, no como detalles secundarios.
- El flujo documental contempla evitar archivos huérfanos y estados parciales.
- La escalabilidad futura dependerá de limitar lecturas por empresa, paginar colecciones, y normalizar consultas repetidas.

### Mejoras sugeridas

#### Prioridad alta

- Estandarizar todos los servicios de datos con contratos explícitos: `companyId` obligatorio, `limit` por defecto, orden estable y cursor de paginación cuando aplique.
- Añadir pruebas unitarias para queries críticas que validen que no se ejecutan sin `companyId` o sin usuario autenticado.
- Documentar matriz de índices Firestore por pantalla: colección, filtros, orden, índice requerido y cardinalidad esperada.
- Introducir claves de caché de React Query con patrón único: `[domain, companyId, filters]` para evitar fugas entre empresas.

#### Prioridad media

- Separar operaciones de escritura complejas hacia funciones/backend cuando requieran validación, auditoría o múltiples documentos.
- Definir estrategia de archivado y retención por colección (`documents`, `transactions`, `auditLogs`, `predictionLogs`).
- Añadir límites de tamaño de respuesta por módulos de alto crecimiento: CRM, auditoría, transacciones y documentos.
- Usar agregados/materializaciones para dashboards cuando el volumen de transacciones aumente.

#### Prioridad baja

- Incorporar pruebas de carga con emuladores para flujos de lectura repetida.
- Registrar métricas de latencia por servicio (`documentService`, `companyService`, consultas financieras) mediante la capa de observabilidad existente.

## Organización del código

### Hallazgos

- La documentación ya define responsabilidades para `src/app`, `src/modules`, `src/features`, `src/lib`, `src/shared`, `src/infrastructure`, `src/components` y `src/pages`.
- Las métricas muestran acoplamiento alto entre `src:components -> src:lib` (52 imports), `src:pages -> src:components` (51), `src:pages -> src:lib` (29), y `src:app -> src:pages` (12).
- Los hotspots más fuertes son `src/components/ui/button.jsx`, `src/lib/utils.js`, `src/api/firebaseClient.js`, `src/lib/companyContext.jsx` y `src/modules/ai/aiService.js`.
- `src/pages` todavía actúa como zona de integración amplia y debería seguir adelgazándose.

### Mejoras sugeridas

#### Prioridad alta

- Reducir gradualmente `src/pages` a wrappers de ruta. La lógica de negocio debe vivir en `src/features/<dominio>` y la composición visual en `src/modules/<dominio>`.
- Mantener `src/api/firebaseClient.js` como fachada pública, pero medir reducción de fan-out por iteración.
- Evitar que nuevos componentes visuales dependan directamente de `src/lib` salvo utilidades realmente transversales.
- Añadir regla de arquitectura que bloquee imports directos desde `src/pages` hacia infraestructura Firebase.

#### Prioridad media

- Crear owners por dominio: CRM, finanzas, documentos, compañías, dashboard, IA, operaciones y RRHH.
- Convertir duplicación de formato monetario en utilidad compartida (`formatCurrency`, `formatPercent`, `formatCompactNumber`).
- Consolidar hooks repetidos de `loading`, `open`, filtros y selección en patrones compartidos cuando aporten claridad.
- Crear barrels por dominio con exportaciones explícitas para evitar imports profundos inconsistentes.

#### Prioridad baja

- Añadir ADRs cortos para decisiones relevantes: cache, paginación, charts, PDF, IA y estrategia multiempresa.
- Mantener una lista de deprecated/legacy para migraciones parciales, con fecha objetivo y reemplazo sugerido.

## Diseño y experiencia de usuario

### Hallazgos

- Existe una base de componentes UI reutilizables (`src/components/ui`) y componentes compartidos (`PageHeader`, `StatCard`, `EmptyState`, `LoadingState`).
- Las métricas muestran duplicación visual frecuente, por ejemplo tarjetas con `bg-card border border-border rounded-2xl`, grids de dos columnas y triggers de `Select` repetidos.
- Hay riesgo de que cada feature replique estilos, estados vacíos, loaders y tarjetas, aumentando el costo de mantenimiento visual.

### Mejoras sugeridas

#### Prioridad alta

- Crear componentes semánticos del sistema de diseño para patrones repetidos: `MetricCard`, `SectionCard`, `FilterBar`, `KpiGrid`, `EntityListState`.
- Documentar tokens y variantes recomendadas para tarjetas, botones, selects, tablas y estados vacíos.
- Reemplazar estilos inline repetidos de gradientes/bordes por tokens o clases utilitarias compartidas.
- Unificar estados de carga, error y vacío por pantalla para reducir saltos visuales y mejorar accesibilidad.

#### Prioridad media

- Añadir historias o ejemplos documentados por componente clave, aunque no se incorpore Storybook todavía.
- Definir guías responsive por layout: móvil, tablet y escritorio.
- Revisar accesibilidad de diálogos, menús, navegación móvil, contraste y foco visible.

#### Prioridad baja

- Añadir pruebas visuales/smoke con Playwright para rutas críticas.
- Crear checklist de UX para nuevas pantallas: loading, empty, error, permisos, offline/degraded mode.

## Plan recomendado por fases

### Fase 1: medición y gates (1 semana)

- Convertir `npm run build`, `npm run budget:bundle`, `npm run measure:architecture`, `npm run lint` y `npm run typecheck` en checks obligatorios de CI.
- Añadir presupuestos separados para `vendor-firebase`, `vendor-pdf`, `vendor-charts`, CSS principal y tamaño máximo por ruta nueva.
- Publicar métricas de arquitectura como artefacto de CI.

### Fase 2: quick wins de bundle (1-2 semanas)

- Lazy load de PDF/exportación y gráficas avanzadas.
- Revisar imports directos de dependencias pesadas.
- Reducir imports redundantes de iconos y fechas.
- Verificar que rutas no críticas no cargan chunks de gráficos/PDF.

### Fase 3: desacoplamiento por dominios (2-4 semanas)

- Elegir dos dominios piloto: `documents` y `finance`.
- Mover lógica de páginas hacia servicios/hooks de feature.
- Formalizar cache keys y paginación por dominio.
- Reducir fan-out de páginas y fachada Firebase.

### Fase 4: sistema de diseño y duplicación (2-3 semanas)

- Extraer componentes semánticos repetidos.
- Sustituir duplicación de formato financiero y layouts recurrentes.
- Documentar patrones de pantalla y tokens.
- Añadir pruebas visuales smoke en rutas críticas.

## KPIs sugeridos

| Área | KPI actual observado | Meta sugerida |
| --- | --- | --- |
| Bundle compartido | 570.9 kB gzip / 650 kB | Mantener < 600 kB y presupuestar vendors por separado |
| Dependencias internas | 555 | Reducir 10-15% en rutas legacy tras fase 3 |
| Duplicación candidata | 30 grupos | Reducir 30% con componentes/tokens compartidos |
| Hotspot fachada Firebase | Score 42 | Reducir fan-out y mover lógica a servicios por dominio |
| Imports de iconos | 86 | Reducir mediante centralización o imports por ruta |
| Rutas críticas | Todas pasan presupuesto | Mantener gate obligatorio en CI |

## Riesgos si no se actúa

- Crecimiento gradual del vendor compartido hasta degradar carga inicial en móviles.
- Aumento de duplicación visual que dificulta cambios de diseño globales.
- Mayor riesgo de fugas multiempresa si queries nuevas no aplican `companyId` de forma uniforme.
- Páginas y fachadas demasiado acopladas, haciendo más lento incorporar dominios nuevos.
- Costos de Firestore más altos por lecturas sin paginación o dashboards calculados en cliente.

## Recomendación final

No recomiendo una reescritura. Recomiendo un programa incremental guiado por métricas: primero gates y presupuestos, luego optimización de chunks pesados, después desacoplamiento por dominios y finalmente consolidación del sistema de diseño. El repositorio ya tiene la instrumentación inicial necesaria; el siguiente paso es hacer que esas métricas bloqueen regresiones y orienten refactors pequeños, medibles y reversibles.

# Auditoría maestra UX/UI + funcional + arquitectura

Fecha: 2026-06-27  
Objetivo: consolidar en un único documento maestro todo lo que debe cambiarse antes de ejecutar una refactorización grande y coordinada, evitando correcciones aisladas por tarjeta.

## 1. Veredicto ejecutivo

La aplicación ya cuenta con una base moderna: React 18, Vite, Firebase, lazy loading por ruta, pruebas unitarias, pruebas de reglas, pruebas E2E y documentación previa de arquitectura. Sin embargo, el producto todavía mezcla capas legacy y modernas, duplica patrones visuales y funcionales, y conserva hotspots de acoplamiento que deben resolverse en una refactorización planificada.

El enfoque recomendado es **no tocar tarjetas sueltas**. Primero se congela este documento como backlog maestro, luego se agrupan los cambios en épicas de refactor con criterios de salida verificables.

## 2. Evidencia levantada

### 2.1 Comandos ejecutados

- `npm run measure:architecture`: generó métricas actualizadas en `docs/architecture/architecture-metrics.md` y `docs/architecture/architecture-metrics.json`.
- `npm run lint`: sin errores reportados.
- `npm run typecheck:core`: sin errores reportados.

### 2.2 Baseline cuantitativa

Según la medición de arquitectura del 2026-06-27:

| Métrica | Valor |
| --- | ---: |
| Archivos medidos | 229 |
| Dependencias internas | 561 |
| Paquetes externos importados | 50 |
| Grupos de líneas duplicadas | 30 |

Hotspots principales detectados:

| Hotspot | Riesgo |
| --- | --- |
| `src/api/firebaseClient.js` | Fachada crítica con alto fan-in/fan-out; cualquier cambio puede romper módulos completos. |
| `src/lib/companyContext.jsx` | Estado multiempresa transversal; riesgo de inconsistencias entre rutas públicas/protegidas. |
| `src/modules/ai/services/aiService.js` | Servicio de IA muy consumido; requiere contrato estable y degradación segura. |
| `src/modules/documents/pages/DocumentsPage.jsx` | Página con muchas dependencias salientes; candidata a adelgazar hacia hooks/servicios. |
| `src/modules/ai/pages/AIAssistantPage.jsx` | Página con alta composición funcional; debe separarse presentación, estado y servicio. |

## 3. Auditoría UX/UI

### 3.1 Problemas globales

| Prioridad | Hallazgo | Impacto | Acción recomendada |
| --- | --- | --- | --- |
| P0 | No existe un inventario formal de estados por pantalla: carga, vacío, error, permisos, sin empresa activa y degradación de IA. | Experiencia inconsistente y difícil de probar. | Definir matriz UX por ruta y reusable states (`LoadingState`, `EmptyState`, error boundary, permission state). |
| P1 | Se repiten tarjetas, grids, headers, badges y formatos monetarios en múltiples features. | Aumenta deuda visual y hace costoso cambiar diseño. | Crear patrones de dominio: `MetricCard`, `SectionCard`, `CurrencyValue`, `FeatureToolbar`. |
| P1 | Layout responsive dividido entre `Sidebar`, `MobileHeader` y `BottomNav`, pero sin contrato documentado por breakpoint. | Riesgo de navegación inconsistente móvil/desktop. | Documentar reglas responsive y validar rutas críticas en viewport móvil y desktop. |
| P1 | Muchos componentes de feature usan clases Tailwind directas en vez de tokens semánticos. | Dificulta theming y consistencia visual. | Extraer tokens/patrones para cards, bordes, espaciados y estados. |
| P2 | Falta una guía clara de microcopy para acciones destructivas, IA degradada, errores de permisos y archivos inválidos. | El usuario puede no entender qué hacer al fallar un flujo. | Crear guía de mensajes y aplicarla a documentos, IA, multiempresa y pagos. |

### 3.2 Pantallas prioritarias para rediseño coordinado

1. **Dashboard**: debe consolidar widgets, alertas, insights y escenarios bajo un layout único con estados vacíos reales.
2. **Documents**: debe priorizar claridad del flujo: seleccionar archivo, validar, crear metadata, subir, analizar, ver estado y reintentar.
3. **Companies**: debe explicar empresa activa, rol, permisos y cambios de contexto.
4. **AIAssistant**: debe diferenciar IA disponible, IA degradada, cuota agotada y error backend.
5. **ERP/Finance/CRM/HR/Operations**: deben compartir patrones de filtros, importación, listados, KPIs y exportación.

### 3.3 Checklist UX/UI para la refactorización

- [ ] Definir una matriz de estados por ruta: loading, empty, error, permission denied, no active company, offline/degraded.
- [ ] Crear componentes visuales reutilizables para tarjetas, toolbars, KPIs, filtros y listas.
- [ ] Normalizar formateo de moneda, fechas, porcentajes y conteos.
- [ ] Homologar CTAs primarios/secundarios/destructivos.
- [ ] Validar navegación móvil, tablet y desktop con evidencia visual.
- [ ] Definir microcopy estándar para errores Firebase, documentos, IA y permisos.
- [ ] Eliminar duplicación de clases visuales detectada por métricas.

## 4. Auditoría funcional

### 4.1 Flujos críticos

| Flujo | Estado actual | Riesgo | Acción recomendada |
| --- | --- | --- | --- |
| Auth | Existe provider global y rutas protegidas. | Debe validarse sesión expirada, usuario no registrado y redirecciones. | Mantener pruebas unitarias y añadir casos E2E de sesión expirada. |
| Multiempresa | Existe `CompanyProvider`, servicios de membresía y almacenamiento de empresa activa. | La ruta `/` envuelve `Dashboard` con provider propio; confirmar que no duplica contexto frente a rutas protegidas. | Centralizar provider multiempresa en composición global o documentar excepción. |
| Documentos | Existen servicios de upload/análisis, validación de archivo y reglas Storage/Firestore. | Página documental aún tiene alta dependencia saliente. | Adelgazar UI hacia hooks y casos de uso testeables. |
| IA | Usa endpoints same-origin y servicio central. | Riesgo de mensajes inconsistentes y manejo parcial de degradación. | Unificar contrato de respuesta, errores, cuotas y auditoría. |
| Auditoría/actividad | Existen logs y página de actividad. | Riesgo de cobertura desigual entre mutaciones. | Exigir middleware o wrapper obligatorio para mutaciones críticas. |
| Suscripciones/gates | Hay gates de plan y predicción. | Riesgo de divergencia entre UI y permisos reales backend/reglas. | Documentar contrato de planes y alinear UI con reglas/claims. |

### 4.2 Backlog funcional maestro

#### P0 — Estabilidad contractual

- [ ] Congelar contratos públicos de rutas, aliases, colecciones, Storage paths y endpoints internos.
- [ ] Crear pruebas E2E mínimas para Auth + Multiempresa + Documentos + IA degradada.
- [ ] Confirmar que todo flujo crítico falla antes de tocar persistencia cuando faltan `companyId`, rol o archivo válido.
- [ ] Definir contrato único de errores funcionales: código, mensaje usuario, detalle técnico y acción sugerida.

#### P1 — Consolidación de comportamiento

- [ ] Unificar filtros, ordenamiento, búsqueda e importación en CRM, ERP, HR y Operations.
- [ ] Centralizar exportaciones/reportes bajo contratos de dominio.
- [ ] Normalizar optimistic updates y revalidación de React Query.
- [ ] Asegurar que cada mutación crítica emite auditoría consistente.
- [ ] Crear fixtures de negocio para pruebas unitarias y E2E.

#### P2 — Madurez de producto

- [ ] Añadir estados de onboarding por módulo.
- [ ] Añadir telemetría de conversión y abandono en documentos/IA/importaciones.
- [ ] Definir métricas de éxito por dominio: tiempo a primer documento, tasa de análisis exitoso, uso de IA, importaciones completadas.

## 5. Auditoría de arquitectura

### 5.1 Fortalezas

- Existe separación inicial entre `src/app`, `src/features`, `src/modules`, `src/infrastructure`, `src/shared`, `src/lib` y `src/components`.
- La arquitectura documenta Firebase Hosting/Auth/Firestore/Storage y backend para IA segura.
- Hay scripts de validación de arquitectura, entorno, secretos, bundle y observabilidad.
- Las rutas principales ya usan lazy loading.
- Existen pruebas unitarias, de reglas y E2E.

### 5.2 Deuda arquitectónica principal

| Prioridad | Hallazgo | Evidencia | Acción recomendada |
| --- | --- | --- | --- |
| P0 | Coexisten carpetas legacy y modernas para los mismos dominios (`pages`, `modules`, `features`). | Métricas muestran acoplamiento `src:pages -> src:components` y `src:app -> src:pages`. | Definir ownership por dominio y migrar páginas a módulos sin cambiar rutas públicas. |
| P0 | Fachadas críticas con alto fan-in/fan-out. | `firebaseClient`, `companyContext`, `aiService`. | Crear contratos explícitos, tests de compatibilidad y migración por adaptadores. |
| P1 | Duplicación visual y utilitaria en features. | 30 grupos de duplicación textual. | Extraer shared components y formatters antes de mover pantallas. |
| P1 | UI todavía consume infraestructura indirecta/legacy en varios puntos. | Alto acoplamiento `pages/lib`, `components/lib`. | Prohibir nuevos imports directos a infraestructura desde UI; usar servicios de feature. |
| P1 | Providers y contexto multiempresa requieren cierre de ownership. | `CompanyProvider` aparece en rutas específicas. | Mover composición multiempresa a `src/app/providers.jsx` si aplica globalmente. |
| P2 | Falta un mapa de dependencias permitido por capa automatizado como regla de CI. | Existe medición, pero la gobernanza debe endurecerse. | Convertir límites de capas en reglas de arquitectura fallables. |

### 5.3 Arquitectura objetivo

```text
src/app/                         # providers, router, layouts de aplicación
src/modules/<domain>/            # páginas y composición vertical de producto
src/features/<domain>/           # casos de uso, hooks y servicios testeables
src/infrastructure/firebase/      # adaptadores técnicos Firebase
src/shared/                      # contratos, validaciones, formatters y componentes sin dominio
src/components/ui/               # primitivas visuales
src/components/layout/           # layout shell reutilizable
src/lib/                         # infraestructura transversal estable y legacy en reducción
```

Reglas objetivo:

1. `src/app` puede importar `modules`, `pages` legacy durante transición, providers y layout.
2. `modules` puede importar `features`, `shared`, `components` y fachadas públicas.
3. `features` no debe importar páginas ni layout global.
4. `shared` no debe importar dominios concretos.
5. `infrastructure` no debe importar React UI.
6. UI nueva no debe hablar directamente con Firebase; debe usar servicios/repositorios/fachadas.

## 6. Plan único de refactorización grande

### Fase A — Preparación y congelamiento

- [ ] Congelar este documento como backlog maestro.
- [ ] Añadir owners por dominio: Auth, Companies, Documents, AI, Finance, CRM, ERP, HR, Operations, Subscriptions.
- [ ] Crear matriz de rutas con estado UX, permisos, datos requeridos y pruebas asociadas.
- [ ] Establecer baseline: lint, typecheck, unit, rules, E2E crítico, métricas de arquitectura y bundle.

### Fase B — Contratos y servicios

- [ ] Tipar/documentar contratos públicos de `firebaseClient`, `companyContext`, `aiService`, repositorios y flujos documentales.
- [ ] Extraer formatters y componentes compartidos sin tocar comportamiento.
- [ ] Crear adapters para mantener imports legacy mientras se migran consumidores.
- [ ] Añadir tests de compatibilidad para fachadas críticas.

### Fase C — Migración de pantallas por dominio

Orden sugerido:

1. Companies y Auth: base de permisos/contexto.
2. Documents: flujo crítico de archivos y análisis.
3. AI: contrato seguro, degradación y auditoría.
4. Dashboard: composición de insights y widgets.
5. ERP/Finance/CRM/HR/Operations: patrones compartidos de gestión.
6. Subscriptions/Client Panel/Support: gates y experiencia comercial.

### Fase D — Gobernanza y limpieza

- [x] Eliminar duplicados legacy (`Dashboard.backup.jsx`, `Dashboard.original.jsx`) si ya no son necesarios.
- [ ] Convertir `measure:architecture` en quality gate con umbrales máximos de acoplamiento/duplicación.
- [ ] Documentar patrón para crear un módulo nuevo.
- [ ] Actualizar runbooks y checklist de release.

## 7. Criterios de salida de la refactorización

La refactorización grande se considera terminada solo si:

- [ ] No se rompen rutas públicas existentes.
- [ ] `npm run lint` pasa.
- [ ] `npm run typecheck:core` pasa.
- [ ] `npm run test:unit` pasa.
- [ ] Pruebas de reglas Firebase pasan o quedan justificadas con emuladores.
- [ ] E2E crítico pasa o queda evidencia manual documentada por entorno.
- [ ] Métricas de arquitectura reducen o no empeoran hotspots principales.
- [ ] Todas las pantallas críticas tienen estados UX completos.
- [ ] No hay nuevos imports directos desde UI a adaptadores Firebase privados.
- [ ] El documento de arquitectura coincide con el código real.

## 8. Decisión recomendada

Aprobar este documento como **documento maestro de auditoría** y usarlo como fuente única para preparar una refactorización integral. No conviene seguir corrigiendo componentes aislados sin atacar primero contratos, ownership, estados UX y límites de arquitectura.

Para decisiones de producto y priorización por rol, este documento debe leerse junto con `docs/PRODUCT_VISION.md`, que define el problema que resuelve Gemailla, los usuarios principales, los módulos obligatorios/opcionales y el flujo ideal de adopción.

Antes de iniciar la gran refactorización, también debe cerrarse `docs/AUDITORIA_MODELO_DATOS_Y_RADIOGRAFIA_PRODUCTO.md`, que valida Firestore, colecciones, índices, permisos, roles, claims, eventos, KPIs, tarjetas, menús, botones, rutas y estados UX.

La capa visual reusable debe auditarse con `docs/AUDITORIA_COMPONENTES_Y_DESIGN_SYSTEM.md` para evitar que botones, cards, modales, formularios, layouts, hooks, providers, tokens y estilos Tailwind inconsistentes se repliquen durante el refactor.

El dominio y la ejecución deben cerrarse con `docs/MODELO_DOMINIO_Y_MATRIZ_PERMISOS.md` y `docs/PLAN_MIGRACION_REFACTOR_Y_METRICAS_EXITO.md`, que convierten las auditorías en entidades, relaciones, permisos, orden de migración, adaptadores temporales e indicadores de éxito.

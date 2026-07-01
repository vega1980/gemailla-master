# Auditoría de componentes y design system

Fecha: 2026-06-27  
Estado: auditoría previa obligatoria antes de tocar código de UI.

## 1. Propósito

Esta auditoría existe para atacar la fuente más común del caos visual y funcional: componentes duplicados, patrones de UI inconsistentes, hooks repetidos, providers dispersos, estilos inline, tokens incompletos y componentes sin uso.

Antes de refactorizar pantallas, hay que saber qué componentes existen, cuáles se duplican, cuáles son primitives del design system, cuáles son componentes de producto y cuáles deben eliminarse o consolidarse.

## 2. Alcance

La auditoría debe responder por el 100% de:

- Todos los componentes existentes.
- Componentes duplicados.
- Botones duplicados.
- Cards duplicadas.
- Modales y diálogos.
- Formularios e inputs.
- Tablas y listas.
- Layouts.
- Hooks repetidos.
- Providers.
- Context.
- Tokens de colores.
- Tipografía.
- Espaciados.
- Breakpoints.
- Iconografía.
- Tailwind inconsistente.
- Componentes muertos.
- Componentes sin uso.

## 3. Inventario base del sistema actual

### 3.1 Primitivas UI existentes

El proyecto ya contiene una capa amplia de primitivas en `src/components/ui`:

| Familia | Componentes actuales | Decisión de auditoría |
| --- | --- | --- |
| Acciones | `button`, `toggle`, `toggle-group`, `switch`, `checkbox`, `radio-group`, `slider` | Verificar variantes, tamaños, disabled, loading y accesibilidad. |
| Formularios | `form`, `input`, `textarea`, `select`, `input-otp`, `label`, `calendar` | Unificar errores, ayuda, required, máscaras y validación. |
| Navegación | `navigation-menu`, `menubar`, `breadcrumb`, `pagination`, `tabs`, `sidebar` | Definir qué es navegación global vs navegación local. |
| Overlays | `dialog`, `alert-dialog`, `sheet`, `drawer`, `popover`, `hover-card`, `tooltip`, `dropdown-menu`, `context-menu` | Evitar modales duplicados por feature y estandarizar confirmaciones. |
| Datos | `table`, `chart`, `progress`, `badge`, `avatar`, `skeleton` | Definir estados loading/empty/error y densidades. |
| Layout/estructura | `card`, `accordion`, `collapsible`, `separator`, `scroll-area`, `resizable`, `aspect-ratio`, `carousel`, `command` | Decidir qué se usa como patrón de producto y qué es solo primitive. |
| Feedback | `alert`, `toast`, `toaster`, `sonner` | Evitar dos sistemas de notificación compitiendo. |

### 3.2 Componentes compartidos actuales

| Componente | Rol esperado | Revisión requerida |
| --- | --- | --- |
| `AppErrorBoundary` | Captura de errores de UI. | Asegurar uso en providers y copy accionable. |
| `LoadingState` | Estado de carga común. | Convertir en patrón obligatorio por pantalla/datos. |
| `EmptyState` | Estado vacío común. | Alinear con producto/rol y acción sugerida. |
| `StatCard` | KPI o métrica reusable. | Diferenciar KPI ejecutivo, operacional y técnico. |
| `PageHeader` | Encabezado de pantalla. | Homologar títulos, subtítulos, acciones y breadcrumbs. |

### 3.3 Layouts actuales

| Layout | Uso | Riesgo |
| --- | --- | --- |
| `AppLayout` | Shell principal. | Debe ser único punto de composición visual protegida. |
| `Sidebar` | Navegación desktop. | Tiene navegación completa, estilos inline y lógica de empresa. |
| `MobileHeader` | Encabezado móvil. | Debe coordinarse con sidebar/bottom nav. |
| `BottomNav` | Navegación móvil inferior. | Debe priorizar acciones principales, no duplicar todo el sidebar. |

### 3.4 Providers y context actuales

| Provider/Context | Rol | Revisión requerida |
| --- | --- | --- |
| `AppProviders` | Composición global: error boundary, auth, query client, router, toaster. | Confirmar que todo provider global vive aquí o está justificado. |
| `AuthProvider` | Sesión de usuario. | Contrato con rutas protegidas y estados de auth. |
| `CompanyProvider` | Empresa activa y switching. | Evitar duplicidad entre rutas públicas/protegidas y claims. |
| `QueryClientProvider` | Cache y server state. | Unificar invalidación por mutación y empresa activa. |
| `subscriptionContext` | Planes/gates. | Alinear con roles, claims y UI. |

### 3.5 Hooks actuales a revisar

| Hook | Dominio | Riesgo de duplicación |
| --- | --- | --- |
| `useCompanyData` | Multiempresa/datos | Puede solaparse con `CompanyProvider` y queries por entidad. |
| `useFinancialAlerts` | Finanzas/alertas | Puede duplicar lógica de KPIs/insights. |
| `useCashFlowPrediction` | Finanzas/predictivo | Debe separarse de UI y depender de contratos. |
| `use-mobile` | Responsive | Debe alinearse con breakpoints oficiales del design system. |
| Hooks por feature | Varios | Revisar si encapsulan dominio o solo estado visual repetido. |

## 4. Hallazgos principales

| Prioridad | Hallazgo | Impacto | Acción recomendada |
| --- | --- | --- | --- |
| P0 | Hay muchas primitivas UI, pero falta un contrato de design system que diga cuándo usar cada una. | Los equipos pueden crear variantes locales y duplicadas. | Crear catálogo de componentes con ownership, variants y ejemplos. |
| P0 | `Card`, estilos de tarjetas y clases Tailwind aparecen duplicados en features. | Inconsistencia visual y refactors costosos. | Extraer `SectionCard`, `KpiCard`, `EntityCard`, `ActionCard` y prohibir duplicados. |
| P0 | Botones de acción no tienen contrato único de loading, disabled, permiso y auditoría. | Acciones visibles pueden fallar por permisos o no comunicar estado. | Extender patrón de botón de producto sobre primitive `Button`. |
| P1 | Existen dos sistemas de feedback (`toast`/`toaster` y `sonner`). | Mensajes inconsistentes y duplicación de UX. | Elegir un sistema primario y documentar excepciones. |
| P1 | Layout desktop/móvil no tiene matriz de breakpoints ni prioridades por rol. | Móvil puede heredar navegación saturada de desktop. | Definir breakpoints, navegación por rol y quick actions móviles. |
| P1 | Hay estilos inline y colores hardcodeados, especialmente dorados y bordes. | Los tokens no gobiernan toda la UI. | Migrar a tokens semánticos y utilidades documentadas. |
| P1 | Tipografía existe como token, pero no hay escala editorial de títulos, body, labels, métricas y tablas. | Jerarquía visual inconsistente. | Crear escala tipográfica del producto. |
| P2 | No hay proceso documentado para detectar componentes muertos o sin uso. | El árbol crece con legacy invisible. | Añadir script/auditoría de imports antes de cada refactor grande. |

## 5. Auditoría por tipo de componente

### 5.1 Botones

Todo botón debe clasificarse como:

- Primario.
- Secundario.
- Tercero/ghost.
- Destructivo.
- Icon-only.
- Link action.
- Async action.
- Permission-gated action.

Checklist obligatorio:

- [ ] Usa primitive `Button` o wrapper autorizado.
- [ ] Tiene `aria-label` si es icon-only.
- [ ] Tiene estado loading si ejecuta mutación o proceso largo.
- [ ] Tiene estado disabled con explicación si falta permiso, plan, empresa activa o datos.
- [ ] Tiene confirmación si modifica permisos, elimina/cancela o ejecuta acción sensible.
- [ ] Emite auditoría si cambia datos críticos.
- [ ] No usa clases locales para inventar variante visual nueva.

### 5.2 Cards

Tipos permitidos:

| Tipo | Uso | Datos mínimos |
| --- | --- | --- |
| `KpiCard` | Métrica con periodo y fuente. | Valor, periodo, fuente, tendencia, rol. |
| `SectionCard` | Contenedor de sección. | Título, descripción opcional, contenido. |
| `EntityCard` | Resumen de documento/cliente/proyecto/etc. | Estado, owner, fecha, acción. |
| `ActionCard` | CTA contextual. | Acción, permiso, resultado esperado. |
| `InsightCard` | Recomendación/alerta. | Severidad, explicación, acción. |

Antipatrones:

- Tarjetas KPI sin periodo.
- Tarjetas sin acción ni explicación.
- Bordes/color hardcodeados.
- Duplicar cards de feature con la misma estructura.
- Mezclar KPI ejecutivo con métrica de plataforma en dashboard de empresa.

### 5.3 Modales, dialogs, sheets y drawers

Reglas:

- `Dialog`: edición o creación focalizada en desktop.
- `AlertDialog`: confirmación destructiva o sensible.
- `Sheet`: panel lateral contextual.
- `Drawer`: experiencia móvil o acción secundaria de bajo riesgo.
- `Popover`: selección breve o contextual.

Checklist:

- [ ] Título y descripción accesibles.
- [ ] Cierre claro y seguro.
- [ ] Focus trap correcto.
- [ ] Acción principal/destructiva diferenciada.
- [ ] Loading al guardar.
- [ ] Error visible dentro del modal.
- [ ] No se abre si faltan permisos o empresa activa, salvo modo lectura.

### 5.4 Formularios

Todo formulario debe tener:

- Schema de validación o contrato explícito.
- Labels visibles.
- Mensajes por campo.
- Estado dirty/submitting/success/error.
- Botón submit con loading.
- Cancelación segura.
- Auditoría si cambia datos críticos.
- Normalización antes de persistir.

Formularios prioritarios a auditar:

- Login/registro.
- Crear/editar empresa.
- Invitar miembro/cambiar rol.
- Cargar documento.
- Crear/editar transacción.
- Importadores.
- Crear/editar cliente/deal/interacción.
- HR: empleados, nómina, desempeño.
- Soporte/tickets.
- Suscripción/plan.

### 5.5 Tablas y listas

Todo listado debe definir:

- Fuente de datos.
- `companyId` requerido.
- Columnas y visibilidad por rol.
- Orden por defecto.
- Filtros.
- Paginación o límite.
- Estado empty/error/loading.
- Acción por fila.
- Exportación si aplica.

No debe existir una tabla nueva si el mismo patrón puede resolverse con un componente compartido de tabla/lista.

### 5.6 Layouts

Layouts a normalizar:

- App shell.
- Dashboard ejecutivo.
- Página operativa con filtros + tabla/lista.
- Página documental.
- Página de auditoría.
- Página de configuración/admin.
- Página de onboarding.
- Estado de error/permisos/sin empresa.

Checklist de layout:

- [ ] Tiene header estándar.
- [ ] Tiene jerarquía de secciones.
- [ ] Maneja scroll y safe areas.
- [ ] Tiene responsive definido.
- [ ] No mezcla layout global con lógica de dominio.
- [ ] No inyecta providers de negocio locales salvo justificación.

## 6. Design tokens

### 6.1 Colores

El producto ya define variables CSS para background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, charts y sidebar.

Riesgo: también existen colores hardcodeados y estilos inline (`#c5a059`, `rgba(197,160,89,...)`, gradientes dorados, bordes manuales) que compiten con tokens.

Acción requerida:

- Definir tokens semánticos: `brand`, `success`, `warning`, `danger`, `info`, `premium`, `surface`, `surface-elevated`.
- Reemplazar colores hardcodeados por tokens.
- Documentar cuándo usar dorado como marca vs estado/alerta.
- Separar color de marca de color de severidad.

### 6.2 Tipografía

Tokens actuales:

- `--font-sans`: Cormorant Garamond.
- `--font-display`: Source Serif 4.

Pendiente:

- Escala para `display`, `page-title`, `section-title`, `card-title`, `metric`, `body`, `caption`, `table`, `label`, `button`.
- Pesos permitidos.
- Line-height por uso.
- Reglas para mayúsculas/letter-spacing.

### 6.3 Espaciados

Pendiente crear escala oficial:

| Token | Uso sugerido |
| --- | --- |
| `space-xs` | Separación interna mínima. |
| `space-sm` | Inputs, badges, elementos compactos. |
| `space-md` | Cards y grupos. |
| `space-lg` | Secciones. |
| `space-xl` | Layout entre bloques principales. |
| `space-2xl` | Separación entre regiones de página. |

La auditoría debe detectar clases repetidas como `p-4`, `p-5`, `gap-3`, `gap-4`, `rounded-2xl`, `border-border` y decidir cuáles se vuelven patrones.

### 6.4 Breakpoints

Pendiente definir matriz oficial:

| Rango | Uso esperado |
| --- | --- |
| Mobile | Acciones principales, navegación corta, bottom nav. |
| Tablet | Layout híbrido con filtros plegables. |
| Desktop | Sidebar, tablas, dashboards con varias columnas. |
| Wide | Dashboards ejecutivos y análisis comparativo. |

`use-mobile` debe depender de esta matriz y no de un breakpoint implícito aislado.

### 6.5 Iconografía

El producto usa Lucide como biblioteca principal.

Reglas pendientes:

- Tamaños permitidos: navegación, botón, card, estado, empty state.
- Stroke consistente.
- Iconos por módulo.
- Iconos por severidad.
- Prohibir iconos distintos para la misma acción.
- Icon-only siempre con texto accesible.

## 7. Tailwind inconsistente

Patrones a auditar:

- Clases largas repetidas en features.
- Colores arbitrarios (`[#...]`) y estilos inline.
- Bordes y backgrounds con `rgba(...)` manual.
- Gradientes duplicados.
- `rounded-2xl`, `p-5`, `grid-cols-2`, `flex items-center gap-*` repetidos sin wrapper.
- Tamaños de texto definidos localmente sin escala.
- Breakpoints ad hoc.

Regla recomendada:

> Tailwind debe usarse para componer primitives y patrones autorizados, no para crear un mini design system distinto dentro de cada feature.

## 8. Componentes muertos o sin uso

Antes del refactor, hay que ejecutar una auditoría de uso con estas reglas:

1. Listar todos los exports de `src/components`, `src/features`, `src/modules`, `src/hooks`, `src/lib` y `src/shared`.
2. Cruzar exports con imports reales.
3. Separar componentes enrutable/lazy loaded de componentes realmente muertos.
4. Marcar backups y originales legacy como candidatos a eliminación.
5. No borrar sin confirmar rutas, tests, docs y imports dinámicos.

Candidatos a revisar por nombre/patrón:

- Archivos `*.backup.*` y `*.original.*`.
- Componentes de feature que solo se usan una vez y duplican shared components.
- Wrappers visuales que solo añaden clases repetidas.
- Hooks que solo encapsulan `useState`/`useEffect` sin contrato de dominio.
- Providers que podrían vivir en `AppProviders` o desaparecer.

## 9. Ownership recomendado

| Capa | Owner | Qué puede crear |
| --- | --- | --- |
| `src/components/ui` | Design system | Primitives generales, sin dominio. |
| `src/components/shared` | Plataforma UI | Patrones reutilizables de producto. |
| `src/components/layout` | App shell | Layouts globales y navegación. |
| `src/features/*/components` | Dominio | Componentes específicos del caso de uso. |
| `src/modules/*` | Producto/rutas | Páginas y composición vertical. |
| `src/hooks` | Hooks transversales | Hooks compartidos no ligados a una feature. |
| `src/lib` | Infraestructura transversal | Contextos/servicios técnicos legacy en reducción. |

Regla: si un componente de feature se repite en dos dominios, debe moverse a `shared` o convertirse en patrón del design system.

## 10. Backlog antes de tocar UI

### P0 — Orden del design system

- [ ] Inventario de todos los componentes y exports.
- [ ] Matriz de uso: usado, sin uso, duplicado, legacy, primitive, patrón, dominio.
- [ ] Catálogo de botones, cards, modales, formularios, tablas y layouts.
- [ ] Decidir sistema único de toast/feedback.
- [ ] Definir tokens semánticos de color, tipografía, spacing y breakpoints.
- [ ] Definir wrapper de botones async/permission-gated.
- [ ] Definir cards oficiales de producto.

### P1 — Consolidación

- [ ] Reemplazar cards duplicadas por patrones compartidos.
- [ ] Reemplazar botones locales por variantes autorizadas.
- [ ] Homologar formularios con schemas, errores y loading.
- [ ] Homologar tablas/listas con estado empty/error/loading.
- [ ] Normalizar navegación desktop/móvil por rol y plan.
- [ ] Mover estilos inline a tokens.
- [ ] Documentar iconografía por módulo y severidad.

### P2 — Limpieza

- [ ] Eliminar componentes muertos confirmados.
- [ ] Eliminar backups/originales legacy si no son referencia necesaria.
- [ ] Añadir check automatizado de imports no usados.
- [ ] Añadir checklist de PR para nuevos componentes.
- [ ] Crear ejemplos visuales mínimos para cada patrón aprobado.

## 11. Criterios de salida

Esta auditoría se considera cerrada cuando:

- [ ] Existe inventario completo de componentes.
- [ ] Cada componente tiene categoría, owner y estado: activo, duplicado, legacy, muerto o pendiente.
- [ ] Todos los botones usan variantes autorizadas.
- [ ] Todas las cards usan patrones aprobados.
- [ ] Modales, sheets, drawers y alert dialogs tienen reglas de uso.
- [ ] Formularios tienen validación, estados y errores consistentes.
- [ ] Tablas/listas tienen patrón común.
- [ ] Providers/context están centralizados o justificados.
- [ ] Hooks repetidos están fusionados o eliminados.
- [ ] Tokens cubren colores, tipografía, spacing, radii, sombras, breakpoints e iconografía.
- [ ] No quedan colores hardcodeados sin justificación.
- [ ] No quedan componentes muertos confirmados.
- [ ] Tailwind se usa bajo patrones autorizados, no como diseño ad hoc por feature.

## 12. Relación con las otras auditorías

- `docs/PRODUCT_VISION.md`: define para quién se diseña y qué debe priorizarse.
- `docs/AUDITORIA_MAESTRA_UX_UI_FUNCIONAL_ARQUITECTURA.md`: define el backlog UX/UI, funcional y arquitectónico.
- `docs/AUDITORIA_MODELO_DATOS_Y_RADIOGRAFIA_PRODUCTO.md`: define si datos, permisos, roles, eventos y rutas sostienen el producto.
- `docs/MODELO_DOMINIO_Y_MATRIZ_PERMISOS.md`: define entidades de negocio, relaciones y matriz de permisos única para UI/backend/reglas.
- `docs/PLAN_MIGRACION_REFACTOR_Y_METRICAS_EXITO.md`: define orden de migración, adaptadores temporales y métricas para comprobar la mejora.
- Esta auditoría define si la capa visual y reusable está lista para soportar la refactorización sin reproducir caos.

La gran refactorización debe empezar solo cuando estas fuentes estén alineadas.

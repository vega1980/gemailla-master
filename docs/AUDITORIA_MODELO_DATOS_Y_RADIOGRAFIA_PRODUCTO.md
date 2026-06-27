# Auditoría de modelo de datos y radiografía completa de producto

Fecha: 2026-06-27  
Estado: documento previo obligatorio antes de la gran refactorización.

## 1. Propósito

Esta auditoría complementa la auditoría UX/UI + funcional + arquitectura y la visión de producto. Su objetivo es revisar la raíz estructural del producto: modelo de datos, permisos, rutas, roles, claims, auditoría, eventos y todos los elementos visibles de la experiencia.

Una mala UI muchas veces es síntoma de un modelo de datos que obliga a mostrar información sin contexto, sin relación clara o con permisos ambiguos. Por eso, antes de rediseñar pantallas, hay que validar que los datos sostienen correctamente las preguntas de negocio de cada rol.

## 2. Alcance de la radiografía

Esta radiografía debe cubrir el 100% de:

- Firestore.
- Colecciones y subcolecciones.
- Índices.
- Reglas y permisos.
- Relaciones entre entidades.
- Flujo de `companyId`.
- Roles de empresa.
- Claims de autenticación.
- Auditoría y eventos.
- KPIs.
- Tarjetas.
- Menús.
- Botones.
- Rutas.
- Estados UX: loading, empty, error, offline, sin empresa activa, permisos insuficientes y degradación de IA.

## 3. Inventario actual de colecciones

El inventario técnico actual expone estas colecciones de negocio y plataforma:

| Colección | Dominio | Uso esperado | Revisión requerida |
| --- | --- | --- | --- |
| `users` | Auth | Perfil de usuario autenticado. | Confirmar que no almacena roles privilegiados editables por cliente. |
| `companies` | Multiempresa | Empresa, owner y configuración base. | Confirmar que el owner y la empresa activa son coherentes con claims. |
| `companyMembers` | Multiempresa/roles | Membresías por `companyId_userUid`. | Validar estados, roles y transición de permisos. |
| `documents` | Documentos | Metadata documental, estado, Storage path y análisis. | Confirmar que nunca depende de URL pública persistida. |
| `transactions` | Finance/ERP | Movimientos financieros. | Validar relación con documentos y KPIs derivados. |
| `auditLogs` | Auditoría | Evidencia de cambios críticos. | Asegurar cobertura obligatoria de mutaciones. |
| `crmClients`, `crmDeals`, `crmInteractions` | CRM | Clientes, oportunidades e interacciones. | Revisar si pertenecen al core o a módulo opcional por plan. |
| `employees`, `payroll`, `performanceReviews` | HR | Empleados, nómina y desempeño. | Revisar permisos por rol y sensibilidad. |
| `kpis` | Dirección/operación | Indicadores configurables o derivados. | Definir ownership, fórmula, periodo, fuente y rol visible. |
| `subscriptions` | Comercial/planes | Plan, límites y gates. | Alinear UI, claims y backend. |
| `predictionLogs` | Predictivo | Registro de predicciones. | Confirmar suficiencia de datos y trazabilidad. |
| `aiConversations` | IA | Conversaciones y mensajes de IA. | Validar contexto permitido por empresa, rol y plan. |
| `projects`, `projectTasks` | Operaciones | Proyectos y tareas. | Revisar estados, responsables y KPIs derivados. |
| `supportTickets` | Soporte | Tickets y seguimiento. | Definir si es interno, cliente o ambos. |
| `observabilityEvents` | Observabilidad | Eventos técnicos/producto. | Separar telemetría técnica de auditoría legal/negocio. |

## 4. Firestore: hallazgos y decisiones pendientes

### 4.1 Modelo plano vs subcolecciones

El modelo actual usa colecciones top-level con `companyId`, en lugar de subcolecciones por empresa. Esto facilita queries globales por colección y fachadas compartidas, pero exige disciplina estricta:

- Todo documento de negocio debe tener `companyId` obligatorio.
- Todo query de negocio debe filtrar por `companyId` o por ownership permitido.
- Toda regla debe validar `companyId` contra claims y membresía.
- Los índices deben acompañar los filtros reales de UI.

Decisión pendiente: mantener el modelo top-level por compatibilidad, pero documentar explícitamente qué colecciones admiten registros por `ownerUid` sin `companyId` y cuáles deben ser estrictamente multiempresa.

### 4.2 Subcolecciones

No se observa un uso central de subcolecciones para los dominios principales. Antes del refactor, hay que decidir si algunas relaciones merecen subcolecciones o si se mantienen top-level con índices:

| Relación | Opción actual | Riesgo | Decisión recomendada |
| --- | --- | --- | --- |
| Empresa → miembros | `companyMembers` top-level | IDs compuestos y queries por `companyId`. | Mantener top-level por reglas actuales, pero documentar contrato de ID. |
| Empresa → documentos | `documents` top-level | Pantallas deben filtrar siempre por empresa activa. | Mantener, reforzar índices por `companyId`, `status`, `createdAt`. |
| Documento → eventos/análisis | Campos en `documents` o logs separados. | Puede crecer demasiado o mezclar evidencia con estado. | Evaluar `documentEvents` si el historial documental crece. |
| Transacción → documento origen | Referencias por IDs/campos. | KPIs pueden quedar inconsistentes si falta relación. | Estandarizar `documentId` opcional y fuente de origen. |
| Proyecto → tareas | `projectTasks` top-level. | Tareas sin proyecto/empresa clara. | Exigir `projectId` + `companyId` y reglas/índices. |

## 5. Índices

Índices actuales declarados:

| Colección | Campos | Uso probable |
| --- | --- | --- |
| `companies` | `ownerUid`, `createdAt desc` | Listado de empresas por propietario. |
| `documents` | `ownerUid`, `companyId`, `createdAt desc` | Documentos por usuario/empresa/fecha. |
| `auditLogs` | `ownerUid`, `companyId`, `createdAt desc` | Actividad por usuario/empresa/fecha. |
| `documents` | `ownerUid`, `companyId`, `cfdi.uuid` | Detección/búsqueda documental por UUID fiscal. |

### Índices candidatos a revisar antes del refactor

- `documents`: `companyId + status + createdAt desc` para bandejas de pendientes/procesando/error.
- `transactions`: `companyId + date desc`, `companyId + type + date desc`, `companyId + category + date desc` para ERP/Finance.
- `auditLogs`: `companyId + module + createdAt desc`, `companyId + actorUid + createdAt desc`, `companyId + eventType + createdAt desc` para auditoría real.
- `companyMembers`: `companyId + status + role` para administración de permisos.
- `crmDeals`: `companyId + stage + updatedAt desc` para pipeline.
- `projects` y `projectTasks`: `companyId + status + dueDate` para operación.
- `observabilityEvents`: índices separados de auditoría para no mezclar uso técnico con evidencia de negocio.

## 6. Permisos, roles y claims

### 6.1 Roles actuales a normalizar

Se observan dos niveles de vocabulario:

- Roles de producto compartidos: `director`, `admin`, `miembro`, `invitado`.
- Roles de reglas/empresa: `owner`, `director`, `admin`, `editor`, `viewer`, `invitado`.

Riesgo: si UI, reglas, claims y membresías no usan el mismo diccionario, una pantalla puede mostrar acciones que Firestore/Storage rechaza o, peor, ocultar acciones permitidas.

Acción requerida:

- Crear una matriz única de roles.
- Definir permisos por rol y módulo.
- Mapear roles visibles en UI a roles usados en reglas.
- Probar cada permiso con reglas y E2E.

### 6.2 Claims obligatorios

El flujo multiempresa depende de claims como:

- `companyId`.
- `companyRole` o `role`.
- `membershipStatus`.

Riesgos:

- Usuario cambia empresa activa en UI, pero claims siguen apuntando a otra empresa.
- Storage permite/deniega por claims desactualizados.
- Firestore y UI usan fuentes distintas para decidir permisos.

Acción requerida:

- Definir cuándo se actualizan claims al cambiar empresa activa.
- Mostrar estado claro si la empresa activa local no coincide con claims.
- Forzar refresh de token después de cambios de membresía o empresa activa.
- Documentar fallback si claims no existen o están expirados.

## 7. Flujo de `companyId`

`companyId` debe comportarse como la columna vertebral del producto.

### Contrato obligatorio

1. Toda ruta protegida debe conocer empresa activa o mostrar estado “sin empresa activa”.
2. Todo documento de negocio debe tener `companyId` salvo excepciones explícitas por ownership personal.
3. Toda query debe filtrar por `companyId` cuando consulta datos de empresa.
4. Toda mutación debe validar `companyId` antes de tocar persistencia.
5. Todo evento de auditoría debe incluir `companyId` si ocurre dentro de una empresa.
6. Todo KPI debe declarar de qué `companyId`, periodo y fuente proviene.

### Antipatrones a eliminar

- KPIs globales en dashboard de empresa sin contexto.
- Queries que mezclan `ownerUid` y `companyId` sin contrato claro.
- Componentes que infieren empresa por el primer registro disponible.
- Botones visibles aunque el rol no pueda ejecutar la acción.
- Estados vacíos que ocultan un problema de permisos o empresa activa.

## 8. Auditoría y eventos

Hay que separar tres conceptos:

| Tipo | Propósito | Ejemplo | Quién lo consume |
| --- | --- | --- | --- |
| Auditoría de negocio | Evidencia de acciones críticas. | Cambio de rol, carga documental, actualización de transacción. | Auditor, Director, cumplimiento. |
| Observabilidad técnica | Diagnóstico operativo. | Error de API, latencia, fallo de proveedor IA. | Equipo técnico/operaciones. |
| Evento de producto | Medición de adopción. | Onboarding completado, reporte exportado. | Producto/negocio. |

Acción requerida:

- No mezclar `auditLogs` con `observabilityEvents`.
- Definir catálogo de eventos por módulo.
- Toda mutación crítica debe registrar actor, empresa, entidad, acción, estado anterior/nuevo y correlación.
- Toda acción IA debe registrar costo, tokens, empresa, rol, estado y motivo de fallo sin guardar prompts sensibles innecesarios.

## 9. Radiografía UX/Producto completa

### 9.1 KPIs

Todo KPI debe tener ficha técnica:

- Nombre visible.
- Rol destinatario.
- Fórmula.
- Fuente de datos.
- Periodo.
- `companyId`.
- Estado vacío.
- Acción asociada.
- Permiso requerido.
- Riesgo de interpretación.

KPIs a revisar por categoría:

| Categoría | Ejemplos válidos | Riesgo |
| --- | --- | --- |
| Ejecutivo | Caja, ingresos, gastos, margen, alertas críticas. | Métricas sin acción o sin periodo. |
| Documental | Pendientes, procesando, error, analizados. | Contar documentos de otra empresa o sin permiso. |
| Auditoría | Eventos críticos, cambios de roles, accesos fallidos. | Mezclar eventos técnicos con evidencia. |
| Operación | Proyectos en riesgo, tareas vencidas, capacidad. | Falta de relación con responsables. |
| Comercial | Deals por etapa, clientes activos, churn. | Mostrar CRM a clientes sin módulo activo. |
| Plataforma | Empresas activas, usuarios totales. | Solo válido para admin/plataforma, no dashboard de empresa. |

### 9.2 Tarjetas

Cada tarjeta debe clasificarse como:

- KPI.
- Acción rápida.
- Alerta.
- Resumen de entidad.
- Estado de proceso.
- Recomendación IA.
- Navegación secundaria.

Checklist de tarjeta:

- [ ] Tiene título claro.
- [ ] Tiene fuente/periodo cuando muestra dato.
- [ ] Tiene acción o navegación si es accionable.
- [ ] Tiene estado loading/empty/error.
- [ ] Respeta permisos y plan.
- [ ] No duplica otra tarjeta de la misma pantalla.
- [ ] No aparece fuera del rol correcto.

### 9.3 Menús y navegación

La navegación debe responder a rol, plan y empresa activa.

Revisión requerida:

- Menú principal: separar módulos obligatorios de opcionales.
- Menú por rol: ocultar o degradar módulos sin permiso/plan.
- Menú móvil: priorizar acciones frecuentes, no copiar todo el sidebar.
- Rutas alias: mantener compatibilidad, pero definir ruta canónica.
- Admin/Companies: separar gestión multiempresa de operación diaria.

### 9.4 Botones y acciones

Todo botón debe tener:

- Acción clara.
- Permiso requerido.
- Estado disabled con explicación.
- Loading state si muta datos.
- Confirmación si es destructivo o sensible.
- Registro de auditoría si cambia datos críticos.
- Mensaje de éxito/error específico.

Botones a auditar especialmente:

- Crear/editar empresa.
- Cambiar empresa activa.
- Invitar/cambiar rol de miembro.
- Cargar documento.
- Analizar documento con IA.
- Crear/editar transacción.
- Exportar reporte.
- Ejecutar predicción.
- Cambiar plan/suscripción.
- Cerrar sesión.

### 9.5 Rutas

Cada ruta debe tener ficha:

- Ruta canónica.
- Alias legacy.
- Módulo.
- Rol permitido.
- Plan requerido.
- Empresa activa requerida.
- Datos mínimos.
- Estados UX requeridos.
- Eventos/auditoría que dispara.

Rutas actuales a cubrir:

| Ruta | Módulo | Revisión clave |
| --- | --- | --- |
| `/dashboard` | Dashboard | Debe ser ejecutivo y por rol. |
| `/documents` | Documents | Estados documentales completos. |
| `/erp` | ERP | Permisos, filtros, transacciones y reportes. |
| `/audit` | Auditoría | Evidencia y filtros por evento. |
| `/ai`, `/ai-assistant` | IA | Alias, cuotas, degradación y permisos. |
| `/companies` | Companies | Empresa activa, membresías y roles. |
| `/activity`, `/activity-log` | Actividad | Diferenciar actividad de auditoría formal. |
| `/subscriptions` | Subscriptions | Plan gates y límites. |
| `/predictive`, `/predictive-analysis` | Predictivo | Módulo opcional y data mínima. |
| `/finance`, `/financial-hub` | Finance | KPIs financieros y reportes. |
| `/client`, `/client-panel` | Cliente | Exposición externa y permisos. |
| `/operations` | Operaciones | Proyectos, tareas y KPIs. |
| `/crm` | CRM | Módulo opcional por plan. |
| `/hr` | HR | Datos sensibles y permisos estrictos. |

### 9.6 Estados UX obligatorios

Cada pantalla y componente de datos debe implementar o delegar:

| Estado | Pregunta que responde | Ejemplo de copy |
| --- | --- | --- |
| Loading | ¿El sistema está trabajando? | “Cargando datos de la empresa…” |
| Empty | ¿No hay datos todavía? | “Aún no hay documentos cargados.” |
| Error | ¿Qué falló y qué hago? | “No pudimos cargar los movimientos. Reintentar.” |
| Offline | ¿La red está caída o degradada? | “Sin conexión. Algunos datos pueden estar desactualizados.” |
| Sin empresa activa | ¿Qué falta para operar? | “Selecciona o crea una empresa para continuar.” |
| Permisos insuficientes | ¿Por qué no puedo actuar? | “Tu rol actual no permite editar esta información.” |
| Plan insuficiente | ¿Es una limitación comercial? | “Este módulo requiere un plan superior.” |
| IA degradada | ¿La IA no está disponible? | “La IA no está disponible; tus datos siguen accesibles.” |

## 10. Backlog de auditoría antes de refactor

### P0 — Datos, permisos y seguridad

- [ ] Matriz completa de colecciones, campos obligatorios, relaciones y owners.
- [ ] Matriz única de roles UI/reglas/claims.
- [ ] Validación de `companyId` en todas las queries y mutaciones.
- [ ] Índices requeridos por rutas críticas.
- [ ] Separación formal entre auditoría, observabilidad y eventos de producto.
- [ ] Pruebas de reglas para cada rol y colección crítica.

### P1 — Producto visible

- [ ] Inventario de todos los KPIs y ficha técnica por KPI.
- [ ] Inventario de todas las tarjetas por pantalla y rol.
- [ ] Inventario de todos los botones con permisos, loading y auditoría.
- [ ] Inventario de todos los menús por rol/plan.
- [ ] Matriz de rutas canónicas y alias.
- [ ] Matriz de estados UX por ruta.

### P2 — Gobernanza

- [ ] Gate de arquitectura para impedir imports o queries fuera de patrón.
- [ ] Gate de producto para impedir KPIs sin ficha técnica.
- [ ] Checklist de PR obligatorio para permisos, estados y auditoría.
- [ ] Documentación de migración de modelo de datos si se decide cambiar estructura.

## 11. Criterios de salida

Esta auditoría se considera cerrada cuando:

- [ ] Cada colección tiene owner, propósito, campos obligatorios y permisos documentados.
- [ ] Cada relación de entidad tiene campo, índice y regla asociada.
- [ ] Cada rol tiene matriz de permisos validada con reglas y UI.
- [ ] Cada ruta tiene ficha funcional y estados UX.
- [ ] Cada KPI tiene fórmula, fuente, periodo, rol y acción asociada.
- [ ] Cada botón crítico define permiso, loading, error, success y auditoría.
- [ ] Los índices cubren las queries reales de los flujos críticos.
- [ ] Claims y empresa activa tienen contrato probado.
- [ ] Auditoría, observabilidad y eventos están separados.
- [ ] La gran refactorización puede comenzar sin incertidumbre de modelo de datos.

## 12. Relación con documentos existentes

- `docs/PRODUCT_VISION.md` define por qué existe el producto y para quién se diseña.
- `docs/AUDITORIA_MAESTRA_UX_UI_FUNCIONAL_ARQUITECTURA.md` define qué debe corregirse a nivel UX/UI, funcional y arquitectura.
- `docs/AUDITORIA_COMPONENTES_Y_DESIGN_SYSTEM.md` define si la capa de componentes, hooks, providers, tokens y estilos puede sostener la refactorización sin duplicar caos visual.
- `docs/MODELO_DOMINIO_Y_MATRIZ_PERMISOS.md` define entidades de negocio, relaciones, cardinalidades, owners y matriz Rol × Acción × Módulo.
- `docs/PLAN_MIGRACION_REFACTOR_Y_METRICAS_EXITO.md` define el orden de migración, congelamientos, adaptadores temporales, eliminación de legacy e indicadores de éxito.
- Este documento define si el modelo de datos, permisos, eventos y radiografía completa de producto sostienen esas decisiones.

La gran refactorización debe empezar solo cuando estos documentos estén alineados.

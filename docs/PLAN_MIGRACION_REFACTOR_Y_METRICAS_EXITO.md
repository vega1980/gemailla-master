# Plan de migración del refactor e indicadores de éxito

Fecha: 2026-06-27  
Estado: guía operativa para ejecutar la gran refactorización sin romper producto.

## 1. Propósito

Los documentos de auditoría definen el “qué”. Este documento define el “cómo”: orden de migración, módulos congelados, adaptadores temporales, criterios para eliminar legacy e indicadores que demostrarán si el refactor mejoró realmente el producto.

## 2. Principios de migración

1. No romper rutas públicas ni aliases existentes.
2. No mover una pantalla antes de congelar sus contratos de datos, permisos y estados UX.
3. Mantener adaptadores temporales para imports legacy hasta completar pruebas.
4. Migrar primero cimientos de dominio y permisos; después pantallas; al final limpieza visual.
5. Cada fase debe cerrar con evidencia: lint, typecheck, unit, reglas, E2E o justificación.
6. Ningún módulo opcional debe bloquear el core: Auth, Companies, Documents, Finance/ERP, Audit e IA segura.

## 3. Módulos congelados durante la preparación

| Módulo | Estado durante preparación | Motivo |
| --- | --- | --- |
| Auth | Congelado salvo bugs críticos | Base de sesión y permisos. |
| Companies/Multiempresa | Congelado salvo contrato de empresa activa | Cambios pueden afectar todo `companyId`. |
| Documents | Congelado funcionalmente | Flujo crítico con Firestore + Storage + IA. |
| Audit/Activity | Congelado funcionalmente | Necesario para verificar cambios. |
| IA | Congelado salvo contrato de errores/degradación | Riesgo de seguridad/costos. |
| UI primitives | Congeladas salvo design-system plan | Evita variantes nuevas antes de catalogar. |

Durante el congelamiento se permiten documentación, pruebas, adaptadores de compatibilidad y métricas; no se permiten rediseños aislados sin pasar por los checklists.

## 4. Adaptadores temporales previstos

| Adaptador | Propósito | Cuándo se elimina |
| --- | --- | --- |
| `src/api/firebaseClient.js` | Mantener API pública legacy mientras repositorios se adelgazan. | Cuando consumidores usen servicios de feature y tests de compatibilidad pasen. |
| Barrels de `src/modules/*/index.js` | Mantener solo metadatos explícitos del módulo; no deben reexportar páginas o servicios como shims. | No aplica como shim: los imports deben apuntar a `@modules/<dominio>/pages`, `@modules/<dominio>/components` o `@modules/<dominio>/services`. |
| Wrappers de UI compartida | Reemplazar clases repetidas sin migrar toda pantalla a la vez. | Cuando todos los componentes usen patrones oficiales. |
| Facades de Company/Auth | Evitar romper contexto mientras se normalizan claims y empresa activa. | Fecha límite 2026-08-31 para retirar shims en `src/pages`/`src/lib` o documentar una excepción con owner y reemplazo canónico. |
| Aliases de rutas legacy | Mantener navegación existente. | Solo se eliminan con redirección, analytics y aviso de release. |

## 5. Orden de migración recomendado

### Fase 0 — Baseline y congelamiento

- Cerrar auditorías: Product Vision, UX/UI/funcional/arquitectura, modelo de datos, componentes/design system, dominio/permisos.
- Generar baseline de arquitectura, bundle, tests y rutas.
- Crear inventario de componentes, rutas, KPIs y permisos.
- Definir matriz de entidades y roles como contrato de negocio.

### Fase 1 — Dominio, permisos y providers

Objetivo: que el producto tenga una base estable de empresa activa, roles, claims y gates.

Orden:

1. Auth y sesión.
2. CompanyProvider / empresa activa.
3. Matriz de permisos y gates de plan.
4. Auditoría de mutaciones críticas.
5. Query invalidation por `companyId`.

Salida:

- Empresa activa coherente entre UI, claims y reglas.
- Estados “sin empresa activa” y “permisos insuficientes” disponibles.
- Tests de roles para flujos críticos.

### Fase 2 — Documentos e IA segura

Objetivo: estabilizar el flujo más sensible: documento → Storage → metadata → análisis → auditoría.

Orden:

1. Servicios documentales y validación temprana.
2. Página Documents adelgazada hacia hooks/servicios.
3. Estados documentales completos.
4. Contrato de IA degradada, cuotas y errores.
5. Auditoría y eventos de IA/documentos.

Salida:

- No hay archivos huérfanos por flujo cliente.
- IA nunca se ejecuta sin empresa, rol, plan y contexto permitido.
- E2E/documentación cubre carga, error, retry y análisis.

### Fase 3 — Finance/ERP y Dashboard ejecutivo

Objetivo: que los KPIs y tarjetas sigan el modelo de dominio y no muestren métricas fuera de contexto.

Orden:

1. Transacciones y reportes.
2. KPIs con ficha técnica.
3. Dashboard por rol.
4. Exportaciones y estados vacíos.
5. Reemplazo de cards duplicadas por patrones oficiales.

Salida:

- Todo KPI tiene fórmula, fuente, periodo, rol y acción.
- Dashboard no mezcla métricas de plataforma con operación de empresa.
- Reducción medible de duplicación de cards.

### Fase 4 — Módulos opcionales

Orden sugerido:

1. CRM.
2. Operations.
3. HR.
4. Predictive Analysis.
5. Client Panel.
6. Support/Auto Reports.

Regla: un módulo opcional se migra solo si tiene owner, plan/gate, rutas, permisos, estados y componentes compartidos definidos.

### Fase 5 — Design system y limpieza legacy

- Consolidar botones, cards, forms, tables, modals y layouts.
- Reemplazar estilos inline por tokens.
- Eliminar componentes muertos confirmados.
- Eliminar backups/originales legacy.
- Convertir métricas de arquitectura y duplicación en quality gates.

## 6. Criterios para eliminar legacy

Un archivo, adapter o ruta legacy se elimina solo si:

- No tiene imports reales ni lazy imports.
- No aparece en rutas públicas o aliases vigentes.
- Tiene reemplazo documentado.
- Hay tests o evidencia manual para el flujo reemplazado.
- El changelog/release notes explican la eliminación.
- No rompe contratos de datos, permisos, auditoría o navegación.

## 7. Indicadores de éxito del refactor

### 7.1 Arquitectura

| Indicador | Baseline actual | Objetivo |
| --- | ---: | ---: |
| Dependencias internas | 561 | Reducir o mantener con capas más claras. |
| Grupos de duplicación textual | 30 | Reducir al menos 40%. |
| Acoplamiento `src:pages -> src:components` | 53 | Reducir al menos 30%. |
| Hotspot `src/api/firebaseClient.js` | Score 41 | Reducir fan-in/fan-out o encapsular por contratos. |
| Imports directos UI → infraestructura privada | A auditar | 0 nuevos; reducir existentes. |

### 7.2 Design system

| Indicador | Objetivo |
| --- | ---: |
| Componentes inventariados | 100% |
| Botones usando variantes autorizadas | 100% en rutas críticas |
| Cards reemplazadas por patrones oficiales | 80%+ en rutas críticas |
| Colores hardcodeados no justificados | 0 en componentes migrados |
| Componentes muertos confirmados | 0 después de limpieza |
| Sistemas de toast activos | 1 primario documentado |

### 7.3 Producto y UX

| Indicador | Objetivo |
| --- | ---: |
| Rutas críticas con loading/empty/error/sin empresa/permisos | 100% |
| KPIs con ficha técnica | 100% en dashboard y finance |
| Tiempo para cargar primer documento | Reducir frente a baseline manual |
| Tiempo para encontrar documentos con error | Reducir frente a baseline manual |
| Tiempo para exportar reporte financiero | Reducir frente a baseline manual |
| Acciones visibles sin permiso real | 0 en rutas migradas |

### 7.4 Calidad y seguridad

| Indicador | Objetivo |
| --- | ---: |
| `npm run lint` | Pasa |
| `npm run typecheck:core` | Pasa |
| `npm run test:unit` | Pasa |
| Pruebas de reglas críticas | Pasan en emuladores/CI |
| E2E Auth + Companies + Documents + IA | Pasa o evidencia manual documentada |
| Mutaciones críticas con auditoría | 100% en módulos migrados |

## 8. Quality gates por PR de refactor

Cada PR de refactor debe responder:

- ¿Qué entidad de dominio toca?
- ¿Qué roles y permisos cambia?
- ¿Qué rutas afecta?
- ¿Qué componentes reemplaza o elimina?
- ¿Qué adaptador temporal mantiene?
- ¿Qué legacy elimina?
- ¿Qué estados UX cubre?
- ¿Qué tests/evidencia demuestran no regresión?
- ¿Qué métrica de éxito mejora o protege?

## 9. Señales para pausar el refactor

Pausar y volver a estabilización si ocurre cualquiera de estas señales:

- Fallan Auth, empresa activa, documentos o IA.
- Aumenta acoplamiento crítico sin justificación.
- Se crean variantes nuevas de botones/cards sin pasar por design system.
- Una pantalla muestra datos de empresa equivocada.
- Una acción visible falla por permiso que UI pudo conocer.
- Se pierde auditoría en una mutación crítica.
- E2E crítico queda roto sin plan de recuperación.

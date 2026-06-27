# Product Vision — Gemailla

Fecha: 2026-06-27  
Estado: guía de producto para decisiones de UX/UI, funcionalidad y arquitectura.

## 1. Propósito del documento

Este documento define la visión común de producto para Gemailla. Su objetivo es que diseño, desarrollo, auditoría, soporte y negocio tomen decisiones con el mismo contexto, evitando pantallas o métricas fuera de lugar.

La regla principal es: **si un elemento no ayuda a un usuario clave a operar, decidir, auditar o controlar la empresa, no debe aparecer como prioridad en la experiencia principal**.

## 2. ¿Qué problema resuelve Gemailla?

Gemailla resuelve la fragmentación operativa de pequeñas y medianas empresas que gestionan información financiera, documental, comercial, operativa y administrativa en herramientas separadas.

El problema central no es solo “ver datos”; es convertir datos dispersos en decisiones accionables, trazables y seguras para la dirección de la empresa.

Gemailla debe ayudar a:

- Centralizar documentos, movimientos, clientes, operaciones y alertas.
- Reducir trabajo manual en carga, conciliación, análisis y reporte.
- Dar visibilidad ejecutiva a dueños y directores.
- Dar herramientas operativas a contadores, administradores y equipos internos.
- Mantener auditoría, permisos y trazabilidad por empresa.
- Usar IA como asistente contextual, no como sustituto de controles de negocio.

## 3. ¿Quién es el usuario principal?

El usuario principal es el **Director/Dueño operativo de una PyME** que necesita entender rápidamente el estado del negocio, detectar riesgos y coordinar a su equipo.

Usuarios secundarios:

| Usuario | Necesidad principal | Riesgo si la experiencia falla |
| --- | --- | --- |
| Director | Ver salud del negocio, prioridades, riesgos y decisiones sugeridas. | Pierde confianza si ve KPIs irrelevantes o datos sin contexto. |
| Dueño | Controlar rendimiento, caja, cumplimiento y crecimiento. | No adopta el sistema si no ve impacto ejecutivo inmediato. |
| Contador | Cargar, validar, clasificar y reportar información financiera/documental. | Regresa a hojas de cálculo si el flujo es más lento que su proceso actual. |
| Auditor | Revisar trazabilidad, evidencia, cambios y cumplimiento. | No puede certificar confiabilidad si faltan logs o contexto. |
| Administrador interno | Gestionar usuarios, empresas, permisos y operación diaria. | Crea inconsistencias si los permisos o estados no son claros. |

## 4. Principio de experiencia por rol

Gemailla no debe mostrar la misma prioridad visual a todos los usuarios. El producto debe organizar la información según la pregunta principal de cada rol:

- Director: “¿Qué requiere mi atención hoy?”
- Dueño: “¿La empresa va bien y bajo control?”
- Contador: “¿Qué debo cargar, validar o corregir?”
- Auditor: “¿Qué pasó, quién lo hizo y con qué evidencia?”
- Administrador: “¿Quién tiene acceso y qué está operativo?”

## 5. ¿Qué ve primero un Director?

Un Director debe entrar a un **dashboard ejecutivo accionable**, no a una colección genérica de KPIs.

Debe ver primero:

1. Alertas críticas: caja, vencimientos, documentos pendientes, anomalías y riesgos.
2. Resumen financiero: ingresos, gastos, flujo de efectivo y variación contra presupuesto.
3. Estado operativo: proyectos o procesos en riesgo.
4. Recomendaciones de IA o insights explicables.
5. Accesos rápidos a acciones: revisar documentos, aprobar pendientes, consultar IA, exportar reporte.

No debe ver primero:

- Métricas internas de plataforma sin valor ejecutivo directo, como “empresas activas”, salvo que esté en una vista administrativa multiempresa.
- Tarjetas duplicadas o métricas sin periodo, origen o acción asociada.
- Datos técnicos que no respondan a una decisión de negocio.

## 6. ¿Qué ve primero un Contador?

Un Contador debe entrar a una vista de **trabajo pendiente y control documental/financiero**.

Debe ver primero:

1. Documentos por cargar, validar, analizar o corregir.
2. Movimientos pendientes de clasificación o conciliación.
3. Errores de archivo, XML/PDF inválidos o documentos sin metadata completa.
4. Reportes contables/financieros disponibles para descargar.
5. Historial de cambios relevantes en documentos y transacciones.

La experiencia debe priorizar velocidad, filtros, lotes, validaciones claras y trazabilidad.

## 7. ¿Qué ve primero un Auditor?

Un Auditor debe entrar a una vista de **evidencia, trazabilidad y cumplimiento**.

Debe ver primero:

1. Bitácora de actividad filtrable por empresa, usuario, módulo, fecha y tipo de evento.
2. Cambios críticos en documentos, transacciones, permisos, IA y reportes.
3. Evidencia asociada: documento, usuario, timestamp, empresa, estado anterior y estado nuevo.
4. Excepciones o eventos de riesgo: fallos de permisos, intentos no autorizados, documentos rechazados.
5. Exportación de evidencia para revisión externa.

El Auditor no necesita un dashboard comercial; necesita confianza, filtros, evidencia y consistencia.

## 8. ¿Qué ve primero un Dueño?

Un Dueño debe entrar a una vista de **salud integral del negocio**.

Debe ver primero:

1. Estado financiero resumido: caja, margen, ingresos, gastos y tendencia.
2. Riesgos principales: liquidez, concentración de clientes, vencimientos, anomalías.
3. Avance de objetivos o presupuesto.
4. Estado de operación: proyectos críticos, clientes clave y tareas bloqueadas.
5. Recomendación ejecutiva: qué revisar, qué aprobar o qué preguntar al equipo.

La experiencia debe ser menos operativa que la del Contador y menos técnica que la del Auditor.

## 9. Módulos obligatorios

Estos módulos son obligatorios porque sostienen el producto mínimo coherente:

| Módulo | Motivo |
| --- | --- |
| Auth y usuarios | Identidad, sesión, roles y seguridad base. |
| Companies / Multiempresa | Aislamiento por empresa, empresa activa y membresías. |
| Dashboard ejecutivo | Punto de entrada por rol y priorización de decisiones. |
| Documents | Carga, validación, evidencia y análisis documental. |
| Finance / ERP básico | Movimientos, ingresos, gastos, presupuestos y reportes. |
| Audit / Activity Log | Trazabilidad, cumplimiento y confianza operativa. |
| AI Assistant seguro | Asistencia contextual sobre datos permitidos y bajo control backend. |
| Subscriptions / Plan Gates | Control comercial, límites y habilitación de capacidades. |

Sin estos módulos, Gemailla pierde coherencia como plataforma de gestión empresarial con IA y trazabilidad.

## 10. Módulos opcionales

Estos módulos pueden habilitarse por plan, industria o madurez del cliente:

| Módulo | Cuándo es opcional |
| --- | --- |
| CRM | Cuando el cliente gestiona pipeline, segmentos o seguimiento comercial. |
| HR | Cuando necesita nómina, empleados o desempeño. |
| Operations | Cuando administra proyectos, procesos o KPIs operativos. |
| Predictive Analysis | Cuando ya existe suficiente data histórica para predicción. |
| Client Panel | Cuando el cliente final necesita autoservicio o visibilidad externa. |
| Support / Auto Reports | Cuando el plan incluye soporte avanzado, reportes automáticos o colaboración. |
| Integraciones externas | Cuando existe una fuente externa con valor claro y permisos definidos. |

Un módulo opcional no debe contaminar la navegación principal de clientes que no lo usan.

## 11. Flujo ideal de cliente: desde entrada hasta operación

### 11.1 Onboarding inicial

1. El cliente crea cuenta o recibe invitación.
2. Crea una empresa o se une a una empresa existente.
3. Selecciona rol inicial: Director, Dueño, Contador, Auditor o Administrador.
4. Configura datos mínimos: nombre de empresa, país/moneda, periodo fiscal y permisos.
5. El sistema muestra una guía de primeros pasos según rol.

### 11.2 Activación operativa

1. El Contador o Administrador carga documentos iniciales PDF/XML.
2. Gemailla valida archivos, metadata, permisos y estado de empresa.
3. Se crean movimientos o registros relacionados cuando aplica.
4. El sistema genera alertas, métricas y evidencia de auditoría.
5. El Director/Dueño ve un dashboard útil con datos reales, no placeholders genéricos.

### 11.3 Uso recurrente

1. Usuarios operativos cargan, corrigen y clasifican información.
2. Directores revisan alertas, tendencias y recomendaciones.
3. Auditores revisan evidencia y trazabilidad.
4. IA responde preguntas dentro del contexto permitido por empresa, rol y plan.
5. Reportes se exportan con datos consistentes y trazables.

### 11.4 Expansión

1. Se habilitan módulos opcionales según necesidad real.
2. Se agregan usuarios y roles con permisos claros.
3. Se configuran reportes automáticos, predicciones o integraciones.
4. El sistema mide adopción, errores, uso de IA y valor generado.

## 12. Reglas para decisiones de diseño y desarrollo

Antes de agregar una pantalla, tarjeta, KPI, módulo o acción, debe responderse:

1. ¿Para qué rol existe?
2. ¿Qué decisión o trabajo facilita?
3. ¿Qué dato real lo alimenta?
4. ¿Qué acción puede tomar el usuario desde ahí?
5. ¿Pertenece al módulo obligatorio u opcional correcto?
6. ¿Debe verse en dashboard ejecutivo o en una pantalla operativa?
7. ¿Tiene estado vacío, error, permisos y loading?
8. ¿Respeta empresa activa, membresía, rol y plan?
9. ¿Genera auditoría si cambia datos críticos?
10. ¿Puede explicarse sin contexto técnico?

Si la respuesta no es clara, el elemento debe posponerse o moverse a una vista secundaria.

## 13. Ejemplo de decisión: KPI “Empresas activas”

El KPI “Empresas activas” puede ser correcto en una vista de administración de plataforma o en una consola multiempresa para un superadministrador.

No es correcto como KPI principal para un Director, Contador, Auditor o Dueño de una sola empresa, porque no responde a su pregunta principal ni dispara una acción operativa inmediata.

Decisión recomendada:

- En dashboard ejecutivo de empresa: reemplazarlo por KPIs de caja, ingresos, gastos, margen, documentos pendientes, alertas o riesgos.
- En módulo Companies/Admin: mantenerlo solo si el usuario administra varias empresas y puede actuar sobre ellas.
- En auditoría: mostrar empresas solo como filtro o contexto, no como indicador principal.

## 14. Relación con auditorías maestras

Este documento complementa `docs/AUDITORIA_MAESTRA_UX_UI_FUNCIONAL_ARQUITECTURA.md`.

La auditoría maestra define qué está mal, qué debe corregirse y cómo ordenar la refactorización. Product Vision define por qué existe el producto, para quién se diseña y cómo decidir si una funcionalidad tiene sentido.

También debe usarse junto con `docs/AUDITORIA_MODELO_DATOS_Y_RADIOGRAFIA_PRODUCTO.md`, que valida si el modelo de datos, permisos, eventos, KPIs, tarjetas, menús, botones, rutas y estados sostienen la visión de producto.

La capa reusable de UI debe validarse con `docs/AUDITORIA_COMPONENTES_Y_DESIGN_SYSTEM.md`, que ordena componentes, botones, cards, modales, formularios, layouts, hooks, providers, tokens e inconsistencias de Tailwind.

El mapa de negocio y la ejecución del refactor deben apoyarse en `docs/MODELO_DOMINIO_Y_MATRIZ_PERMISOS.md` y `docs/PLAN_MIGRACION_REFACTOR_Y_METRICAS_EXITO.md`.

Estos documentos deben usarse juntos antes de aprobar cambios grandes de UX/UI, funcionalidad, datos, componentes o arquitectura.

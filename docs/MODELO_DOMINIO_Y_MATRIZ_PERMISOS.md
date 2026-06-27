# Modelo de dominio y matriz de permisos

Fecha: 2026-06-27  
Estado: referencia única de negocio para UI, backend, reglas Firestore y QA.

## 1. Propósito

Este documento traduce el producto a entidades de negocio, relaciones, cardinalidades, ownership y permisos. No describe solo cómo está guardado en Firestore; describe cómo funciona Gemailla como dominio empresarial.

Regla central: **el código debe seguir el negocio, no solo la estructura de colecciones**.

## 2. Entidades de negocio

| Entidad | Dueño de negocio | Identidad | Propósito | Fuente persistente |
| --- | --- | --- | --- | --- |
| Empresa | Dueño/Director | `companyId` | Tenant principal, contexto operativo y límite de permisos. | `companies` |
| Usuario | Persona autenticada | `uid` | Identidad individual para sesión, acciones y auditoría. | `users`, Firebase Auth |
| Miembro | Empresa + usuario | `companyId_uid` | Relación entre usuario, empresa, rol y estado. | `companyMembers` |
| Documento | Empresa | `documentId` + `companyId` | Evidencia PDF/XML, metadata, estado y análisis. | `documents`, Storage |
| Transacción | Empresa | `transactionId` + `companyId` | Movimiento financiero/ERP. | `transactions` |
| Auditoría | Empresa | `auditLogId` + `companyId` | Evidencia de cambios críticos. | `auditLogs` |
| Cliente CRM | Empresa | `clientId` + `companyId` | Cuenta/contacto comercial. | `crmClients` |
| Deal CRM | Empresa + cliente | `dealId` + `companyId` | Oportunidad/pipeline comercial. | `crmDeals` |
| Interacción CRM | Empresa + cliente/deal | `interactionId` + `companyId` | Registro de contacto/seguimiento. | `crmInteractions` |
| Empleado | Empresa | `employeeId` + `companyId` | Persona interna para HR. | `employees` |
| Nómina | Empresa + empleado | `payrollId` + `companyId` | Pago/periodo de nómina. | `payroll` |
| Evaluación | Empresa + empleado | `reviewId` + `companyId` | Desempeño. | `performanceReviews` |
| KPI | Empresa + módulo | `kpiId` + `companyId` | Indicador calculado o configurado. | `kpis` |
| Suscripción | Empresa o owner | `subscriptionId` | Plan, límites y habilitación de módulos. | `subscriptions` |
| Predicción | Empresa | `predictionLogId` + `companyId` | Resultado predictivo y evidencia. | `predictionLogs` |
| Conversación IA | Empresa/usuario | `conversationId` + `companyId` | Hilo contextual de IA autorizado. | `aiConversations` |
| Proyecto | Empresa | `projectId` + `companyId` | Iniciativa o proceso operativo. | `projects` |
| Tarea de proyecto | Empresa + proyecto | `taskId` + `projectId` | Trabajo operativo asignable. | `projectTasks` |
| Ticket soporte | Empresa/usuario | `ticketId` + `companyId` | Solicitud de soporte o colaboración. | `supportTickets` |
| Evento observabilidad | Plataforma/empresa | `eventId` | Diagnóstico técnico o evento de producto. | `observabilityEvents` |

## 3. Relaciones y cardinalidades

| Relación | Cardinalidad | Regla de dominio | Campo/contrato |
| --- | --- | --- | --- |
| Usuario → Empresas | N a N mediante Miembro | Un usuario puede pertenecer a varias empresas; una empresa puede tener varios usuarios. | `companyMembers.companyId`, `companyMembers.userUid` |
| Empresa → Miembros | 1 a N | Toda empresa operativa debe tener al menos un owner/director activo. | `companyMembers.role`, `status` |
| Empresa → Documentos | 1 a N | Todo documento pertenece a una empresa y no debe moverse entre empresas. | `documents.companyId` |
| Documento → Storage Object | 1 a 1 lógico | El binario vive en Storage y la metadata en Firestore. | `documents.storagePath`, `companies/{companyId}/documents/{documentId}` |
| Documento → Transacciones | 0 a N | Un documento puede originar o justificar movimientos. | `transactions.documentId` recomendado |
| Empresa → Transacciones | 1 a N | Toda transacción usada en KPIs debe tener empresa, fecha, tipo y monto. | `transactions.companyId` |
| Empresa → Auditoría | 1 a N | Todo cambio crítico dentro de empresa debe dejar evidencia. | `auditLogs.companyId` |
| Usuario → Auditoría | 1 a N | Toda acción crítica debe asociarse al actor. | `auditLogs.actorUid` recomendado |
| Empresa → Clientes CRM | 1 a N | CRM es opcional y aislado por empresa. | `crmClients.companyId` |
| Cliente CRM → Deals | 1 a N | Un deal debe poder rastrearse al cliente si aplica. | `crmDeals.clientId` recomendado |
| Cliente/Deal → Interacciones | 1 a N | Cada interacción debe tener contexto comercial. | `crmInteractions.clientId/dealId` recomendado |
| Empresa → Empleados | 1 a N | HR es sensible y requiere permisos estrictos. | `employees.companyId` |
| Empleado → Nómina | 1 a N | Nómina debe apuntar a empleado y periodo. | `payroll.employeeId`, `period` recomendado |
| Empleado → Evaluaciones | 1 a N | Evaluación requiere periodo y evaluador. | `performanceReviews.employeeId` recomendado |
| Empresa → Proyectos | 1 a N | Proyecto pertenece a empresa. | `projects.companyId` |
| Proyecto → Tareas | 1 a N | Tarea debe tener proyecto y empresa. | `projectTasks.projectId`, `companyId` |
| Empresa → Conversaciones IA | 1 a N | IA siempre debe operar con empresa, rol y plan. | `aiConversations.companyId` |
| Empresa → Suscripción | 0 a 1 activa | Un plan activo gobierna módulos y límites. | `subscriptions.companyId/status` recomendado |

## 4. Ownership por entidad

| Entidad | Owner funcional | Puede crear | Puede editar | Puede leer | Puede auditar |
| --- | --- | --- | --- | --- | --- |
| Empresa | Dueño/Director | Dueño/Director | Owner/Director/Admin | Miembros activos | Auditor/Admin |
| Miembro | Admin empresa | Owner/Director/Admin | Owner/Director/Admin | Propio miembro y admins | Auditor/Admin |
| Documento | Contador/Admin | Owner/Director/Admin/Editor/Contador | Owner/Director/Admin/Editor/Contador | Miembros activos autorizados | Auditor/Admin |
| Transacción | Contador/Finance | Owner/Director/Admin/Editor/Contador | Owner/Director/Admin/Editor/Contador | Director/Dueño/Contador/Auditor | Auditor/Admin |
| Auditoría | Sistema | Sistema/backend | Nadie cliente | Auditor/Admin/Director según política | Auditor/Admin |
| Cliente/Deal/Interacción | Comercial/CRM | CRM autorizado/Admin | CRM autorizado/Admin | Director/CRM | Auditor/Admin |
| HR/Nómina/Evaluación | HR/Admin | HR/Admin | HR/Admin | HR/Admin/Dueño autorizado | Auditor/Admin restringido |
| KPI | Sistema/Director | Sistema/Admin | Sistema/Admin | Rol destino | Auditor/Admin |
| IA Conversación | Usuario autorizado | Roles con IA habilitada | Propietario/roles permitidos | Empresa/usuario según política | Auditor/Admin con metadata |
| Proyecto/Tarea | Operaciones | Ops/Admin | Ops/Admin/Responsable | Director/Ops | Auditor/Admin |
| Soporte | Usuario/Soporte | Usuario/Soporte | Soporte/Admin | Usuario/Soporte/Admin | Auditor/Admin |

## 5. Roles de referencia

| Rol | Descripción | Nivel |
| --- | --- | --- |
| Owner | Dueño legal/funcional del tenant. | Máximo |
| Director | Decisor ejecutivo de empresa. | Alto |
| Admin | Administrador operativo y permisos. | Alto |
| Editor/Contador | Operador con escritura en datos financieros/documentales. | Medio |
| Auditor | Revisor de evidencia y cumplimiento. | Lectura especializada |
| Viewer/Miembro | Usuario de consulta o colaboración limitada. | Bajo |
| Invitado | Acceso mínimo o pendiente. | Restringido |
| Soporte | Operador interno de soporte, si existe. | Contextual |

## 6. Matriz Rol × Acción × Módulo

Leyenda: `A` = permitido, `R` = lectura, `D` = denegado, `S` = sistema/backend, `P` = depende del plan, `C` = requiere condición adicional.

| Módulo / Acción | Owner | Director | Admin | Editor/Contador | Auditor | Viewer/Miembro | Invitado | Sistema |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Empresas: crear empresa | A | A | C | D | D | D | D | D |
| Empresas: editar datos base | A | A | A | D | R | R | D | D |
| Empresas: cambiar empresa activa | A | A | A | A | A | A | C | D |
| Miembros: invitar usuario | A | A | A | D | D | D | D | D |
| Miembros: cambiar rol | A | A | A | D | D | D | D | D |
| Miembros: ver miembros | A | A | A | R | R | R | D | D |
| Documentos: cargar PDF/XML | A | A | A | A | D/R | D | D | D |
| Documentos: analizar con IA | P | P | P | P | R | D | D | S |
| Documentos: corregir metadata | A | A | A | A | D/R | D | D | D |
| Documentos: ver documentos | A | A | A | A | R | R | D | D |
| Transacciones: crear/editar | A | A | A | A | D/R | D | D | D |
| Transacciones: ver | A | A | A | A | R | R | D | D |
| Finanzas: ver KPIs ejecutivos | A | A | A | R | R | R limitado | D | S |
| Finanzas: exportar reportes | A | A | A | A | R/C | D | D | S |
| Auditoría: ver logs | A | A | A | D | A | D | D | S |
| Auditoría: crear logs | D | D | D | D | D | D | D | S |
| IA: iniciar conversación | P | P | P | P/C | R/C | D | D | S |
| IA: ver costos/cuotas | A | A | A | D | R | D | D | S |
| CRM: gestionar clientes/deals | P | P | P | P/C | R | D | D | D |
| HR: gestionar empleados | A/C | A/C | A/C | D | R/C | D | D | D |
| HR: nómina | A/C | A/C | A/C | D | R/C | D | D | D |
| Operaciones: gestionar proyectos | A | A | A | P/C | R | R limitado | D | D |
| Predictivo: ejecutar predicción | P | P | P | P/C | R | D | D | S |
| Suscripciones: ver plan | A | A | A | D | R | D | D | S |
| Suscripciones: cambiar plan | A | C | C | D | D | D | D | S |
| Soporte: crear ticket | A | A | A | A | A | A | C | D |
| Soporte: resolver ticket | C | C | A/C | D | D | D | D | S/C |

## 7. Reglas para consumir esta matriz

1. La UI no debe mostrar una acción como primaria si la matriz dice `D`.
2. Si la matriz dice `P`, la UI debe consultar plan/gate antes de habilitar.
3. Si la matriz dice `C`, la condición debe estar documentada en el módulo.
4. Firestore/Storage/backend siempre prevalecen sobre UI.
5. Toda excepción temporal debe registrarse en el plan de migración.
6. Los tests de reglas deben cubrir al menos Owner, Admin, Editor/Contador, Auditor y Viewer.

## 8. Preguntas abiertas antes del refactor

- ¿`miembro` debe mapear a `viewer` o a un rol operativo distinto?
- ¿`Contador` será un rol explícito o una variante de `editor`?
- ¿`Auditor` existe en claims/reglas o se modela como `viewer` con permisos especiales?
- ¿Soporte interno opera dentro del tenant o en una consola separada?
- ¿Los KPIs son siempre derivados o pueden ser registros configurables editables?

# Reconciliación de catálogos de CRM, RRHH y KPI

## Decisión e implementación

Se conserva el contrato existente de Zod/Firestore y se retiran las nueve opciones obsoletas de los formularios. No se modifican permisos, roles, reglas de Firestore/Storage ni políticas de Functions. Tampoco se amplían los enums admitidos por el servidor.

`src/shared/constants/domainEnums.js` es la fuente de valores para Zod y para las cinco listas de formulario. `domainSchemas.js` mantiene la reexportación de DOMAIN_ENUMS para compatibilidad. El estado técnico archived no se ofrece en formularios; se conserva el mecanismo de archivado existente.

| Campo | Decisión aplicada |
|---|---|
| Cliente | prospecto, activo e inactivo; se retira perdido del selector |
| Interacción CRM | llamada, email, reunion, mensaje y nota; se retiran cotizacion, pedido, soporte y otro |
| Empleo | tiempo_completo, medio_tiempo, contrato y practicante; se retiran freelance y temporal |
| Nómina | pendiente, procesando, pagado y cancelado; se retira aprobado |
| Frecuencia KPI | semanal, mensual, trimestral y anual; se retira diario |

No se convierten automáticamente los valores retirados a otros aparentemente similares. Si existen registros antiguos, sus valores se conservan: no se ejecutó ninguna migración. Los badges de cliente/nómina y el tipo de empleo muestran el valor almacenado cuando no tienen etiqueta vigente; no se presentan como otro estado. Para modificar un registro incompatible hay que seleccionar expresamente un valor válido.

## Flujo de nómina

El botón Aprobar que intentaba guardar aprobado se sustituye por **Procesar**, que guarda procesando. El siguiente botón Pagar guarda pagado: **pendiente → procesando → pagado**. Es el flujo admitido por el contrato actual; no equivale a una aprobación formal ni crea un permiso de aprobación.

Se muestran los estados En proceso y Cancelado en el selector. Los registros antiguos aprobado no se convierten en procesando ni habilitan automáticamente el pago. La transición conserva las comprobaciones de acceso existentes en Firestore. Se añade aviso si falla el cambio de estado.

## Prevención de regresiones

```sh
npm run audit:ui-enums
```

El auditor comprueba en el AST que cada Select obtiene sus opciones del catálogo correcto y conserva sus valores al mapearlos. Rechaza plantillas adicionales, opciones locales o transformaciones que puedan introducir otro valor. Después verifica cada opción con Zod y compara con la cláusula de enum de Firestore. No modifica reglas ni datos.

La auditoría pasa con **20 opciones válidas en cinco catálogos, cero rechazadas y paridad Zod–Firestore**. Se añade como paso de CI sin cambiar la política de auditoría de dependencias ni los permisos del workflow.

Las pruebas unitarias recorren todas las opciones y conservan rechazo de valores arbitrarios. Las pruebas E2E crean clientes con los tres estados y las cinco interacciones, empleados con los cuatro tipos y una nómina que pasa de pendiente a procesando y pagado. Comprueban los registros y la recarga. La regresión KPI verifica que diario no se ofrece y que semanal persiste: la expectativa anterior de aceptar diario pertenecía al defecto documentado y se actualiza a la decisión explícita de conservar el contrato.

Los informes de T1 y de verificación previa son snapshots históricos; no se reemplazan sus resultados por éxitos actuales.

## Límites de integración

Esta corrección resuelve el bloqueante de catálogos. No corrige ERP, agregación de dashboard ni el extractor PDF, ya documentados en la verificación anterior. Gemini real y carga autenticada de staging continúan pendientes. La auditoría de dependencias previa conserva seis avisos moderados en Functions. No se declara main o producción aptos por este cambio.

Resultados: lint, tipos, build, arquitectura y presupuesto de bundle aprobados; **185 unitarias, 153 de backend y 112 de reglas aprobadas**. La suite completa de navegador dio **44 PASS / 2 FAIL**: los fallos son los previos de ERP y dashboard. Los tres nuevos E2E de catálogos y la regresión de KPI semanal pasaron. El resumen de esta ejecución y la auditoría están en `enum-fix/`. Se utilizaron emuladores con datos sintéticos y el escáner mock existente. Los ajustes locales de proxy para loopback y puerto Pub/Sub 18085 se restauran al finalizar; no forman parte de la aplicación.

# Radiografía completa del Dashboard para rol Director

## Alcance revisado

Esta auditoría revisa el dashboard principal implementado en `src/pages/Dashboard.jsx`, los gráficos cargados de forma diferida en `src/pages/dashboard/DashboardCharts.jsx`, la fuente agregada de datos `src/hooks/useCompanyData.js`, la configuración de consultas por entidad `src/lib/companyEntityQueries.js` y el presupuesto de rendimiento de la ruta `/dashboard` en `performance-budgets.json`.

## Diagnóstico ejecutivo

El dashboard actual mezcla dos productos en una sola pantalla: un panel operativo de empresa activa y un panel tipo administrador/consultor multiempresa. Para un Director que entra a dirigir una empresa, la primera lectura debería responder: **¿cómo va mi negocio, qué requiere mi atención hoy y qué acción debo tomar?**. En cambio, la pantalla prioriza accesos directos, métricas de volumen y componentes con datos estáticos o sintéticos.

Los problemas más críticos son:

1. **Desalineación de rol:** “Empresas activas” y la tabla “Empresas” son útiles para un owner multiempresa, consultor o administrador, pero no para un Director enfocado en una empresa activa.
2. **KPIs poco accionables:** “Análisis IA”, “Tareas en proceso” y “Ahorro estimado” no explican impacto, riesgo ni decisión.
3. **Datos simulados o estáticos:** cambios porcentuales fijos, alertas fijas, actividad reciente fija, análisis “92%” y “Última sync” fija generan pérdida de confianza.
4. **Jerarquía visual invertida:** los accesos directos aparecen antes del estado del negocio; el Director ve navegación antes que salud, riesgos o caja.
5. **Escalabilidad insuficiente:** el panel de empresas usa `companies.slice(0, 4)` sin búsqueda funcional, paginación, orden ni virtualización; con cientos o miles de empresas se vuelve irrelevante.

## Información que no tiene sentido para el rol

| Elemento | Problema | Recomendación |
|---|---|---|
| KPI “EMPRESAS ACTIVAS” | Para un Director de una empresa activa, contar empresas no aporta a la gestión diaria. Además mezcla contexto multiempresa con desempeño de negocio. | Cambiar por “Empresa activa”, “Salud del negocio”, “Caja disponible”, “Margen neto” o “Riesgos críticos”. |
| Tabla “EMPRESAS” | Parece un panel de cartera/administrador. Muestra sector, estado y riesgo de varias empresas, no la operación de la empresa seleccionada. | Mover a `/companies` o mostrar solo si el usuario tiene rol owner/consultor multiempresa. Para Director, reemplazar por “Prioridades de la empresa activa”. |
| Búsqueda “Buscar empresas, documentos...” | Si el Director está dentro de una empresa activa, buscar empresas distrae. | Usar búsqueda contextual: “Buscar documentos, transacciones, reportes o clientes”. |
| “GEMAILLA IA ● Conectado” como estado principal | No aclara usuario, empresa activa, rol ni entorno. | Mostrar “Empresa: X”, “Rol: Director”, selector de empresa si aplica, y estado IA secundario. |
| Footer “Soporte 24/7” | Es promesa comercial, no estado operativo. | Mover a ayuda/soporte; footer debe ser mínimo o desaparecer en dashboard operativo. |

## KPIs que no aportan valor o son débiles

### KPIs actuales

- **Empresas activas:** métrica de administración, no de dirección.
- **Documentos procesados:** útil solo si se conecta a cumplimiento, pendientes, errores o vencimientos.
- **Análisis IA:** actualmente cuenta KPIs (`kpis.length`), por lo que la etiqueta no coincide con el dato.
- **Alertas activas:** es útil, pero necesita severidad, fuente, vencimiento y acción.
- **Tareas en proceso:** se deriva de transacciones con `status === 'pending'`; la etiqueta no comunica si son conciliaciones, pagos, aprobaciones o importaciones.
- **Ahorro estimado:** calcula 15% de ingresos sin justificación de negocio, baseline ni fuente; debe eliminarse o convertirse en oportunidad estimada explicable.

### KPIs recomendados para Director

Priorizar 4 a 6 KPIs, no 6 tarjetas equivalentes con sparklines repetidas:

1. **Caja disponible / flujo neto del mes.**
2. **Ingresos vs gastos del periodo.**
3. **Margen operativo o resultado neto.**
4. **Riesgos críticos abiertos.**
5. **Documentos pendientes/vencidos.**
6. **Acciones ejecutivas pendientes**, por ejemplo aprobaciones, auditorías, pagos o anomalías.

Cada KPI debe incluir: valor actual, variación real contra periodo anterior, fecha de actualización, severidad y CTA cuando corresponda.

## Información duplicada

- “Alertas activas” aparece como KPI y como panel lateral. Mantener ambos solo si la tarjeta resume y el panel detalla por severidad; hoy se sienten redundantes.
- “Documentos procesados” como KPI y acceso directo a Documentos compiten por atención sin explicar pendientes.
- “Análisis IA” y “Análisis en tiempo real” duplican concepto IA/análisis sin distinguir objetivo.
- “Empresas activas”, tabla “Empresas”, búsqueda de empresas y acceso directo “Empresas” en navegación lateral son señales repetidas de gestión multiempresa.

## Secciones vacías, estáticas o de relleno

| Sección | Evidencia funcional | Riesgo |
|---|---|---|
| Alertas | Usa arreglo constante `ALERTS`. | Puede mostrar riesgos falsos o irrelevantes. |
| Actividad reciente | Usa arreglo constante `RECENT_ACTIVITY`. | Simula operación y no refleja auditoría real. |
| Análisis en tiempo real | Pie fijo 92%, tiempo fijo y checks genéricos. | Alto riesgo de pérdida de confianza; parece demo. |
| Cambios porcentuales | `+18%`, `+24%`, `+12%`, `-5%`, `+7%`, `+32%` son estáticos. | El Director puede tomar decisiones con datos falsos. |
| Último análisis | “Hoy, 09:15 AM” en todas las empresas. | Dato falso repetido. |
| Última sync | “Hoy, 03:15 AM” fijo. | No representa estado real de sincronización. |

## Flujo visual: qué ve primero el Director

Orden actual:

1. Header con menú, búsqueda y estado IA.
2. Accesos directos.
3. KPIs de volumen.
4. Tabla de empresas.
5. Análisis en tiempo real y alertas.
6. Actividad reciente.

Orden recomendado:

1. **Encabezado contextual:** empresa activa, rol, periodo, fecha de actualización y selector de periodo.
2. **Resumen ejecutivo:** 3 a 5 datos críticos de salud del negocio.
3. **Prioridades:** alertas críticas, pendientes y próximos vencimientos.
4. **Tendencias:** flujo/caja, ingresos/gastos, margen o documentos por estado.
5. **Acciones rápidas:** cargar documento, registrar transacción, ejecutar auditoría, preguntar a IA.
6. **Actividad reciente real:** solo eventos auditables.
7. **Accesos a módulos:** como navegación secundaria, no como primer bloque.

## Jerarquía de información

La jerarquía actual da el mismo peso visual a todo: módulos, KPIs, tabla, análisis y actividad usan tarjetas oscuras con bordes dorados. Esto reduce escaneabilidad.

Recomendaciones:

- Usar un bloque principal de “Estado del negocio” con mayor tamaño.
- Separar niveles: crítico, informativo y navegación.
- Evitar que todas las tarjetas tengan sparklines; usar gráficos solo donde expliquen tendencia real.
- Reservar color rojo/ámbar/verde para severidad, no para decoración.
- Agrupar por decisión: finanzas, cumplimiento, operación y crecimiento.

## Acciones principales

Acciones actuales visibles:

- Ver todas / + Nueva en empresas.
- Ver todas en alertas.
- Ver todas en actividad.
- Accesos directos a módulos.
- Botones de notificaciones y ayuda sin destino visible.

Acciones recomendadas para Director:

1. **Ejecutar auditoría** cuando existan datos suficientes.
2. **Cargar documento** si hay vencimientos o falta soporte documental.
3. **Registrar/importar transacciones** si la información financiera está incompleta.
4. **Resolver alerta** o “Ver plan de acción”.
5. **Preguntar a IA sobre este negocio** con contexto de empresa activa.
6. **Generar reporte ejecutivo** del periodo.

Los botones principales deben ubicarse cerca de los datos que justifican la acción, no solo como una parrilla de módulos.

## Navegación

La parrilla de accesos directos ocupa la primera posición del contenido y duplica parcialmente la navegación lateral/global. Para dashboard ejecutivo, la navegación debe ser secundaria.

Recomendaciones:

- Reducir accesos directos a 4 acciones frecuentes por rol.
- Personalizar módulos por permisos y madurez del cliente.
- No mostrar módulos sin datos configurados como si fueran equivalentes.
- Mantener “Empresas” fuera del dashboard de Director salvo que administre cartera.

## Terminología de negocio

Problemas de terminología:

- “Dashboard” y “Análisis en tiempo real” son genéricos.
- “Análisis IA” no describe resultado.
- “Saturación de datos” no es un término claro para dirección.
- “Tareas en proceso” no aclara qué proceso.
- “Ahorro estimado” requiere metodología.

Terminología recomendada:

- “Resumen ejecutivo”.
- “Salud financiera”.
- “Riesgos críticos”.
- “Pendientes de cumplimiento”.
- “Flujo neto”.
- “Acciones recomendadas”.
- “Última actualización”.
- “Oportunidad estimada” solo si existe cálculo auditable.

## Colores, contraste y legibilidad

Fortalezas:

- La identidad visual negro/dorado es consistente.
- El uso de `Suspense` para gráficos evita bloquear la renderización principal.

Riesgos:

- Mucho texto usa opacidades bajas (`rgba(..., 0.5/0.6/0.7)`) sobre fondo oscuro; puede incumplir contraste en pantallas reales.
- El dorado se usa para títulos, iconos, bordes, KPIs y acciones, por lo que pierde significado.
- El verde `#4caf50` sobre fondos oscuros con transparencias debe verificarse contra WCAG.
- Los textos en mayúsculas con letter-spacing funcionan para labels, pero no para lectura rápida en todo el dashboard.

Recomendaciones:

- Definir tokens semánticos: texto primario, texto secundario, borde sutil, alerta crítica, alerta warning, éxito.
- Aumentar contraste de textos secundarios.
- Usar color de severidad solo para estados, no para decoración.
- Revisar foco visible de botones e inputs.

## Espacios y alineación

Observaciones:

- La pantalla usa `p-6`, `gap-4` y `gap-6` de forma consistente.
- En pantallas grandes, 6 tarjetas KPI en una fila (`2xl:grid-cols-6`) pueden quedar estrechas y difíciles de comparar.
- La tabla de empresas dentro de `xl:col-span-2` puede comprimirse y exige scroll horizontal.
- El header no muestra claramente el contexto de empresa activa, por lo que el usuario debe inferirlo.

Recomendaciones:

- Limitar KPIs superiores a 4 tarjetas principales + 1 panel de alertas.
- Usar columnas 12-grid: resumen 8 columnas, prioridades 4 columnas.
- Mantener alineación de CTA por bloque.
- Evitar tablas en cards pequeñas; usar listas resumidas o páginas dedicadas.

## Componentes que sobran

Para rol Director de empresa activa sobran o deberían ser condicionales:

- Tabla multiempresa en el dashboard.
- KPI “Empresas activas”.
- Pie fijo de “Análisis en tiempo real”.
- Footer con “Soporte 24/7”.
- Sparkline repetida en todas las tarjetas sin relación con cada KPI.
- Botón hamburguesa si ya existe layout global responsive.
- Actividad reciente fija.

## Componentes que faltan

- Selector de periodo: hoy, 7 días, mes, trimestre, año.
- Identidad de empresa activa y rol visible.
- Estado de frescura de datos real.
- Empty states honestos cuando no hay empresa, transacciones, documentos o KPIs.
- Ranking de riesgos con severidad, owner y fecha límite.
- Acciones recomendadas con prioridad y explicación.
- Resumen financiero real: ingresos, gastos, neto, tendencia.
- Calidad de datos: documentos pendientes, transacciones sin categorizar, importaciones fallidas.
- Paginación/búsqueda server-side si se mantiene cualquier listado multiempresa.

## Datos dinámicos vs estáticos

### Deben ser dinámicos

- Conteos de documentos por estado.
- Ingresos, gastos, flujo neto y variaciones contra periodo anterior.
- Alertas reales desde auditoría, KPIs o reglas de negocio.
- Actividad reciente desde audit logs.
- Última sincronización real.
- Último análisis real por empresa.
- Estado de IA/costos/cuotas si se muestra.
- Riesgo por empresa si el usuario administra varias.

### Pueden ser estáticos o de configuración

- Lista de módulos disponibles por plan/rol.
- Textos de ayuda.
- Definiciones de severidad.
- Umbrales base, siempre que se documenten y puedan configurarse.
- Etiquetas de navegación.

## Rendimiento

Hallazgos:

- El dashboard consulta `transactions`, `documents` y `kpis` mediante `useCompanyData`, con límite por defecto 50 en el hook, aunque las consultas de entidad tienen default 100. Esto reduce carga, pero puede sesgar KPIs si se espera total histórico.
- `companies` llega desde contexto y se renderiza parcialmente con `slice(0, 4)`, pero si el contexto carga todas las empresas no escala para miles.
- `DashboardSparkline` y `DashboardRealtimePie` se cargan con `lazy`, lo cual ayuda a separar Recharts, pero se renderiza una sparkline por cada tarjeta aunque todas usan el mismo `monthlyData`.
- El presupuesto de `/dashboard` permite solo vendors core y firebase; si Recharts entra en el chunk de la ruta debe vigilarse con `npm run budget:bundle`.

Recomendaciones:

- Reemplazar KPIs calculados en cliente con agregados backend por periodo.
- Cargar tendencias específicas por KPI, no reutilizar una serie común.
- No cargar charts si el usuario no tiene datos suficientes.
- Introducir paginación/cursor y búsqueda server-side para empresas.
- Medir Web Vitals y peso del chunk de dashboard en CI.
- Memoizar formateadores y normalizar fechas en capa de datos si crece el volumen.

## Preparación para escalar a cientos o miles de empresas

Si el producto debe servir a consultores o grupos empresariales con muchas empresas:

1. El dashboard debe tener dos modos: **Empresa activa** y **Cartera multiempresa**.
2. El modo cartera debe usar agregados: empresas en riesgo, pendientes críticos, facturación total, vencimientos próximos.
3. El listado de empresas debe moverse a una página dedicada con filtros, paginación, búsqueda server-side y orden por riesgo/actividad.
4. No usar `companies.length` como métrica ejecutiva sin segmentar por permisos, estado real y plan.
5. Las alertas deben estar indexadas por severidad, empresa, fecha límite y responsable.
6. La carga inicial no debe depender de traer todas las empresas y luego cortar a 4 en UI.

## Propuesta de rediseño por prioridad

### P0 — Confianza de datos

- Eliminar o etiquetar como demo toda métrica fija.
- Quitar “Ahorro estimado” hasta tener fórmula auditada.
- Reemplazar `ALERTS` y `RECENT_ACTIVITY` por datos reales o empty states.
- Corregir “Análisis IA” para que no cuente KPIs.

### P1 — Relevancia para Director

- Primer bloque: empresa activa, periodo, salud financiera y riesgos.
- Sustituir “Empresas activas” por KPI de negocio.
- Mover tabla multiempresa a `/companies` o hacerla condicional por rol.
- Añadir CTA principal: “Ver plan de acción” o “Ejecutar auditoría”.

### P2 — Navegación y jerarquía

- Bajar accesos directos debajo del resumen ejecutivo.
- Reducir módulos visibles según rol.
- Reordenar paneles: resumen, prioridades, tendencias, acciones, actividad.

### P3 — Escalabilidad y rendimiento

- Agregados backend por periodo.
- Paginación/cursor para empresas.
- Presupuesto de bundle vigilado en CI.
- Carga condicional de gráficos y listas pesadas.

## Checklist final de decisión

- [ ] ¿El primer pantallazo responde cómo va la empresa activa?
- [ ] ¿Cada KPI tiene fuente, periodo y acción asociada?
- [ ] ¿No hay datos simulados sin etiqueta demo?
- [ ] ¿Las alertas son reales, priorizadas y resolubles?
- [ ] ¿La navegación no compite con la información ejecutiva?
- [ ] ¿La tabla multiempresa solo aparece para roles que la necesitan?
- [ ] ¿El dashboard soporta miles de empresas sin traerlas todas al cliente?
- [ ] ¿Los colores expresan jerarquía y severidad, no solo marca?

# Plan de refactor recomendado en 4 fases

Este plan prioriza estabilidad operativa antes de mover carpetas o introducir módulos nuevos. Cada fase debe cerrar con evidencia verificable en `docs/VERIFICACION.md` o en el documento de release correspondiente.

## Fase 1: Estabilizar la arquitectura actual

Objetivo: congelar contratos públicos y asegurar que los flujos críticos actuales funcionan de forma repetible antes de cualquier refactor estructural.

### Alcance

- Mantener las rutas públicas, alias `@/*` y fachadas existentes.
- Documentar los contratos que no pueden romperse: Auth, multiempresa, documentos, IA, reglas Firebase y Storage.
- Cubrir con pruebas los flujos críticos ya definidos: Auth/Multiempresa, Documentos e IA segura por backend.
- Centralizar observabilidad mínima para errores de cliente, Cloud Functions, reglas, Storage y consumo de IA.
- Registrar decisiones de arquitectura en documentación antes de aplicar cambios de carpetas o nombres.

### Entregables

- Checklist de contratos públicos y dependencias internas.
- Suite estable de unit tests, tests de reglas y E2E críticos.
- Deploy de staging reproducible.
- Runbooks actualizados para incidentes de IA, documentos y rollback.
- Matriz de riesgos vigente con responsables y mitigaciones.

### Criterios de salida

- `npm run lint`, `npm run typecheck:core`, `npm run test:unit` y pruebas de reglas pasan en CI o entorno documentado.
- Los flujos Auth/Multiempresa, Documentos e IA tienen cobertura E2E o evidencia manual justificada.
- No existen secretos hardcodeados ni dependencias críticas sin propietario.
- La arquitectura vigente está documentada y validada contra el código desplegado.

## Fase 2: Extraer dominios y servicios por feature

Objetivo: reducir acoplamiento sin cambiar comportamiento visible.

### Alcance

- Mover lógica de negocio desde componentes UI hacia servicios por feature.
- Mantener fachadas públicas estables mientras se adelgazan internamente.
- Separar validación, normalización, persistencia y presentación.
- Introducir pruebas unitarias alrededor de servicios extraídos antes de cambiar consumidores.

### Entregables

- Servicios por dominio para documentos, compañías, IA y módulos financieros prioritarios.
- Adaptadores Firebase explícitos en `src/infrastructure/firebase/`.
- Componentes UI dependiendo de contratos de dominio, no de detalles de Firebase.
- Mapa de migración de imports legacy a imports nuevos.

### Criterios de salida

- No se rompen rutas, permisos ni reglas Firebase.
- Las fachadas legacy siguen exportando el contrato esperado.
- Cada extracción tiene pruebas unitarias o de integración equivalentes.
- El bundle y el tiempo de carga no empeoran de forma relevante frente a la línea base.

## Fase 3: Reorganizar capas de aplicación

Objetivo: consolidar una estructura mantenible para crecimiento modular.

### Alcance

- Crear o completar capas `src/app`, `src/features`, `src/infrastructure` y `src/shared`.
- Mover providers, rutas y composición de aplicación a `src/app`.
- Normalizar hooks compartidos y utilidades transversales.
- Deprecar imports legacy con avisos documentados antes de eliminarlos.

### Entregables

- Árbol de carpetas objetivo documentado.
- Rutas y providers centralizados.
- Guía de importación por capa.
- Lista de módulos legacy pendientes y fecha objetivo de eliminación.

### Criterios de salida

- No hay ciclos de dependencia entre capas principales.
- Las páginas consumen servicios de feature o hooks públicos, no repositorios internos directamente.
- La documentación de arquitectura coincide con la estructura real.
- El equipo puede crear un módulo nuevo siguiendo una plantilla documentada.

## Fase 4: Optimizar operación, performance y escalabilidad

Objetivo: convertir la arquitectura estabilizada en una base preparada para crecimiento de producto.

### Alcance

- Medir y optimizar carga inicial, rutas críticas y consultas Firebase.
- Revisar índices, reglas, cuotas y presupuestos por tenant.
- Consolidar alertas operativas y tableros de costos.
- Automatizar validaciones de release y rollback.

### Entregables

- Presupuesto de performance por ruta crítica.
- Revisión de índices Firestore y patrones de consulta.
- Alertas de errores, latencia, uso de IA y costos.
- Checklist de release con pasos de verificación y rollback.

### Criterios de salida

- Lighthouse móvil y E2E críticos quedan registrados por release.
- Las consultas principales tienen índices y límites operativos definidos.
- La plataforma tiene alertas accionables para fallos de Auth, documentos, IA y costos.
- El roadmap puede aceptar nuevos módulos sin reabrir deuda arquitectónica crítica.

## Orden recomendado de ejecución

1. Completar Fase 1 sin añadir funcionalidad nueva.
2. Ejecutar Fase 2 por dominio, empezando por documentos y compañías.
3. Aplicar Fase 3 cuando las fachadas estén delgadas y cubiertas por pruebas.
4. Mantener Fase 4 como mejora continua después de cada release.

## Regla de control

Si una fase detecta regresiones en Auth, Multiempresa, Documentos o IA, se pausa el refactor y se vuelve temporalmente a Fase 1 hasta recuperar estabilidad verificable.

# Dashboard Ejecutivo v2

## Objetivo

Este documento define el diseño funcional, visual, técnico y de negocio del Dashboard Ejecutivo de Gemailla.

Es la especificación oficial para la refactorización del Dashboard y tiene prioridad sobre implementaciones existentes.

El dashboard debe responder en menos de 5 segundos las siguientes preguntas:

1. ¿Cómo está mi empresa?
2. ¿Qué requiere atención inmediata?
3. ¿Qué riesgos existen?
4. ¿Qué oportunidades tengo?
5. ¿Qué acciones debo realizar hoy?
6. ¿Cuál es el impacto económico del negocio?

## Principios del Dashboard Ejecutivo
### Regla 1

El dashboard no es una pantalla de navegación.

Es un centro de decisiones.

Cada tarjeta debe ayudar a:

- decidir
- priorizar
- controlar
- auditar
- reducir riesgos
- ahorrar tiempo

Si un componente no ayuda a tomar decisiones, no pertenece al dashboard.

---

### Regla 2

No mostrar métricas técnicas.

Ejemplos:

❌ Empresas activas

❌ Usuarios registrados

❌ Total de miembros

❌ Documentos en Firestore

❌ Colecciones

❌ Storage utilizado

❌ Tokens IA

Todo eso pertenece al área administrativa.

---

### Regla 3

Mostrar únicamente KPIs de negocio.

Ejemplos:

- Riesgo tributario
- Flujo de efectivo
- Liquidez
- Rentabilidad
- Obligaciones próximas
- Alertas críticas
- Documentos pendientes
- Facturación
- IA ejecutada
- Ahorro generado
- Riesgo laboral
- Riesgo financiero
- Riesgo legal

---

### Regla 4

Todo KPI debe responder:

¿Por qué debo preocuparme?

¿Necesito actuar hoy?

¿Qué gano si lo soluciono?

Si no responde esas preguntas, debe eliminarse.
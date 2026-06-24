# Iteración de estabilización previa a nuevos módulos

## Decisión de producto e ingeniería

La próxima iteración se dedica exclusivamente a estabilizar los flujos críticos y validar el producto en staging. No se aceptan módulos nuevos en el roadmap hasta completar esta cobertura y validación.

Desde el inicio de esta iteración queda congelada toda feature nueva no crítica. Solo se aceptan cambios correctivos, de seguridad, confiabilidad, observabilidad, pruebas, costos u operación que contribuyan directamente a cumplir los criterios de salida.

## Alcance exclusivo de la iteración

Durante esta iteración solo se trabajará en:

1. Tests de reglas Firestore y Storage.
2. Firebase Emulator Suite.
3. Deploy de staging.
4. Lighthouse móvil.
5. Playwright para los tres flujos críticos.
6. Monitoreo y alertas.
7. Revisión de costos de IA y Firebase.

## Regla de bloqueo de roadmap

Ningún módulo nuevo entra al roadmap hasta que los flujos de Auth, Multiempresa, Documentos e IA tengan cobertura E2E y validación en staging.

## Flujos críticos requeridos

### 1. Auth y Multiempresa

Debe validarse como mínimo:

- Login real o emulado con Firebase Auth.
- Creación o selección de empresa activa.
- Acceso por dueño de empresa.
- Acceso por miembro activo.
- Bloqueo de usuario sin membresía.
- Validación de roles para lectura, escritura y administración.

### 2. Documentos

Debe validarse como mínimo:

- Creación de metadata Firestore antes de la subida.
- Subida válida de PDF/XML a Storage.
- Rechazo de MIME no permitido.
- Rechazo de archivo mayor al límite permitido.
- Bloqueo de lectura/escritura desde otra empresa.
- Bloqueo de update/delete físico desde cliente.
- Persistencia de `storagePath` sin URLs públicas.

### 3. IA

Debe validarse como mínimo:

- Rechazo de peticiones sin token Firebase.
- Rechazo de token inválido o expirado.
- Rechazo de `companyId` ausente o inválido.
- Rechazo de empresa sin acceso.
- Rechazo de documento de otro tenant.
- Aplicación de rate limiting, cuota diaria y presupuesto diario.
- Respuesta exitosa desde backend seguro con correlación trazable.

## Checklist formal de release

Este documento es el checklist formal de release para la iteración de estabilización. Cada ítem debe quedar marcado y respaldado con evidencia fechada en `docs/VERIFICACION.md` antes de abrir el roadmap a features no críticas.

| Estado | Área | Evidencia requerida |
| --- | --- | --- |
| [ ] | Congelamiento de features no críticas | Registro explícito de freeze, alcance permitido y excepciones aprobadas. |
| [ ] | Reglas Firestore y Storage | Resultado de Firebase Emulator Suite con comando, fecha, entorno y responsable. |
| [ ] | Auth y Multiempresa | Evidencia Playwright E2E o staging para login, empresa activa, roles y bloqueo sin membresía. |
| [ ] | Documentos | Evidencia Playwright E2E o staging para metadata, upload PDF/XML, rechazos, aislamiento tenant e inmutabilidad. |
| [ ] | IA | Evidencia backend/E2E para auth token, tenant, documento, rate limit, cuotas, presupuesto y trazabilidad. |
| [ ] | Deploy staging | Identificador de deploy, comandos reproducibles y configuración usada. |
| [ ] | Lighthouse móvil | Reporte o resumen de métricas contra staging. |
| [ ] | Monitoreo y alertas | Alertas configuradas para Cloud Functions, Auth, Storage y consumo de IA. |
| [ ] | Costos operativos | Límites definidos para IA, Firestore, Storage, Functions y Hosting. |
| [ ] | Evidencia consolidada | `docs/VERIFICACION.md` actualizado con resultados, bloqueos y siguientes acciones. |

## Criterios de salida

La iteración solo se considera completa cuando:

- Las pruebas de reglas Firestore y Storage pasan en Firebase Emulator Suite.
- Los tres flujos críticos tienen cobertura Playwright E2E.
- Existe un deploy de staging reproducible.
- Lighthouse móvil se ejecuta contra staging y los resultados quedan documentados.
- Monitoreo y alertas cubren errores de Cloud Functions, autenticación, Storage y consumo de IA.
- La revisión de costos define límites operativos para IA, Firestore, Storage, Functions y Hosting.
- La evidencia queda registrada en `docs/VERIFICACION.md` o en el documento de release correspondiente.

## Política de excepciones al congelamiento

Cualquier excepción debe cumplir todas estas condiciones:

1. Estar asociada a un riesgo crítico de seguridad, datos, operación, cumplimiento o disponibilidad.
2. No ampliar superficie funcional fuera de Auth, Multiempresa, Documentos, IA, observabilidad, costos o release.
3. Registrar justificación, aprobador, fecha y evidencia en `docs/VERIFICACION.md`.
4. Mantener o aumentar la cobertura exigida por este checklist.

## Fuera de alcance

Queda explícitamente fuera de alcance durante esta iteración:

- Nuevos módulos de negocio.
- Nuevas páginas no relacionadas con los flujos críticos.
- Integraciones externas no necesarias para Auth, Multiempresa, Documentos o IA.
- Cambios cosméticos que no mejoren validación, confiabilidad, seguridad u operación.

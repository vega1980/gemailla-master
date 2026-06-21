# Iteración de estabilización previa a nuevos módulos

## Decisión de producto e ingeniería

La próxima iteración se dedica exclusivamente a estabilizar los flujos críticos y validar el producto en staging. No se aceptan módulos nuevos en el roadmap hasta completar esta cobertura y validación.

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

## Criterios de salida

La iteración solo se considera completa cuando:

- Las pruebas de reglas Firestore y Storage pasan en Firebase Emulator Suite.
- Los tres flujos críticos tienen cobertura Playwright E2E.
- Existe un deploy de staging reproducible.
- Lighthouse móvil se ejecuta contra staging y los resultados quedan documentados.
- Monitoreo y alertas cubren errores de Cloud Functions, autenticación, Storage y consumo de IA.
- La revisión de costos define límites operativos para IA, Firestore, Storage, Functions y Hosting.
- La evidencia queda registrada en `docs/VERIFICACION.md` o en el documento de release correspondiente.

## Fuera de alcance

Queda explícitamente fuera de alcance durante esta iteración:

- Nuevos módulos de negocio.
- Nuevas páginas no relacionadas con los flujos críticos.
- Integraciones externas no necesarias para Auth, Multiempresa, Documentos o IA.
- Cambios cosméticos que no mejoren validación, confiabilidad, seguridad u operación.

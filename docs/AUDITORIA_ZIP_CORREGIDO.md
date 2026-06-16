# Auditoría de versión corregida

## Dictamen

Base Firebase pura corregida para prueba local y siguiente validación en Firebase real.

## Cambios críticos

- [PROPUESTA]: Importar `connectStorageEmulator`.
- [PROS]: Evita ruptura inmediata en localhost.
- [CONTRAS]: Si los emuladores no están activos, habrá error de conexión local.

- [PROPUESTA]: Endurecer reglas Firestore por campos permitidos.
- [PROS]: Reduce modificación maliciosa desde navegador.
- [CONTRAS]: Cambios futuros de campos requieren actualizar reglas.

- [PROPUESTA]: Storage exige usuario autenticado, claim de empresa activo, permisos/rol válidos y metadata `companyId`/`documentId` coincidente.
- [PROS]: Refuerza aislamiento por empresa y reduce subidas con metadata/ruta inconsistente.
- [CONTRAS]: La existencia del documento Firestore se conserva como contrato del flujo de aplicación/tests, no como lectura `get()`/`exists()` desde `storage.rules`.

- [PROPUESTA]: Mantener IA en modo limitado sin OpenAI en navegador.
- [PROS]: No expone claves privadas.
- [CONTRAS]: IA real requiere Cloud Functions o backend seguro.

## Pendiente para producción

```text
1. Probar reglas con Firebase Emulator.
2. Probar login real.
3. Probar subida real PDF/XML.
4. Agregar roles si se usará por equipo.
5. Agregar Cloud Functions si se requiere auditoría legal fuerte o IA real.
```

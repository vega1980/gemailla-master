# Fase 1: integridad, retención y operaciones de seguridad

## Contratos compartidos

Los enums y límites canónicos viven en `src/shared/validation/domainSchemas.js`. Los schemas son estrictos, las actualizaciones se validan contra el documento fusionado y Firestore repite autorización, tipos, campos permitidos, rangos y transición. Solo las diez colecciones de esta fase usan `serverTimestamp()`; las colecciones legacy conservan timestamps ISO hasta contar con una migración explícita.

## Retención y borrado

| Dato | Plazo | Estado | Jurisdicción | Responsable | Aprobador |
|---|---:|---|---|---|---|
| Documentos y objetos Storage | vigencia + 5 años | pendiente de aprobación legal | México | Operaciones | Legal/DPO |
| Empleados | relación laboral + 5 años | pendiente de aprobación legal | México | RR. HH. | Legal/DPO |
| Nómina | 5 años | pendiente de aprobación legal | México | Finanzas/RR. HH. | Legal/DPO |
| Logs de IA y observabilidad | 90 días | implementado en `expiresAt`; TTL real pendiente | Global/México | Plataforma | Seguridad |
| Auditoría lógica | 7 años | propuesto; sin WORM | Global/México | Seguridad | Legal/DPO |
| Cuarentena infectada | 30 días | implementado en código; aprobación legal, despliegue y verificación pendientes | Global | Seguridad | Legal/DPO |
| Cuarentena con error transitorio | 7 días | implementado en código; aprobación legal, despliegue y verificación pendientes | Global | Plataforma | Legal/DPO |

`legalHold=true` implica `expiresAt=null` o ausente. **TTL pendiente:** el script `configure:ttl` requiere confirmación explícita y el estado no se considera verificado hasta ejecutar `gcloud firestore fields ttls list` en el proyecto real.

Los backfills `backfill:log-expiry` (dry-run) y `backfill:log-expiry:apply` son paginados, reiniciables e idempotentes. El inventario `audit:phase-one-domain` solo informa incompatibilidades y nunca elimina campos desconocidos.

## Cuarentena de archivos

El cliente solo puede subir PDF/XML a `companies/{companyId}/quarantine/{documentId}/{file}`; las reglas bloquean el alta directa en `documents`. En el código local, `scanQuarantinedDocument` valida tenant, tamaño, magic bytes y hash, reclama la generación en Firestore y la copia de forma idempotente a `unscanned-gemailla-enterprise`. Los consumidores de `clean-gemailla-enterprise` y `quarantined-gemailla-enterprise` están implementados y se prueban localmente con emuladores; su despliegue, triggers, IAM y activación en producción permanecen pendientes del proceso autorizado. El servicio antivirus productivo y su Eventarc existente no se consideran verificados por estas pruebas locales. La integración no usa una API HTTP ni secretos de antivirus. El simulador local reproduce eventos y movimientos entre buckets, usando EICAR únicamente como archivo seguro de prueba.

## IAM y cuentas de servicio

`npm run audit:iam -- PROJECT_ID` comprueba solo roles primitivos y claves de cuentas. **IAM pendiente:** falta revisar buckets, Secret Manager, Cloud Run, Functions, impersonación, miembros externos y políticas organizacionales con credenciales reales.

## Procedimiento de verificación

Ejecutar tests Zod, rules en emuladores y Functions antes del despliegue. Validar CSP en staging (incluidos Auth, Firestore y Storage), revisar reportes antes de endurecer directivas, y probar cuarentena con PDF/XML válidos, MIME falso, EICAR y archivo sobredimensionado.

Producción no publica CSP. Staging genera temporalmente `Content-Security-Policy-Report-Only`, pero aún no existe un receptor de reportes. **Validación CSP pendiente** hasta configurar un destino seguro y obtener evidencias de login popup/redirect y App Check.

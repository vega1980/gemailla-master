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
| Cuarentena infectada | 30 días | implementado en código; despliegue/verificación pendientes | Global | Seguridad | Seguridad |
| Cuarentena con error transitorio | 7 días | implementado en código; despliegue/verificación pendientes | Global | Plataforma | Seguridad |

`legalHold=true` implica `expiresAt=null` o ausente. **TTL pendiente:** el script `configure:ttl` requiere confirmación explícita y el estado no se considera verificado hasta ejecutar `gcloud firestore fields ttls list` en el proyecto real.

Los backfills `backfill:log-expiry` (dry-run) y `backfill:log-expiry:apply` son paginados, reiniciables e idempotentes. El inventario `audit:phase-one-domain` solo informa incompatibilidades y nunca elimina campos desconocidos.

## Cuarentena de archivos

El cliente solo puede subir PDF/XML a `companies/{companyId}/quarantine/{documentId}/{file}`; las reglas bloquean el alta directa en `documents`. `scanQuarantinedDocument` valida tenant, tamaño y magic bytes y consulta, en modo fail-closed, el antivirus configurado en `MALWARE_SCANNER_URL`; `MALWARE_SCANNER_API_KEY` se inyecta desde Secret Manager. El escáner simulado valida únicamente el flujo local. **Antivirus de producción pendiente** hasta desplegar y comprobar el servicio real.

## IAM y cuentas de servicio

`npm run audit:iam -- PROJECT_ID` comprueba solo roles primitivos y claves de cuentas. **IAM pendiente:** falta revisar buckets, Secret Manager, Cloud Run, Functions, impersonación, miembros externos y políticas organizacionales con credenciales reales.

## Procedimiento de verificación

Ejecutar tests Zod, rules en emuladores y Functions antes del despliegue. Validar CSP en staging (incluidos Auth, Firestore y Storage), revisar reportes antes de endurecer directivas, y probar cuarentena con PDF/XML válidos, MIME falso, EICAR y archivo sobredimensionado.

Producción no publica CSP. Staging genera temporalmente `Content-Security-Policy-Report-Only`, pero aún no existe un receptor de reportes. **Validación CSP pendiente** hasta configurar un destino seguro y obtener evidencias de login popup/redirect y App Check.

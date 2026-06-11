# Runbook: incidente en uploads documentales

## Ownership

- **Owner primario**: Equipo Documentos.
- **Backup**: Equipo Firebase/Storage.

## Severidades

| Severidad | Criterio |
| --- | --- |
| SEV1 | Ningún usuario puede subir documentos en producción. |
| SEV2 | Más de 5 fallos en 10 minutos o impacto a empresas críticas. |
| SEV3 | Fallos intermitentes por tipo de archivo o empresa. |
| SEV4 | Error aislado de validación de usuario/archivo. |

## Detección

1. Revisar alerta `Upload failures`.
2. Identificar `correlationId` en documento Firestore, metadata de Storage, consola frontend o `auditLogs`.
3. Confirmar release (`appVersion`, `buildId`, `gitSha`, `deployEnv`).

## Diagnóstico

1. Verificar reglas de Storage y Firestore para la empresa/documento.
2. Confirmar que el documento Firestore quedó en `uploading` antes del upload.
3. Validar tamaño máximo (15 MB) y MIME (`PDF`, `XML`).
4. Revisar si el objeto existe en `companies/{companyId}/documents/{documentId}/...`.
5. Si el documento está en `error`, usar el `errorMessage` con `correlationId` para buscar el evento.

## Mitigación

- Si es regresión de release, ejecutar rollback.
- Si son reglas, aplicar fix mínimo y probar en emuladores.
- Si son archivos inválidos, comunicar límites y mantener el rechazo.

## Cierre

- Registrar empresas afectadas, documentos impactados, `correlationId` y release.
- Confirmar que auditoría muestra `document_upload` con `correlationId` para uploads recuperados.

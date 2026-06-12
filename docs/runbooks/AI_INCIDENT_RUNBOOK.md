# Runbook: incidente en operaciones IA

## Ownership

- **Owner primario**: Equipo Plataforma/IA.
- **Backup**: Equipo Frontend si el fallo solo aparece en navegador; Equipo Firebase si hay errores de auth/functions.

## Severidades

| Severidad | Criterio |
| --- | --- |
| SEV1 | IA caída para la mayoría de usuarios en producción o fuga de credenciales. |
| SEV2 | Error rate IA > 2% o p95 > 8s sostenido. |
| SEV3 | Fallo parcial, degradación o errores acotados a una empresa/release. |
| SEV4 | Ruido de logging o consultas puntuales sin impacto al usuario. |

## Detección

1. Revisar alerta `AI error rate` o `AI latencia p95`.
2. Tomar un `correlationId` de la alerta, UI o auditoría.
3. Buscar en logs backend por `correlationId` y confirmar `gitSha`, `buildId`, `deployEnv`.

## Diagnóstico

1. Validar que `OPENAI_API_KEY` esté configurada y vigente.
2. Revisar `status` de `openai_request_failed` y `ai_request_failed`.
3. Comparar contra la release anterior usando `gitSha` y `buildId`.
4. Si el error es 401/403, validar tokens Firebase y reglas CORS.
5. Si el error es 429/5xx, activar degradación y comunicar latencia/proveedor.

## Mitigación

- Para SEV1/SEV2, pausar despliegues y ejecutar checklist de rollback.
- Si la clave falta, restaurar secreto `OPENAI_API_KEY` y redeploy de Functions.
- Si el proveedor está degradado, bajar uso, limitar prompts y activar mensaje de IA no disponible.

## Cierre

- Documentar `correlationId`, `gitSha`, causa raíz, duración e impacto.
- Crear acción preventiva con owner y fecha.

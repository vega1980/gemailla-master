# Radiografía del repositorio GEMAILLA AI

Fecha de corte: 2026-06-18.

## 1. Resumen ejecutivo

GEMAILLA AI es una aplicación web estática construida con React 18 y Vite, con Firebase como backend principal para autenticación, datos, almacenamiento, hosting y funciones server-side. El repositorio está orientado a una arquitectura incremental: conserva fachadas públicas estables mientras migra lógica de negocio hacia módulos por dominio, servicios de feature e infraestructura Firebase.

El producto cubre módulos empresariales como dashboard, documentos, ERP, auditoría, IA, compañías, actividad, suscripciones, predicción, finanzas, panel cliente, operaciones, CRM y recursos humanos. La mayor atención arquitectónica actual se concentra en multiempresa, reglas de seguridad, flujo documental sin URLs públicas persistidas e IA protegida mediante backend.

## 2. Stack y herramientas

| Capa | Tecnología principal | Evidencia en el repositorio |
| --- | --- | --- |
| Frontend | React 18, Vite 6, React Router 6 | `package.json`, `src/app/App.jsx`, `src/app/routes.jsx` |
| UI | Tailwind CSS, Radix UI, componentes internos | `tailwind.config.js`, `src/components/ui/` |
| Estado/datos cliente | TanStack Query, contextos React | `src/app/providers.jsx`, `src/lib/query-client.js` |
| Backend gestionado | Firebase Auth, Firestore, Storage, Hosting | `firebase.json`, `firestore.rules`, `storage.rules` |
| Backend propio | Firebase Cloud Functions v2 para IA | `functions/index.js` |
| Validación | Zod, scripts de entorno | `src/shared/validation/`, `scripts/validate-env.js` |
| Testing | Node test runner, Firebase emulators, Playwright | `tests/`, `playwright.config.js`, scripts npm |

## 3. Métricas rápidas del árbol versionado

> Recuento calculado excluyendo `node_modules` dentro de `functions/`.

| Área | Archivos | Líneas aproximadas relevantes |
| --- | ---: | ---: |
| `src/` | 205 | 21.274 |
| `functions/` | 5 | 611 |
| `tests/` | 11 | 1.584 |
| `docs/` | 12 | 1.005 |

Extensiones principales detectadas: 146 archivos `.jsx`, 70 `.js`, 13 `.md`, 10 `.json`, 6 `.mjs`, 2 `.ts`, 2 `.css`, 2 `.rules`, además de fixtures y assets públicos.

## 4. Mapa de directorios

```text
src/app/                         # composición de providers, router y shell de rutas
src/pages/                       # páginas públicas de módulos de negocio
src/modules/                     # módulos por dominio en transición
src/features/                    # servicios y flujos por feature
src/infrastructure/firebase/     # cliente Firebase, repositorios, Storage y mutaciones
src/lib/                         # fachadas/contexts históricos y utilidades transversales
src/components/                  # layout, auth, UI base y componentes de negocio
tests/rules/                     # pruebas de reglas Firestore/Storage
tests/unit/                      # pruebas unitarias de políticas y contratos críticos
tests/e2e/                       # flujos Playwright críticos
functions/                       # Cloud Function `ai` y servicios backend auxiliares
docs/                            # arquitectura, verificación, observabilidad y runbooks
```

## 5. Arquitectura de aplicación

La entrada principal compone providers globales y rutas protegidas. `AppProviders` monta el boundary de errores, autenticación, TanStack Query, router y toaster. Las rutas de negocio se cargan con `lazy`/`Suspense`, lo que reduce el coste inicial y aísla la carga por módulo.

La app distingue:

- rutas públicas: actualmente `/`, con pantalla de acceso requerido;
- rutas protegidas: módulos empresariales bajo `ProtectedRoute` y `AppLayout`;
- fallback global: página 404.

Los módulos protegidos actuales incluyen dashboard, documentos, ERP, auditoría, asistente IA, compañías, actividad, suscripciones, análisis predictivo, finanzas, cliente, operaciones, CRM y RR. HH.

## 6. Dominios funcionales identificados

| Dominio | Ubicación principal | Observaciones |
| --- | --- | --- |
| Autenticación | `src/modules/auth/`, `src/components/auth/`, `src/lib/AuthContext.jsx` | Combina provider histórico con páginas y guards. |
| Compañías / multiempresa | `src/modules/companies/`, `src/features/companies/` | Servicios de membresía, rol y empresa activa. |
| Documentos | `src/modules/documents/`, `src/features/documents/`, `src/infrastructure/firebase/storage/` | Flujo controlado de metadata + Storage; foco fuerte de seguridad. |
| IA | `src/modules/ai/`, `functions/`, `src/pages/AIAssistant.jsx` | Endpoint server-side `/api/ai`; evita claves en frontend. |
| Auditoría/actividad | `src/modules/audit/`, `src/lib/auditLogger.js`, `src/pages/ActivityLog.jsx` | Soporta trazabilidad y mutaciones auditables. |
| Finanzas/ERP/CRM/HR/Operaciones | `src/modules/*`, `src/components/*` | Módulos funcionales con UI y lógica por área. |
| Observabilidad | `src/lib/observability.js`, `docs/observability/`, runbooks | Existe política documental y pruebas unitarias. |

## 7. Backend, seguridad y datos

Firebase es el backend primario. `firebase.json` configura Hosting sobre `dist`, rewrites SPA y rewrite `/api/ai` hacia la función `ai`, además de reglas e índices de Firestore, reglas de Storage y emuladores para auth, firestore, storage, hosting, functions y UI.

El modelo de datos documentado se centra en colecciones como:

- `users/{uid}`;
- `companies/{companyId}`;
- `companyMembers/{companyId}_{uid}`;
- `documents/{documentId}`;
- `auditLogs/{logId}`;
- `transactions/{id}`;
- `subscriptions/{id}`;
- `predictionLogs/{id}`;
- `aiConversations/{id}`.

Las reglas de seguridad y el flujo documental son piezas críticas: los documentos se crean primero en Firestore en estado `uploading`, luego se sube el binario a Storage bajo una ruta multiempresa, y finalmente se actualiza la metadata a `pending`. El cliente no debe persistir URLs públicas; debe persistir `storagePath`.

## 8. IA y Cloud Functions

La función `ai` valida CORS, token Firebase Auth, acceso a compañía y límites de uso antes de llamar al proveedor LLM. Incluye límites por frecuencia, tokens diarios, presupuesto diario estimado, reserva de tokens de salida, correlación de logs y redacción de datos sensibles.

Puntos positivos:

- la clave `OPENAI_API_KEY` se define como secret de Functions;
- el frontend usa `/api/ai` y no expone secretos;
- hay validación de origen, rate limit y presupuesto;
- hay logs estructurados con sanitización.

Riesgos a vigilar:

- mantener sincronizados los límites configurables con costes reales del modelo usado;
- asegurar que los documentos solicitados por IA respeten siempre membresía/rol;
- evitar crecimiento indefinido de colecciones de uso si no hay retención o jobs de limpieza.

## 9. Calidad, pruebas y operaciones

Scripts principales disponibles:

```bash
npm run lint
npm run typecheck
npm run typecheck:core
npm run build
npm run test:unit
npm run test:rules
npm run test:rules:emulators
npm run test:e2e
npm run test:e2e:emulators
npm run validate:env
npm run validate:env:functions
npm run validate:env:all
```

Cobertura observada:

- unit tests para endpoint IA, política de observabilidad y reglas de Storage estáticas;
- tests de reglas Firestore/Storage con Node test runner y emuladores;
- E2E Playwright para flujos críticos integrados;
- documentación operativa con runbooks de rollback, incidentes de IA y carga documental.

## 10. Fortalezas

1. Arquitectura Firebase coherente para una SPA empresarial.
2. Separación incremental entre app, features, infraestructura y fachadas legacy.
3. Buen foco en seguridad documental: metadata, Storage path, MIME, tamaño, claims y ausencia de URLs públicas persistidas.
4. IA correctamente desplazada al backend con secrets, CORS, auth, cuotas y presupuestos.
5. Presencia de pruebas en varias capas: unitarias, reglas y E2E.
6. Documentación operativa superior a la media: arquitectura, estabilización, observabilidad y runbooks.

## 11. Deuda técnica / riesgos

| Riesgo | Impacto | Recomendación |
| --- | --- | --- |
| Doble organización `pages/` + `modules/` + fachadas legacy | Puede dificultar encontrar ownership real | Definir matriz de ownership y migración por dominio. |
| Contextos históricos en `src/lib/` | Riesgo de acoplamiento transversal | Mantenerlos como fachadas y mover lógica a features/infrastructure. |
| Reglas Firebase críticas | Cambios pequeños pueden abrir datos multiempresa | Exigir tests de reglas en CI antes de deploy. |
| E2E dependiente de emuladores | Puede fallar por entorno, Java o descargas Firebase | Cachear emuladores/JAR y documentar requisitos CI. |
| Función IA concentra muchas responsabilidades | Puede crecer en complejidad | Continuar extrayendo servicios en `functions/services/`. |
| Dependencias UI numerosas | Bundle y mantenimiento | Auditar uso real y lazy loading por módulo. |

## 12. Próximas acciones sugeridas

### Prioridad alta

1. Ejecutar en CI `npm run lint`, `npm run typecheck:core`, `npm run test:unit`, `npm run test:rules:emulators` y `npm run build`.
2. Añadir una matriz de ownership por dominio en `docs/` para clarificar responsables lógicos.
3. Revisar reglas Firestore/Storage ante cada cambio documental o multiempresa.
4. Validar que `/api/ai` queda cubierto por pruebas de autorización negativa y cuota.

### Prioridad media

1. Reducir imports directos hacia fachadas legacy desde módulos nuevos.
2. Documentar contratos de repositorios Firebase en `src/infrastructure/firebase/repositories/`.
3. Crear checklist de migración para mover páginas desde `src/pages/` a `src/modules/` sin romper rutas.
4. Medir bundle por ruta y detectar módulos pesados.

### Prioridad baja

1. Normalizar nomenclatura bilingüe si el producto busca consistencia internacional.
2. Añadir diagramas Mermaid por dominio crítico: auth, documentos, IA y auditoría.
3. Revisar dependencias visuales no usadas.

## 13. Diagnóstico final

El repositorio está en una fase de estabilización/maduración: no parece un prototipo simple, sino una base empresarial con varios módulos y decisiones de seguridad importantes ya documentadas. La prioridad no debería ser añadir más superficie funcional, sino consolidar límites de dominio, asegurar CI reproducible con emuladores, mantener reglas Firebase cubiertas por tests y completar la migración incremental desde fachadas legacy hacia servicios por feature.

---
applyTo: "src/lib/**"
description: "Instructions for cross-cutting infrastructure in src/lib, including contexts, observability, audit logging, and query utilities."
---

When editing `src/lib/**`:

- Keep this layer cross-cutting and infrastructure-focused. Do not place feature-specific business rules here.
- Preserve stable public contracts used by the app, especially shared contexts and query helpers.
- Prefer using existing observability helpers for logging and correlation (`observability` and policy helpers) instead of introducing ad hoc logging patterns.
- Avoid adding direct Firebase SDK access in this layer when an infrastructure adapter already exists under `src/infrastructure/firebase/`.
- Keep company-scoped and auth-scoped flows explicit in context providers; fail safely when user or company context is missing.
- Keep React Query defaults and query-key builders centralized; avoid duplicating query key logic in unrelated files.
- Keep exports and behavior backward compatible unless a migration is explicitly included.
- If you change shared context shape, update all consumers in the same change.
- If you change observability payload shape, preserve sanitization and release metadata propagation.

Useful references:

- [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)
- [docs/PLAN_REFACTOR_4_FASES.md](docs/PLAN_REFACTOR_4_FASES.md)
- [AGENTS.md](AGENTS.md)
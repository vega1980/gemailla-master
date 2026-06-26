---
applyTo: "src/modules/**"
description: "Instructions for screen composition, module entry points, and route-facing UI under src/modules."
---

When editing `src/modules/**`:

- Treat this layer as screen composition and module entry points, not reusable business logic.
- Keep domain rules, validations, and side-effectful use-cases in `src/features/`.
- Keep Firebase adapters and persistence helpers in `src/infrastructure/`.
- Keep shared primitives, constants, and contracts in `src/shared/`.
- Preserve lazy-loaded route entry points and module boundaries.
- Prefer composing feature services, hooks, and shared UI components over duplicating behavior inside a module page.
- Keep module pages thin: read state, wire actions, render UI, and delegate work.
- Maintain compatibility with the existing route map and public facades.
- If a module needs new backend access, add or extend the underlying feature or infrastructure layer first.
- If a module change affects company-scoped data, ensure the feature or infrastructure layer validates `company.id` before any write.

Useful references:

- [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)
- [docs/PLAN_REFACTOR_4_FASES.md](docs/PLAN_REFACTOR_4_FASES.md)
- [AGENTS.md](AGENTS.md)
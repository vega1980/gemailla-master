---
applyTo: "src/pages/**"
description: "Instructions for legacy route pages and page-to-module migration boundaries under src/pages."
---

When editing `src/pages/**`:

- Treat this layer as route-facing pages, including legacy pages and temporary migration wrappers.
- Prefer thin page composition: fetch state, wire actions, render UI, and delegate reusable business logic to `src/features/`.
- Prefer moving reusable screen implementations into `src/modules/` and re-exporting from `src/pages/` during migration.
- Keep route compatibility stable while migrating pages; avoid breaking existing route paths or page exports.
- Do not add new Firebase adapter logic in pages; use `src/infrastructure/` through existing APIs and feature services.
- Keep company-scoped writes guarded through feature or infrastructure logic before any side effects.
- If a page is converted to a module, preserve the page entry point as a wrapper export unless routes are updated in the same change.
- Keep shared UI and contracts in `src/components/` and `src/shared/`; avoid domain-specific duplication inside pages.
- If a page contract changes, update route wiring and direct consumers in the same change.

Useful references:

- [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)
- [docs/PLAN_REFACTOR_4_FASES.md](docs/PLAN_REFACTOR_4_FASES.md)
- [AGENTS.md](AGENTS.md)
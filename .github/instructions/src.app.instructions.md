---
applyTo: "src/app/**"
description: "Instructions for top-level app composition, providers, and route orchestration under src/app."
---

When editing `src/app/**`:

- Treat this layer as the single composition point for providers, routing, and app shell wiring.
- Keep business logic out of this layer; delegate domain behavior to `src/features/`, `src/modules/`, or `src/lib/` as appropriate.
- Keep one authoritative route definition in `src/app/routes.jsx`; do not create a parallel router.
- Preserve the public/protected route split and the layout nesting contract used by the app.
- Keep provider composition centralized in `src/app/providers.jsx` and avoid scattering global providers elsewhere.
- Keep `src/app/App.jsx` thin: compose providers, mount routes, and render fallbacks.
- Maintain lazy loading and loading-state behavior for routed screens unless a coordinated routing change is intended.
- Preserve compatibility with stable public facades and existing route paths unless a migration plan is included.
- If a provider value or route contract changes, update all direct consumers in the same change.

Useful references:

- [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)
- [docs/PLAN_REFACTOR_4_FASES.md](docs/PLAN_REFACTOR_4_FASES.md)
- [AGENTS.md](AGENTS.md)
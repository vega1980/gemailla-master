---
applyTo: "src/shared/**"
description: "Instructions for shared contracts, constants, schemas, hooks, and reusable barrels under src/shared."
---

When editing `src/shared/**`:

- Treat this layer as reusable contracts and shared primitives with no single domain owner.
- Keep `src/shared/constants` and `src/shared/validation` framework-agnostic where practical.
- Prefer shared enums, constants, and schemas over duplicated literals across features or modules.
- Keep shared schemas backward compatible unless a coordinated migration is included.
- Avoid importing feature-specific business logic into this layer.
- Keep shared barrels (`index.js`) stable and intentional; avoid accidental re-export churn.
- If adding a new shared primitive, ensure names are generic and reusable across domains.
- For collections and identifiers, align with existing central sources rather than redefining values.
- If a shared contract changes shape, update all known consumers in the same change.

Useful references:

- [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)
- [docs/PLAN_REFACTOR_4_FASES.md](docs/PLAN_REFACTOR_4_FASES.md)
- [AGENTS.md](AGENTS.md)
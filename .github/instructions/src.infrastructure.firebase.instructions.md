---
applyTo: "src/infrastructure/firebase/**"
description: "Instructions for Firebase adapters, repositories, storage helpers, and mutation middleware under src/infrastructure/firebase."
---

When editing `src/infrastructure/firebase/**`:

- Keep this layer infrastructure-only. Do not move UI, route, or feature business logic here.
- Prefer thin facades over deep abstractions. Preserve the existing export surface unless a change is explicitly required.
- Route Firestore work through repository helpers such as `createRepository` and `ENTITY_COLLECTIONS` instead of ad hoc collection strings.
- Keep audit metadata consistent. New writes should continue to use the audit middleware patterns already in place.
- Validate tenant-sensitive inputs early when this layer builds storage paths or document references.
- For Storage helpers, keep canonical path rules strict and reject public URLs or malformed internal paths.
- Avoid bypassing normalization and filter guards. If a query needs new filtering behavior, update the validation helper and its callers together.
- Do not import feature or module code into this layer.
- If a change affects persistence shape or Storage paths, update the matching rules or emulator tests as part of the same change.

Useful references:

- [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)
- [docs/PLAN_REFACTOR_4_FASES.md](docs/PLAN_REFACTOR_4_FASES.md)
- [AGENTS.md](AGENTS.md)
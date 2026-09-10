# 0.5.0 local release candidate

Plugin versions: K-Tech Radar 0.4.0, KGJ Design 1.3.0, Canvas Web Experiences 1.7.0. This document does not claim a GitHub release has been published.

- Radar uses OS user-data storage by default, retains explicit path overrides, adds an offline teaching demo and topic change briefs, and runs public tests against synthetic isolated data without network access.
- KGJ hardens stdio negotiation and shutdown, validates immutable history before recovery, makes read-only access fail closed without initialization, and adds hash-bound staged DNA previews and proportional refinement routing.
- Canvas adds stable DOM-first experience selection, standalone 2D/3D/map starters, a reproducible three-engine browser suite, and one canonical copy of each concept image.
- Common tooling adds redacted diagnostics, optional provenance metadata exchange, exact-commit deterministic packaging and installation checks, public-source safety checks, schema compatibility checks, onboarding and contributor/security documentation.

Compatibility: existing plugin identities, legacy manifests, and local stdio transport remain. Radar's default data location changes; preserve existing data and explicitly select its former location before any migration. KGJ refuses incomplete or invalid stores instead of silently repairing on reads. Recovery requires verified immutable history. Unknown or changed data schemas block automatic rollback.

Validation receipts are external artifacts tied to the final commit. Human first-use tests, native Safari/screen-reader checks, live Radar collection, and the new remote CI run remain separate gates. Remote MCP hosting and manifest-format migration remain conditional design decisions.

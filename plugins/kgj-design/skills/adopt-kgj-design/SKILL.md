---
name: adopt-kgj-design
description: Connect an existing Codex Desktop or CLI project to KGJ Design with a portable project contract, evidence registry, validated product DNA, and read-only readiness diagnostics. Use when onboarding a product, inspecting KGJ adoption, or preparing a governed implementation.
---

# Adopt KGJ Design

## Contract first

1. Inspect existing product flows, tokens, styles, assets, accessibility contracts, and local guidance.
2. If `kgj.design.json` exists, run `python scripts/kgj_design.py doctor <contract>` and preserve its
   product-owned paths and unresolved decisions.
3. If no contract exists and the user authorized adoption, run `init-project` with
   `--confirm-create`. Never overwrite an existing contract or design source.
4. Replace template assumptions with observed product evidence before changing state to `ready`.
5. Record evidence independently from decisions and mutations. Give each a stable evidence ID and
   accurate proof level.
6. Resolve lineage and compile tokens only after the contract passes. For a descendant DNA, persist the
   content-addressed lock and pass it to `compile --lineage-lock`; never compile a lineage child without it.

## Stop conditions

Hold when paths escape the project, linked files are missing, product IDs disagree, evidence hashes
drift, unresolved decisions remain in a `ready` contract, or a parent DNA is unavailable. Report the
exact hold reasons and do not silently downgrade them.

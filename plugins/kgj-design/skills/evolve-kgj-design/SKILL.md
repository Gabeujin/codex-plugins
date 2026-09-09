---
name: evolve-kgj-design
description: Govern a KGJ Design mutation across tokens, components, patterns, DNA packs, documentation, or compatibility contracts. Use when proposing, testing, adopting, deprecating, migrating, or versioning a design-system change rather than designing a single surface.
---

# Evolve KGJ Design

Read [evolution governance](../../references/evolution-governance.md),
[token system](../../references/token-system.md), and
[source adaptation records](../../references/source-adaptation-records.md).

## Treat change as a mutation

Define the observed product pressure, affected lineage, current workaround, proposed mutation, owner,
consumers, compatibility risk, and evidence. Classify the change as genome, allele, expression rule,
component, pattern, or tooling. A DNA pack may change values and declared assets; it may not silently
change semantics, focus, keyboard behavior, content rules, or state transitions.

## Choose the smallest level

Prefer a product-local pattern until reuse is proven. Promote to shared component only when distinct
contexts demonstrate the same semantic job and an existing primitive cannot express it. Use bounded
variants or composition before forks; name and own a true fork when behavior has materially diverged.

## Trial, adopt, or hold

Record baseline, success and guardrail metrics, target window, rollback, migration, deprecation, and
compatibility tests. Use `experimental -> candidate -> stable -> deprecated -> removed`. Resolve parent
DNA to a lock, pass that lock to compilation, run `diff-dna`, and generate a migration plan before a
change. Keep the migration on hold until a named owner, rollback target, verified evidence registry,
and all seven required migration claims are bound: conversion, behavior preservation, differential
probe, browser regression, rollback rehearsal, lineage impact, and genome review.
`ready-for-canary` is not a production release.
Route shared-pattern admission to `govern-design-patterns`. Preserve append-only lineage receipts and
explicit supersession. If source cases or local evidence are not comparable, hold instead of forcing adoption.

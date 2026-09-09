# KGJ Design architecture

## Thesis

KGJ Design is a lineage, not a look. Products share a trustworthy semantic genome and may express it
through different visual, verbal, spatial, and interaction traits. A descendant should feel related
without becoming a reskinned copy.

## Layers

```text
product evidence and local Dictionary
  -> portable project contract
  -> typed evidence graph
  -> invariant semantic genome and resolved lineage lock
  -> foundation / semantic / component token graph
  -> product DNA expression pack
  -> primitives and components
  -> domain patterns and product flows
  -> web / HTML report / Markdown / spatial phenotype
  -> verification, mutation, compatibility diff, migration plan, and release ledger
```

### 1. Project contract and product evidence

The `kgj.design.json` handshake identifies the product, owner, surfaces, themes, locales, DNA,
generated tokens, evidence registry, evidence root, and unresolved decisions. Facts about users,
tasks, risk, data, content, runtime, constraints, and observed friction remain separate typed evidence records. User-stated
preferences, explicit rejections, experiments, and verified outcomes may be retrieved from the local
KGJ Dictionary. Evidence remains scoped and provenance-carrying.

### 2. Invariant genome

Stable meaning and behavior: semantic roles, state transitions, focus and keyboard contracts,
accessibility, content guarantees, locale behavior, data truth, permission boundaries, and failure
recovery. A DNA pack cannot override these.

### 3. Token graph

Foundation values feed stable semantic aliases; component-owned tokens narrow those aliases inside a
component. Product code consumes semantic or component tokens, never raw foundation values.

### 4. Product DNA expression pack

Product-owned values and declared assets for typography, palette, density, spacing rhythm, shape,
depth, motion character, illustration, voice, and signature moments. The pack expresses semantic
roles; it does not rename their meaning.

### 5. Components

Behavior-bearing primitives with typed variants and bounded composition points. They own semantics,
states, accessibility, and component tokens. A component is not admitted merely because markup repeats.

### 6. Domain patterns

Task compositions that preserve domain truth: operational review, decision support, onboarding,
evidence inspection, mapping, editing, or reporting. Product flows remain product-owned when a shared
abstraction would distort expertise, density, regulation, or error cost.

### 7. Phenotypes

The rendered result for its medium. Web UI is interactive and stateful; an HTML report is editorial
and printable; Markdown must survive plain text; a spatial renderer separates semantic DOM from the
scene. All derive from one lineage but need not share the same composition.

### 8. Governance

Every mutation names its evidence, owner, consumers, compatibility effect, experiment, success,
rollback, review date, and supersession. Parent DNA files resolve into a content-addressed lock before
compilation, and lineage compilation requires that exact current lock. Compatibility diffs classify
semantic or component changes as breaking and generate a conversion/preservation/differentiation/canary
migration plan. The plan remains on hold until its owner, rollback target, and seven required evidence
claims resolve to active, passing, locally hashed records: conversion, behavior preservation,
differential probe, browser regression, rollback rehearsal, lineage impact, and genome review.
Production claims bind deterministic checks
to real runtime or browser evidence.

The local MCP boundary publishes explicit safety hints for every tool. Read tools are closed-world and
non-mutating; write tools are closed-world, additive, and idempotent for an identical request key. The
catalog is fail-closed: adding a tool without a safety classification prevents server startup. Hints guide
Codex approval UX but do not replace confirmation fields, revision fencing, privacy filters, or immutable
ledger verification. Plugin release evidence includes a new ephemeral Codex task that invokes only the
static ontology and binds the successful structured result to the exact installed release.

## Inheritance boundary

| Classification | Meaning | Examples |
|---|---|---|
| Inherit | Stable across descendants | semantic state, focus, data truth, evidence labels |
| Translate | Same intent, medium-specific expression | navigation in web versus report contents |
| Re-derive | Product must own the answer | signature color, density, editorial voice, imagery |
| Forbid | Would erase identity or safety | copied branding, raw-token leaks, hidden essential data |

## Success test

Two products should be able to share the genome and verification suite, use different DNA packs, and
retain their own workflow, language, data interpretation, and signature moments without forks or
accessibility regressions.

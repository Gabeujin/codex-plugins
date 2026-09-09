---
name: canvas-runtime-architecture
description: Design scalable Canvas runtime architecture for state, scene projection, rendering, input, workers, GPU resources, streaming, collaboration, persistence, export, observability, and cleanup. Use for performance-sensitive or long-lived 2D, 3D, game, map, diagram, CAD/BIM, and HTML-in-Canvas applications.
---

# Canvas Runtime Architecture

Make the product model survive renderer changes, browser experiments, large scenes, and long sessions.

## Required references

Read:

- `../../references/architecture-patterns.md`
- `../../references/domain-routing.md`

For experimental capture, also read `../../references/early-adopter-playbook.md`.

## Workflow

### 1. Inventory invariants and scale

Record domain objects, stable IDs, maximum scene/data sizes, coordinate units, persistence, collaboration, undo, export, offline, browser/device targets, and performance budgets. Inspect the existing framework and renderer lifecycle before proposing replacements.

### 2. Draw explicit boundaries

Define:

- durable product/document/game state;
- transient interaction state;
- scene projection and renderer-owned caches;
- input and gesture normalization;
- DOM accessibility bridge;
- asset and GPU-resource manager;
- worker protocol and cancellation;
- history/collaboration/persistence;
- export and observability.

Avoid making library scene objects the only source of truth for persistent products.

### 3. Choose update semantics

Select immediate or retained rendering, full or incremental projection, fixed or variable simulation step, event or frame invalidation, and main-thread or worker execution. Explain why. Keep high-frequency values in engine state or mutable references when reactive state would rebuild the app unnecessarily.

### 4. Specify lifecycle and failure

Cover initialization after the client host exists, DPR-aware resize, visibility pause, route transitions, hot reload, asset cancellation, listener/observer teardown, worker termination, GPU disposal, context/device loss, and rehydration.

For HTML-in-Canvas, isolate method detection, snapshot/paint readiness, meaningful-change update coalescing, measured transform sync, stable changed-element IDs, transferable ownership, failure classification, resource retirement, fallback, telemetry, and kill switch inside the adapter.

### 5. Define coordinate contracts

Name client, viewport, device, world, local, model, geographic, tile, and texture spaces. Make conversions testable. Establish units, precision, local origins, projection, snapping tolerances, and world-to-DOM overlay synchronization.

### 6. Budget and profile

Set representative budgets for frame time, input latency, memory growth, draw calls, geometry/sprite counts, texture upload, startup, and bundle size. Use dynamic imports for heavy optional paths. Add batching, culling, LOD, tiling, instancing, workers, or DPR adaptation only in response to evidence.

### 7. Produce an ADR

Use `../../assets/templates/canvas-architecture-decision.md`. Include:

- context and decision;
- alternatives with rejection evidence;
- data and control flow;
- resource ownership;
- browser/accessibility/fallback contract;
- performance and observability plan;
- migration, rollback, and kill criteria;
- verification commands and real-browser evidence needed.

## Stop condition

Do not finalize an architecture when license, coordinate precision, collaboration consistency, or controlled-browser requirements are unknown and materially alter the decision. Report the exact missing evidence and a reversible spike that can obtain it.

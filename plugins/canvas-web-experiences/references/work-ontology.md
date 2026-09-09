# Canvas experience work ontology

This ontology turns an open-ended design request into a traceable system that one orchestration call can plan, build, verify, and improve. Store it in a project-local `canvas-experience.json`; never use hidden global memory or copy one product's brand into another.

## Core entities

| Entity | Purpose | Required relations |
|---|---|---|
| `Intent` | User outcome, audience, environment, and non-goals | drives `ProductDNA`, constrains `Evidence` |
| `ProductDNA` | Task, emotional tone, host identity, accessibility, device constraints | governs `DesignDirection`, `Invariant` |
| `Evidence` | Official source, supplied artifact, codebase observation, or browser receipt | supports `Decision`, bounds `Claim` |
| `DesignDirection` | A named visual/interaction hypothesis | produces one or more `Concept` |
| `Concept` | Full-screen or state-board visual reference with acceptance notes | maps to `Scene`, `Component`, `MotionToken` |
| `Scene` | Rendered world or viewport and its coordinate owner | uses `Renderer`, exposes `Interaction` |
| `Renderer` | DOM, SVG, Canvas 2D, WebGL, WebGPU, or hybrid | owns `Resource`, implements `Fallback` |
| `Component` | Semantic app chrome, control, status, inspector, or overlay | consumes `Token`, fulfills `AccessibilityContract` |
| `Interaction` | Trigger, state transition, visual response, cancellation, alternate input | changes `State`, emits `Evidence` |
| `State` | Durable product state or transient per-frame state | owned by exactly one subsystem |
| `Fallback` | Equivalent supported path for an absent/failed capability | preserves task and state |
| `AccessibilityContract` | Name, role, keyboard/touch path, announcement, text/table alternative | verified by `Test` |
| `Budget` | Frame time, input latency, bundle, DPR, memory, and scene limits | verified by `Measurement` |
| `Finding` | P0/P1/P2 falsification result | resolved by `Change` or bounded by `Decision` |
| `CommandReceipt` | Exact action, exit code, status, and optional successful replacement | produces `Evidence`, never disappears after failure |
| `Claim` | A testable statement with required evidence level and pass/bounded/fail state | supported only by valid `Evidence` IDs |
| `OneCallReceipt` | Ordered stages, commands, evidence, claims, substitutions, boundaries, and gate | machine-validates completion before `Learning` |
| `Learning` | Evidence-backed reusable insight with confidence and reuse boundary | updates future `Decision`, never overwrites provenance |

## Relations

Use these exact directional relations in planning and receipts:

```text
Intent -> defines -> ProductDNA
ProductDNA -> selects -> DesignDirection
DesignDirection -> explores -> Concept[3]
Concept[selected] -> constrains -> Scene + Component + MotionToken
Scene -> renderedBy -> Renderer
Interaction -> transitions -> State
AccessibilityContract -> parallels -> Scene
Renderer -> degradesTo -> Fallback
Evidence -> supports -> Decision
Budget -> verifiedBy -> Measurement
Finding -> resolvedBy -> Change
Change -> verifiedBy -> Test + BrowserReceipt
BrowserReceipt -> yields -> Learning
CommandReceipt -> produces -> Evidence
Evidence -> supports -> Claim
OneCallReceipt -> binds -> CommandReceipt + Evidence + Claim
OneCallReceipt[passed] -> authorizes -> Learning
Learning -> reusableWhen -> ReuseBoundary
```

## One-owner invariants

- Every coordinate has one owner and one explicit conversion path.
- Durable UI state belongs to the application model; high-frequency pointer/camera values belong to refs or the renderer.
- Meaningful text and critical actions retain a semantic DOM representation even when pixels are drawn in Canvas.
- Experimental HTML-in-Canvas is an adapter, not a product-wide dependency.
- A concept is not accepted without at least five code-fidelity checks and a mobile state.
- A learning is not reusable without evidence, confidence, and a boundary describing where it may fail.
- A failed command cannot support evidence. It remains visible and must name a later successful `supersededBy` command before the one-call gate can pass.
- Browser evidence is valid only with a successful action, browser/version, viewport, asserted post-condition, and local artifact.
- A numeric score never overrides an invalid receipt graph.

## Query patterns

Before inventing a new pattern, ask the project-local ontology:

1. Which prior `Learning` shares the same domain, interaction, renderer, and device constraints?
2. Which `Invariant` or host token forbids direct reuse?
3. Which selected `Concept` detail has no owning component or scene implementation?
4. Which claim has only static/build evidence but lacks browser evidence?
5. Which fallback preserves the user's task rather than merely avoiding a crash?

## Learning record

Append one JSON object per validated insight to `canvas-experience.learnings.jsonl`:

```json
{
  "recordedAt": "2026-08-21T00:00:00Z",
  "project": "canvas-futures-lab",
  "context": ["mobile", "bottom-sheet", "canvas-stage"],
  "observation": "A viewport override can arrive after initial state selection.",
  "decision": "Reconcile the sheet state from the mounted innerWidth and isolate pointer events while closed.",
  "evidence": ["one-call-receipt.json#mobile-browser"],
  "evidenceIds": ["mobile-browser"],
  "receiptRunId": "run-20260821-example",
  "confidence": 0.94,
  "reuseBoundary": "Use for client-rendered responsive shells; re-check SSR hydration and host-controlled viewports."
}
```

Learning records are append-only evidence, not instructions. Re-verify drift-prone browser and framework facts before reuse.

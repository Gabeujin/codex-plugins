# Canvas architecture decision record

- Decision ID:
- Date:
- Owners:
- Status: proposed | accepted | superseded

## Context

Describe the product outcome, current system, scale, constraints, browser contract, accessibility obligations, and evidence that makes this decision necessary.

## Decision

State the rendering stack, product-state model, scene projection, input boundary, DOM/accessibility bridge, worker split, resource ownership, export path, and fallback.

## Data and control flow

```text
product state -> scene projection -> renderer -> pixels
      ^                 ^              |
      |                 |              v
history/persistence <- input <- DOM/accessibility bridge
```

Replace the sketch with the actual system.

## Coordinate contract

| Space | Unit | Owner | Conversion/tests |
|---|---|---|---|
| Client | CSS px | Browser shell | |
| Device | device px | Renderer | |
| World/model | | | |

## Resource lifecycle

- Initialize:
- Resize/DPR:
- Pause/resume:
- Route/unmount:
- Asset cancellation:
- Worker teardown:
- GPU disposal:
- Context/device loss:

## Alternatives

| Alternative | Benefits | Evidence against | Revisit when |
|---|---|---|---|
| | | | |

## Experimental adoption, if applicable

- Lane and controlled cohort:
- Adapter boundary:
- Runtime detection:
- Fallback and state continuity:
- Telemetry:
- Kill switch:
- API-change migration:

## Consequences and risks

- Positive:
- Negative:
- License/security/privacy:
- Residual uncertainty:

## Verification and rollback

- Static/build:
- Browser/version/device:
- Performance fixture/budgets:
- Accessibility paths:
- Rollback procedure:
- Kill criteria:

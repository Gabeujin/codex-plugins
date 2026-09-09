# HTML-in-Canvas early-adopter playbook

The goal is not to wait for universal support. The goal is to exploit the new interaction surface quickly while keeping the experiment measurable, replaceable, and safe.

## Adoption lanes

### Lane 0 — capability spike

Use for one- to three-day feasibility work.

- Pin the tested Chrome channel and version.
- Pin the WICG commit and date, record the live Chrome Status result, and list relevant issue deltas since the previous release.
- Record the required flag or origin-trial enrollment.
- Record the DevTools Application-panel origin-trial validity result without copying the token value, plus `typeof` results for every required method.
- Implement one high-value interaction, not a full product migration.
- Prove the exact renderer overload and CSS behavior in a real browser.
- Compare with the best conventional DOM-overlay or texture pipeline.

Exit evidence: a screen recording or screenshots, browser/version receipt, feature-detection result, measured update cost, known constraints, and a recommendation.

### Lane 1 — internal preview

Use for design teams, labs, demos, and controlled staff environments.

- Isolate the feature behind an adapter and runtime flag.
- Keep a fully usable DOM or conventional texture fallback.
- Log activation, fallback reason, capture failure, frame cost, and context loss.
- Keep animation-only pixels in the renderer; request a new DOM snapshot only for meaningful semantic changes.
- Test keyboard, focus, pointer, scroll, Korean/RTL text, animation, CSS resize/DPR, nested canvas behavior, transformed hit targets, and same-/cross-origin descendants.
- Document how to disable the feature without rebuilding.

Exit evidence: successful target-browser sessions, no unresolved P0/P1, bounded performance cost, and a tested kill switch.

Do not advance a lane from screenshots or capability presence. Require `command → exact call receipt → measured alignment → task postcondition`, and preserve failed actions until a successful replacement explicitly supersedes them.

### Lane 2 — opt-in audience

Use for beta cohorts who accept browser constraints.

- Declare supported browser/channel requirements at the entry point.
- Gate activation by both cohort flag and runtime capability.
- Verify the origin-trial status in DevTools and then exercise the exact overload; token validity or method presence alone is insufficient.
- Preserve user state across experimental-to-fallback switching.
- Retire paint listeners, RAF, textures, workers, and in-flight transferable ownership on loss before showing recovery as complete.
- Monitor fallback rate, errors, latency, frame pacing, memory growth, and task completion.
- Provide a user-visible escape hatch when the experiment becomes unstable.

Exit evidence: cohort metrics, fallback equivalence, support playbook, privacy review, and rollback rehearsal.

### Lane 3 — production enhancement

Use only as progressive enhancement while standards and browser signals remain unsettled.

- Never make experimental pixels the sole path to critical content or transactions.
- Keep the adapter narrow enough to replace when IDL changes.
- Verify every supported release channel, not just Canary.
- Re-check Chrome Status, the WICG explainer, WHATWG activity, origin-trial status, and framework integration before each release.
- Record each resize, nesting, RTL, hit-test, and privacy fixture as `passed`, `failed`, `bounded`, or `unmeasured`; do not turn a missing fixture into a support claim.
- Define a sunset condition for both the experiment and its fallback.

## High-value experiments

Prioritize cases where native HTML materially improves an existing Canvas/WebGL workflow:

- live forms, media, rich text, selectable content, or accessible controls on 3D surfaces;
- DOM-designed cards, labels, and dashboards used as GPU textures;
- responsive HTML prototypes composited with shaders or particle systems;
- interactive product configurators and spatial portfolios;
- world-space UI in games, digital twins, BIM/CAD review, maps, and control rooms;
- user-generated HTML content rendered into a controlled visual surface.

Never treat Canvas capture as sanitization, isolation, or a sandbox. For user content, render a trusted data model or sanitized DOM under a restrictive CSP; do not allow untrusted scripts, event-handler attributes, or uncontrolled iframe content. Test resource origins and export taint separately.

Do not spend the experiment budget on content that a normal DOM overlay already handles with less complexity.

## Adapter contract

Expose product intent, not raw experimental calls:

```ts
type HtmlSurfaceResult =
  | { mode: "native-html-capture"; dispose(): void }
  | { mode: "dom-overlay"; dispose(): void }
  | { mode: "raster-fallback"; dispose(): void };
```

The implementation may use `drawElementImage`, `texElementImage2D`, or `copyElementImageToTexture`, but product code should depend on an adapter such as `attachInteractiveSurface()` or `createHtmlTexture()`. Keep feature detection inside that boundary.

## Experiment brief

Before coding, answer:

1. What becomes possible or substantially better?
2. Which target Chrome channel/version is controlled?
3. What is the exact conventional fallback?
4. Which interaction, accessibility, privacy, and performance assumptions could fail?
5. What evidence advances the experiment to the next lane?
6. What metric or incident activates the kill switch?

Use `../assets/templates/canvas-feature-brief.md` to record the decision.

## Release revalidation receipt

Every release receipt must include the tested Chrome version/channel, activation boundary, WICG commit/date, Chrome Status lookup date/result, open-issue delta, exact overload receipt, first-paint state, `requestPaint` capability and scheduling strategy, resize/DPR result, nesting result, RTL/corner result, transformed hit-test result, privacy fixture result, fallback continuity, kill-switch result, and console/resource teardown status. A field without current evidence is explicitly `unmeasured`.

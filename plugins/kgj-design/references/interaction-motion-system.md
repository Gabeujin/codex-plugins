# Interaction motion system

Conditional candidate guidance for controls and task flows, owned by KGJ Design maintainers. Use when
input changes content, selection, hierarchy, reading focus, or async status. Existing tokens, genome,
Dictionary, tools and closed release rubric remain unchanged. This does not promote a stable pattern.
Review or reverse it when it adds ceremony without catching a failure. Use
[spatial review](motion-and-spatial-review.md) for a scene or timeline.

## Start with the task and state

Interaction design determines what an input means. Interactive motion explains the resulting change.
A microinteraction confirms one bounded action. A motion system makes those choices consistent across
components. Specify them in that order; animation cannot repair an ambiguous state model.

| Transition field | Decision to make |
| --- | --- |
| Job and owner | User goal, authoritative state, stable object ID, current state |
| Trigger and guard | Pointer, touch, keyboard or system event; permission and validation prerequisites |
| Commit and feedback | Next state, immediate acknowledgement, what remains usable |
| Recipe | Intent, property, origin/direction, token aliases, enter/exit, sequencing |
| Access | Accessible name/value, focus destination/return, DOM order, committed announcement |
| Interruption | Rapid input, reversal, pointer cancellation, navigation, stale callbacks |
| Recovery and proof | Failure/retry/undo and an action with an observable post-condition |

Use the [worksheet](../data/templates/interaction-motion-spec.md) only when useful. A control change
needs its affected rows, not a new product contract or release ledger.

## Attach feedback to the action

- Acknowledge a press at its control without waiting for a request. Keep the hit target stable during
  a visual transform; pointer cancellation or drag-out must not activate the action.
- Keep a frequent next action predictable. A persistent footer must not cover content, errors, focus
  or the last scrollable line at narrow widths, zoom, or with the software keyboard.
- Give a busy control a meaningful name and prevent duplicate submissions according to the task
  contract. Preserve its footprint when replacing its label with a progress indicator.
- Emphasize the current reading step while retaining context and access to the full content. Do not
  remove required information, force a timed reading pace, or replay emphasis on every render.
- A review summary can preserve the identity of the inspected item. Keep the full item reopenable
  at the relevant location; a miniature image is not an accessible document.

## Compose recipes from existing roles

Use `motion.fast`, `motion.standard`, and `motion.easing`. Specify distance, origin, property, delay and
sequencing in the owning component. Raw timing/easing values belong in foundation tokens; new shared
roles follow normal evolution governance. An instant semantic update is behavior, not a new token.

| Synthetic recipe | Intent and expression | Completion and reduced-motion equivalent |
| --- | --- | --- |
| Press | Feedback at the control; small transform with `motion.fast` / `motion.easing` | Input accepted independently of the effect; static pressed/focused feedback |
| Detail entry/return | Orientation from a stable item anchor; `motion.standard` / `motion.easing` | Usable destination and focus; direct swap preserves heading, history and return |
| Reading-step change | Attention on one step; retain context and next action | User controls advancement; direct emphasis preserves readable content and step identity |
| Disclosure/review | Continuity from expanded item to summary | Correct expanded state, focus and DOM order without motion; closed content leaves tab order |
| Request pending/result | Feedback for the current request; reserve control/status geometry | Text names the actual stage; static status replaces loops; authoritative confirmation gates success |
| Multi-stage process | One stage owns each bounded visual sequence | Local stage completion differs from overall completion; readable stage text survives without animation |

Choose rhythm by frequency, travel, hierarchy and consequence. Repeated controls settle quickly; longer
travel may need orientation. Define enter/exit separately and avoid competing focal events. Do not delay
an action or readable error for a flourish. Prefer transform/opacity where suitable; profile painting
and layout costs before using blur or large masks. A recording cannot establish spring constants,
universal durations, internal tokens or performance guarantees.

## Treat interruption and async work as normal

- Derive labels, content, ARIA and motion targets from canonical state. Do not commit saves, unlock
  navigation, or release focus only in `transitionend`, `animationend`, or an animation promise.
- Reversible motion retargets from its current presentation. New input invalidates obsolete completion
  handlers. Handle cancelled animations and zero-duration paths without relying on an end event.
- For search/filter reads, bind responses to current query/request identity; exercise B-before-A
  delivery. For writes, define deduplication/idempotency and reconcile authoritative results. A
  search-style latest-result policy cannot hide an earlier write that may already have committed.
- Distinguish dismissing a view, aborting a client request and cancelling server work. Closing a view
  does not prove remote cancellation. Preserve and reconcile the outcome of an in-flight write.
- Optimistic changes need pending state and rollback/reconciliation. Retry cannot silently repeat a
  possibly committed write. Errors name the next safe action.
- Hidden or unmounted components release applicable timers, observers, listeners and pointer capture.
  Re-entry resumes or refreshes declared state; it cannot restart a write or accumulate loops.

## Reduced motion preserves the same task

Handle the initial setting and changes during motion. Remove unnecessary translation, zoom, parallax
and repeated pulses; provide a static or user-stepped equivalent. Do not just slow effects or apply a
global near-zero-duration hack. Preserve content, route, result, keyboard, focus and retry. Announce
meaningful committed changes, never every loading frame. Unsupported motion APIs fall back to the same
usable DOM state. A multi-stage process still names its actual stage.

## Inspect recordings without inventing implementation facts

Keep private references outside public source. Record identity and presentation timestamps (PTS), not
just nominal FPS. Decode the full sequence before selecting adjacent frames around changes. Locate
changes in contact sheets, then inspect decisive frames at original resolution. Record visually
inspected ranges and unreadable or absent intervals. Separate observation, interpretation, adaptation
and unverified behavior. Touch indicators or overlays may belong to the recorder.

Video supports geometry, emphasis, ordering and visible feedback. It cannot prove keyboard operation,
reduced motion, backend commit, physical input latency, exact easing or another device's frame rate.
Black/missing frames and a recording ending while busy cannot establish success or its cause. Do not
redistribute private recordings, screenshots, source copy or timestamps in a generalized guide. Use
new synthetic examples and public sources for transferable ideas.

## Verify affected behavior

| Probe | Falsifiable post-condition |
| --- | --- |
| Pointer, keyboard and supported touch | Same task outcome; visible focus, stable targets, no hover-only requirement |
| Open, close midway, open again | Final intent owns DOM/ARIA/focus; no stale callback, hidden tab stop or duplicate loop |
| B response before A; close pending view | Stale read cannot replace B or reopen the view; write outcome is reconciled |
| Rapid double submit, failure, retry | Declared idempotency policy; no false success or unsafe repeat |
| Reduced motion before load and mid-transition | Same content/result/return; no unnecessary movement or end-event dependency |
| Narrow, zoom, long text, software keyboard | Content, error and focused control remain readable and unobscured |
| Hide, return, unmount, remount | Correct re-entry state and bounded resources/request ownership |

Fix post-conditions before implementation. Run affected probes in the target browser/app and retain
source identity, input sequence, state and result. Mark unrun paths explicitly. Timing claims need the
metric, device, browser, interval and distribution. Screenshots prove neither continuity nor sustained
frame rate. In release work map state/data truth to round 1, interaction/accessibility to round 2 and
delivery identity to round 3. This adds no scored round or proof that a behavior passed.

Public influences: [Toss interaction design, 2025-05-30](https://toss.tech/article/interaction_simplicity)
supports device-appropriate controls and runtime prototypes; [Toss working prototypes, 2026-06-16](https://toss.tech/article/deadend)
supports evaluating motion in working code. Do not reproduce branding, native framework choices,
promotional flows or proprietary effects. KGJ's task-state rules above are synthesis.

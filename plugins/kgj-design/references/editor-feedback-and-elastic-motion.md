# Editor feedback and elastic motion

Conditional candidate guidance, owned by KGJ Design maintainers. Read for object creation, dragging,
duplication, deletion, toast visibility, or dialog entry/exit changes. Keep the task/state contract in
[interaction motion system](interaction-motion-system.md); this guide adds implementation failure
probes, not a second motion system. It changes no token, schema, permission, default style or release
rubric. Review or reverse a recipe when it distracts, obscures work, or costs more than it explains.

## Choose the expression within the product

Elastic or "jelly" motion can communicate material response and continuity in a creative editor.
Treat it as an opt-in product expression. A dense admin form, frequent typing, critical warning or
reduced-motion path may need static feedback or a short fade instead. Do not inherit another product's
palette, spring constants, durations, breakpoints or object-count thresholds as KGJ defaults.

Separate these owners before implementation:

| Owner | Contract |
| --- | --- |
| Document | Canonical coordinates, IDs, z-order, selection, history, permissions and persistence |
| Input | Hit targets, pointer capture, modifiers, snapping, keyboard and cancellation |
| Presentation | Temporary deformation, preview opacity, visual velocity and decorative lifetime |

A translucent insertion or duplicate preview must be distinguishable from committed content, then
settle into the actual object. Keep text, handles and guides legible. Deformation must not change the
pointer's semantic coordinate, saved geometry, export, Undo history or accessible focus. Velocity-based
stretch and release overshoot need bounded amplitude and settling time; do not claim physical fidelity
from an attractive spring. Prefer a stable input wrapper and a separate visual layer.

For large selections, consider one bounded composite proxy rather than one spring per child. Preserve
member offsets, clipping and z-order. Keep originals usable until the proxy is ready; once active,
name the single presentation owner and suppress duplicate painting where required. Retain the final
proxy until the authoritative draw acknowledges completion, then restore the canonical layer. A
duplicate operation may intentionally keep its source visible. A stale or failed capture must release the proxy
and restore the usable original scene. Do not flatten interleaved layers when their order would change.
Name pixel/byte/concurrency budgets and cleanup owners; a decoded-image cache budget is not total
browser or GPU memory. If composition is unsafe or unavailable, move normally without decoration.

For deletion, commit the recoverable document operation independently and animate an inert visual
copy only when safe. The copy does not register as another document object or duplicate interactive
DOM identifiers, hit targets, focus or live announcements; internal render references may remain. Undo,
navigation, failure and motion-off changes remove it without replaying a deletion or resurrecting data.

## Make entry and exit continuous

| Failure | Implementation decision | Falsifying probe |
| --- | --- | --- |
| Closing during entry jumps brighter or larger | Snapshot the current computed presentation; retarget relative to that pose rather than forcing a fully visible start | Close early, midway and after settling; inspect successive opacity and position samples |
| Spring opacity rebounds or flashes before removal | Use a monotonic opacity envelope, a separately damped shape curve, and one owner per property | Check that exit opacity never rises; inspect the frame between finish and unmount |
| Cancelling a finished exit reveals the base style | Retain the final transparent frame until actual removal; hand ownership back explicitly on reversal | Finish exit while removal is delayed; no visible base-style flash |
| Centered popups drift as scale changes | Separate placement translate/anchor from the animated transform; declare transform origin | Repeated open/close at narrow and wide widths keeps the anchor stable |
| A rejected close leaves a faded, unusable dialog | The state owner accepts or rejects closure; animate only an accepted close or recover the current open state | Busy close, repeated Escape, ignored callback and new input during exit leave a usable dialog |
| The backdrop or focus disappears ahead of the surface | Preserve native dialog semantics/top-layer ownership through the bounded visual exit; coordinate backdrop opacity | Close with focus inside, then verify backdrop continuity, inert background and focus return |

These are alternatives to evaluate against the host, not a copy-ready universal implementation.
When handing from CSS entry to WAAPI exit, settle or release only the known entry animation; do not
finish unrelated infinite spinners. Do not mix fill modes, CSS transitions and manual cancellation
without naming who owns the resting pose. Reversal invalidates stale completion work and starts from
the current presentation. Animation API failure must still reach a usable semantic state.

An accepted close may have a bounded visual lifetime, but success, account changes or direct parent
removal must not wait for decoration. Do not infer close acceptance from an undefined callback return.
Use an explicit state handshake or the host's connected/open state, with bounded recovery and cleanup.
Handle reduced motion, app motion-off and hidden/unmounted state for recovery as well as exit.

Test native dialog/popover feature detection. A fixed child of a transformed dialog may use that
ancestor as its containing block. A fallback can retain native focus/inert behavior and omit transform
on the affected host for its lifetime; avoid an untested fake-modal replacement. Verify fallback
coordinates and dismissal separately from the supported top-layer path.

## Make notifications visible without displacing work

Use a viewport overlay with an appropriate semantic status region; inserting a transient banner into
editor layout must not resize the viewport or move the document. Improve contrast, placement and
hierarchy before increasing bounce, duration or size. An icon and short category can aid recognition,
but do not label every message as success. Keep the message as the live announcement and avoid
re-announcing decorative headings, icons or every countdown frame. Check text, close, hover, focus and
forced-color states against their actual surfaces.

Keep the close target stable. At narrow widths or enlarged text, give the body a full-width row if
icon/body/close columns squeeze it. Preserve Korean word readability, long content and the last line;
do not solve a bad structure by shrinking text. Record text enlargement separately from full browser
zoom. A toast must not cover progress cancellation, zoom controls, focused inputs or the current task.
Choose an available placement and remeasure on content/obstacle/viewport changes, not every frame.
Clean up observers/listeners; update geometry only when it changes. If no safe overlay space exists,
keep essential information in an accessible persistent location.

When auto-dismiss is appropriate, declare its reading window and pause policy. Hover, focus or a
hidden view can suspend the timer. Reading that starts during automatic exit must invalidate stale
removal and recover the message; distinguish this from an explicit close. Replacing a message or
moving its host into/out of a dialog cannot let the old exit remove the new message. Important errors,
undo opportunities and required actions need a persistent or retrievable path rather than a blanket
timeout. A visual toast is not a save, delivery or backend-success receipt.

## Verify the changed scope

Freeze expected post-conditions, then retain the initial failure, correction and fresh affected result.
Select applicable probes below; mark others not run or not applicable with a reason. Do not convert
this table into mandatory release ceremony for a spacing-only change.

| Changed surface | Action sequence | Observable result |
| --- | --- | --- |
| Object motion | Create, drag quickly/slowly, reverse, stop, cancel; duplicate with supported modifiers | Stable pointer/handles and canonical geometry; bounded visual settling; correct Undo |
| Composite/deletion | Prepare, fail capture, switch page, delete and immediately Undo | Originals/proxy handoff is complete; no missing members, ghost interaction or stale resource |
| Dialog | Close during entry, reject close while busy, reopen during exit, close after settling | No brightening, anchor jump, stuck backdrop, stale close or lost focus |
| Toast | Auto-dismiss, start reading during exit, explicitly close, replace, change dialog host | Current message owns its timer, live status and removal; manual/automatic policies differ |
| Overlay layout | Narrow/large text, long Korean body, progress cancel and zoom controls together | Message and controls remain readable, reachable and unobscured |
| Motion policy | Toggle reduced motion/off midway; hide, return, unmount and remount | Same task and bounded cleanup with no abandoned recovery animation |

Prefer precomputed transform/opacity samples or browser animation primitives over per-frame DOM
measurement when they serve the recipe. That is an architecture choice, not measured performance.
For small fixes, run targeted browser/state checks. Run large-document or long memory/latency stress
tests when explicitly requested or required by the active project contract; preserve a user's explicit
opt-in boundary. A performance-sensitive change without such permission remains unmeasured, not fast
by assertion. Record device, browser, workload, interval and metric when measuring. Next-rAF delay,
frame interval, document completion, JS heap and GPU memory are different quantities.

## Evidence and reuse boundary

These probes are KGJ synthesis informed by a private real-product diagram-editor iteration. Local
tests supported a bounded desktop Chromium implementation; they do not establish every browser,
touch or screen-reader behavior, universal spring values, sustained frame rate or absence of leaks.
No private source, screenshot, conversation, path, identifier or execution receipt is distributed here.
Keep product-specific provenance in the owning project's private evidence registry. Synthetic recipes
and checklists are authoring aids, not executed tests. Shared stable promotion still follows
[pattern lifecycle](pattern-lifecycle.md) and [evolution governance](evolution-governance.md).

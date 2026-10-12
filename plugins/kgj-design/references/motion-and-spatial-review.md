# Motion and spatial experience review

Use this guide for a motion-led page, an interactive exhibition, a spatial explainer, or an exploded-view study. It is conditional design and review guidance, not a renderer dependency or proof that an artifact passed. Keep small refinements in refinement mode.

Status: candidate expression guidance. Owner: KGJ Design maintainers. Consumers: web experience makers and reviewers. Compatibility: no DNA, token, Dictionary, tool, or evidence schema changes. Review when a new renderer or failure case invalidates an assumption. Reversal: remove the conditional routing in a new version if it adds ceremony without improving the relevant task. A successful example alone does not promote a reusable pattern to stable.

## Plan the collection before styling it

Give each concept a distinct explanatory job, composition, material language, and interaction. A collection of recolored copies is not a diverse exhibition. Compare alternatives in a brief concept table, choose the ones that explain different ideas, and retain the reason for selection. A framing system can unify navigation and controls while each work retains its own visual language.

Before implementation, write a storyboard with start/end time, visible copy, object state, camera, transition, input behavior, and reduced-motion equivalent. Name the opening, development, resolved composition, and loop seam. Fix acceptance criteria before critique; do not award a perfect score from a plan.

For example, a synthetic 20-second assembly study could use this worksheet:

| Time | Object state | Visible information | Interaction and acceptance |
| --- | --- | --- | --- |
| 0–4 s | Separate housing, spacer, and pin | Part names and assembly order | Pause or seek reveals a complete readable state |
| 4–9 s | Spacer aligns with housing | Alignment axis and contact surface | Orbit preserves the anchor and shows thickness |
| 9–15 s | Pin enters the aligned parts | Connection and remaining clearance | Reverse seeking restores each part without duplicate events |
| 15–20 s | Completed assembly, then planned seam | Summary and replay control | End/start states either join continuously or use an explicit reset |

These times and parts are invented teaching material, not historical or engineering evidence. Adapt the sequence to the user's actual purpose.

## Make spatial claims visible

Choose and name the rendering model: flat 2D, layered 2.5D, projected 3D on Canvas, or WebGL/WebGPU. Respect the user's allowed technology and offline constraints. Perspective math on Canvas can express real spatial geometry; a tilted bitmap by itself does not establish it.

- Define world axes, handedness, camera convention, projection, clipping, and one transform owner. Verify a simple labeled box before adding elaborate geometry. A view intended to look down must reveal its top rather than its underside.
- Use nonzero thickness and closed or deliberately open surfaces. Test front, side, back, and the permitted pitch/zoom extremes. Hide back faces or resolve visibility consistently. A single object-average depth sort can fail for intersecting or overlapping faces; use face-level ordering or a depth buffer appropriate to the scene, and test the known limitations.
- Preserve consistent light direction, face shading, contact, and occlusion. Decorative shadows cannot repair incorrect overlap. Check silhouettes and joints before increasing polygon count.
- Normalize accepted color formats once. Reject unsupported values explicitly; do not feed an rgb() result into a hex-only shading helper and silently render black.
- Maintain safe camera and interaction bounds. Prevent geometry, labels, effects, and overlays from clipping at those bounds. Verify actual extremes, not only the default hero angle. Include representative combinations such as maximum zoom with an extreme camera angle and a selected or enlarged part.

## Make exploded views explain structure

Model meaningful parts independently with stable IDs, local geometry, assembly transforms, and explosion offsets. Define relationships such as support, connection, overlap, and assembly order. A rigid texture moving away from a whole model does not show its anatomy.

Choose the smallest details that explain construction: a base, contact pad, structural member, connector, covering, or layered finish. Show cross sections or enlarged details where scale makes the real relationship unreadable. Preserve truthful proportions where they matter and label deliberate exaggeration or schematic reconstruction.

Keep the selected part, highlighted geometry, enlarged view, leader-line anchor, term, and explanatory copy on the same semantic ID. Selecting a base must not display a structural member with a renamed caption. Anchor lines to transformed world points and apply the current projection after object/camera changes. At narrow widths, move explanations into readable DOM text rather than shrinking them indefinitely inside the canvas.

Check repeated details for their structural relationship, not just quantity: a cap should not erase the adjacent channel, a pin should meet its socket, and a covering should read as a surface with thickness. Separate documented facts from visual interpretation. Cite authoritative sources for factual dimensions, terminology, history, prices, and product claims; retain uncertainty and the date checked. An explanatory simulation is not a live service integration or a measured engineering model.

## Give typography a role in the motion

Assign a semantic hierarchy: scene title, current part or concept, supporting explanation, and control/status text. Match entrances to attention and assembly, with enough dwell time to read. Vary composition and movement by the concept; do not apply the same letter stagger to every work.

Keep paragraph text, controls, and essential explanations in semantic DOM. Reserve animated vector or canvas lettering for intentional graphic content and supply equivalent text. Preserve meaningful reading order in split text, avoid announcing every animated character, and prevent clipping at actual font metrics and narrow widths. Font loading must not leave stale measurements. Use system/local fonts when the requested artifact must run without external resources.

## One state, one clock, explicit lifecycle

Use a canonical state for selection, controls, timeline, camera, geometry, and DOM explanations. In an input handler, update state first, then derive visible labels and render from that same state. A deferred label update scheduled before another handler mutates state can leave the interface one step behind.

Keep a single time owner. Seeking to the same time and inputs should produce the same frame; separate side effects, scores, and analytics from rendering. Check repeated play/pause, forward/backward seeking, restart, rate changes, and the end/start seam. Do not accumulate animation loops or listeners after switching works.

Render only active or visible work as needed. Suspend animation when hidden and release timers, observers, pointer capture, audio, GPU resources, and event listeners on teardown. Reduced motion needs a useful static or step-based equivalent, with no unnecessary background frame loop. Preserve explicit inspection controls where motion is essential to the explanation.

For collections, give every work a discoverable route, selected state, keyboard-operable navigation, focus return, and reset behavior. Keep the selected thumbnail visible without forcing unexpected page scroll. Avoid autoplaying every thumbnail. Announce meaningful committed changes; a high-frequency clock must not continuously interrupt assistive technology.

## Review every work in the browser

Use one row per work and record pass, fail, not run, or not applicable with a reason. A shared shell check cannot stand in for distinct content behavior.

| Boundary | Required observation when applicable |
| --- | --- |
| Identity | Exact source/build hash, browser/version, viewport, DPR, route, and input state |
| Default and end | Opening, middle, final state, loop seam, and return to the work |
| Interaction | Primary controls, pointer and keyboard paths, cancellation, reset, and extreme values |
| Spatial semantics | Multiple permitted camera angles, thickness, occlusion, selected part/anchor/copy agreement |
| Layout | Representative desktop, approximately 390 CSS px, 200% zoom, and 320 CSS px when supported |
| Accessibility | Focus visibility/return, names and values, readable alternatives, reduced motion, and long content |
| Runtime | Console/network failures, hidden-tab suspension, switch-away cleanup, and fallback |
| Delivery | Exact delivered file or build, declared network dependencies, offline/file opening when promised |

Set reduced-motion emulation before loading or wait for the actual media-change reaction before asserting the stopped state. Validate a deliberate pause separately from a frozen or failed renderer. For single-file offline output, inspect resource requests and open the delivered file in the promised offline context; a localhost screenshot alone is insufficient.

Screenshots support visual review. They do not establish keyboard operation, real geometry, loop cleanup, offline operation, or sustained performance. Retain earlier failures and attach a new result to the specific correction; changes to source or measurement conditions invalidate affected prior results.

## Measure the bottleneck and preserve meaning

Record the device/browser, viewport, DPR, scene state, warm-up, observation interval, sample count, and metric. Distinguish render-function duration, requestAnimationFrame intervals, and sustained frame delivery. A short timing sample or average below a threshold does not prove 60 fps on other devices. Prefer percentile and dropped-frame information when the claim needs it.

Profile before optimizing. Reuse bounded offscreen procedural textures, static paths, geometry, and measurements when they dominate work. Specify cache keys, DPR/resize invalidation, memory bounds, and disposal. Keys must include every input that changes cached pixels, such as palette, geometry, text, and font metrics, or the cached layer must be explicitly static. Verify the visual result, selected states, and loop seam again after optimization. Reduce work without removing the detail that explains the concept. Cap backing resolution or geometry only with an explicit quality/performance tradeoff and fallback.

## Integrate with the existing review and publication contracts

Map structure, data truth, privacy, and state ownership to round 1; actual browser, visual, accessibility, and performance evidence to round 2; deterministic packaging, offline delivery, install identity, and readback to round 3. This worksheet supplements the existing protocol. It adds no scored round, changes no closed assertion count, and does not replace runner-attested evidence.

Publish newly authored, generalized rules and synthetic teaching examples only. Exclude private conversation titles, source projects, customer or business identifiers, personal ledgers, machine paths, environment settings, screenshots, and session traces. Review the exact diff and complete package inventory before publishing; a credential scan alone cannot recognize contextual private information. Do not copy local reference notes merely because their filenames sound generic.

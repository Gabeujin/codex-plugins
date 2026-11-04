# Design candidates before UI R&D

Use this workflow **before every UI R&D engagement**, including small visual or interaction
experiments. First produce and inspect drafts; start product implementation only after selection.
A precisely specified defect repair with no design choice, text-only correction, or read-only audit
is not UI R&D. Record that narrow reason; do not relabel a redesign as refinement to skip comparison.
An explicit user direction or constraint takes precedence. Keep one comparison for the coherent
engagement; do not multiply it per button, file, review pass, or gallery item.

## 1. Freeze the question and comparison conditions

Write the user job, visible outcome, protected behavior, representative content/states, target
viewports, accessibility and performance constraints in a local brief. Fix these criteria and the
five lenses below before seeing scores. Reuse the existing product DNA. For a new product, discover
the DNA first. Record scope changes and reevaluate affected candidates rather than lowering criteria.

Keep candidate packets, source copies, prompts, images and review notes in the task's private
artifact area outside the installed plugin and public repository. This workflow never writes the
Dictionary or Codex memory, exports private material, starts a paid generation job, or grants publishing
authority. Use synthetic representative content when work may later be shared.

## 2. Make four or five substantive drafts and relevant asset alternatives

Produce **4–5 materially different rendered drafts** under the same brief and content. Vary the
information structure, composition, interaction approach or visual narrative; recoloring a clone
does not count. Use inexpensive disposable prototypes, not five production applications. Capture
each actual rendered result and record browser/tool, viewport, route, state and the source identity.
Review all candidates at the same representative desktop and narrow conditions when applicable.
Prompts, prose, wireframe descriptions and a source file alone are not rendered drafts. If rendering
is unavailable, retain a HOLD and the precise missing step; do not invent a screenshot or score.

For each candidate, make at least **two distinct alternatives for each selected asset role** such as
illustration, icon family, diagram, texture, motion study or typographic specimen. Use relevant SVG,
CSS, original drawings or generated imagery; do not add ornamental images only to meet a count.
Existing product assets remain protected. Compare alternatives in the composition, select one and
explain the choice. Record authorship/generation or licensed source, usage rights, attribution,
privacy/metadata review, and the selected file. Generated assets still need inspection and rights
review; generation does not certify either. Use the available image-generation tool for requested
raster generation/editing. Do not fabricate image-tool output or copy a brand's appearance/assets.

## 3. Evaluate every candidate through five fixed lenses

| Lens / packet role | Primary question |
| --- | --- |
| Designer / `designer` | Does the composition have a clear idea, coherent form and appropriate visual character? |
| UI designer / `ui-designer` | Are hierarchy, type, spacing, color, components and small-screen layouts readable and consistent? |
| UX designer / `ux-designer` | Can users discover, complete and recover the main task with clear states and accessible navigation? |
| UI/UX engineer / `ui-ux-engineer` | Can the design preserve semantics, keyboard/focus, responsive behavior, reduced motion and runtime budgets? |
| Product designer / `product-designer` | Does this direction solve the stated user problem within product identity, risk and delivery constraints? |

Give each lens **0–20 integer points**, equal weight, total **0–100**. Use common anchors: 0 = unusable
on observed evidence; 5 = major observed weaknesses; 10 = coherent but material gaps remain;
15 = representative requirements met with minor gaps; 20 = strong observed fit with no material gap
in the declared scope. Intermediate integers need a specific reason. Missing observation is `null`,
never zero, an inferred pass, or an average with a smaller denominator. These are subjective design
judgments supported by observations, not measured probabilities or the release rubric's 9.9 score.

Use an actual independent reviewer when delegation is available and authorized. Otherwise perform
five explicit sequential lens reviews and label them `single-agent-lens`. Record an opaque reviewer
ID and actual mode; do not claim that five professional humans or five independent agents participated
because five role names appear. Independent reviews see the same artifacts/criteria before each
other's conclusions. Cross-review disagreement and retain minority findings with an acceptance test.
Reuse a bounded reviewer team; one reviewer may cover more than one lens. No model switching is implied.

Record rationale, current evidence and blockers for **every** candidate and lens. P0/P1, privacy or
asset-rights concerns, a failed critical task/accessibility path, unresolved release-critical dissent,
missing observations or stale bindings block eligibility regardless of score. A blocked candidate may
retain its observed score; explain why a lower-scoring eligible candidate wins. Do not remove weak
or failed candidates from the comparison.

## 4. Select and bind the highest eligible score

Select the unique highest total among eligible candidates. With no eligible candidate, HOLD. With a
tie for highest eligible score, HOLD and run a bounded side-by-side probe against the original user
job, then update the affected evidence and reviews. Do not use input order, an arbitrary ID or hidden
decimal precision to break a tie. Retain previous results. Show the comparison table, selected assets,
important dissent and selection reason before product implementation; an extra confirmation is needed
only when existing authority or a material ambiguity requires it.

Use [the packet template](../data/templates/design-candidates.json). Paths resolve relative to the
private packet. List all candidate source dependencies and all asset alternatives with SHA-256; include
rendered images and observation notes. The checker only verifies declared files, not omitted dependencies.

```powershell
python scripts/review_design_candidates.py <private-packet.json> --snapshot
python scripts/review_design_candidates.py <private-packet.json>
```

After capturing previews, use `--snapshot` to obtain each `sourceSha256`; set that field on the matching
preview only when its observation actually binds those sources. Rerun `--snapshot` for the final
`candidateSha256`, then provide that identity to reviewers. The source identity includes the brief,
direction, declared sources and asset/rights records; the candidate identity also includes previews.
Re-run the default check immediately before applying the selected source/assets. Changed sources,
assets, preview files or notes invalidate related previews/reviews; recompute and actually re-review.

`ranked` means local files match and declared scores have a unique eligible maximum. It does **not**
verify visual distinctness, true rendering, review independence, rights or aesthetic judgment, and it
does not authorize release. Inspect rendered work and evidence independently. The tool is read-only,
does not execute packet content, and prints no free-form rationale, raw source or local paths.

## 5. Develop with bounded negative review, R&D and improvement

Apply the selected direction as the smallest coherent product slice. Use
[the development review record](../data/templates/development-review.md) under the original task ID:

1. Negatively review the current implementation against the frozen criteria. Name the exact file,
   rendered state or input path, impact, counterexample and acceptance test. Preserve initial failures.
2. Form a concrete cause hypothesis. Run the smallest relevant R&D probe, compare alternatives for the
   defect, and make the minimum improvement supported by its result. Do not rewrite unrelated code.
3. Recheck the affected task, states, responsive layout, keyboard/focus, reduced motion, content and
   performance as applicable in the actual target. Source checks cannot stand in for browser behavior.
4. Independently reread/review the changed candidate and affected dependencies. A changed artifact
   invalidates related PASS and downstream proof. Attach new evidence to the original finding.

Use at most **three corrective passes** for the engagement, or a stricter existing limit. Do not repeat
the same failure with unchanged input, reset the count by renaming candidates/splitting tasks, weaken
criteria, or manufacture changes after a clean review. Stop when fixed criteria are met and current
proof supports them. At the limit, retain HOLD, cause, remaining items and a materially different next
approach or external condition; a high score is not completion. A local record cannot enforce history
against deletion/recreation, so report this as a workflow rule, not tamper-proof enforcement.

If fixes change the selected design direction materially, revisit candidate selection and affected
reviews without resetting the corrective-pass budget. Small evidence-backed corrections do not require
four new whole-product drafts. Keep comparison history and explicit supersession.

This design comparison is separate from cross-model/plugin benchmarking, which still has no automatic
aggregate rankings. For release-style work, map findings to the **existing** KGJ rounds 1–3 and retain
the closed quality rubric. Corrective passes are not new scored release rounds. Candidate scores,
team consensus and a checker result cannot close a release check or promote a Dictionary entry.

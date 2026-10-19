# Design benchmark evaluation

Protocol version: `kgj-design-benchmark-1.0.0`. Use only for a requested sample evaluation/comparison.
The public ten-sample suite is a development probe, not an unseen test or a new KGJ release rubric.
Use a new copy of the [run template](../data/templates/benchmark-run.json). Empty fields are not proof.

## Freeze the comparison before generation

- **equal-packet:** provide identical versioned prompt, selected KGJ instructions, factual source text,
  licensed asset bytes, fixtures, initial workspace, acceptance criteria and allowed tools. Pin hashes.
  The same user sentence with different hidden context, assets or browsers is not an equal packet.
- **native-integration:** evaluate the actual model/harness/plugin stack with its disclosed tools and
  loaded resources. Record missing capabilities. Keep this track separate from equal-packet runs.
- Record selected provider/model label and the actual returned model/snapshot ID separately. If the
  harness does not expose identity or effective reasoning, use null and a reason; a prompt cannot
  switch the running model. Do not change the user's model to run the benchmark.
- Record app/CLI versions, visible governing instructions, skill/resource hashes, OS/runtime/lockfile,
  browser/viewport/DPR, permissions, network/cache, tool inventory and initial state. Avoid private
  user information. Do not supply one participant another participant's output or critique.
- Fix correction/intervention policy and operational wall-clock/tool/output caps before runs. Equal
  token counts or similarly named reasoning modes across vendors are not equal compute. Keep raw
  provider usage, measured time boundaries and interruptions separate. Cost stays unknown without
  complete observed usage and current billing/pricing evidence.
- Preserve initial and corrected artifacts, every attempt, tool failure and human intervention. A
  selected best result is not an unassisted first attempt. Pin the final source/build used by reviewers.

## Observe each work, then rate dimensions

Keep generation time separate from artifact quality. Inspect domain-specific structure rather than
labels alone: part relationships in architecture, coherent geometry, informative landmarks and useful
content hierarchy. In spatial controls, declare world/camera conventions and probe whether equivalent
inputs unexpectedly reverse between modes. Observe a fixed ten-second input/scroll sequence on
animated works for continuity, particle behavior and stale state. If measuring, bind device/browser,
viewport/DPR, warm-up, interval, sample count and metric. Distinguish render duration, rAF intervals and
displayed frame delivery; screenshots and an FPS label in a reference video cannot prove performance.
Keep visual preferences, measured runtime and environment limitations separate.

First record the action, expected post-condition, actual result, environment and evidence per sample.
Critical failures include fewer than ten working distinct samples, an unreachable promised core task,
keyboard exclusion, false data/model/backend success, or unrecoverable interaction state. Record these
categorically, including scope and severity; attractive visuals cannot offset them. A missing test tool
is an environment limitation and an unrun check, not an observed application failure.

Optional dimension ratings describe the reviewed artifact only. Use integers 0-4 with evidence;
1 and 3 are justified intermediate cases between anchors. **null means unrun/insufficient evidence;
0 means an observed failure.** Unsupported/N/A paths need a task-specific reason. Do not invent a
number to fill the template or convert declarations/screenshots into behavioral evidence.

| Dimension | 0 — observed failure | 2 — partial result | 4 — strong result under the recorded scope |
| --- | --- | --- | --- |
| Visual composition | Domain illegible or content obscured | Coherent but repetitive hierarchy or weak detail | Distinct domain expression, intentional hierarchy/type/space and controlled small-screen composition |
| Interaction | Promised core task cannot complete | Core task works but reversal or edge state is inconsistent | Input, canonical state, feedback, history and recovery stay coherent through tested interruptions |
| Motion | Motion blocks meaning/task or leaves stale state | Basic transitions work but continuity/rhythm is inconsistent | Intentional orientation and microfeedback; interruption and initial/dynamic reduced motion preserve the task |
| Accessibility | Core task excludes keyboard or content is inaccessible | Core path usable with identified focus/zoom/status gaps | Tested keyboard/focus/zoom/narrow paths preserve the same task with meaningful status and semantic alternatives |
| Content/data truth | Fabricated claim, result or measurement | Claims mostly sourced with localized ambiguity | Frozen claim-level sources, declared synthesis/fixtures, consistent units and clear unknowns |
| Engineering/reproducibility | App cannot launch or has a critical runtime failure | Runs with incomplete evidence/resource cleanup/reproduction | Reproducible source/build, per-work probes, bounded lifecycle and faithful run/intervention records |

There is no weighted total, automatic leaderboard or conversion to KGJ's 9.9 release score. For a
release request, use the existing closed fifteen-check/three-round workflow and its actual evidence.
This template has no attestation and cannot mint passing execution receipts.

## Review independence and permitted conclusions

Use anonymous artifact IDs and randomized inspection order when practical. Record reviewer identity,
role, available evidence, conflicts and independence. A generator's self-review must be labelled;
it cannot certify independent visual or behavioral quality. Freeze anchors before seeing results;
if criteria change, version them and invalidate/review affected ratings rather than preserving old PASS.

Report per-sample observations, failure flags, dimension vectors, missing evidence and environment
differences. One run per model is a case study of those artifacts and conditions. Repeated comparisons
need the same correction policy, run count and observed variation. Do not generalize intelligence,
design ability, speed, price or a provider ranking from the suite. Plugin benefit needs its own matched
with/without-plugin comparison, not a cross-model anecdote. Public samples do not establish held-out
generalization; keep any future private evaluation answers separate from generator inputs.

A user-supplied [Codefactory demonstration](https://www.youtube.com/watch?v=2lv5xHjLx1c&t=248s),
04:08-09:01, checked 2026-10-16, illustrates why assembly detail, control mapping and particle/scroll
continuity deserve separate observations. It is an observational source, not a controlled comparison.
Do not import its model rankings, pricing, timing/FPS claims, layouts, assets or prose. The measurement
and fairness protocol above is KGJ synthesis; model facts still require official sources.

No evaluation mode authorizes additional paid/provider runs, credential setup, publication or data
export. Carry out only the runs the user actually requested.

# Mandatory benchmark telemetry

Version: `kgj-design-benchmark-telemetry-v1`. Applies to **every user-requested benchmark**, regardless
of artifact count. It does not authorize extra models, paid runs, provider calls, publication or
access to personal stores. Ordinary work is not automatically a benchmark.

## Start recording before planning

The active agent is the recorder. Create a private copy of
[benchmark-run.json](../data/templates/benchmark-run.json), declare every requested artifact in
`telemetry.artifacts`, and preserve the initial copy before the first planning action. Record the
actual clock boundary when a phase starts and ends. There is no hidden observer, background hook,
provider integration or automatic append command in this plugin. The CLI below only reads files.

Use four phase names: `planning`, `design`, `development`, `completion`. Revisited work gets a new
segment ID; never reset or overwrite an earlier segment. Preserve interruptions and corrections.
Elapsed time is the union of observed start/end intervals within one artifact and phase. It includes
waiting inside those intervals; it is not inferred active thinking time. Do not sum overlapping
parallel intervals and describe that sum as wall-clock duration.

At each available model-response or harness receipt, the active agent records the returned model ID,
observed normalized token counts, timestamp and a local file/hash binding for the structured usage
evidence. Keep the selected label separate. Do not infer the actual model from a theme, prompt,
selected UI label or another call. Mixed-model work retains separate request rows.

If the surface exposes no usage, record null values with reasons. If earlier boundaries or exclusive
attribution cannot be established, leave those artifact values null and keep the known observations
in an explicitly named shared bucket. Never divide shared totals equally, by time or by token length.
Do not mine personal memory, transcripts or unrelated task history to backfill a public example.

## Read-only commands

From the plugin directory:

```sh
python -X utf8 -B scripts/benchmark_telemetry.py validate /path/to/private/run.json --root /path/to/private/evidence
python -X utf8 -B scripts/benchmark_telemetry.py summarize /path/to/private/run.json --root /path/to/private/evidence
```

Both commands read only the input and declared local bindings, write JSON to stdout, and make no
network calls. They do not collect or append events, authenticate a provider receipt, verify an
official pricing page, measure Lighthouse, calculate a bill, or mint release evidence. A valid input
is labelled `validated-input-only`. Legacy benchmark-run-v1 files without the additive extension
remain readable as `legacy-unknown`; no historical measurement is invented.

Relative source/report/usage-evidence paths resolve beneath `--root` (default: input parent).
Absolute paths, parent traversal and resolved symlink escapes are rejected. Keep private ledgers
and raw receipts outside the plugin, cache, source repository and public fixtures.

## Typed additive extension

The v1 run envelope and its existing fields retain their meaning. Its optional `telemetry` extension
has exactly these fields:

| Field | Type and meaning |
| --- | --- |
| `schemaVersion` | `kgj-design-benchmark-telemetry-v1` |
| `captureMode` | `active-agent-manual`; never implies automatic capture |
| `artifacts` | Rows with `id`, `sourceFiles`, `unknownReasons` |
| `phaseEvents` | Append-only observed start/end rows |
| `usageEntries` | Unique request-level delta usage rows |
| `priceRates` | Caller-supplied official-source pricing records |
| `lighthouseSnapshots` | Local raw-report/source bindings |
| `unknownReason` | Nonempty reason when no artifact ledger was initialized |

Each artifact declares `sourceFiles: [{"path": "...", "sha256": "..."}]` and an `unknownReasons`
object with all six keys: `planning`, `design`, `development`, `completion`, `usage`, `lighthouse`.
An unobserved field needs a nonempty reason; an observed field uses null for its reason. Begin with
honest unknown reasons, then append observations and clear only the corresponding resolved reason.
The declared sources must cover the build and shared resources affecting that artifact; the checker
validates the declared files, not the completeness of an undeclared dependency graph.
Declare generated measurement outputs outside this source fingerprint so adding a report does not
change its own source identity. Retain each report's independent hash, disclose this exclusion, and
include the actual telemetry loader/renderer code and its other dependencies in the source set.

A phase event has `id, artifactId, sharedBucket, attributionReason, phase, segment, action, at,
evidenceRef`. IDs are unique; `action` is `start` or `end`; `at` is a timezone-qualified timestamp.
Each segment needs exactly one ordered pair. Artifact attribution uses an artifact ID and null
shared bucket. Shared work uses null artifact ID, a named bucket and a nonempty attribution reason.

A usage row has `id, requestId, artifactId, sharedBucket, attributionReason, phase, provider,
selectedModelLabel, actualModelId, modelUnknownReason, usageKind, inputTokens, cachedInputTokens,
outputTokens, reasoningOutputTokens, unknownReasons, evidenceRef, observedAt, usageEvidence,
rateId, unpricedCharges`. Namespace request IDs by provider and retain one final delta row for each
logical request. Cumulative snapshots and reset counters are unsupported; do not add them to deltas.
For shared usage, the phase may also be null when unknown.

`usageEvidence` is a local path/SHA-256 pair whenever model identity or a token count is observed.
The normalized values must be checked against that structured receipt by the active agent; a file
hash proves bytes, not the truth or authenticity of its contents. With no observed identity/count,
use null evidence and explicit unknown reasons. `unknownReasons` has the four token-count keys;
each missing count needs its own reason, while a numeric count has null reason.

Normalize the provider's documented semantics into this contract before recording:

- `inputTokens` is total input, including the `cachedInputTokens` subset.
- `outputTokens` includes the `reasoningOutputTokens` subset; reasoning is not added a second time.
- Token counts are nonnegative integers. Missing cache information is null, not assumed zero.
- `actualModelId` is null with `modelUnknownReason` when not returned by the surface.
- Additional image/audio/tool/cache-write or other unpriced charges go in `unpricedCharges`.
  Any such charge makes the whole API-equivalent total unknown in this token-only calculator.

## Official API-equivalent cost is not a bill

Each rate has `id, provider, actualModelId, currency, inputPerMillion, cachedInputPerMillion,
outputPerMillion, officialSourceUrl, retrievedAt, conditions`. Currency is USD; rates are finite
nonnegative decimal **strings**. The active agent verifies the current responsible provider's
official page, exact model, service tier, context/cache conditions and retrieval time. The CLI
checks local structure/model matching and the HTTPS locator; it does not authenticate that source.
Do not bundle live account receipts, provider usage or current personal rate ledgers.

For a fully observed supported request:

```text
API-equivalent USD =
 ((inputTokens - cachedInputTokens) * inputPerMillion
  + cachedInputTokens * cachedInputPerMillion
  + outputTokens * outputPerMillion) / 1,000,000
```

Unknown model/count/rate or unsupported charge means null with a reason. Do not show a known subset
as a complete total. Actual billed amount is separate and remains null in this utility; subscriptions,
discounts, credits, taxes, non-token charges and provider billing are not reconstructed.

## Primary-screen Lighthouse snapshots

Every requested artifact must disclose its major routes and measurement state. The active agent
runs the authorized measurement separately and adds a row with `id, artifactId, route, measuredAt,
completedAt, lighthouseVersion, sourceSha256, report`. `report` is a raw local LHR path/hash binding, not a
handwritten score. Record measurement conditions, device/profile, browser/version and limitations
beside that raw report in the private evidence record. Keep its browser/environment and configSettings.
`measuredAt` is the raw LHR fetchTime/start boundary. The active agent observes and records the actual
clock after the measurement process and report output complete as `completedAt`; it must be timezone-
qualified and no earlier than measuredAt. Do not relabel fetchTime as the completion time or infer an
end time from a score, file mtime or earlier run.

`sourceSha256` is SHA-256 of the artifact's `sourceFiles`, sorted by path and serialized as UTF-8
JSON with sorted object keys, no ASCII escaping and separators `(",", ":")`. The validator checks
every declared source's current bytes, the aggregate fingerprint, raw report hash, requestedUrl,
fetchTime/start, the observed completion boundary and lighthouseVersion. Never put the raw report in `sourceFiles`: that is self-referential.
A changed source/report invalidates the snapshot until separately remeasured or explicitly unknown.

Keep performance, accessibility, best-practices and SEO separate, retaining raw null category scores
as unknown. A snapshot is one route/time/device/profile observation, not complete task, accessibility,
usability or deployment proof. Do not copy another site's scores or a previous deployment's result
into a current measurement.

## Mandatory disclosure and privacy

At completion show one row per artifact with all four phase durations or null reasons; observed
models; input, cached-input and output tokens; API-equivalent USD or null reason; separate actual-bill
status; and primary-route Lighthouse categories with timestamp, route/version and source/report
identities, including measurement start and completion times. Show shared/unattributed work in a separate bucket. Never hide unknowns, silently borrow
run-level totals, or turn these rows into a model ranking or the release quality score.

For each web artifact, a discoverable header or footer entry is **required**. Show the complete
per-artifact summary there or in its labelled disclosure, and provide a clickable Lighthouse detail
entry with primary-route categories, measurement start/completion timestamps, conditions and the raw
report/source identities. Preserve the existing product task and accessible open/close/focus behavior.
For other media, put the same required disclosure in an appropriate report/summary location.
The final report and required web UI must label observed, unknown, synthetic and stale values explicitly.
Only newly authored synthetic cases belong in public tests. No real company/domain data, personal
memory, provider ledger, account record, prompt, private local path or private insight store belongs
in source, templates, examples, packages or public release evidence. Preserve the existing independent
privacy review and exact-commit release gates.

# KGJ Ontology and Dictionary

## Purpose

The Ontology defines how KGJ describes design knowledge. The Dictionary is a private, append-only
learning ledger for one user. It preserves individuality by learning scoped preferences, rejections,
experiments, and outcomes without converting activity into a universal personality score.

The promise is **portable learning, not portable identity**.

## Static ontology

The bundled `ontology/kgj-ontology.json` v1.2 defines:

- entities: user, product, domain, surface, trait, pattern, decision, evidence, mutation, verification;
- trait axes: density, hierarchy, typography, color, shape, depth, motion, imagery, voice, data,
  interaction, and spatial composition;
- contexts: product, domain, surface, audience expertise, task, risk, frequency, device, input, locale,
  theme, content length, and connectivity;
- entry types: observation, preference, rule, rejection, experiment, outcome, and candidate-pattern;
- evidence roles: user-stated, product-observation, official-source, inferred, tested-locally, import;
- relations: prefers, rejects, expresses, inherits, applicable-to, supported-by, contradicts, validates,
  challenges, supersedes, revokes, derived-from, adopts, migrates-to, proven-by, and expires;
- governed artifacts: project contract, evidence record, lineage lock, migration plan, pattern candidate,
  expert lens, review round, finding, dissent, insight, and acceptance test;
- a closed portable-principle vocabulary for de-identified candidate export.

## Entry semantics

| Type | Meaning | Automatic local influence | Sharing |
|---|---|---|---|
| observation | factual, time-bounded event | evidence only | no by default |
| preference | user-stated inclination | matching scope, explainable | never as personal identity |
| rule | explicit local instruction | highest local authority | never copied to another user |
| rejection | first-class do-not-use/counterexample | matching scope, ahead of preferences | aggregate signal only after consent |
| experiment | reversible hypothesis | declared trial window only | not until outcome exists |
| outcome | measured result | matching validity scope | eligible for sanitized candidate support |
| candidate-pattern | de-identified non-binding guidance | only after explicit local adoption | shareable only after review |

Every entry has one type, subject scope, applicability context, provenance, authority, confidence,
review/expiry, counterevidence, sharing class, retention, and a human-readable explanation. A sensitive
trait, protected characteristic, diagnosis, or psychological label is forbidden.

A `consented-candidate` additionally requires a local consent receipt with a non-public grant ID,
purpose `cross-user-candidate-export`, policy version, canonical UTC grant time, mandatory expiry no
more than 366 days later, and current `granted` status. Revising the entry back to `private` immediately removes export eligibility;
the historical grant remains local evidence and is never exported.

## Resolution

Apply matching entries in this order:

1. explicit local rule;
2. scoped local rejection;
3. verified local outcome;
4. explicit local preference;
5. explicitly adopted candidate-pattern;
6. independently verified inference.

Specific scope beats general scope. Conflicts remain visible as `supports`, `contradicts`, or `unknown`;
do not average opposites into a fake consensus. Recency may lower applicability but cannot erase
history. A reached `reviewAfter` or `expiresAt` makes the current entry review-only. Only an explicit
new revision supersedes, adopts, or revokes an entry.

An inferred entry always starts with `inferenceStatus: pending`, remains non-binding regardless of its
entry type, and enters the review queue. Only `review_inferred_entry` can verify or reject it, and that
transition requires a separate evidence reference and review note. Generic recording cannot invoke
import-adoption or inference-review transitions.

## Storage and mutation

Mutable data never lives in the plugin installation or cache. The default root is the platform's
per-user application-data directory under `KGJ Design/v1`; `KGJ_DESIGN_DATA_DIR` overrides it.

The runtime stores:

```text
dictionary.json          current projection and revision
dictionary-ledger.jsonl  immutable entry revisions
idempotency.json         request hash to committed revision
design-runs.jsonl        append-only application/review receipts
snapshot.json            hashes and counts
```

Mutations require explicit record intent, optimistic `expectedRevision`, a stable idempotency key,
bounded schemas, an exclusive short-lived lease, host/PID/process-start fencing for stale recovery, durable file
flush, atomic replace, and append-only revision history. Every mutation first verifies semantic replay;
an interrupted projection, idempotency, run, or snapshot state requires explicit recovery before writes.
Restoring data must restore the projection, ledger, idempotency map, and runs together.
`verify_integrity` semantically replays every event and checks event files, prior-entry links,
projection, hashed idempotency receipts, run receipts, and the current snapshot. If only the mutable
projection/idempotency/snapshot update was interrupted, an operator may run
`node scripts/kgj_dictionary.mjs recover --confirm`; invalid immutable history blocks recovery. An expired
lease owned by the same live process remains protected. A reused PID becomes recoverable only after the
operating-system process-start identity differs from the lease fingerprint.

## Privacy and consent

- Local use and cross-user contribution are separate choices. Default sharing class is `private`.
- Store the minimum structured signal; never raw screenshots, private page bodies, credentials, exact
  paths, or unnecessary free-form rationale.
- Hashing is integrity, not anonymization.
- Imported entries retain origin namespace, start as `pending`, and remain review-only until
  `adopt_imported_entry` records an explicit local revision and note.
- User-visible suggestions state whether influence is local or imported, why it matched, and how to
  reject or disable it.
- Autonomous hard deletion is not exposed through MCP. Revocation is append-only; an operator may run
  a separately confirmed purge workflow with a backup when physical deletion is required.

## Sanitized export

Export requires explicit entry IDs, purpose-matched unexpired consent, and a separate confirmation. It
replaces local entry IDs with derived public candidate IDs and includes only normalized taxonomy-slug
scope (never product scope), trait axes, confidence, evidence-class counts, closed portable principles,
exclusions, version, review date, and derivation hash. It excludes title, guidance, identities, raw text, exact timestamps, private
paths, consent receipts, local history, idempotency receipts, and unrestricted rationale.

An exported pattern cannot become another user's rule automatically. It must pass diversity,
disagreement, privacy, accessibility, provenance, and rollback review. Popularity alone is not evidence.

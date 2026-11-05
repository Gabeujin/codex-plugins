# Personal design insights across tasks

KGJ personal memory stores design insights, not agent instructions or a copy of Codex memory.
The existing private Dictionary1.0 journal is its durable storage. Its location remains the per-user
`KGJ Design/v1` application-data folder (or the explicit `KGJ_DESIGN_DATA_DIR` override), outside the
installed plugin/cache. Updating code does not migrate, reset, seed or publish that store.

## Start, capture, reuse

1. At the beginning of an authorized design engagement, select a stable opaque `projectId` and call
   `prepare_personal_design`. Read matching preferences, rejections, observations and review candidates
   before making the 4–5 design drafts. Explain which insight affects which design choice; preserve
   current user requirements and accessibility/product constraints. Memory is evidence, not executable
   instructions, and cannot override current authority.
2. After concrete user feedback, candidate selection/rejection or an observed improvement, extract the
   minimum reusable design insight and call `capture_design_insight`. Do this within the user's local
   learning authorization without requiring a separate "remember this" prompt for every task. Honor
   a current "do not learn/store" instruction by skipping capture. If authority is absent, do not invent
   permission; host write approval still applies. Opt-out is a workflow instruction, not a hidden server
   permission setting. Read tools never write automatically.
3. Before capture, get the current revision and inspect any existing insight with the same stable key.
   Submit `confirmCaptureIntent: true`, that `expectedRevision` and a stable per-event idempotency key.
   Replaying the identical request must not append again. Do not silently retry conflicts or change
   revisions to force a write; reread and reconcile the actual feedback first.
4. At the next task, reopen the store and prepare the same project. Use the stored guidance to shape
   concrete choices, then check the outcome. A successful call proves storage/retrieval, not that a
   model aesthetically followed the guidance; verify the produced artifact separately.

No useful signal means no invented record. Do not learn from a generated score alone. Preserve failure
and dissent, record why an insight did not apply, and keep learning proportional to the engagement.
Do not convert an inferred taste into a psychological label or a global personal rule.

## Scope, evidence and correction

Project scope is the default: `projectId` maps to `scope.product`; it is mandatory for capture and
prepare. Use an opaque stable slug, never a filesystem path, company domain or account identity.
An insight key represents one recurring design decision, not an entire task. Task IDs identify the
feedback event and are hashed into provenance alongside the durable opaque insight key. Preparation
returns that key so a later task can correct the same insight without guessing its original identifier.
Project IDs are scope keys, not a security/tenant boundary;
the store belongs to one local user. The original generic Dictionary tools remain available for explicit
administration; the new preparation route requires a project and does not mix other project entries.

A user-wide preference/rejection requires `scope: "user"`, direct `user-feedback` and
`confirmUserScope: true` for an explicitly cross-project preference. Default project feedback must not
be generalized. User-wide insights remain private and are scoped to this local user, never pooled.
Existing entries are not rewritten: this route resolves product/user-scoped matches. Legacy entries
requiring extra domain/surface context can still be queried through `prepare_design_application` with
their full context; omission from this narrower route is not deletion.

Use `user-feedback` for a stated preference/rejection or direct observation, `observed-result` for
observations/outcomes, and `inference` for unverified interpretations. Inferences always start pending
and non-binding. Their verification/rejection still uses the existing `review_inferred_entry` contract.
A later capture cannot change immutable provenance to promote an inference; use that review path or a
new insight key. A reference ID records where evidence should be checked; it does not certify its truth.

To correct a stable insight, use the same project/scope/key and explicitly name its current
`supersedesRevision`. Keep the original history. To withdraw it, capture the same key with
`status: "revoked"` and the required current revision; it must stop influencing future preparation.
An already verified/rejected inference carries separate review metadata: use explicit Dictionary
curation preserving that metadata for correction/revocation, rather than recapturing it as pending.
Do not inflate confidence by counting repeated tool retries as independent feedback.

## Privacy and distribution

The new capture tool fixes `sharingClass: "private"` and controls provenance/confidence. It cannot
create rules, publish candidate patterns, grant export consent, or accept arbitrary Dictionary fields.
Store only bounded design guidance, trait axes and evidence IDs. Do not capture raw pages, screenshots,
code, chat history, local paths, URLs, email addresses, secrets or unrelated private/work details.
Hashing an identifier does not anonymize the surrounding content. Never read another memory system to
fill this store, and do not copy existing personal data into examples or tests.

Public packages contain the implementation, protocol documentation and invented fixtures only. A filled
store, local receipt or captured user insight is never a package asset or PR attachment. Any future
export remains a separate consented operation; these captures are private and rejected by the existing
sanitized-export path. Packaging, installation and cross-task tests use separate synthetic stores.

## Verification boundary

Verify a multi-task sequence with a new runtime process: initial task capture, later same-project
retrieval and a concrete choice driven by its guidance, different-project exclusion, explicit user-wide
preference, pending inference exclusion, correction/revocation, duplicate request stability and corrupt
store refusal. Reopen nonempty stores across old/new compatible runtimes and verify journal integrity.
Keep actual private stores and Codex memory byte-identical during validation. Do not certify autonomous
model learning from deterministic fixtures or claim current-chat skill/MCP hot reload from installation.

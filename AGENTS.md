# Public plugin repository rules

This repository is public. Follow the user's current scope and preserve unrelated changes.

## Protect private work and data

- Author generic public changes from public source and synthetic fixtures. Never copy company work,
  internal domains or processes, private source, accumulated personal memory, task history, accounts,
  private Dictionary records, logs, captures or credentials into source, examples, tests or attachments.
  Renaming or redacting a private original does not establish public provenance.
- Keep personal state outside the plugin and cache. Check update compatibility with read-only local
  diagnostics and separate synthetic replay fixtures; never rewrite or reset a real store to make an
  update pass. Do not print private values in scans or publish raw diagnostic receipts.
- Review the complete candidate inventory, hidden files, media content/metadata and all new commit
  snapshots and metadata from base to head. Review PR text, release text and package contents too.
  A removed file can remain in a new commit's history. Use an intended public author identity.
- Complete independent semantic/privacy review before the first public push, upload or PR. Automated
  heuristics, declared provenance and hashes do not certify privacy or rights. If required evidence
  is missing or a possible private-data exposure is unresolved, HOLD publication.

## Finish suitability checks before opening a PR

Follow [the release procedure](docs/RELEASING.md). Freeze the applicable checks before execution:
full regressions, separate build/browser checks, exact-commit packages from two clean clones,
isolated install/source readback, data-schema/update/rollback compatibility and independent review.
Keep raw evidence outside the repository; publish only a reviewed safe summary.

After privacy clearance, push the reviewed candidate branch and wait for its exact-commit push CI,
including supported OS/Node and browser jobs, **before creating a public PR**. PR CI is an additional
check. Do not open a PR with required checks failed, pending, unrun or stale, or promise to finish them
afterward. An unavailable check is not an applicability exception. Candidate changes invalidate related
checks; repeat local checks and privacy review before pushing an update, then obtain fresh push CI
before opening the PR. Report the actual verification boundary.

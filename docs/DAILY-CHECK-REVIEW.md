# Codex Daily Check 0.3.0 — public readiness review

Reviewed on 2026-09-16 from three perspectives: senior development (probe portability and failure handling), AI evaluation (false readiness and evidence limitations), and Codex operation (actual browser/native routes, authorization and packaging).

## Changes made before publication

- Removed developer-machine paths and a mandatory private CLI-wrapper dependency. A verified local wrapper can still be selected explicitly; unsupported OS-only checks remain unsupported.
- Separated in-app browser and external Chrome read/navigation/input checks. Computer Use discovery never substitutes for native app input.
- Required accurate CLI version provenance, stable-channel comparison and bounded latest-release metadata. Updates are suggested commands only; no updater or Desktop shutdown is executed.
- Prevented an over-budget or backwards-clock run from returning overall READY, even if its operational rows pass.
- Rejected duplicate capability names and malformed hashes. Missing inventory no longer claims that all previous tools disappeared.
- Restricted copied system receipt data to version/status fields. Personal run paths, screenshots, native responses and installation receipts are not in this repository.
- Clarified that report status is based on caller-recorded observations. New-file writes do not make receipts signed, tamper-proof, or independent runtime attestations.
- Kept immediate failure recording when documentation is unavailable; later official-source diagnosis and authorized recovery are separate from the five-minute diagnostic target.

## Validation and limits

The repository verification command runs the new plugin's offline Python regression tests in addition to the existing plugins. The GitHub matrix exercises Python logic on Linux, Windows and macOS; it does not operate those systems' GUI applications.

During local Windows authoring, the agent separately exercised external Chrome and the in-app browser: public page read, real link navigation, input and exact value readback. It exercised Computer Use in a new Notepad tab, captured the screen, typed Korean text, saved a new file and compared its UTF-8 contents. Existing user tabs were preserved. Chrome was already running, so this is not cold-start certification.

The plugin-owned Windows notification and response form received a user-confirmed response. That does not prove Codex's native approval notification or approve any operation. Actual approval flow and an end-to-end five-minute benchmark remain unverified. A previous failure to enumerate a PowerShell-hosted test form was not treated as proof that all native apps were inaccessible.

Known boundaries: runtime availability depends on installed plugins and policy; Windows foreground interaction needs an active desktop; exact GUI/tool behavior must be retested on each host. Raw probe receipts stay local. Review caller-authored evidence before sharing. A recovery is complete only after the original real operation passes, not merely after a restart or reinstall.

## Official references

- [Computer Use setup, Windows foreground and app access](https://learn.chatgpt.com/docs/computer-use)
- [Browser extension setup and troubleshooting](https://learn.chatgpt.com/docs/chrome-extension)
- [Codex CLI installation and update commands](https://developers.openai.com/codex/cli/)

These sources document setup and boundaries, not a universal guarantee that every installed plugin must work under every managed policy. Do not bypass security policy to turn a failed check green.

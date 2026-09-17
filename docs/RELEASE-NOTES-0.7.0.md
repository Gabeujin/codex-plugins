# v0.7.0 — Codex Daily Check 0.5.0

Daily Check now overlaps independent background probes with browser checks and coordinates a separate foreground interval with the user before Computer Use. IAB, actual Chrome, native app input and human notification responses retain separate evidence. Other plugin versions are unchanged.

- Use a three-digit notification code. Incorrect input stays open for correction within the original timeout; retain only match status and attempt count, never raw answers.
- Start the diagnostic clock before discovery with `--started-epoch`. The 300-second ceiling includes setup and waits; stop new probes at 240 seconds and reserve final readback time.
- Record multiple validated observations with `record-batch --input FILE`. Validate every row before appending; preserve existing immutable receipts.
- Resolve helper paths from the loaded skill file, pass capabilities as a UTF-8 JSON file, and distinguish top-level tools from the discovered tool list. Reuse returned paths instead of guessing report filenames.
- Background reads may overlap browser work. Shared focus/input, Computer Use and the topmost human form must not overlap. No user readiness means an explicit deferred result, never automatic mouse takeover.

Regression scope: report timing, batch validation, immutable receipts, and the real PowerShell click-handler logic executed without displaying a window. These tests are not new GUI delivery proof. Existing observed browser/native successes remain historical evidence. Actual approval coverage can remain blocked by session policy; no all-features READY claim is made.

CLI updates remain command-only. No user configuration, approval policy, Desktop process or CLI installation is changed by the diagnostic. Receipt schemaVersion remains 1 with additive responseAttempts metadata; existing receipts are preserved.

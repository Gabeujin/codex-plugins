# v0.6.0 — Codex Daily Check 0.4.0

This release adds Codex Daily Check to the tagged marketplace bundle and improves the distinction between diagnostic completion and fully verified readiness. Other plugin versions remain K-Tech Radar 0.4.0, KGJ Design 1.3.0, and Canvas Web Experiences 1.7.0.

- Treat 300 seconds as the diagnostic ceiling, finish early when checks are resolved, and use remaining time to resolve actionable uncertainty. Reserve finalization time and report measured overruns honestly.
- Require independent in-app and actual Chrome checks plus actual native app input when Computer Use is installed.
- Verify the existing extracted bundled CLI against the Appx payload by SHA-256 before invoking its version command. Compare it with the standalone CLI as a separate release channel. Never execute CLI updates.
- Test the app-owned question notification through a real question and minimized-app observation. Distinguish click-to-app response, inline response, plugin-owned forms, and genuine approval notifications.
- Require genuine approval coverage for full READY; restricted host policy remains an explicit blocker.

Local evidence: a diagnostic using 0.3.0 completed in 180.713 seconds with PARTIAL status. Subsequent corrections verified the bundled CLI and app-owned question notification. This does not certify a fully unattended run, actual approval notifications, completion notifications, or all newly released features. No private receipts or screenshots are bundled.

See the [review](DAILY-CHECK-REVIEW.md), [runtime support](RUNTIME-SUPPORT.md), and [installation guide](INSTALL-AND-UPDATE.md). Release assets are bound to an exact Git commit and include a SHA-256 inventory; CI verifies code behavior, not every host's GUI or human notification delivery.

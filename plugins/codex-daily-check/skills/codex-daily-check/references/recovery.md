# Installed feature recovery

Verified official sources on 2026-09-16; fetch current pages again when investigating a new failure:

- [Computer Use](https://learn.chatgpt.com/docs/computer-use): plugin installation and enablement, server/skill toggles, Windows active desktop, app approval, managed restrictions.
- [Browser extension](https://learn.chatgpt.com/docs/chrome-extension): actual Chrome/profile connection, setup, website permissions and documented recovery order.
- [Configuration Reference](https://developers.openai.com/codex/config-reference/): inspect only relevant settings when needed; do not dump full configs containing secrets.

## Diagnose before changing

Keep three separate facts: installed package; exposed runtime tool; successful real operation. Installed but inaccessible is actionable and cannot be called healthy. Capture plugin ID/version, exact tool route, failed step/error class, whether a real window/tab was visible, and safe next action. Lack of an accessibility tree alone is not failure when the installed API supports screenshot-based input.

For official research, search the exact feature/error with the OpenAI docs search tool, then fetch the matched Computer Use or browser-extension page. Do not stop at an API computer-use model page: that is a different product surface. If search misses, use the verified pages above and their links. Distinguish official guidance from a local inference.

## Windows Computer Use

Official setup requires the Computer Use plugin enabled with its server and skill toggles, app access permitted, and a visible target on the active Windows desktop. A locked/background session is not a valid Windows foreground probe. The host may require a human app-access decision; never approve it through UI automation or silently persist an allowlist.

Use current bundled `@oai/sky` guidance when that is the exposed route. Import, discover, select a unique returned native app window, observe, act and re-observe. For text input, prefer Notepad: launch through the supported API, inspect the restored window, create a NEW tab/document before typing, focus its blank editor, type a unique harmless token, inspect screenshot/text, and save to a NEW run file for exact UTF-8 readback if time allows. Never overwrite or clear existing user tabs. Preserve the saved test file.

In the author's bounded Windows validation on 2026-09-16, the custom PowerShell WinForms fixture was absent from `sky.list_windows`; Notepad worked. The Computer Use contract also forbids automating terminal apps. Therefore never use a PowerShell-hosted form as the sole native-control acceptance test. The separate WinForms human notification remains useful solely for the human notification route.

If accessibility is null, observe a screenshot and use current screenshot coordinates for a visible blank editor. Do not dereference `accessibility.tree` unconditionally. Never infer focus solely from the window title. If input outcome is uncertain, reobserve once before any retry. A transport timeout permits one documented runtime recovery with fresh handles; preserve evidence and do not keep the same failed loop running.

## Actual Chrome vs in-app browser

Test each browser independently. Chrome must resolve to the installed external Chrome/provider, use the extension's active profile, open a new task-owned tab, and prove read + click navigation + text-input readback. Record whether Chrome was already running; opening a tab in an existing Chrome process is not a cold-start test. Do not terminate the user's Chrome to manufacture cold-start evidence. IAB success does not pass Chrome.

Official browser recovery checks website blocking, desktop app version, browser connection (`Manage`), active extension profile, and a new chat. Later steps include browser/app restart or extension reinstall and support feedback. Choose only steps justified by observed evidence and current authorization. Do not restart a browser with user work, interrupt the current Codex host, remove an extension, weaken site permissions, or delete caches automatically. When one of those is genuinely required, preserve the completed diagnostic and clearly identify the exact human action and why it is required. Continue independent local work.

Do not bypass a file-URL denial by serving the same forbidden content another way. Use a materially different harmless public-page probe for general browser testing and retain local-file access as a separate blocked optional check. For example, on `https://example.com`, inspect and click its public documentation link; on `https://www.wikipedia.org`, enter a nonsensitive test token in the observed search field and read it back without submitting. Input may trigger site suggestions, so use no private token or data.

## Repair completion

Daily diagnosis still emits its report by the five-minute target. Installed-feature failures start a separate recovery phase when authorized by the request, based on an explicit request to normalize failed installed features. Research and non-disruptive fixes continue without stopping at a list of suggestions. Preserve any changed file under the user's pre-change backup policy. Finish only after the same originally failing real-app/browser action passes, or a precise host/policy/human-action blocker remains. Store a new recovery receipt linked to the original report; keep original failure evidence. A reinstall/version bump alone is not recovery.

Record `official-docs: <fetched URL or exact unsuccessful search evidence>; normalization: <action/result or concrete blocker>` in actual-failure evidence, without secrets. If docs are temporarily unreachable, record that fact and continue safe local diagnosis; do not invent a source or suppress the failure record.

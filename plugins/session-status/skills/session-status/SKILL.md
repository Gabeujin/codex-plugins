---
name: session-status
description: Keep a Codex chat title aligned with its actual task state using a status prefix, preserving the topic and project tags.
---

# Session Status

Use a single status prefix at the beginning of the current chat title. Follow the user's language and explicit label choices. Common labels are `[Working]`, `[Planning]`, `[Needs review]`, `[Verified]`, `[Committed]`, `[Deployed]`, `[Tested]` and `[Blocked]`. Korean equivalents include `[작업중]`, `[기획 및 검토]`, `[검토대상]`, `[확인완료]` and `[커밋완료]`.

At task start, a meaningful state change, and before the final reply:

1. Confirm the current thread ID from the host or lifecycle context. Never choose another chat by similarity. A confirmation message may close the current task rather than begin new work.
2. Read the current title with `get_session_title` or the host's title tool. Select a label supported by actual evidence. Distinguish user-confirmed facts from actions you executed; a turn ending, an idle process or a submitted request does not establish task completion.
3. Use `set_session_status` with that exact `expected_title`. Pass `previous_status` when replacing a user-defined old status. Known status prefixes are replaced, but unknown project tags are preserved. `preview_session_status` provides a no-write preview.
4. Check the verified response. If the title changed concurrently, read it again and reassess. Do not retry a failed mutation without resolving its cause.

If the host has a native title tool, it can be used instead. For a new unnamed chat, use the native tool to set a concise topic and prefix; never derive a title from private transcript files. If title tools or the local Codex API are unavailable, explain the limit and continue the requested work.

Commit, deployment and test labels require the corresponding result in the named environment. Do not run those actions just to obtain a label. Keep sensitive content out of titles. The tools change metadata only; they do not validate work, commit code, deploy, change permissions, edit global instructions or trust hooks.

The plugin hooks add these reminders and the current session ID to model context; the agent performs the title update. Users must review and trust hooks through `/hooks` or the App's hook settings. Do not bypass that flow. An unavailable hook does not prove that a title update failed, and an installed hook does not prove that it ran.

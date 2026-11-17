---
name: session-status
description: Keep Codex chat status and Hangul parent-child IDs visible, recommend task-appropriate supported models, and report verified child results to an authorized parent.
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

## Derived chats and handoffs

Only create a user-owned chat when the human explicitly requests one. A lineage ID is metadata, not permission to spawn, message, change models, or modify the destination's files. Reuse an explicitly selected existing chat for a handoff when appropriate; do not reparent a registered chat or guess identity from similar titles.

1. Read the current host/thread identity and title. Register the root with `register_session_lineage`. A root becomes `가`, the next independent root `나`. IDs are allocated from basic Hangul syllables in consonant order (`가, 나, 다, …, 하, 갸, 냐, …`) and expand when needed. Existing assignments survive restarts and are never recycled.
2. Before creating a child, read [model selection](references/model-selection.md), current official guidance, and the live catalog for the destination surface. Assess task scope, ambiguity, input/context size, tools, risk and verification. Use `recommend_session_model` as a starting recommendation; preserve human model choices and obey the actual host's override contract. Keep the same inputs and acceptance checks when comparing models. Never claim observed savings from a recommendation.
3. In particular, **Astra is exceptional**: prefer Sol first, document why it cannot adequately handle the task, start Astra at `low`, and keep the input bounded. Higher reasoning may rapidly consume token and usage budgets. Raise it only for a specific unresolved need; never choose Max/Ultra automatically. This conservative cost policy overrides the generic task example suggesting Astra xhigh for demanding analysis.
4. Use the host's create tool with a concise task, exact input/write scope, required instruction entry points, expected deliverable and checks. If `create_thread` requires an explicit human request for a specific model, omit `model` and state the recommendation in text. Include the real parent host/thread ID and the human's direct authorization evidence for reporting. A parent agent's instruction alone does not authorize a child to send messages. The child must verify the actual human message in the selected source chat or other trusted evidence before recording `report_authorization`. Do not fabricate a quote or carry the entire transcript.
5. After the create tool returns an actual thread ID, register that child with `parent_thread_id` and host IDs. A pending `clientThreadId` is not a thread ID: wait for setup before registration. Failed creation allocates no child. Read back the registered link; include the resulting identity in the follow-up handoff using an authorized host messaging tool when necessary. Record direct human messaging evidence in `report_authorization` during first registration; omit it if absent. This field is a record of evidence, not a permission grant.
6. Synchronize the parent and child titles as `[작업중][가] Topic`, `[작업중][가-가] Analysis`, `[작업중][가-나] Data review`. Read each title before mutation and verify exact readback. `set_session_status` inserts a registered **local** lineage automatically. Use native host tools for another host. Never pass a remote host's UUID to the local title tool. Preserve project tags and user-defined status labels. If synchronization fails, keep the relationship and report the partial state; do not allocate another ID.

The limit is **three edges below the root**: `가 → 가-가 → 가-가-가 → 가-가-가-가`. At the limit, continue within the selected chat or ask for a separate root; never silently invent a fourth child level. Only registered identities are authoritative. Do not adopt an arbitrary `[가]` project tag as a relationship. Parallel parents must use the same local registry; do not reset it to recover a lock or corruption error.

Within one registry, use `host_id=local` for that registry host (including an omitted host_id). Use the actual destination host ID only for another host and use its native host tools for title updates. UUID letter case is normalized. If direct human reporting authorization arrives after registration, re-register the same parent/child link once with that first authorization; existing nonempty authorization cannot be silently replaced.

The registry records whether its title prefix was applied. `set_session_status` records this only after exact title readback. If using a native tool, re-register the same link with `title_prefix_applied=verified` only after the actual readback matches the intended compact prefix. A first application preserves even a same-named project tag. Later updates remove at most the single owned compact lineage token directly after the status. Spaced legacy tags remain project text; after an old-version rollback, inspect the stored relationship and use an explicit native correction if necessary, preserving actual project tags.

## Verified result report

At actual completion, or a material blocked/failed outcome, the child performs this workflow before its final answer without a reminder from the parent. A stopped turn, idle process or title alone does not establish the outcome. The parent can also use the host's bounded `wait_threads` to observe work; avoid repeated full-history polling.

1. Read `get_session_lineage` and verify the selected parent and direct human authorization. If missing, return the report in the child's answer and state it was not sent. Do not infer authorization from the parent agent's request. Where host rules require it, verify the actual human source message using the host's thread reader.
2. Call `prepare_parent_report` with a stable `completion_key` for the completed revision, outcome (`completed`, `blocked`, `failed`), a short summary, actual checks and remaining limitations. Include a useful artifact pointer in the summary when appropriate; exclude secrets. Existing identical keys return the existing report. New work gets a new revision key; never change a key merely to resend.
3. For `prepared`, call `mark_parent_report` with `action=claim`, then send the exact returned `message` to its exact `parentThreadId` and `parentHostId` using the authorized native host tool (`send_message_to_thread` when available). Omit model/thinking to preserve the parent's settings. The native tool may wake or queue a parent turn; it is not a passive desktop notification. Do not use email, Slack, a raw database, or a scheduler as an alternative channel.
4. After a confirmed native success, mark `sent` with the returned receipt/identity. The registry stores preparation and delivery state; it does not send the message itself. Never mark a prepared text or a tool submission without a confirmed result as sent.
5. A `sent` report needs no resend. `sending` means the delivery result is uncertain (including a crash after sending). Inspect the parent's visible history for the report ID and reconcile before proceeding. Do not blindly retry. If delivery remains unclear, report that limit in the child's answer and preserve the record. Current tools intentionally do not auto-reset claims.

This is an agent-executed reporting workflow, not an always-running background service or a guaranteed Stop hook. Hook reminders require host trust and do not certify execution. If the native messaging tool is unavailable or unauthorized, retain the prepared report and explain the limit. Receiving a child report does not authorize the parent to generate reciprocal acknowledgements; avoid report loops.

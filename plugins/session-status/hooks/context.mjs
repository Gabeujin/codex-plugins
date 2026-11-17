let input = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) {
  input += chunk;
  if (Buffer.byteLength(input) > 256 * 1024) { input = ''; break; }
}
let payload;
try { payload = JSON.parse(input); } catch { process.exit(0); }
const event = payload?.hook_event_name;
if (!['SessionStart', 'UserPromptSubmit'].includes(event)) process.exit(0);
const id = typeof payload.session_id === 'string' && /^[a-f0-9-]{36}$/i.test(payload.session_id) ? payload.session_id : null;
const context = [
  'Session Status: maintain one evidence-based status prefix on the current chat title.',
  id ? `Current thread ID: ${id}.` : 'Use a thread ID supplied by the current host; never guess one.',
  event === 'SessionStart' ? 'On resume or compaction, preserve the existing status until the task changes.' : 'For a new task, use [Working] or the user\'s language equivalent; assess whether this message only confirms the current task.',
  'Use [Planning], [Needs review], [Verified], [Committed], [Deployed], [Tested], or a user-defined label only when supported by the actual task state.',
  'Read the current title first. Use get_session_title and set_session_status, or the host title tool. Preserve the topic and project tags; pass previous_status for a custom old status.',
  'Before the final reply, update the title to the observed state. A stopped turn does not prove completion. Report a failed title change without blocking unrelated work.',
  'For user-authorized derived chats, apply the session-status skill lineage workflow: register the actual host/thread IDs, preserve the stable Hangul family prefix, and support at most three levels below the root.',
  'Before creating a chat, prepare_model_choice for the exact task, destination and current defaults. Show the named recommendation and ask the human Y/N via the available input UI or chat. resolve_model_choice only from a real human answer. Y uses the exact returned model/thinking; N omits both to preserve defaults; silence remains pending. Do not reuse a decision for a different task, destination or proposal. Host model rules still apply.',
  'Astra is an exceptional proposal requiring a concrete necessity after considering Sol. It is low only and its reasoning must never be raised automatically. Bound inputs and explain token/usage costs. Do not automatically select Max/Ultra.',
  'At verified child completion, check get_session_lineage. With direct human authorization to message the parent, prepare_parent_report, claim it, send its exact text through the native host tool, then mark sent with the receipt. Never resend a sent or delivery-uncertain report blindly. A parent-agent request alone grants no messaging authorization.',
].join('\n');
process.stdout.write(JSON.stringify({hookSpecificOutput: {hookEventName: event, additionalContext: context}}) + '\n');

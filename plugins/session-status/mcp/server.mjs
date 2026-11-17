import readline from 'node:readline';
import {getTitle, setStatus, formatTitle} from '../lib/title.mjs';
import {withCodex} from '../lib/codex.mjs';
import {LineageStore} from '../lib/lineage.mjs';
import {recommend} from '../lib/routing.mjs';
import {prepareModelChoice, resolveModelChoice, getModelChoice} from '../lib/model-choice.mjs';

const string = {type: 'string'};
const schema = (properties, required) => ({type: 'object', properties, required, additionalProperties: false});
const tools = [
  {name: 'get_session_title', description: 'Read only the title of an explicitly selected local Codex thread.',
    inputSchema: schema({thread_id: string}, ['thread_id']), annotations: {readOnlyHint: true}},
  {name: 'preview_session_status', description: 'Preview a status prefix without reading or changing any session.',
    inputSchema: schema({title: string, status: string, previous_status: string}, ['title', 'status']), annotations: {readOnlyHint: true}},
  {name: 'set_session_status', description: 'Replace a title status prefix and verify its readback. Use the current title as expected_title; confirm completion evidence before using a completion label.',
    inputSchema: schema({thread_id: string, status: string, expected_title: string, previous_status: string}, ['thread_id', 'status', 'expected_title']),
    annotations: {readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false}},
  {name: 'register_session_lineage', description: 'Register an explicit local or host-qualified session and optional parent. Returns a stable Hangul lineage ID, root plus at most three child levels. Register the parent first. This writes local relationship metadata only; use status/native title tools to synchronize both titles. Record report_authorization only from direct human messaging authorization, never a parent-agent instruction.',
    inputSchema: schema({thread_id: string, host_id: string, parent_thread_id: string, parent_host_id: string, report_authorization: string, title_prefix_applied: string}, ['thread_id']), annotations: {readOnlyHint: false, destructiveHint: false}},
  {name: 'get_session_lineage', description: 'Read the selected session relationship, children and report delivery states from the local registry. Does not read transcripts or infer parents from titles.',
    inputSchema: schema({thread_id: string, host_id: string}, ['thread_id']), annotations: {readOnlyHint: true}},
  {name: 'recommend_session_model', description: 'Recommend a supported model/effort using task-specific official guidance and a live catalog JSON array of {model,efforts}. Does not change models or create tasks. Workloads: extraction, scoped_fix, technical, conflicting_evidence, demanding_analysis. Check host override rules and current docs before use.',
    inputSchema: schema({workload: string, live_catalog: string, user_model: string, user_effort: string, astra_necessity: string}, ['workload', 'live_catalog']), annotations: {readOnlyHint: true}},
  {name: 'prepare_model_choice', description: 'Prepare a task-bound Y/N question for a named model/effort recommendation and actual destination defaults. Ask the human using the host input UI or chat; no response remains pending. This records metadata only and never creates a task or grants permission. Workloads match recommend_session_model; Astra requires necessity and low only.',
    inputSchema: schema({thread_id: string, host_id: string, scope_key: string, task_description: string, destination_host: string, default_model: string, default_effort: string, workload: string, live_catalog: string, user_model: string, user_effort: string, astra_necessity: string}, ['thread_id', 'scope_key', 'task_description', 'destination_host', 'default_model', 'default_effort', 'workload', 'live_catalog']), annotations: {readOnlyHint: false, destructiveHint: false}},
  {name: 'resolve_model_choice', description: 'Record an actual direct human Y or N for the exact prepared task/model/destination choice. human_evidence must reference the real human answer, never an agent message or assumed silence. Y returns the exact named model/thinking; N returns {} to preserve native defaults. Stale or changed decisions are rejected. This tool does not verify human identity, send prompts, or execute models.',
    inputSchema: schema({choice_id: string, reply: string, human_evidence: string}, ['choice_id', 'reply', 'human_evidence']), annotations: {readOnlyHint: false, destructiveHint: false}},
  {name: 'get_model_choice', description: 'Read a prepared model choice after resume. Only a current approved/declined choice returns executable override metadata; pending or inactive choices return null. Does not execute models.',
    inputSchema: schema({choice_id: string}, ['choice_id']), annotations: {readOnlyHint: true}},
  {name: 'prepare_parent_report', description: 'Prepare a bounded parent report after actual work verification. Requires recorded direct human messaging authorization. completion_key identifies this completion/revision; same key and content returns the existing delivery state. Does not send anything.',
    inputSchema: schema({thread_id: string, host_id: string, completion_key: string, outcome: string, summary: string, verification: string, limitations: string}, ['thread_id', 'completion_key', 'outcome', 'summary', 'verification', 'limitations']), annotations: {readOnlyHint: false, destructiveHint: false}},
  {name: 'mark_parent_report', description: 'Claim a prepared report immediately before sending its exact text via the authorized native host messaging tool. After native success, mark sent with its receipt. A sending state is delivery-uncertain: reconcile the parent before any retry. This tool never sends messages.',
    inputSchema: schema({report_id: string, action: string, receipt: string}, ['report_id', 'action']), annotations: {readOnlyHint: false, destructiveHint: false}},
];
let initialized = false;
const send = value => process.stdout.write(JSON.stringify(value) + '\n');
const result = (id, value) => send({jsonrpc: '2.0', id, result: value});
const error = (id, code, message) => send({jsonrpc: '2.0', id, error: {code, message}});
const content = value => ({content: [{type: 'text', text: JSON.stringify(value)}]});

async function handle(line) {
  let request;
  try { request = JSON.parse(line); } catch { error(null, -32700, 'Invalid JSON'); return; }
  if (!request || Array.isArray(request) || request.jsonrpc !== '2.0' || typeof request.method !== 'string') {
    error(null, -32600, 'Invalid request'); return;
  }
  if (!Object.hasOwn(request, 'id')) return;
  const {id, method, params = {}} = request;
  if (!(typeof id === 'string' || (typeof id === 'number' && Number.isFinite(id)))) { error(null, -32600, 'Invalid request ID'); return; }
  if (!params || typeof params !== 'object' || Array.isArray(params)) { error(id, -32602, 'Invalid parameters'); return; }
  // 응답 ID 없는 알림은 실행하지 않고 오류에도 입력값을 노출하지 않도록 구분
  if (method === 'initialize') {
    initialized = true;
    const versions = ['2025-11-25', '2025-06-18'];
    result(id, {protocolVersion: versions.includes(params.protocolVersion) ? params.protocolVersion : versions[0],
      capabilities: {tools: {}}, serverInfo: {name: 'session-status', version: '0.3.0'}});
  } else if (method === 'ping') result(id, {});
  else if (!initialized) error(id, -32002, 'Initialize first');
  else if (method === 'tools/list') result(id, {tools});
  else if (method === 'tools/call') {
    const tool = tools.find(item => item.name === params.name);
    const args = params.arguments;
    if (!tool || !args || typeof args !== 'object' || Array.isArray(args)
      || tool.inputSchema.required.some(key => typeof args[key] !== 'string')
      || Object.entries(args).some(([key, value]) => !(key in tool.inputSchema.properties) || typeof value !== 'string')) {
      error(id, -32602, 'Invalid tool or arguments'); return;
    }
    try {
      if (tool.name === 'preview_session_status') result(id, content({title: formatTitle(args.title, args.status, args.previous_status)}));
      else if (tool.name === 'register_session_lineage') result(id, content(new LineageStore().register(args)));
      else if (tool.name === 'get_session_lineage') result(id, content(new LineageStore().get(args.thread_id, args.host_id)));
      else if (tool.name === 'recommend_session_model') result(id, content(recommend(args)));
      else if (tool.name === 'prepare_model_choice') result(id, content(prepareModelChoice(new LineageStore(), args)));
      else if (tool.name === 'resolve_model_choice') result(id, content(resolveModelChoice(new LineageStore(), args)));
      else if (tool.name === 'get_model_choice') result(id, content(getModelChoice(new LineageStore(), args.choice_id)));
      else if (tool.name === 'prepare_parent_report') result(id, content(new LineageStore().prepare(args)));
      else if (tool.name === 'mark_parent_report') result(id, content(new LineageStore().mark(args)));
      else if (tool.name === 'get_session_title') result(id, content(await withCodex(async rpc => ({thread_id: args.thread_id, title: await getTitle(rpc, args.thread_id)}))));
      else {
        const store = new LineageStore(); const session = store.get(args.thread_id).session;
        const saved = await withCodex(rpc => setStatus(rpc, args, session?.lineageId, session?.titlePrefixApplied ?? false));
        if (session) store.markTitleApplied(args.thread_id);
        result(id, content(saved));
      }
    } catch {
      result(id, {...content({error: 'Session operation unavailable, invalid, changed, locked, or not verified. Inspect current title/lineage/report/choice state and resolve the cause before retrying. Do not assume a Y/N decision or resend uncertain delivery.'}), isError: true});
    }
  } else error(id, -32601, 'Method not found');
}

const lines = readline.createInterface({input: process.stdin, crlfDelay: Infinity});
let chain = Promise.resolve();
lines.on('line', line => {
  if (Buffer.byteLength(line) > 64 * 1024) { error(null, -32600, 'Request too large'); return; }
  chain = chain.then(() => handle(line)).catch(() => error(null, -32603, 'Request failed'));
});
lines.on('close', () => { void chain; });

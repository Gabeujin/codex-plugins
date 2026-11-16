import readline from 'node:readline';
import {getTitle, setStatus, formatTitle} from '../lib/title.mjs';
import {withCodex} from '../lib/codex.mjs';

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
      capabilities: {tools: {}}, serverInfo: {name: 'session-status', version: '0.1.0'}});
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
      else if (tool.name === 'get_session_title') result(id, content(await withCodex(async rpc => ({thread_id: args.thread_id, title: await getTitle(rpc, args.thread_id)}))));
      else result(id, content(await withCodex(rpc => setStatus(rpc, args))));
    } catch {
      result(id, {...content({error: 'Session title unavailable, invalid, changed, or not verified. Read the title and retry only after resolving the cause.'}), isError: true});
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

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {formatTitle, setStatus, getTitle} from '../lib/title.mjs';
import {CodexRpc, resolveCodex, withCodex} from '../lib/codex.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const id = '00000000-0000-0000-0000-000000000001';
const rpc = (name, behavior = {}) => ({calls: [], async call(method, params) {
  this.calls.push([method, params]);
  if (method === 'thread/name/set') {
    if (behavior.fail) throw new Error('synthetic failure');
    if (!behavior.mismatch) name = params.name;
    return {};
  }
  return {thread: {name}};
}});

test('status replacement preserves project tags and supports repeated custom labels', () => {
  assert.equal(formatTitle('[Working] [Example] Improve sample', 'Needs review'), '[Needs review] [Example] Improve sample');
  assert.equal(formatTitle('[Working] [Verified] Sample', 'Planning'), '[Planning] Sample');
  assert.equal(formatTitle('[Custom] Sample', 'Custom'), '[Custom] Sample');
  assert.equal(formatTitle('[Custom] Sample', 'Tested', 'Custom'), '[Tested] Sample');
  assert.equal(formatTitle('[Example] Sample', '작업중'), '[작업중] [Example] Sample');
  assert.equal(formatTitle('[작업중] 예제 개선', '확인완료'), '[확인완료] 예제 개선');
});

test('invalid labels, empty topics and damaged Unicode are rejected', () => {
  for (const status of ['', ' Working ', '[Done]', 'Line\nBreak', '\uFFFD', '\uD800']) {
    assert.throws(() => formatTitle('Sample', status));
  }
  assert.throws(() => formatTitle('[Working]', 'Verified'));
  assert.throws(() => formatTitle('x'.repeat(500), 'Working'));
});

test('update checks expected title, writes metadata only, and reads back exact Unicode', async () => {
  const fake = rpc('[Working] 예제');
  const result = await setStatus(fake, {thread_id: id, status: '검토대상', expected_title: '[Working] 예제'});
  assert.equal(result.title, '[검토대상] 예제');
  assert.equal(result.verified, true);
  assert.deepEqual(fake.calls.map(([method]) => method), ['thread/read', 'thread/name/set', 'thread/read']);
  assert(fake.calls.filter(([method]) => method === 'thread/read').every(([, params]) => params.includeTurns === false));
});

test('stale expected title, API failure and readback mismatch never report success', async () => {
  await assert.rejects(setStatus(rpc('Changed'), {thread_id: id, status: 'Working', expected_title: 'Sample'}), /Title changed/);
  for (const behavior of [{fail: true}, {mismatch: true}]) {
    await assert.rejects(setStatus(rpc('Sample', behavior), {thread_id: id, status: 'Working', expected_title: 'Sample'}));
  }
  const fake = rpc('Sample');
  await assert.rejects(getTitle(fake, 'not-a-thread'));
  assert.equal(fake.calls.length, 0);
});

test('same title is idempotent and unrelated project tags remain intact across update and rollback', async () => {
  const fake = rpc('[Example] 합성 예제');
  let title = '[Example] 합성 예제';
  for (const label of ['작업중', '검토대상', '작업중']) {
    title = (await setStatus(fake, {thread_id: id, status: label, expected_title: title})).title;
  }
  assert.equal(title, '[작업중] [Example] 합성 예제');
  const count = fake.calls.filter(([method]) => method === 'thread/name/set').length;
  await setStatus(fake, {thread_id: id, status: '작업중', expected_title: title});
  assert.equal(fake.calls.filter(([method]) => method === 'thread/name/set').length, count);
});

function runScript(script, input) {
  const result = spawnSync(process.execPath, [path.join(root, script)], {input, encoding: 'utf8', timeout: 10000, windowsHide: true});
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
}

test('hooks include only selected session identity and guidance, never prompt or transcript input', () => {
  for (const hook_event_name of ['SessionStart', 'UserPromptSubmit']) {
    const result = runScript('hooks/context.mjs', JSON.stringify({hook_event_name, session_id: id,
      prompt: 'SYNTHETIC_PRIVATE_MARKER', transcript_path: 'SYNTHETIC_PATH_MARKER'}));
    const text = JSON.stringify(result);
    assert(!text.includes('SYNTHETIC_PRIVATE_MARKER'));
    assert(!text.includes('SYNTHETIC_PATH_MARKER'));
    assert(text.includes(id));
    assert(!result[0].decision);
  }
  assert.deepEqual(runScript('hooks/context.mjs', '{'), []);
  assert.deepEqual(runScript('hooks/context.mjs', JSON.stringify({hook_event_name: 'Stop'})), []);
});

test('MCP initialize/list/preview works offline and id-less mutation is ignored', () => {
  const messages = [
    {jsonrpc: '2.0', id: 1, method: 'initialize', params: {protocolVersion: '2025-11-25'}},
    {jsonrpc: '2.0', id: 2, method: 'tools/list'},
    {jsonrpc: '2.0', id: 3, method: 'tools/call', params: {name: 'preview_session_status', arguments: {title: 'Sample', status: 'Working'}}},
    {jsonrpc: '2.0', method: 'tools/call', params: {name: 'set_session_status', arguments: {thread_id: id, expected_title: 'Sample', status: 'Committed'}}},
    {jsonrpc: '2.0', id: 4, method: 'tools/call', params: {name: 'preview_session_status', arguments: {title: 'Sample', status: 'Working', extra: 'not-allowed'}}},
  ];
  const replies = runScript('mcp/server.mjs', messages.map(x => JSON.stringify(x)).join('\n') + '\n');
  assert.equal(replies[0].result.protocolVersion, '2025-11-25');
  assert.equal(replies[1].result.tools.length, 8);
  assert.equal(JSON.parse(replies[2].result.content[0].text).title, '[Working] Sample');
  assert.equal(replies.length, 4);
  assert.equal(replies[3].error.code, -32602);
});

test('native resolver uses explicit paths and never requires a shell', () => {
  assert.equal(resolveCodex({SESSION_STATUS_CODEX_BIN: process.execPath}), process.execPath);
  assert.throws(() => resolveCodex({SESSION_STATUS_CODEX_BIN: 'relative'}));
  assert.throws(() => resolveCodex({PATH: ''}));
});

test('real child-process RPC resolves replies and terminates on deadline', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'session-status-fixture-'));
  const server = path.join(directory, 'rpc.mjs');
  fs.writeFileSync(server, `import readline from 'node:readline';
const lines=readline.createInterface({input:process.stdin});
lines.on('line',line=>{const r=JSON.parse(line);if(r.method!=='hang')process.stdout.write(JSON.stringify({id:r.id,result:{ok:true}})+'\\n');});`, 'utf8');
  const client = new CodexRpc({command: process.execPath, args: [server], timeout: 1000});
  assert.deepEqual(await client.call('initialize', {}), {ok: true});
  await assert.rejects(client.call('hang', {}), /timed out/);
  assert.equal(client.closed, true);
});

test('Codex handshake sends initialized before metadata requests', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'session-status-handshake-'));
  const server = path.join(directory, 'rpc.mjs');
  fs.writeFileSync(server, `import readline from 'node:readline';
let ready=false;
readline.createInterface({input:process.stdin}).on('line',line=>{
 const r=JSON.parse(line);if(r.method==='initialized'){ready=true;return;}
 const value=r.method==='initialize'||ready?{result:{ready}}:{error:{code:-1}};
 process.stdout.write(JSON.stringify({id:r.id,...value})+'\\n');
});`, 'utf8');
  const result = await withCodex(client => client.call('thread/read', {}), {command: process.execPath, args: [server]});
  assert.deepEqual(result, {ready: true});
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync, execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {LineageStore, hangulId} from '../lib/lineage.mjs';
import {formatTitle, setStatus} from '../lib/title.mjs';
import {recommend} from '../lib/routing.mjs';

const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const fixture = () => new LineageStore(fs.mkdtempSync(path.join(os.tmpdir(), 'lineage-fixture-')));
test('stable siblings, Hangul order, restart and root plus three child levels', () => {
  // 재개와 최대 깊이에서도 이미 발급한 연결과 형제 순서가 유지되는지 확인
  const store = fixture();
  assert.equal(store.register({thread_id: id(1)}).lineageId, '가');
  assert.equal(store.register({thread_id: id(2), parent_thread_id: id(1)}).lineageId, '가-가');
  assert.equal(store.register({thread_id: id(3), parent_thread_id: id(1)}).lineageId, '가-나');
  assert.equal(store.register({thread_id: id(4), parent_thread_id: id(2)}).lineageId, '가-가-가');
  assert.equal(store.register({thread_id: id(5), parent_thread_id: id(4)}).lineageId, '가-가-가-가');
  assert.throws(() => store.register({thread_id: id(6), parent_thread_id: id(5)}), /depth/);
  const restarted = new LineageStore(store.directory);
  assert.equal(restarted.register({thread_id: id(2), parent_thread_id: id(1)}).lineageId, '가-가');
  assert.equal(restarted.register({thread_id: id(7)}).lineageId, '나');
  assert.equal(restarted.get(id(1)).children.length, 2);
  assert.equal(hangulId(13), '하'); assert.equal(hangulId(14), '갸'); assert.equal(hangulId(140), '가가');
});
test('no guessed parents, self cycles, reparenting, or cross-host ID collision', () => {
  const store = fixture();
  assert.throws(() => store.register({thread_id: id(1), parent_thread_id: id(1)}));
  assert.throws(() => store.register({thread_id: id(2), parent_thread_id: id(1)}));
  store.register({thread_id: id(1)});
  store.register({thread_id: id(2), parent_thread_id: id(1)});
  assert.throws(() => store.register({thread_id: id(1), parent_thread_id: id(2)}), /Reparenting/);
  assert.equal(store.register({thread_id: id(1), host_id: 'remote-fixture'}).lineageId, '나');
  assert.throws(() => store.register({thread_id: '../../example'}));
  assert.throws(() => store.register({thread_id: id(3), host_id: '../example'}));
});
test('registered family prefix and custom status preserve project tags on update and rollback', async () => {
  assert.equal(formatTitle('[Working][가-나] [Example] Sample', 'Verified', undefined, '가-나'), '[Verified][가-나] [Example] Sample');
  assert.equal(formatTitle('[가] Sample', 'Working'), '[Working] [가] Sample');
  assert.equal(formatTitle('[Custom][가] [Example] Sample', '작업중', 'Custom', '가'), '[작업중][가] [Example] Sample');
  assert.equal(formatTitle('[Working] [가] Project topic', 'Verified', undefined, '가', false), '[Verified][가] [가] Project topic');
  assert.equal(formatTitle('[Working][가] [가] Topic', 'Verified', undefined, '가'), '[Verified][가] [가] Topic');
  assert.equal(formatTitle('[Working][가] Topic', 'Verified', undefined, '가', false), '[Verified][가] [가] Topic');
  let title = '[Working][가-나] [Example] Sample';
  const rpc = {async call(method, args) { if (method === 'thread/name/set') title = args.name; return {thread: {name: title}}; }};
  assert.equal((await setStatus(rpc, {thread_id: id(1), expected_title: title, status: 'Verified'}, '가-나')).title, '[Verified][가-나] [Example] Sample');
  // 구버전 상태 변경도 알 수 없는 계층 태그를 보존하므로 데이터 변환 없이 되돌리기 가능
  assert.equal(formatTitle(title, 'Working'), '[Working] [가-나] [Example] Sample');
});
test('lock contention and corrupt store fail closed without resetting metadata', () => {
  // 잠금이나 손상된 JSON을 이유로 기존 데이터를 초기화하지 않는지 확인
  const store = fixture(); store.register({thread_id: id(1)});
  const before = fs.readFileSync(store.file, 'utf8');
  fs.writeFileSync(path.join(store.directory, 'write.lock'), 'fixture lock', 'utf8');
  assert.throws(() => store.register({thread_id: id(2)}));
  assert.equal(fs.readFileSync(store.file, 'utf8'), before);
  const broken = fixture(); fs.writeFileSync(broken.file, '{', 'utf8');
  assert.throws(() => broken.register({thread_id: id(3)}));
  assert.equal(fs.readFileSync(broken.file, 'utf8'), '{');
  const damaged = fixture(); damaged.register({thread_id: id(1)});
  const value = JSON.parse(fs.readFileSync(damaged.file, 'utf8'));
  value.sessions[`local:${id(1)}`].lineageId = '나';
  fs.writeFileSync(damaged.file, JSON.stringify(value), 'utf8');
  const bytes = fs.readFileSync(damaged.file, 'utf8');
  assert.throws(() => damaged.register({thread_id: id(2)}), /allocation/);
  assert.equal(fs.readFileSync(damaged.file, 'utf8'), bytes);
});
test('UUID case is normalized and first human authorization can be recorded later', () => {
  const store = fixture(); const mixed = 'abcdefab-cdef-abcd-efab-abcdefabcdef';
  const first = store.register({thread_id: mixed.toUpperCase()});
  assert.equal(store.register({thread_id: mixed}).lineageId, first.lineageId);
  assert.equal(Object.keys(store.read().sessions).length, 1);
  store.register({thread_id: id(1), parent_thread_id: mixed});
  const authorized = store.register({thread_id: id(1), parent_thread_id: mixed, report_authorization: 'Synthetic human authorization recorded after registration'});
  assert(authorized.reportAuthorization);
  assert.throws(() => store.register({thread_id: id(1), parent_thread_id: mixed, report_authorization: 'Different authority'}));
});
test('independent processes allocate unique siblings through one registry lock', async () => {
  // 서로 다른 프로세스가 하나의 저장소에 등록해도 같은 형제 ID를 받지 않는지 확인
  const store = fixture(); store.register({thread_id: id(1)});
  const worker = path.join(store.directory, 'worker.mjs');
  const library = new URL('../lib/lineage.mjs', import.meta.url).href;
  fs.writeFileSync(worker, `import {LineageStore} from ${JSON.stringify(library)};
const store = new LineageStore(process.argv[2]);
for (let attempt=0; attempt<100; attempt++) {
 try { const result=store.register({thread_id:process.argv[3],parent_thread_id:process.argv[4]}); console.log(result.lineageId); break; }
 catch(error) { if(error.code!=='EEXIST'||attempt===99) throw error; await new Promise(resolve=>setTimeout(resolve,10)); }
}`, 'utf8');
  const run = promisify(execFile);
  const results = await Promise.all([2, 3, 4, 5].map(n => run(process.execPath, [worker, store.directory, id(n), id(1)], {windowsHide: true, timeout: 10000})));
  assert.equal(new Set(results.map(result => result.stdout.trim())).size, 4);
  assert.deepEqual(new Set(store.get(id(1)).children.map(item => item.lineageId)), new Set(['가-가', '가-나', '가-다', '가-라']));
});
test('parent reports require human authority and verified fields, deduplicate and preserve uncertain delivery', () => {
  // 문안 준비와 실제 발송 확인을 분리하고 재개 시에도 중복 전송을 막는지 확인
  const store = fixture(); store.register({thread_id: id(1)});
  store.register({thread_id: id(2), parent_thread_id: id(1)});
  const args = {thread_id: id(2), completion_key: 'revision-1', outcome: 'completed', summary: '합성 작업 완료', verification: '합성 검사 통과', limitations: '실제 환경 미검증'};
  assert.throws(() => store.prepare(args));
  store.register({thread_id: id(3), parent_thread_id: id(1), report_authorization: 'Human explicitly requested reports to the selected parent in this synthetic fixture.'});
  args.thread_id = id(3);
  assert.throws(() => store.prepare({...args, verification: ''}));
  const prepared = store.prepare(args);
  assert.equal(prepared.parentThreadId, id(1)); assert.equal(prepared.state, 'prepared');
  assert(prepared.message.includes('[가-나]')); assert(prepared.message.includes('실제 환경 미검증'));
  assert.equal(store.prepare(args).reportId, prepared.reportId);
  assert.throws(() => store.prepare({...args, summary: 'Different content'}));
  store.mark({report_id: prepared.reportId, action: 'claim'});
  assert.equal(new LineageStore(store.directory).prepare(args).state, 'sending');
  assert.throws(() => store.mark({report_id: prepared.reportId, action: 'claim'}));
  store.mark({report_id: prepared.reportId, action: 'sent', receipt: 'synthetic-native-receipt-1'});
  assert.equal(store.prepare(args).state, 'sent');
  assert.throws(() => store.mark({report_id: prepared.reportId, action: 'sent', receipt: 'second'}));
});
test('task-specific routing intersects live support, preserves explicit model and rejects malformed catalog', () => {
  const live_catalog = JSON.stringify([{model: 'gpt-6-luna', efforts: ['low', 'high']}, {model: 'gpt-6.1-sol', efforts: ['medium', 'high', 'xhigh']}]);
  assert.deepEqual(recommend({workload: 'extraction', live_catalog}).recommendation, {model: 'gpt-6-luna', thinking: 'low'});
  assert.deepEqual(recommend({workload: 'conflicting_evidence', live_catalog}).recommendation, {model: 'gpt-6.1-sol', thinking: 'high'});
  assert.equal(recommend({workload: 'scoped_fix', live_catalog}).preserve_default, true);
  assert.deepEqual(recommend({workload: 'extraction', live_catalog, user_model: 'gpt-6.1-sol', user_effort: 'medium'}).recommendation, {model: 'gpt-6.1-sol', thinking: 'medium'});
  assert.throws(() => recommend({workload: 'technical', live_catalog: '{}'}));
  const all = JSON.stringify([{model: 'gpt-6.1-sol', efforts: ['high']}, {model: 'gpt-6-astra', efforts: ['low', 'xhigh']}]);
  assert.equal(recommend({workload: 'demanding_analysis', live_catalog: all}).recommendation.model, 'gpt-6.1-sol');
  assert.throws(() => recommend({workload: 'demanding_analysis', live_catalog: all, user_model: 'gpt-6-astra'}), /necessity/);
  assert.deepEqual(recommend({workload: 'demanding_analysis', live_catalog: all, astra_necessity: 'Synthetic conflicting results remain after bounded Sol review.'}).recommendation, {model: 'gpt-6-astra', thinking: 'low'});
  assert.throws(() => recommend({workload: 'demanding_analysis', live_catalog: all, astra_necessity: 'Synthetic need', user_effort: 'xhigh'}), /remain low/);
});
test('real MCP registry/report protocol persists separately from package and does not send messages', () => {
  // 실제 stdio 경로로 등록·조회·보고 준비를 호출하되 native 메시지는 발송하지 않음
  const store = fixture();
  const request = (n, name, args) => ({jsonrpc: '2.0', id: n, method: 'tools/call', params: {name, arguments: args}});
  const messages = [{jsonrpc: '2.0', id: 1, method: 'initialize', params: {}},
    request(2, 'register_session_lineage', {thread_id: id(1)}),
    request(3, 'register_session_lineage', {thread_id: id(2), parent_thread_id: id(1), report_authorization: 'Synthetic direct human approval'}),
    request(4, 'get_session_lineage', {thread_id: id(2)}),
    request(5, 'prepare_parent_report', {thread_id: id(2), completion_key: 'one', outcome: 'blocked', summary: '합성 차단', verification: '차단 확인', limitations: '진행 대기'})];
  const run = spawnSync(process.execPath, [fileURLToPath(new URL('../mcp/server.mjs', import.meta.url))], {
    input: messages.map(item => JSON.stringify(item)).join('\n') + '\n', encoding: 'utf8', windowsHide: true,
    env: {...process.env, SESSION_STATUS_DATA_DIR: store.directory}, timeout: 10000});
  assert.equal(run.status, 0, run.stderr);
  const replies = run.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(JSON.parse(replies[3].result.content[0].text).session.lineageId, '가-가');
  assert.equal(JSON.parse(replies[4].result.content[0].text).state, 'prepared');
  assert.equal(store.get(id(2)).reports.length, 1);
});

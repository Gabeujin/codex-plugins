import {createHash} from 'node:crypto';
import {threadId} from './title.mjs';
import {recommend} from './routing.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function bounded(value, limit = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit || /[\p{Cc}\p{Cs}\uFFFD]/u.test(value)) throw new Error('Invalid choice text');
  return value;
}
function host(value) {
  bounded(value, 100);
  if (!/^[a-zA-Z0-9._-]+$/.test(value)) throw new Error('Invalid host');
  return value;
}
function pair(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid model pair');
  bounded(value.model, 100); bounded(value.thinking, 20);
  if (!['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'].includes(value.thinking)) throw new Error('Invalid effort');
  if (value.model === 'gpt-6-astra' && value.thinking !== 'low') throw new Error('Astra is low only');
}
function promptFor(record) {
  const exception = record.proposal.model === 'gpt-6-astra' ? ` Astra 필요성: ${record.astraNecessity}. low만 사용하며 추론 수준을 자동으로 올리지 않습니다.` : '';
  return `${record.task}: 추천 모델 ${record.proposal.model} / ${record.proposal.thinking}을 적용할까요? Y=추천 적용, N=기본값 ${record.defaults.model} / ${record.defaults.thinking} 유지. 응답 전에는 이 작업 채팅을 생성하지 않습니다.${exception}`;
}
function identity(record) {
  return hash([record.scopeId, record.task, record.destinationHost, record.surface, record.workload,
    record.proposal, record.defaults, record.astraNecessity]);
}
function view(record, active) {
  const createOverrides = !active || !['approved', 'declined'].includes(record.state) ? null
    : record.state === 'approved' ? {model: record.proposal.model, thinking: record.proposal.thinking} : {};
  return {...record, active, createOverrides};
}
export function validateModelChoices(value) {
  if (value === undefined) return;
  if (!value || value.version !== 1 || !value.requests || !value.activeByScope
    || typeof value.requests !== 'object' || Array.isArray(value.requests)
    || typeof value.activeByScope !== 'object' || Array.isArray(value.activeByScope)) throw new Error('Unsupported model choices');
  // 선택 기록이 바뀌면 이전 응답으로 다른 모델·작업을 실행하지 않도록 바인딩을 검사
  for (const [id, record] of Object.entries(value.requests)) {
    if (!record || id !== record.choiceId || !/^[a-f0-9]{64}$/.test(id)) throw new Error('Invalid choice identity');
    if (threadId(record.threadId) !== record.threadId) throw new Error('Invalid requester');
    host(record.hostId); host(record.destinationHost); bounded(record.scopeKey); bounded(record.task);
    pair(record.proposal); pair(record.defaults); bounded(record.workload, 100);
    if (record.surface !== 'codex-app' || record.scopeId !== hash([record.hostId, record.threadId, record.scopeKey])
      || identity(record) !== id || record.question !== promptFor(record)) throw new Error('Choice binding mismatch');
    if (record.proposal.model === 'gpt-6-astra') bounded(record.astraNecessity, 1000);
    if (!['pending', 'approved', 'declined', 'superseded'].includes(record.state)) throw new Error('Invalid choice state');
    if (['approved', 'declined'].includes(record.state)) {
      if (record.reply !== (record.state === 'approved' ? 'Y' : 'N')) throw new Error('Choice reply mismatch');
      bounded(record.humanEvidence, 1000);
    } else if (record.reply !== null || record.humanEvidence !== null) throw new Error('Unexpected choice reply');
    if (record.state === 'pending' && value.activeByScope[record.scopeId] !== id) throw new Error('Inactive pending choice');
  }
  for (const [scope, id] of Object.entries(value.activeByScope)) {
    if (!value.requests[id] || value.requests[id].scopeId !== scope || value.requests[id].state === 'superseded') throw new Error('Invalid active choice');
  }
}
export function prepareModelChoice(store, {thread_id, host_id = 'local', scope_key, task_description,
  destination_host, default_model, default_effort, ...routing}) {
  const id = threadId(thread_id); host(host_id); host(destination_host);
  bounded(scope_key); bounded(task_description);
  const defaults = {model: default_model, thinking: default_effort}; pair(defaults);
  const recommendation = recommend(routing);
  const catalog = JSON.parse(routing.live_catalog);
  if (!catalog.some(item => item.model === default_model && item.efforts.includes(default_effort))) throw new Error('Refresh the actual host defaults');
  const scopeId = hash([host_id, id, scope_key]);
  if (!recommendation.recommendation) return store.change(value => {
    const choices = value.modelChoices; const previous = choices?.activeByScope[scopeId];
    if (previous) {
      if (choices.requests[previous].state === 'pending') choices.requests[previous].state = 'superseded';
      delete choices.activeByScope[scopeId];
    }
    return {state: 'unavailable', createOverrides: {}, preserveDefault: true, recommendation};
  });
  const record = {threadId: id, hostId: host_id, scopeKey: scope_key, scopeId,
    task: task_description, surface: 'codex-app', destinationHost: destination_host, workload: routing.workload,
    proposal: recommendation.recommendation, defaults, astraNecessity: recommendation.astraNecessity,
    state: 'pending', reply: null, humanEvidence: null};
  record.choiceId = identity(record); record.question = promptFor(record);
  // 같은 제안의 재개는 기존 결정을 반환하고 새 제안은 이전 pending 요청을 대체
  return store.change(value => {
    value.modelChoices ??= {version: 1, requests: {}, activeByScope: {}};
    const choices = value.modelChoices;
    const previous = choices.activeByScope[record.scopeId];
    if (previous === record.choiceId) return view(choices.requests[previous], true);
    if (choices.requests[record.choiceId]) throw new Error('Use a new scope revision instead of reviving an old choice');
    if (previous && choices.requests[previous].state === 'pending') choices.requests[previous].state = 'superseded';
    choices.requests[record.choiceId] = record; choices.activeByScope[record.scopeId] = record.choiceId;
    return view(record, true);
  });
}
export function getModelChoice(store, choiceId) {
  if (!/^[a-f0-9]{64}$/.test(choiceId)) throw new Error('Invalid choice ID');
  const choices = store.read().modelChoices; const record = choices?.requests[choiceId];
  if (!record) throw new Error('Unknown model choice');
  return view(record, choices.activeByScope[record.scopeId] === choiceId);
}
export function resolveModelChoice(store, {choice_id, reply, human_evidence}) {
  if (!/^[a-f0-9]{64}$/.test(choice_id)) throw new Error('Invalid choice ID');
  const normalized = typeof reply === 'string' ? reply.trim().toUpperCase() : '';
  if (!['Y', 'N'].includes(normalized)) throw new Error('An explicit human Y or N is required');
  bounded(human_evidence, 1000);
  // 응답은 저장한 제안에만 적용하고 미응답이나 이전 제안을 승인으로 처리하지 않음
  return store.change(value => {
    const choices = value.modelChoices; const record = choices?.requests[choice_id];
    if (!record || choices.activeByScope[record.scopeId] !== choice_id || record.state === 'superseded') throw new Error('Stale or unknown choice');
    if (record.state !== 'pending') {
      if (record.reply !== normalized) throw new Error('Use a new scope revision to change a decision');
      return view(record, true);
    }
    record.reply = normalized; record.state = normalized === 'Y' ? 'approved' : 'declined';
    record.humanEvidence = human_evidence;
    return view(record, true);
  });
}

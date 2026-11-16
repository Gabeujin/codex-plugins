export const labels = ['Working', 'Planning', 'Needs review', 'Verified', 'Committed', 'Deployed', 'Tested', 'Blocked',
  '작업중', '기획 및 검토', '검토대상', '확인완료', '커밋완료', '반영완료', '테스트완료'];

function text(value, limit) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit || /[\p{Cc}\p{Cs}\uFFFD]/u.test(value)) {
    throw new Error('Invalid text');
  }
  return value;
}

export function statusLabel(value) {
  text(value, 60);
  if (value !== value.trim() || /[\[\]]/.test(value)) throw new Error('Invalid status label');
  return value;
}

export function formatTitle(title, status, previousStatus) {
  text(title, 500);
  statusLabel(status);
  if (previousStatus !== undefined) statusLabel(previousStatus);
  const recognized = new Set([...labels, status, ...(previousStatus ? [previousStatus] : [])]);
  // 상태로 확인한 선두 태그만 제거하고 프로젝트 태그와 주제는 보존
  let topic = title;
  for (;;) {
    const match = /^\[([^\[\]]+)\]\s*/u.exec(topic);
    if (!match || !recognized.has(match[1])) break;
    topic = topic.slice(match[0].length);
  }
  if (!topic.trim()) throw new Error('A topic is required');
  const result = `[${status}] ${topic.trim()}`;
  return text(result, 500);
}

export function threadId(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)) {
    throw new Error('An explicit Codex thread ID is required');
  }
  return value;
}

export async function getTitle(rpc, id) {
  const result = await rpc.call('thread/read', {threadId: threadId(id), includeTurns: false});
  return text(result.thread?.name, 500);
}

export async function setStatus(rpc, {thread_id, status, expected_title, previous_status}) {
  const id = threadId(thread_id);
  const intended = formatTitle(expected_title, status, previous_status);
  const current = await getTitle(rpc, id);
  if (current !== expected_title) throw new Error('Title changed; read it again before updating');
  if (current !== intended) await rpc.call('thread/name/set', {threadId: id, name: intended});
  const actual = await getTitle(rpc, id);
  if (actual !== intended) throw new Error('Title readback mismatch');
  return {thread_id: id, title: actual, verified: true};
}

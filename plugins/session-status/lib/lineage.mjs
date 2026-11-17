import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID, createHash} from 'node:crypto';
import {threadId} from './title.mjs';

const alphabet = [];
for (const vowel of [0, 2, 4, 6, 8, 12, 13, 17, 18, 20]) {
  for (const initial of [0, 2, 3, 5, 6, 7, 9, 11, 12, 14, 15, 16, 17, 18]) {
    alphabet.push(String.fromCodePoint(0xAC00 + initial * 588 + vowel * 28));
  }
}
export function hangulId(index) {
  if (!Number.isSafeInteger(index) || index < 0) throw new Error('Invalid sequence');
  let result = '';
  do { result = alphabet[index % alphabet.length] + result; index = Math.floor(index / alphabet.length) - 1; } while (index >= 0);
  return result;
}
export function safeText(value, limit = 1000) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit || /[\p{Cc}\p{Cs}\uFFFD]/u.test(value)) throw new Error('Invalid text');
  return value;
}
function key(id, host = 'local') {
  safeText(host, 100);
  if (!/^[a-zA-Z0-9._-]+$/.test(host)) throw new Error('Invalid host');
  return `${host}:${threadId(id)}`;
}
export function dataDirectory() {
  const override = process.env.SESSION_STATUS_DATA_DIR;
  if (override && !path.isAbsolute(override)) throw new Error('Data directory must be absolute');
  return override || path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'session-status');
}
export class LineageStore {
  constructor(directory = dataDirectory()) { this.directory = directory; this.file = path.join(directory, 'lineage.json'); }
  read() {
    if (!fs.existsSync(this.file)) return {schemaVersion: 1, sessions: {}, reports: {}};
    const value = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    this.validate(value);
    return value;
  }
  validate(value) {
    if (value.schemaVersion !== 1 || !value.sessions || typeof value.sessions !== 'object' || !value.reports || typeof value.reports !== 'object' || Array.isArray(value.sessions) || Array.isArray(value.reports)) throw new Error('Unsupported lineage store');
    const assigned = new Set();
    const groups = new Map();
    // 읽을 수 있는 JSON이어도 연결·깊이·발급 ID가 손상됐으면 덮어쓰지 않도록 검사
    for (const [own, item] of Object.entries(value.sessions)) {
      if (!item || own !== key(item.threadId, item.hostId) || !/^[가-힣]+(?:-[가-힣]+){0,3}$/u.test(item.lineageId) || assigned.has(item.lineageId)) throw new Error('Invalid relationship');
      assigned.add(item.lineageId);
      const siblings = groups.get(item.parent) || [];
      siblings.push(item); groups.set(item.parent, siblings);
      const parent = value.sessions[item.parent];
      if (item.parent === null ? item.depth !== 0 || item.lineageId.includes('-')
        : !parent || item.depth !== parent.depth + 1 || !item.lineageId.startsWith(parent.lineageId + '-') || item.lineageId.split('-').length !== item.depth + 1) throw new Error('Invalid parent/depth');
      if (typeof item.titlePrefixApplied !== 'boolean') throw new Error('Invalid title ownership');
      if (item.reportAuthorization !== null) safeText(item.reportAuthorization, 500);
    }
    for (const [parent, siblings] of groups) {
      const prefix = parent === null ? '' : value.sessions[parent].lineageId + '-';
      const ids = new Set(siblings.map(item => item.lineageId));
      if (siblings.some((_, index) => !ids.has(prefix + hangulId(index)))) throw new Error('Invalid allocation sequence');
    }
    for (const [reportId, report] of Object.entries(value.reports)) {
      if (!report || report.reportId !== reportId || !/^[a-f0-9]{64}$/.test(reportId) || !['prepared', 'sending', 'sent'].includes(report.state)
        || !value.sessions[report.source]?.parent || typeof report.message !== 'string' || /[\p{Cs}\uFFFD]/u.test(report.message)) throw new Error('Invalid report');
      const parent = value.sessions[value.sessions[report.source].parent];
      if (parent.threadId !== report.parentThreadId || parent.hostId !== report.parentHostId) throw new Error('Invalid report target');
      if (report.state === 'sent') safeText(report.receipt, 1000);
    }
  }
  change(action) {
    fs.mkdirSync(this.directory, {recursive: true, mode: 0o700});
    const history = path.join(this.directory, 'history');
    fs.mkdirSync(history, {recursive: true, mode: 0o700});
    const lock = path.join(this.directory, 'write.lock');
    const handle = fs.openSync(lock, 'wx', 0o600);
    // 동시에 발급한 ID가 겹치지 않도록 전체 읽기·수정·저장을 같은 잠금 안에서 실행
    try {
      const value = this.read();
      const result = action(value);
      this.validate(value);
      const bytes = JSON.stringify(value, null, 2) + '\n';
      if (fs.existsSync(this.file)) fs.copyFileSync(this.file, path.join(history, `${randomUUID()}.json`));
      const temporary = path.join(this.directory, `${randomUUID()}.tmp`);
      fs.writeFileSync(temporary, bytes, {encoding: 'utf8', flag: 'wx', mode: 0o600});
      fs.renameSync(temporary, this.file);
      if (fs.readFileSync(this.file, 'utf8') !== bytes) throw new Error('Store readback mismatch');
      return result;
    } finally {
      fs.closeSync(handle);
      fs.renameSync(lock, path.join(history, `${randomUUID()}.lock`));
    }
  }
  get(id, host = 'local') {
    const value = this.read(); const own = key(id, host);
    return {session: value.sessions[own] || null, children: Object.values(value.sessions).filter(item => item.parent === own),
      reports: Object.values(value.reports).filter(item => item.source === own)};
  }
  register({thread_id, host_id = 'local', parent_thread_id, parent_host_id = host_id, report_authorization, title_prefix_applied}) {
    // 실제 세션 ID에 발급한 계층을 고정하고 같은 세션의 재등록에는 기존 연결을 유지
    const own = key(thread_id, host_id);
    const parent = parent_thread_id ? key(parent_thread_id, parent_host_id) : null;
    if (own === parent) throw new Error('A session cannot parent itself');
    if (report_authorization !== undefined) safeText(report_authorization, 500);
    if (title_prefix_applied !== undefined && title_prefix_applied !== 'verified') throw new Error('Confirm native title readback first');
    return this.change(value => {
      const existing = value.sessions[own];
      if (existing) {
        if (existing.parent !== parent) throw new Error('Reparenting is not supported');
        if (report_authorization && existing.reportAuthorization && existing.reportAuthorization !== report_authorization) throw new Error('Authorization already recorded; inspect it before changing');
        if (report_authorization) existing.reportAuthorization = report_authorization;
        if (title_prefix_applied) existing.titlePrefixApplied = true;
        return existing;
      }
      let parentRecord;
      if (parent) {
        parentRecord = value.sessions[parent];
        if (!parentRecord) throw new Error('Register the parent first');
        if (parentRecord.depth >= 3) throw new Error('Maximum child depth is three');
      }
      const siblings = Object.values(value.sessions).filter(item => item.parent === parent);
      // 같은 부모의 발급 순서를 사용하며 잠금 밖에서 새 번호를 계산하지 않음
      const segment = hangulId(siblings.length);
      const record = {threadId: threadId(thread_id), hostId: host_id, parent, lineageId: parent ? `${parentRecord.lineageId}-${segment}` : segment,
        depth: parent ? parentRecord.depth + 1 : 0, reportAuthorization: report_authorization || null, titlePrefixApplied: title_prefix_applied === 'verified'};
      value.sessions[own] = record;
      return record;
    });
  }
  markTitleApplied(id) {
    return this.change(value => {
      const record = value.sessions[key(id)];
      if (!record) throw new Error('Unknown session');
      record.titlePrefixApplied = true;
      return record;
    });
  }
  prepare({thread_id, host_id = 'local', completion_key, outcome, summary, verification, limitations}) {
    // 같은 완료 revision의 보고는 다시 만들지 않고 이전 전송 상태를 반환
    const own = key(thread_id, host_id);
    for (const item of [completion_key, summary, verification, limitations]) safeText(item);
    if (!['completed', 'blocked', 'failed'].includes(outcome)) throw new Error('Invalid outcome');
    const reportId = createHash('sha256').update(`${own}\n${completion_key}`).digest('hex');
    return this.change(value => {
      const session = value.sessions[own];
      if (!session?.parent || !session.reportAuthorization) throw new Error('Direct human report authorization must be recorded');
      const parent = value.sessions[session.parent];
      const message = `[${session.lineageId}] ${outcome}\n결과: ${summary}\n검증: ${verification}\n남은 제약: ${limitations}\n보고 ID: ${reportId}`;
      const existing = value.reports[reportId];
      // 전송이 끊긴 보고도 보존해 문구를 바꾼 중복 발송을 방지
      if (existing) {
        if (existing.message !== message) throw new Error('Completion key reused with different content');
        return existing;
      }
      const report = {reportId, source: own, parentThreadId: parent.threadId, parentHostId: parent.hostId, message,
        state: 'prepared', authorization: session.reportAuthorization};
      value.reports[reportId] = report;
      return report;
    });
  }
  mark({report_id, action, receipt}) {
    // 발송 직전 선점과 확인된 발송 결과를 구분하고 불확실한 선점은 자동 해제하지 않음
    if (!/^[a-f0-9]{64}$/.test(report_id)) throw new Error('Invalid report ID');
    if (!['claim', 'sent'].includes(action)) throw new Error('Invalid report action');
    if (action === 'sent') safeText(receipt, 1000);
    return this.change(value => {
      const report = value.reports[report_id];
      if (!report) throw new Error('Unknown report');
      if (action === 'claim') {
        if (report.state !== 'prepared') throw new Error('Already claimed; reconcile delivery before retrying');
        report.state = 'sending';
      } else {
        if (report.state !== 'sending') throw new Error('Report was not claimed or already sent');
        report.state = 'sent'; report.receipt = receipt;
      }
      return report;
    });
  }
}

"""Append-only daily-check receipts. Standard library only; no automatic repair."""
import argparse
import datetime as dt
import hashlib
import json
import os
import re
import socket
from pathlib import Path
import time
import uuid

STATUSES = ('PASS','FAIL','BLOCKED','UNAVAILABLE','UNVERIFIED','NOT_TESTED','UNKNOWN','DISPATCHED')
ROWS = ('basic.exec','basic.utf8','versions','browser.interaction',
        'browser.iab.read','browser.iab.navigation','browser.iab.input',
        'browser.chrome.read','browser.chrome.navigation','browser.chrome.input',
        'computer.discovery','computer.read','computer.input','native.simple','native.response','codex.input',
        'codex.notification','codex.approval')
LEGACY_ROWS = ('browser.interaction',)
COMPUTER_ACTUAL_ROWS = ('computer.read','computer.input')
REQUIRED = tuple(x for x in ROWS if x not in LEGACY_ROWS)

def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8', errors='strict'))

def save(path, value):
    text = json.dumps(value, ensure_ascii=False, indent=2) + '\n'
    if '\ufffd' in text:
        raise ValueError('Unexpected replacement character')
    with Path(path).open('x', encoding='utf-8', newline='\n') as stream:
        stream.write(text)
    if Path(path).read_text(encoding='utf-8') != text:
        raise ValueError('Readback mismatch')

def compare(previous, current):
    validate_capabilities(previous)
    validate_capabilities(current)
    before = {x['name']:x.get('schemaHash') for x in previous}
    after = {x['name']:x.get('schemaHash') for x in current}
    return {
        'added': sorted(after.keys()-before.keys()),
        'removed': sorted(before.keys()-after.keys()),
        'changed': sorted(k for k in before.keys() & after.keys()
                          if before[k] and after[k] and before[k] != after[k]),
        'hashUnavailable': sorted(k for k in after if not after[k]),
        'addedOrChangedStatus': 'NEW_UNTESTED',
        'removedStatus': 'SESSION_UNAVAILABLE',
    }

def validate_capabilities(items):
    if not isinstance(items, list):
        raise ValueError('Capabilities must be an array')
    names = set()
    for item in items:
        if not isinstance(item, dict) or not isinstance(item.get('name'), str) or not item['name'].strip():
            raise ValueError('Each capability requires a name')
        if item['name'] in names:
            raise ValueError('Duplicate capability name')
        names.add(item['name'])
        digest = item.get('schemaHash')
        if digest is not None and (not isinstance(digest, str) or not re.fullmatch(r'[0-9a-f]{64}', digest)):
            raise ValueError('schemaHash must be a lowercase SHA-256 or null')

def summarize_system(system):
    """Keep version facts, never raw paths, environment values or command output."""
    if not isinstance(system, dict):
        raise ValueError('System receipt must be an object')
    result = {}
    for key in ('desktop_appx', 'path_cli_snapshot', 'fresh_environment_cli', 'bundled_cli', 'latestStandaloneCli'):
        row = system.get(key)
        if not isinstance(row, dict):
            continue
        version = row.get('version')
        version = version if isinstance(version, str) and re.fullmatch(r'\d+(?:\.\d+){1,3}(?:[-+][0-9A-Za-z.-]+)?', version) else None
        status = row.get('status')
        allowed = {'ok', 'failed', 'unknown', 'not_found', 'unsupported', 'not_requested', 'wrapper_missing', 'timeout', 'decode_failed'}
        result[key] = {'version': version, 'status': status if status in allowed else 'unknown'}
    return result

def previous_receipt(meta, run):
    target = meta.get('previousFinal')
    if not target:
        return None
    path = Path(target)
    if path.name != 'final.json' or path.resolve().parent.parent != run.resolve().parent:
        raise ValueError('Previous receipt must remain inside this run store')
    value = read(path)
    if value.get('scope') != meta['scope']:
        raise ValueError('Previous receipt scope mismatch')
    return value

def start(root, capabilities=None, computer_installed=False):
    root = Path(root).resolve()
    root.mkdir(parents=True, exist_ok=True)
    scope = hashlib.sha256((socket.gethostname() + '|' +
                            str(Path.home())).encode()).hexdigest()[:16]
    prior = []
    for path in root.glob('*/final.json'):
        try:
            item = read(path)
            if item.get('scope') == scope:
                prior.append((item['startedEpoch'], str(path)))
        except (ValueError, OSError, KeyError):
            continue
    run = root / (dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+uuid.uuid4().hex[:8])
    run.mkdir()
    now = time.time()
    caps = read(capabilities) if capabilities else []
    validate_capabilities(caps)
    save(run/'start.json', {'schemaVersion':1,'scope':scope,'startedEpoch':now,
        'deadlineEpoch':now+300,'capabilities':caps,'inventoryProvided':bool(capabilities),
        'computerInstalledInventoryEvidence':bool(computer_installed),
        'previousFinal':max(prior)[1] if prior else None})
    return {'run':str(run),'deadlineEpoch':now+300}

def record(run, check_id, status, evidence):
    run = Path(run)
    read(run/'start.json')
    if (run/'final.json').exists():
        raise ValueError('Run finalized; create a new follow-up receipt')
    if status not in STATUSES or check_id not in ROWS:
        raise ValueError('Unknown status or check ID')
    if not evidence.strip():
        raise ValueError('Evidence required')
    recovery_pending = False
    if check_id in COMPUTER_ACTUAL_ROWS and status in ('FAIL','BLOCKED','UNAVAILABLE'):
        normalized = evidence.lower()
        if 'official-docs:' not in normalized or 'normalization:' not in normalized:
            recovery_pending = True
    event = {'id':check_id,'status':status,'evidence':evidence,'recordedEpoch':time.time(),
             'recoveryPending':recovery_pending}
    save(run/(str(time.time_ns())+'-'+uuid.uuid4().hex[:8]+'.event.json'),event)
    return event

def finalize(run):
    run = Path(run)
    if (run/'final.json').exists() or (run/'report.md').exists():
        raise FileExistsError('Final report already exists; choose a new run')
    meta = read(run/'start.json')
    rows = {key:{'id':key,'status':'UNKNOWN','evidence':'No runtime evidence recorded'} for key in ROWS}
    for path in sorted(run.glob('*.event.json')):
        item = read(path)
        if item.get('id') not in ROWS or item.get('status') not in STATUSES or not isinstance(item.get('evidence'), str):
            raise ValueError('Invalid event receipt')
        rows[item['id']] = item
    elapsed = round(time.time()-meta['startedEpoch'],3)
    previous = previous_receipt(meta, run)
    inventory_comparable = bool(meta.get('inventoryProvided')) and bool(previous and previous.get('inventoryProvided'))
    diff = compare(previous.get('capabilities',[]) if inventory_comparable else [],meta['capabilities'])
    diff['comparisonStatus'] = 'COMPARED' if inventory_comparable else 'BASELINE_OR_INVENTORY_UNAVAILABLE'
    # A missing inventory is not evidence that previously callable tools disappeared.
    if not inventory_comparable:
        diff['removed'] = []
    regression = [key for key in ROWS if previous and
                  previous.get('checks',{}).get(key,{}).get('status') == 'PASS' and rows[key]['status'] != 'PASS']
    computer_installed = bool(meta.get('computerInstalledInventoryEvidence'))
    computer_route_working = rows['computer.discovery']['status'] == 'PASS'
    computer_actual_route_known = computer_installed or computer_route_working
    computer_actual_failure = computer_actual_route_known and any(
        rows[key].get('recordedEpoch') and rows[key]['status'] in ('FAIL','BLOCKED','UNAVAILABLE')
        for key in COMPUTER_ACTUAL_ROWS)
    overview = ('ATTENTION' if any(x['status']=='FAIL' for x in rows.values()) or computer_actual_failure else
                'READY' if all(rows[key]['status']=='PASS' for key in REQUIRED) else 'PARTIAL')
    operational = overview
    within_budget = 0 <= elapsed <= 300
    if not within_budget:
        overview = 'ATTENTION'
    safe_meta = {key:value for key,value in meta.items() if key != 'previousFinal'}
    result = {**safe_meta,'elapsedSeconds':elapsed,'withinFiveMinutes':within_budget,'overall':overview,
              'operationalReadiness':operational,'timingStatus':'WITHIN_TARGET' if within_budget else 'OVER_BUDGET_OR_CLOCK_CHANGE',
              'evidenceTrust':'Caller-recorded observations; not independently attested or tamper-evident',
              'checks':rows,'capabilityChanges':diff,'previousPassNowNotPass':regression,
              'firstBaseline':previous is None,'coverage':'Only recorded probes; not all Codex features',
              'actualApprovalCovered':rows['codex.approval']['status']=='PASS',
              'legacyRowsNotRequired':list(LEGACY_ROWS),
              'computerInstalledKnown':computer_installed,
              'computerDiscoveryWorkingRoute':computer_route_working,
              'computerActualRouteKnown':computer_actual_route_known,
              'computerActualAppCovered':all(rows[key]['status']=='PASS' for key in COMPUTER_ACTUAL_ROWS),
              'computerActualFailureNeedsAttention':computer_actual_failure,
              'computerFailureNormalization':'official-docs: diagnosis; normalization: bounded retry or supported recovery'}
    if (run/'system.json').exists():
        result['system'] = summarize_system(read(run/'system.json'))
    if previous and result.get('system') != previous.get('system'):
        # Compare version-bearing fields, not timestamps or transient command duration.
        def versions(obj):
            if isinstance(obj,dict):
                return {k:versions(v) for k,v in obj.items() if 'version' in k.lower() or isinstance(v,(dict,list))}
            if isinstance(obj,list): return [versions(v) for v in obj]
            return obj
        result['versionReview'] = 'REVIEW_REQUIRED' if versions(result.get('system')) != versions(previous.get('system')) else 'UNCHANGED'
    else:
        result['versionReview'] = 'BASELINE' if not previous else 'UNCHANGED'
    lines = ['# Codex 기능 Daily Check', '',f"상태: **{overview}** · 소요: {elapsed:,.1f}초 · 5분 내: {'예' if within_budget else '아니요'}",'',
             '이 보고서는 호출자가 기록한 관찰을 집계합니다. 독립 인증이나 변조 방지 감사 기록이 아닙니다.', '',
             '| 점검 | 결과 | 근거 |','| --- | --- | --- |']
    for item in rows.values():
        evidence = item['evidence'].replace('|','/').replace('\n',' ')
        lines.append(f"| {item['id']} | {item['status']} | {evidence} |")
    lines += ['', 'Windows 테스트 창은 플러그인 자체 진단 경로이며 Codex 승인 창 정상 동작의 증거가 아닙니다.',
              '', f"추가 도구: {len(diff['added']):,} · 변경: {len(diff['changed']):,} · 현재 세션에서 사라짐: {len(diff['removed']):,}",
              '신규·변경 기능은 개별 검증 전까지 NEW_UNTESTED입니다.']
    report = '\n'.join(lines)+'\n'
    with (run/'report.md').open('x',encoding='utf-8',newline='\n') as stream: stream.write(report)
    if (run/'report.md').read_text(encoding='utf-8') != report: raise ValueError('Readback mismatch')
    save(run/'final.json',result)
    return {'overall':overview,'elapsedSeconds':elapsed,'report':str(run/'report.md')}

def main():
    parser = argparse.ArgumentParser()
    subs = parser.add_subparsers(dest='command',required=True)
    p = subs.add_parser('start'); p.add_argument('--root',required=True); p.add_argument('--capabilities'); p.add_argument('--computer-installed',action='store_true')
    p = subs.add_parser('record'); p.add_argument('run'); p.add_argument('--id',required=True,choices=ROWS); p.add_argument('--status',required=True,choices=STATUSES); p.add_argument('--evidence',required=True)
    p = subs.add_parser('finalize'); p.add_argument('run')
    args = parser.parse_args()
    if args.command=='start': result=start(args.root,args.capabilities,args.computer_installed)
    elif args.command=='record': result=record(args.run,args.id,args.status,args.evidence)
    else: result=finalize(args.run)
    print(json.dumps(result,ensure_ascii=True))

if __name__=='__main__': main()

import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('daily_share_report', ROOT / 'scripts/report.py')
report = importlib.util.module_from_spec(spec)
spec.loader.exec_module(report)
PRIVATE_NOTE = 'SYNTHETIC_PRIVATE_NOTE_7'


class ShareReportTests(unittest.TestCase):
    def fresh(self):
        return Path(tempfile.mkdtemp(prefix='codex-daily-share-tests-'))

    def receipt(self):
        return {'schemaVersion':1, 'overall':'PARTIAL',
                'elapsedSeconds':1, 'withinFiveMinutes':True, 'timingStatus':'WITHIN_TARGET',
                'checks':{key:{'id':key, 'status':'UNKNOWN', 'evidence':PRIVATE_NOTE}
                          for key in report.ROWS}}

    def source(self, root, value=None, payload=None):
        run = root / 'original'
        run.mkdir()
        if payload is None:
            payload = json.dumps(self.receipt() if value is None else value,
                                 ensure_ascii=False).encode('utf-8')
        with (run / 'final.json').open('xb') as stream:
            stream.write(payload)
        with (run / 'report.md').open('x', encoding='utf-8') as stream:
            stream.write(PRIVATE_NOTE)
        return run

    def original_hashes(self, run):
        return {str(path.relative_to(run)):hashlib.sha256(path.read_bytes()).hexdigest()
                for path in run.rglob('*') if path.is_file()}

    def test_export_omits_every_free_text_field_and_preserves_original(self):
        root = self.fresh()
        value = self.receipt()
        # 입력에 자유 문구가 어느 위치에 있든 공유본의 허용 필드로 옮기지 않는지 확인
        value.update({'scope':PRIVATE_NOTE, 'startedEpoch':123456789,
                      'elapsedSeconds':123.456, 'capabilities':[{'name':PRIVATE_NOTE}],
                      'capabilityChanges':{'added':[PRIVATE_NOTE]},
                      'system':{'version':PRIVATE_NOTE}, 'arbitraryName':PRIVATE_NOTE,
                      'url':'https://private.example.invalid/' + PRIVATE_NOTE,
                      'path':'Z:/synthetic/' + PRIVATE_NOTE,
                      'resultSummary':{'counts':{'totalRows':999999}}})
        value['checks']['basic.exec'].update({'status':'PASS', 'name':PRIVATE_NOTE,
                                            'recordedEpoch':123456789})
        value['checks']['native.response']['status'] = 'BLOCKED'
        run = self.source(root, value)
        before = self.original_hashes(run)
        result = report.export_share(run, root / 'shared')
        self.assertEqual(result, {'status':'EXPORTED', 'files':['share.json', 'share.md']})
        self.assertEqual(self.original_hashes(run), before)
        shared = report.read(root / 'shared/share.json')
        self.assertEqual(set(shared), {'schemaVersion', 'reportType', 'overall', 'checks', 'counts'})
        self.assertEqual([item['id'] for item in shared['checks']], list(report.ROWS))
        self.assertTrue(all(set(item) == {'id', 'status'} for item in shared['checks']))
        self.assertEqual(shared['counts'], {'totalRows':len(report.ROWS), 'passedRows':1,
                                          'actualFailures':0, 'blocked':1,
                                          'missingEvidence':len(report.ROWS)-2,
                                          'sessionUnavailable':0})
        for path in (root / 'shared').iterdir():
            text = path.read_text(encoding='utf-8', errors='strict')
            for omitted in (PRIVATE_NOTE, '123456789', '123.456', '999999', 'private.example.invalid', 'Z:/synthetic'):
                self.assertNotIn(omitted, text)

    def test_status_counts_come_from_rows_instead_of_raw_summary(self):
        root = self.fresh()
        value = self.receipt()
        # 실패·차단·세션 사용 불가를 서로 다른 집계로 유지하는지 확인
        value['overall'] = 'ATTENTION'
        statuses = ['FAIL', 'BLOCKED', 'UNAVAILABLE', 'UNVERIFIED', 'NOT_TESTED', 'DISPATCHED']
        for key, status in zip(report.ROWS, statuses):
            value['checks'][key]['status'] = status
        run = self.source(root, value)
        report.export_share(run, root / 'shared')
        counts = report.read(root / 'shared/share.json')['counts']
        self.assertEqual(counts['actualFailures'], 1)
        self.assertEqual(counts['blocked'], 1)
        self.assertEqual(counts['sessionUnavailable'], 1)
        self.assertEqual(counts['missingEvidence'], len(report.ROWS)-3)

    def test_invalid_receipt_shapes_fail_before_output_creation(self):
        cases = [[], {'schemaVersion':True}, {'schemaVersion':2}]
        missing = self.receipt()
        missing['checks'].pop('basic.exec')
        cases.append(missing)
        extra = self.receipt()
        extra['checks'][PRIVATE_NOTE] = {'id':PRIVATE_NOTE, 'status':'PASS'}
        cases.append(extra)
        # 잘못된 판정이나 이름을 다른 항목에 숨겨도 원본 값을 출력하지 않고 거절
        for key, bad in [('id', PRIVATE_NOTE), ('status', PRIVATE_NOTE), ('status', []), ('status', True)]:
            value = self.receipt()
            value['checks']['basic.exec'][key] = bad
            cases.append(value)
        bad_overall = self.receipt()
        bad_overall['overall'] = PRIVATE_NOTE
        cases.append(bad_overall)
        for value in cases:
            with self.subTest(kind=type(value).__name__):
                root = self.fresh()
                run = self.source(root, value)
                with self.assertRaises(ValueError):
                    report.export_share(run, root / 'shared')
                self.assertFalse((root / 'shared').exists())

    def test_invalid_json_encoding_duplicate_keys_and_numbers_are_rejected(self):
        valid = json.dumps(self.receipt()).encode('utf-8')
        payloads = [b'{', b'\xff', b'{"schemaVersion":1,"schemaVersion":1}',
                    valid[:-1] + b',"ignored":NaN}', valid[:-1] + b',"ignored":Infinity}',
                    valid[:-1] + b',"ignored":1e999}',
                    valid[:-1] + b',"ignored":"\\ud800"}',
                    valid[:-1] + b',"ignored":"\\ufffd"}']
        for payload in payloads:
            with self.subTest(length=len(payload)):
                root = self.fresh()
                run = self.source(root, payload=payload)
                with self.assertRaises(ValueError):
                    report.export_share(run, root / 'shared')
                self.assertFalse((root / 'shared').exists())

    def test_size_nesting_and_node_limits_reject_before_output(self):
        # 제외 대상 데이터가 지나치게 크거나 깊어도 출력 폴더를 만들지 않음
        nested = self.receipt()
        branch = nested
        for _ in range(report.SHARE_MAX_DEPTH + 1):
            branch['ignored'] = {}
            branch = branch['ignored']
        many_nodes = self.receipt()
        many_nodes['ignored'] = [0] * (report.SHARE_MAX_NODES + 1)
        payloads = [b' ' * (report.SHARE_MAX_BYTES + 1),
                    json.dumps(nested).encode('utf-8'), json.dumps(many_nodes).encode('utf-8'),
                    b'[' * 2000 + b'0' + b']' * 2000]
        for payload in payloads:
            root = self.fresh()
            run = self.source(root, payload=payload)
            with self.assertRaises(ValueError):
                report.export_share(run, root / 'shared')
            self.assertFalse((root / 'shared').exists())

    def test_ready_or_partial_cannot_hide_recorded_failure(self):
        for overall, status in [('READY', 'UNKNOWN'), ('READY', 'FAIL'), ('PARTIAL', 'FAIL')]:
            value = self.receipt()
            value['overall'] = overall
            value['checks']['basic.exec']['status'] = status
            root = self.fresh()
            run = self.source(root, value)
            with self.assertRaises(ValueError):
                report.export_share(run, root / 'shared')
            self.assertFalse((root / 'shared').exists())

    def test_timing_fields_cannot_hide_budget_or_clock_failure(self):
        # 시간을 공개하지 않더라도 목표 시간 초과를 정상으로 표시하는 모순은 공유 전에 거절
        cases = [(99999, False, 'OVER_BUDGET_OR_CLOCK_CHANGE', 'READY'),
                 (-1, False, 'OVER_BUDGET_OR_CLOCK_CHANGE', 'PARTIAL'),
                 (5, False, 'WITHIN_TARGET', 'PARTIAL'),
                 (5, True, 'OVER_BUDGET_OR_CLOCK_CHANGE', 'PARTIAL'),
                 (True, True, 'WITHIN_TARGET', 'PARTIAL')]
        for elapsed, within, timing, overall in cases:
            value = self.receipt()
            value.update(elapsedSeconds=elapsed, withinFiveMinutes=within,
                         timingStatus=timing, overall=overall)
            for row in value['checks'].values():
                row['status'] = 'PASS'
            root = self.fresh()
            run = self.source(root, value)
            with self.assertRaises(ValueError):
                report.export_share(run, root / 'shared')
            self.assertFalse((root / 'shared').exists())

    def test_valid_over_budget_attention_remains_shareable_without_time(self):
        value = self.receipt()
        value.update(elapsedSeconds=99999, withinFiveMinutes=False,
                     timingStatus='OVER_BUDGET_OR_CLOCK_CHANGE', overall='ATTENTION')
        root = self.fresh()
        run = self.source(root, value)
        report.export_share(run, root / 'shared')
        shared = report.read(root / 'shared/share.json')
        self.assertEqual(shared['overall'], 'ATTENTION')
        self.assertNotIn('elapsedSeconds', shared)

    def test_existing_output_and_original_directory_are_never_overwritten(self):
        root = self.fresh()
        run = self.source(root)
        # 기존 공유 파일과 원본 실행 폴더를 모두 덮어쓰기 대상에서 제외
        before = self.original_hashes(run)
        target = root / 'shared'
        target.mkdir()
        marker = target / 'keep.txt'
        marker.write_text('original output', encoding='utf-8')
        with self.assertRaises(FileExistsError):
            report.export_share(run, target)
        self.assertEqual(marker.read_text(encoding='utf-8'), 'original output')
        with self.assertRaises(ValueError):
            report.export_share(run, run / 'shared')
        self.assertEqual(self.original_hashes(run), before)

    def test_dangling_output_symlink_is_not_followed(self):
        root = self.fresh()
        run = self.source(root)
        target = root / 'uncreated'
        link = root / 'shared'
        try:
            link.symlink_to(target, target_is_directory=True)
        except OSError:
            self.skipTest('Symbolic links are unavailable in this test environment')
        with self.assertRaises(FileExistsError):
            report.export_share(run, link)
        self.assertFalse(target.exists())

    def test_incomplete_export_is_retained_without_modifying_original(self):
        root = self.fresh()
        run = self.source(root)
        before = self.original_hashes(run)
        with patch.object(report, 'save', side_effect=OSError('Synthetic storage failure')):
            with self.assertRaises(OSError):
                report.export_share(run, root / 'shared')
        self.assertTrue((root / 'shared').is_dir())
        self.assertEqual(self.original_hashes(run), before)

    def test_cli_is_opt_in_and_failure_does_not_echo_private_paths_or_values(self):
        root = self.fresh()
        run = self.source(root)
        # 오류 안내에 호출자가 넘긴 경로나 원본의 자유 문구가 섞이지 않는지 확인
        command = [sys.executable, '-B', str(ROOT / 'scripts/report.py'), 'share',
                   str(run), '--output', str(root / 'shared')]
        success = subprocess.run(command, capture_output=True, encoding='utf-8', check=False)
        self.assertEqual(success.returncode, 0, success.stderr)
        self.assertEqual(json.loads(success.stdout), {'status':'EXPORTED', 'files':['share.json', 'share.md']})
        failure = subprocess.run(command, capture_output=True, encoding='utf-8', check=False)
        self.assertEqual(failure.returncode, 2)
        self.assertNotIn(str(run), failure.stderr)
        self.assertNotIn(PRIVATE_NOTE, failure.stderr)

    def test_real_finalize_remains_raw_and_share_is_separate(self):
        root = self.fresh()
        run = Path(report.start(root / 'runs')['run'])
        report.record(run, 'basic.utf8', 'PASS', PRIVATE_NOTE)
        report.finalize(run)
        self.assertFalse((root / 'shared').exists())
        self.assertIn(PRIVATE_NOTE, (run / 'final.json').read_text(encoding='utf-8'))
        self.assertIn(PRIVATE_NOTE, (run / 'report.md').read_text(encoding='utf-8'))
        before = self.original_hashes(run)
        report.export_share(run, root / 'shared')
        self.assertEqual(self.original_hashes(run), before)
        self.assertNotIn(PRIVATE_NOTE, (root / 'shared/share.json').read_text(encoding='utf-8'))


if __name__ == '__main__':
    unittest.main()

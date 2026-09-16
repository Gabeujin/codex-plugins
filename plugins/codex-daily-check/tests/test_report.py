import importlib.util
from pathlib import Path
import unittest
import uuid
import tempfile
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('daily_report',ROOT/'scripts/report.py')
report=importlib.util.module_from_spec(spec);spec.loader.exec_module(report)

class ReportTests(unittest.TestCase):
    def fresh(self):
        return Path(tempfile.mkdtemp(prefix='codex-daily-report-tests-'))/'runs'

    def test_missing_response_is_partial_and_immutable(self):
        run=Path(report.start(self.fresh())['run'])
        report.record(run,'native.response','UNVERIFIED','No human response')
        result=report.finalize(run)
        self.assertEqual(result['overall'],'PARTIAL')
        final=report.read(run/'final.json')
        self.assertFalse(final['actualApprovalCovered'])
        with self.assertRaises(ValueError):
            report.record(run,'native.response','PASS','Late reply')
        with self.assertRaises(FileExistsError): report.finalize(run)

    def test_actual_approval_cannot_be_omitted_from_complete_readiness(self):
        run=Path(report.start(self.fresh())['run'])
        for key in report.REQUIRED:
            if key != 'codex.approval': report.record(run,key,'PASS','Observed result')
        report.record(run,'codex.approval','NOT_TESTED','No actual approval occurred')
        report.finalize(run)
        self.assertEqual(report.read(run/'final.json')['overall'],'PARTIAL')

    def test_new_changed_removed_surface_does_not_execute(self):
        result=report.compare([{'name':'delete','schemaHash':'a'*64},{'name':'old'}],
                              [{'name':'delete','schemaHash':'b'*64},{'name':'new'}])
        self.assertEqual(result['changed'],['delete'])
        self.assertEqual(result['added'],['new'])
        self.assertEqual(result['removed'],['old'])
        self.assertEqual(result['addedOrChangedStatus'],'NEW_UNTESTED')

    def test_prior_pass_regression_is_detected(self):
        root=self.fresh()
        first=Path(report.start(root)['run'])
        report.record(first,'basic.exec','PASS','Command readback')
        report.finalize(first)
        second=Path(report.start(root)['run'])
        report.record(second,'basic.exec','FAIL','Transport failure')
        report.finalize(second)
        result=report.read(second/'final.json')
        self.assertEqual(result['overall'],'ATTENTION')
        self.assertIn('basic.exec',result['previousPassNowNotPass'])

    def test_exact_unicode_and_replacement_rejected(self):
        path=self.fresh();path.mkdir(parents=True)
        report.save(path/'ok.json',{'text':'한글 응답 확인'})
        self.assertEqual(report.read(path/'ok.json')['text'],'한글 응답 확인')
        with self.assertRaises(ValueError): report.save(path/'bad.json',{'text':'\ufffd'})

    def test_distinct_iab_and_chrome_rows_are_required_while_legacy_is_not(self):
        self.assertNotIn('browser.interaction',report.REQUIRED)
        for row in ('browser.iab.read','browser.iab.navigation','browser.iab.input',
                    'browser.chrome.read','browser.chrome.navigation','browser.chrome.input'):
            self.assertIn(row,report.ROWS)
            self.assertIn(row,report.REQUIRED)

    def test_known_computer_use_unavailable_actual_action_requires_attention(self):
        run=Path(report.start(self.fresh(),computer_installed=True)['run'])
        event=report.record(run,'computer.read','UNAVAILABLE','Plugin action failed before research')
        self.assertTrue(event['recoveryPending'])
        report.finalize(run)
        result=report.read(run/'final.json')
        self.assertEqual(result['overall'],'ATTENTION')
        self.assertTrue(result['computerInstalledKnown'])
        self.assertTrue(result['computerActualFailureNeedsAttention'])
        self.assertTrue(result['checks']['computer.read']['recoveryPending'])

    def test_no_computer_response_remains_unverified(self):
        run=Path(report.start(self.fresh())['run'])
        report.record(run,'computer.discovery','PASS','Installed Computer Use plugin discovered')
        report.record(run,'computer.read','UNVERIFIED','No actual app response')
        report.record(run,'computer.input','UNVERIFIED','No actual app response')
        report.finalize(run)
        result=report.read(run/'final.json')
        self.assertEqual(result['overall'],'PARTIAL')
        self.assertFalse(result['computerActualFailureNeedsAttention'])

    def test_arbitrary_capability_name_does_not_prove_computer_plugin_installation(self):
        root=self.fresh();root.mkdir(parents=True)
        capabilities=root/'caps.json'
        report.save(capabilities,[{'name':'computer-themed-helper','schemaHash':None}])
        run=Path(report.start(root,capabilities)['run'])
        report.finalize(run)
        result=report.read(run/'final.json')
        self.assertFalse(result['computerInstalledKnown'])
        self.assertFalse(result['computerDiscoveryWorkingRoute'])

    def test_expired_budget_cannot_be_ready_even_when_operations_pass(self):
        run=Path(report.start(self.fresh())['run'])
        for key in report.REQUIRED:
            report.record(run,key,'PASS','Observed fixture result')
        started=report.read(run/'start.json')['startedEpoch']
        with patch.object(report.time,'time',return_value=started+301):
            report.finalize(run)
        result=report.read(run/'final.json')
        self.assertEqual(result['overall'],'ATTENTION')
        self.assertEqual(result['operationalReadiness'],'READY')
        self.assertFalse(result['withinFiveMinutes'])

    def test_duplicate_and_malformed_capability_hashes_rejected(self):
        with self.assertRaises(ValueError):
            report.compare([], [{'name':'same'},{'name':'same'}])
        with self.assertRaises(ValueError):
            report.compare([], [{'name':'bad','schemaHash':'not-a-hash'}])

    def test_system_summary_does_not_copy_private_fields(self):
        result=report.summarize_system({'environment':{'TOKEN':'private'},'bundled_cli':{'path':'private-path','version':'0.1.0','status':'ok','stderr':'private'}})
        self.assertEqual(result,{'bundled_cli':{'version':'0.1.0','status':'ok'}})

    def test_missing_inventory_does_not_claim_all_tools_removed(self):
        root=self.fresh();root.mkdir(parents=True)
        caps=root/'caps.json';report.save(caps,[{'name':'tool'}])
        first=Path(report.start(root,caps)['run']);report.finalize(first)
        second=Path(report.start(root)['run']);report.finalize(second)
        self.assertEqual(report.read(second/'final.json')['capabilityChanges']['removed'],[])

if __name__=='__main__':unittest.main()

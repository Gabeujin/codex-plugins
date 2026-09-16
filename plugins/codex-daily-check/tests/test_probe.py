import importlib.util
import sys
import tempfile
import time
import unittest
import uuid
from unittest import mock
from pathlib import Path

SPEC = importlib.util.spec_from_file_location("probe", Path(__file__).resolve().parents[1] / "scripts" / "probe.py")
probe = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = probe
SPEC.loader.exec_module(probe)


class ProbeTests(unittest.TestCase):
    def artifact_root(self):
        return Path(tempfile.mkdtemp(prefix="codex-daily-check-"))

    def test_parse_version_and_strict_bytes(self):
        self.assertEqual(probe.parse_version("codex-cli 0.55.1"), "0.55.1")
        self.assertIsNone(probe.parse_version("no version published"))
        self.assertEqual(probe.decode_strict(b"ok"), ("ok", False))
        self.assertEqual(probe.decode_strict(b"\xff"), ("", True))

    def test_pre_release_never_equals_stable(self):
        self.assertEqual(probe.compare_cli_versions("0.55.1", "0.55.1"), "equal")
        self.assertEqual(probe.compare_cli_versions("0.55.1-beta.1", "0.55.1"), "different_channel")
        self.assertEqual(probe.compare_cli_versions(None, "0.55.1"), "unknown")
        self.assertEqual(probe.compare_cli_versions("1.0.0-beta.1", "2.0.0"), "different_channel")

    def test_native_bundled_path_requires_mz(self):
        root = self.artifact_root() / str(uuid.uuid4())
        native = root / "app" / "resources" / "codex.exe"
        native.parent.mkdir(parents=True)
        native.write_bytes(b"MZnative")
        self.assertEqual(probe.bundled_cli_path({"install_path": str(root)}), str(native))
        (root / "app" / "resources" / "codex.exe").write_bytes(b"ELF")
        self.assertIsNone(probe.bundled_cli_path({"install_path": str(root)}))

    def test_extracted_bundled_copy_requires_exact_payload_hash(self):
        root = self.artifact_root()
        payload, extracted = root / "payload.exe", root / "extracted.exe"
        payload.write_bytes(b"MZsame"); extracted.write_bytes(b"MZsame")
        class Budget:
            def remaining_seconds(self): return 1
        verified = probe.verify_extracted_bundled_cli(str(payload),str(extracted),Budget())
        self.assertEqual(verified["status"],"verified")
        extracted.write_bytes(b"MZdifferent")
        self.assertEqual(probe.verify_extracted_bundled_cli(str(payload),str(extracted),Budget())["reason"],"payload_hash_mismatch")

    def test_hash_deadline_exhaustion_prevents_payload_execution(self):
        root = self.artifact_root()
        payload, extracted = root / "payload.exe", root / "extracted.exe"
        payload.write_bytes(b"MZsame"); extracted.write_bytes(b"MZsame")
        class Exhausted:
            def remaining_seconds(self): return 0
        result = probe.verify_extracted_bundled_cli(str(payload),str(extracted),Exhausted())
        self.assertEqual(result["reason"],"hash_deadline_exhausted")

    def test_fresh_configured_path_uses_fresh_powershell_result(self):
        class Budget:
            def run(self, command, timeout):
                self.command, self.timeout = command, timeout
                return probe.CommandResult(list(command),0,'{"path":"C:/local/codex.exe"}',"",0)
        budget = Budget()
        with mock.patch.object(probe.os,"name","nt"):
            self.assertEqual(probe.fresh_configured_cli_path(budget),"C:/local/codex.exe")
        self.assertEqual(budget.command[:3],["powershell.exe","-NoProfile","-NonInteractive"])
        self.assertIn("-eq 'CODEX_CLI_PATH'",budget.command[-1])
        self.assertNotIn("CODEX_CLI_PATH_EXTRA",budget.command[-1])

    def test_exclusive_json_and_korean_artifact_with_exact_readback(self):
        root = self.artifact_root() / str(uuid.uuid4())
        output = root / "probe.json"
        artifact = probe.assert_new_targets(output)
        korean = probe.korean_roundtrip_artifact(artifact)
        probe.write_json(output, {"label": probe.KOREAN_ROUNDTRIP_TEXT})
        self.assertTrue(korean["exact_match"])
        self.assertEqual(output.read_text(encoding="utf-8"), '{\n  "label": "코덱스 점검: 한글 UTF-8 왕복 확인"\n}\n')
        with self.assertRaises(FileExistsError):
            probe.assert_new_targets(output)

    def test_latest_check_suggests_only_verified_npm_path(self):
        root = self.artifact_root() / str(uuid.uuid4()) / "npm"
        package = root / "node_modules" / "@openai" / "codex" / "package.json"
        package.parent.mkdir(parents=True)
        package.write_text('{"name":"@openai/codex","version":"1.2.3"}',encoding="utf-8")
        snapshot = {"path":str(root / "codex.cmd"),"version":"1.2.3","status":"ok"}
        class Response:
            headers = {"Date":"Tue, 16 Sep 2026 00:00:00 GMT"}
            def read(self, size=-1): return b'{"name":"@openai/codex","version":"1.2.4"}'
            def __enter__(self): return self
            def __exit__(self,*args): return False
        class Budget:
            def remaining_seconds(self): return 5
        seen = {}
        def opener(url,timeout):
            seen.update(url=url,timeout=timeout); return Response()
        result = probe.check_latest(Budget(),snapshot,opener)
        self.assertEqual(seen["url"],probe.LATEST_URL)
        self.assertLessEqual(seen["timeout"],5)
        self.assertEqual(result["comparison"],"update_available")
        self.assertEqual(result["updateCommandSuggestion"],"npm install -g @openai/codex@latest")

    def test_latest_check_never_claims_update_on_bad_or_prerelease_data(self):
        class Response:
            headers = {}
            def read(self, size=-1): return b'{"name":"@openai/codex","version":"1.2.4-beta.1"}'
            def __enter__(self): return self
            def __exit__(self,*args): return False
        class Budget:
            def remaining_seconds(self): return 5
        snapshot = {"path":"C:/npm/codex.cmd","version":"1.2.3-beta.1","status":"ok"}
        result = probe.check_latest(Budget(),snapshot,lambda *args,**kwargs: Response())
        self.assertEqual(result["status"],"unknown")
        self.assertEqual(result["comparison"],"unknown")
        self.assertIsNone(result["updateCommandSuggestion"])

    def test_latest_check_rejects_oversized_registry_body(self):
        class Response:
            headers = {}
            def read(self, size=-1): return b"x" * 65537
            def __enter__(self): return self
            def __exit__(self,*args): return False
        class Budget:
            def remaining_seconds(self): return 5
        result = probe.check_latest(Budget(),{"status":"ok","version":"1.2.3"},lambda *args,**kwargs: Response())
        self.assertTrue(result["networkAttempted"])
        self.assertIsNotNone(result["checkedAt"])
        self.assertEqual(result["status"],"unknown")

    def test_wrapper_resolution_is_portable_and_explicit_only(self):
        root = self.artifact_root()
        wrapper = root / "wrapper.ps1"; wrapper.write_text("# test",encoding="utf-8")
        self.assertEqual(probe.resolve_wrapper(str(wrapper)),wrapper.resolve())
        with self.assertRaises(ValueError): probe.resolve_wrapper(str(root / "missing.ps1"))
        with mock.patch.dict(probe.os.environ,{"CODEX_HOME":str(root / "empty")},clear=False):
            self.assertIsNone(probe.resolve_wrapper(None))

    def test_non_windows_desktop_is_explicitly_unsupported(self):
        class Budget: pass
        with mock.patch.object(probe.os,"name","posix"):
            result = probe.discover_desktop(Budget())
        self.assertEqual(result["status"],"unsupported")

    def test_missing_wrapper_shell_falls_back_to_direct_fresh_cli(self):
        class Budget:
            def run(self, command, timeout):
                self.command = command
                return probe.CommandResult(list(command),0,"codex 1.2.3","",0)
        budget = Budget()
        with mock.patch.object(probe,"wrapper_shell",return_value=None):
            result = probe.cli_version(budget,"/tmp/codex",Path("/tmp/wrapper.ps1"))
        self.assertEqual(result["resolution"],"direct_fresh_subprocess")
        self.assertEqual(budget.command,["/tmp/codex","--version"])

    def test_wrapper_default_is_measured_or_explicitly_not_tested(self):
        class Budget:
            def run(self, command, timeout):
                self.command = command
                return probe.CommandResult(list(command),0,"codex 1.2.3","",0)
        budget = Budget()
        with mock.patch.object(probe,"wrapper_shell",return_value="pwsh"):
            measured = probe.wrapper_default_version(budget,Path("/tmp/wrapper.ps1"))
        self.assertEqual(measured["version"],"1.2.3")
        self.assertEqual(budget.command[-1],"--version")
        self.assertNotIn("--wrapper-mode",budget.command)
        self.assertEqual(probe.wrapper_default_version(budget,None)["status"],"not_tested")

    def test_real_sleep_timeout_returns_promptly(self):
        code = "import subprocess,sys,time; subprocess.Popen([sys.executable,'-c','import time; time.sleep(.2)'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(2)"
        started = time.monotonic()
        result = probe.SubprocessBudget(total_seconds=1).run([sys.executable,"-c",code],0.05)
        self.assertTrue(result.timed_out)
        self.assertLess(time.monotonic()-started,0.9)


if __name__ == "__main__":
    unittest.main()

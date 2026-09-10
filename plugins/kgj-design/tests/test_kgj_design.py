from __future__ import annotations

import hashlib
import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("kgj_design", ROOT / "scripts" / "kgj_design.py")
KGJ = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(KGJ)


def accept_unit_browser_receipt(record, *_args, **_kwargs):
    record["_browserReplayVerified"] = True
    return []


class KgjDesignTests(unittest.TestCase):
    def workspace(self, label: str) -> Path:
        return Path(tempfile.mkdtemp(prefix=f"kgj-design-{label}-"))

    def evidence_registry(self, workspace: Path, entries: dict[str, list[str] | dict]) -> Path:
        records = []
        for record_id, raw in entries.items():
            spec = raw if isinstance(raw, dict) else {"claims": raw}
            claims = spec.get("claims", [])
            proof_level = spec.get("proofLevel", "browser" if "browser-regression" in claims else "runtime")
            method = spec.get("method", "browser" if proof_level == "browser" else "command")
            strict_browser = method == "browser" and spec.get("rounds") == [2]
            started_at = "2026-08-27T06:59:59.000Z"
            completed_at = "2026-08-27T07:00:00.000Z"
            if method == "command":
                plan_id = spec.get("planId")
                plan = KGJ.COMMAND_EVIDENCE_PLANS.get(plan_id) if plan_id else None
                if plan and plan["kind"] == "python-unittest":
                    command = ["python", "-B", "-m", "unittest", "discover", "-s", "tests", "-v"]
                    stdout = b""
                    stderr = f"Ran {plan['minimumTests']} tests in 0.100s\n\nOK\n".encode()
                elif plan and plan["kind"] == "npm-test":
                    command = ["npm.cmd", "test"]
                    stdout = f"# tests {plan['minimumTests']}\n# pass {plan['minimumTests']}\n# fail 0\n".encode()
                    stderr = b""
                elif plan and plan["kind"] == "node-mcp-test":
                    command = ["node", "--test", "tests/mcp.test.mjs"]
                    stdout = f"# tests {plan['minimumTests']}\n# pass {plan['minimumTests']}\n# fail 0\n".encode()
                    stderr = b""
                elif plan and plan["kind"] == "kgj-json":
                    subcommand = plan["subcommand"]
                    manifest_version = json.loads((workspace / ".codex-plugin" / "plugin.json").read_text(encoding="utf-8"))["version"]
                    runtime_version = json.loads((workspace / "package.json").read_text(encoding="utf-8"))["version"]
                    package_a = (workspace / "package" / f"kgj-design-{runtime_version}-a.zip").resolve()
                    package_b = (workspace / "package" / f"kgj-design-{runtime_version}-b.zip").resolve()
                    immutable_source = (workspace.parent / "kgj-design-releases" / manifest_version).resolve()
                    cache = KGJ.expected_plugin_cache(manifest_version)
                    audit = {"ok": True, "source": str(immutable_source), "cache": str(cache), "package": str(package_a), "canonicalFiles": 92, "cacheFiles": 92, "packageFiles": 92}
                    output_by_command = {
                        "validate": {"ok": True, "root": str(workspace.resolve()), "skills": len(KGJ.EXPECTED_SKILLS), "dnaProfiles": 4},
                        "package-compare": {"ok": True, "status": "PASS", "byteIdentical": True, "first": {"path": str(package_a)}, "second": {"path": str(package_b)}},
                        "install-readback": {"ok": True, "status": "PASS", "installed": True, "enabled": True, "mcpEnabled": True, "installAudit": audit},
                        "install-audit": audit,
                        "evidence-check": {"ok": True, "verifiedFiles": True},
                        "quality": {"ok": True, "status": "PASS", "weightedScore": 9.975, "openP0P1": 0},
                    }
                    tail_by_command = {
                        "validate": ["."],
                        "package-compare": [str(package_a), str(package_b)],
                        "install-readback": [str(immutable_source), str(cache), "--package", str(package_a)],
                        "install-audit": [str(immutable_source), str(cache), "--package", str(package_a)],
                        "evidence-check": [str((workspace / "evidence-registry.json").resolve()), "--verify-files", "--source-root", str(workspace.resolve())],
                        "quality": ["quality.json", "--evidence-registry", "fixture-registry.json"],
                    }
                    command = ["python", "-B", "scripts/kgj_design.py", subcommand, *tail_by_command[subcommand]]
                    stdout = json.dumps(output_by_command[subcommand]).encode()
                    stderr = b""
                else:
                    command = ["kgj-unittest", record_id]
                    stdout = f"verified {record_id}\n".encode()
                    stderr = b""
                proof = workspace / f"{record_id}.receipt.json"
                stdout_path = workspace / f"{proof.name}.stdout.bin"
                stderr_path = workspace / f"{proof.name}.stderr.bin"
                stdout_path.write_bytes(stdout)
                stderr_path.write_bytes(stderr)
                transcript = {
                    "schemaVersion": "1.2" if plan_id else "1.1",
                    "id": record_id,
                    "command": command,
                    "cwd": str(workspace),
                    "startedAt": started_at,
                    "completedAt": completed_at,
                    "timeoutSeconds": 30,
                    "timedOut": False,
                    "exitStatus": 0,
                    "stdoutBytes": len(stdout),
                    "stdoutSha256": hashlib.sha256(stdout).hexdigest(),
                    "stdoutArtifact": {"locator": stdout_path.name, "bytes": len(stdout), "sha256": hashlib.sha256(stdout).hexdigest()},
                    "stderrBytes": len(stderr),
                    "stderrSha256": hashlib.sha256(stderr).hexdigest(),
                    "stderrArtifact": {"locator": stderr_path.name, "bytes": len(stderr), "sha256": hashlib.sha256(stderr).hexdigest()},
                    "captureTruncated": False,
                    "runner": {"name": "kgj-attest", "version": "1.4.0" if plan_id else "1.3.0", "shell": False},
                }
                if plan_id:
                    transcript["planId"] = plan_id
                transcript_hash = hashlib.sha256(KGJ.canonical_json(transcript).encode()).hexdigest()
                proof.write_text(json.dumps({**transcript, "transcriptSha256": transcript_hash}), encoding="utf-8")
                tool_version = "1.4.0" if plan_id else "1.3.0"
            elif strict_browser:
                receipt_root = workspace / f"{record_id}.browser"
                receipt_root.mkdir()
                source_bindings = []
                for relative in sorted(KGJ.BROWSER_REPLAY_SOURCE_PATHS):
                    source = workspace / relative
                    source.parent.mkdir(parents=True, exist_ok=True)
                    source.write_text(f"bounded source {relative}\n", encoding="utf-8")
                    source_bindings.append({"path": relative, "bytes": source.stat().st_size, "sha256": hashlib.sha256(source.read_bytes()).hexdigest()})
                checks = [{"id": check_id, "status": "pass", "observed": {"fixture": "bounded"}} for check_id in KGJ.BROWSER_REPLAY_CHECKS]
                controls = [{"id": control_id, "status": "pass", "detected": True, "observedFailure": "mutant rejected"} for control_id in KGJ.BROWSER_REPLAY_NEGATIVE_CONTROLS]
                runner = {"name": "kgj-browser-replay", "version": "1.0.0", "playwrightCli": "0.1.19", "shell": False}
                environment = {"browser": "chromium", "browserVersion": "152.0", "userAgent": "test", "localOnly": True}
                limitations = ["Bounded unit-test browser fixture."]
                replay_result = {
                    "schemaVersion": "1.0", "id": "kgj-round2-browser-replay",
                    "startedAt": started_at, "completedAt": completed_at, "status": "pass",
                    "environment": environment, "checks": checks, "negativeControls": controls,
                    "consoleEntries": [], "pageErrors": [], "limitations": limitations,
                }
                (receipt_root / "browser-replay-result.json").write_text(json.dumps(replay_result), encoding="utf-8")
                (receipt_root / "03-browser-replay.stdout.log").write_text(json.dumps({"result": KGJ.canonical_json(replay_result)}), encoding="utf-8")
                (receipt_root / "03-browser-replay.stderr.log").write_text("", encoding="utf-8")
                (receipt_root / "04-semantic-snapshot.stdout.log").write_text("- main: bounded semantic snapshot\n", encoding="utf-8")
                (receipt_root / "05-console-errors.stdout.log").write_text("", encoding="utf-8")
                for name in ("desktop-operations.png", "mobile-390-long-ko.png", "zoom-200-long-ko.png", "reduced-motion-a.png", "reduced-motion-b.png"):
                    (receipt_root / name).write_bytes(b"bounded png fixture")
                trace_root = receipt_root / ".playwright-cli" / "traces"
                trace_root.mkdir(parents=True)
                (trace_root / "bounded.trace").write_text("trace\n", encoding="utf-8")
                (trace_root / "bounded.network").write_text("network\n", encoding="utf-8")
                artifacts = []
                for artifact in sorted((path for path in receipt_root.rglob("*") if path.is_file()), key=lambda path: path.relative_to(receipt_root).as_posix()):
                    artifacts.append({"path": artifact.relative_to(receipt_root).as_posix(), "bytes": artifact.stat().st_size, "sha256": hashlib.sha256(artifact.read_bytes()).hexdigest()})
                material = {
                    "schemaVersion": "1.0",
                    "runner": "kgj-browser-replay",
                    "runnerVersion": runner["version"],
                    "playwrightCli": runner["playwrightCli"],
                    "sourceBindings": source_bindings,
                    "artifacts": artifacts,
                }
                transcript_hash = hashlib.sha256(json.dumps(material, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
                receipt = {
                    "schemaVersion": "1.0", "id": record_id, "result": "pass", "exitStatus": 0,
                    "startedAt": started_at, "completedAt": completed_at, "runner": runner,
                    "environment": environment,
                    "checks": checks, "negativeControls": controls, "consoleEntries": [], "pageErrors": [],
                    "sourceBindings": source_bindings, "artifacts": artifacts,
                    "limitations": limitations, "transcriptSha256": transcript_hash,
                }
                proof = receipt_root / "receipt.json"
                proof.write_text(json.dumps(receipt), encoding="utf-8")
                tool_version = "1.0.0"
            else:
                proof = workspace / f"{record_id}.browser.json"
                receipt = {
                    "schemaVersion": "1.0", "id": record_id, "result": "pass", "exitStatus": 0,
                    "startedAt": started_at, "completedAt": completed_at,
                    "runner": {"name": "kgj-unittest-browser", "version": "1.0.0", "shell": False},
                    "checks": [{"id": "bounded-browser-fixture", "status": "pass"}],
                }
                transcript_hash = hashlib.sha256(KGJ.canonical_json(receipt).encode()).hexdigest()
                proof.write_text(json.dumps({**receipt, "transcriptSha256": transcript_hash}), encoding="utf-8")
                tool_version = "1.0.0"
            records.append({
                "id": record_id,
                "kind": "verification",
                "proofLevel": proof_level,
                "status": "active",
                "locator": proof.relative_to(workspace).as_posix(),
                "sha256": hashlib.sha256(proof.read_bytes()).hexdigest(),
                "capturedAt": "2026-08-27T07:00:00.000Z",
                "supersedes": None,
                "limitations": ["This deterministic fixture proves only its declared test claim."],
                "action": f"Run the bounded verification for {record_id}.",
                "result": "pass",
                "exitStatus": 0,
                "postCondition": f"The {record_id} verification completed without drift.",
                "environment": {
                    "runtime": "Python unittest",
                    "browser": "Test browser" if proof_level == "browser" else None,
                    "browserVersion": "152.0" if strict_browser else "1.0" if proof_level == "browser" else None,
                    "viewport": "1280x720" if proof_level == "browser" else None,
                },
                "claims": claims,
                "coverage": sorted(set().union(*KGJ.BROWSER_REPLAY_CHECKS.values())) if strict_browser else spec.get("coverage", ["bounded-fixture"]),
                "findingRefs": spec.get("findingRefs", []),
                "rounds": spec.get("rounds", [1]),
                "attestation": {
                    "issuer": "kgj-unittest-runner",
                    "method": method,
                    "startedAt": started_at,
                    "completedAt": completed_at,
                    "toolVersion": tool_version,
                    "transcriptSha256": transcript_hash,
                },
            })
        registry = {"schemaVersion": "1.1", "productId": "test-product", "records": records}
        registry_path = workspace / "evidence-registry.json"
        registry_path.write_text(json.dumps(registry), encoding="utf-8")
        return registry_path

    def quality_fixture(self, workspace: Path) -> tuple[Path, Path, dict, dict]:
        (workspace / ".codex-plugin").mkdir(parents=True, exist_ok=True)
        (workspace / ".codex-plugin" / "plugin.json").write_text(json.dumps({"version": "1.2.2+codex.test"}), encoding="utf-8")
        (workspace / "package.json").write_text(json.dumps({"version": "1.2.2"}), encoding="utf-8")
        entries = {
            plan_id: {
                "proofLevel": "install" if "install" in plan_id or "clean-install" in plan_id else "build" if "package" in plan_id else "runtime",
                "coverage": sorted(plan["coverage"]), "rounds": sorted(plan["rounds"]), "claims": [], "planId": plan_id,
            }
            for plan_id, plan in KGJ.COMMAND_EVIDENCE_PLANS.items()
            if plan.get("registry", True) and plan["kind"] != "codex-mcp-probe"
        }
        entries["evidence.r2.browser-replay"] = {"proofLevel": "browser", "coverage": sorted(set().union(*KGJ.BROWSER_REPLAY_CHECKS.values())), "rounds": [2], "claims": []}
        refs = {
            1: {
                "r1.genome-lineage-compatibility": "evidence.r1.python-governance-tests",
                "r1.dictionary-integrity-recovery": "evidence.r1.node-dictionary-tests",
                "r1.security-privacy-permission": "evidence.r1.node-dictionary-tests",
                "r1.evidence-trust-provenance": "evidence.r1.python-governance-tests",
                "r1.compatibility-rollback": "evidence.r1.python-governance-tests",
            },
            2: {check_id: "evidence.r2.browser-replay" for check_id in KGJ.QUALITY_RUBRIC[2]["checks"]},
            3: {
                "r3.manifest-skills-mcp": "evidence.r3.plugin-contract-validation",
                "r3.deterministic-build-package": "evidence.r3.package-determinism",
                "r3.clean-install-enabled-readback": "evidence.r3.clean-install-readback",
                "r3.version-source-cache-identity": "evidence.r3.install-audit",
                "r3.receipt-reproduction": "evidence.r3.receipt-reproduction",
            },
        }
        rounds = [{
            "round": number, "lens": rubric["lens"], "weight": rubric["weight"],
            "checks": [{"id": check_id, "evidenceRef": refs[number][check_id]} for check_id in rubric["checks"]],
            "findings": [],
        } for number, rubric in KGJ.QUALITY_RUBRIC.items()]
        registry_path = self.evidence_registry(workspace, entries)
        ledger = {
            "schemaVersion": "2.0",
            "rubricVersion": "kgj-quality-1.0",
            "artifact": "test-product@1.2.0",
            "artifactType": "codex-plugin",
            "releaseTarget": "personal marketplace clean install",
            "rounds": rounds,
            "coreFlows": [{"name": "Bounded critical flow", "evidenceRef": "evidence.r1.node-dictionary-tests"}],
        }
        ledger_path = workspace / "quality.json"
        ledger_path.write_text(json.dumps(ledger), encoding="utf-8")
        return ledger_path, registry_path, ledger, json.loads(registry_path.read_text(encoding="utf-8"))

    def test_examples_validate_and_compile_to_semantic_css(self):
        for source in sorted((ROOT / "examples" / "dna").glob("*.json")):
            workspace = self.workspace("compile")
            output = workspace / f"{source.stem}.css"
            value = json.loads(source.read_text(encoding="utf-8"))
            lineage_lock = None
            if value.get("lineage"):
                lineage_lock = workspace / f"{source.stem}.lineage.lock.json"
                KGJ.resolve_lineage(source, lineage_lock)
            result = KGJ.compile_dna(source, output, lineage_lock)
            self.assertTrue(result["ok"])
            css = output.read_text(encoding="utf-8")
            self.assertIn(f'data-kgj-dna="{source.stem}"', css)
            self.assertIn("--kgj-foundation-color-canvas", css)
            self.assertIn("--kgj-semantic-surface-canvas: var(--kgj-foundation-color-canvas)", css)
            self.assertIn("--kgj-component-button-background: var(--kgj-semantic-action-accent)", css)
            self.assertEqual(result["layers"], ["foundation", "semantic", "component"])
            self.assertIn(f"lineage-lock-sha256: {result['lineageLockHash'] or 'none'}", css)
        lineage_source = ROOT / "examples" / "dna" / "regulated-operations.json"
        with self.assertRaisesRegex(KGJ.ValidationError, "requires --lineage-lock"):
            KGJ.compile_dna(lineage_source, self.workspace("missing-lock") / "tokens.css")

    def test_token_graph_rejects_raw_semantic_values_and_type_mismatch(self):
        profile = json.loads((ROOT / "examples" / "dna" / "operations-console.json").read_text(encoding="utf-8"))
        profile["tokens"]["semantic"]["surface.canvas"]["$value"] = "#000000"
        issues = KGJ.validate_dna(profile, "raw-semantic")
        self.assertTrue(any("must alias foundation" in issue for issue in issues), issues)
        profile = json.loads((ROOT / "examples" / "dna" / "operations-console.json").read_text(encoding="utf-8"))
        profile["tokens"]["component"]["button.radius"]["$type"] = "color"
        issues = KGJ.validate_dna(profile, "type-mismatch")
        self.assertTrue(any("type does not match" in issue for issue in issues), issues)

    def test_dna_v1_2_requires_closed_genome_and_detects_genome_only_change(self):
        source = json.loads((ROOT / "examples" / "dna" / "operations-console.json").read_text(encoding="utf-8"))
        missing = json.loads(json.dumps(source))
        del missing["genome"]
        self.assertTrue(any("closed genome keys" in issue for issue in KGJ.validate_dna(missing, "missing-genome")))
        extra = json.loads(json.dumps(source))
        extra["genome"]["identityClone"] = ["Forbidden identity copy."]
        self.assertTrue(any("closed genome keys" in issue for issue in KGJ.validate_dna(extra, "extra-genome")))
        workspace = self.workspace("genome-diff")
        before = workspace / "before.json"
        after = workspace / "after.json"
        before.write_text(json.dumps(source), encoding="utf-8")
        source["genome"]["dataTruth"] = ["Every visible and accessible representation binds the same verified fixture and limitation."]
        after.write_text(json.dumps(source), encoding="utf-8")
        difference = KGJ.diff_dna(before, after)
        self.assertEqual(difference["compatibility"], "review-required")
        self.assertEqual(difference["counts"]["genome"], 1)
        self.assertTrue(any(item["path"] == "genome.dataTruth" for item in difference["changes"]))

    def test_dna_diff_detects_parent_hash_and_allowed_override_changes(self):
        left = self.workspace("lineage-left")
        right = self.workspace("lineage-right")
        for target in (left, right):
            shutil.copyfile(ROOT / "examples" / "dna" / "operations-console.json", target / "operations-console.json")
            shutil.copyfile(ROOT / "examples" / "dna" / "regulated-operations.json", target / "regulated-operations.json")
        right_parent = json.loads((right / "operations-console.json").read_text(encoding="utf-8"))
        right_parent["evidence"].append("lineage:test-parent-hash")
        (right / "operations-console.json").write_text(json.dumps(right_parent), encoding="utf-8")
        parent_drift = KGJ.diff_dna(left / "regulated-operations.json", right / "regulated-operations.json")
        self.assertTrue(any(item["classification"] == "lineage-source-change" for item in parent_drift["changes"]))
        right_child = json.loads((right / "regulated-operations.json").read_text(encoding="utf-8"))
        right_child["lineage"]["allowedOverrides"].append("component.*")
        (right / "regulated-operations.json").write_text(json.dumps(right_child), encoding="utf-8")
        governance_drift = KGJ.diff_dna(left / "regulated-operations.json", right / "regulated-operations.json")
        self.assertTrue(any(item["classification"] == "lineage-governance-change" for item in governance_drift["changes"]))

    def test_packages_are_byte_deterministic(self):
        workspace = self.workspace("package")
        first = workspace / "first.zip"
        second = workspace / "second.zip"
        one = KGJ.package_plugin(ROOT, first)
        two = KGJ.package_plugin(ROOT, second)
        self.assertEqual(one["sha256"], two["sha256"])
        self.assertEqual(first.read_bytes(), second.read_bytes())
        self.assertEqual(one["sha256"], hashlib.sha256(first.read_bytes()).hexdigest())

    def test_install_audit_rejects_ignored_cache_executables(self):
        workspace = self.workspace("install-audit")
        package = workspace / "kgj-design.zip"
        KGJ.package_plugin(ROOT, package)
        cache = workspace / "cache"
        cache.mkdir()
        with zipfile.ZipFile(package) as archive:
            archive.extractall(cache)
        result = KGJ.install_audit(ROOT, cache, package)
        self.assertEqual(result["canonicalFiles"], result["cacheFiles"])
        rogue = cache / "scripts" / "__pycache__" / "rogue.pyc"
        rogue.parent.mkdir(parents=True)
        rogue.write_bytes(b"executable residue")
        with self.assertRaisesRegex(KGJ.ValidationError, "ignored executables"):
            KGJ.install_audit(ROOT, cache, package)

    def test_fresh_codex_cli_command_is_wrapper_bound(self):
        expected_wrapper = str((Path.home() / ".codex" / "scripts" / "Invoke-FreshCodexCli.ps1").resolve())
        with mock.patch.object(KGJ.shutil, "which", return_value=r"C:\Program Files\PowerShell\7\pwsh.exe"):
            command = KGJ.fresh_codex_cli_command("plugin", "list", "--json")
        self.assertEqual(command, [
            r"C:\Program Files\PowerShell\7\pwsh.exe",
            "-NoProfile", "-File", expected_wrapper, "plugin", "list", "--json",
        ])

    def test_mcp_readback_parser_rejects_substring_and_field_ambiguity(self):
        valid = "\n".join([
            "kgj-design",
            "  enabled: true",
            "  transport: stdio",
            "  command: node",
            "  args: ./mcp/server.mjs",
            f"  cwd: {(Path.home() / '.codex' / 'plugins' / 'cache' / 'personal' / 'kgj-design' / '1.2.4').resolve()}\\.",
            "  env: -",
            "  remove: codex mcp remove kgj-design",
        ])
        parsed = KGJ.parse_codex_mcp_readback(valid)
        self.assertEqual(parsed["transport"], "stdio")
        with self.assertRaisesRegex(KGJ.ValidationError, "structured field"):
            KGJ.parse_codex_mcp_readback(valid + "\n  enabled: false but enabled: true appears later")
        with self.assertRaisesRegex(KGJ.ValidationError, "closed contract"):
            KGJ.parse_codex_mcp_readback(valid + "\n  note: enabled: true")

    def test_attestation_runner_binds_command_result_and_refuses_overwrite(self):
        workspace = self.workspace("attest")
        output = workspace / "receipt.json"
        command = [
            sys.executable,
            str(ROOT / "scripts" / "kgj_attest.py"),
            "--output", str(output),
            "--id", "test.attestation-runner",
            "--cwd", str(ROOT),
            "--", sys.executable, "-c", "print('verified')",
        ]
        first = subprocess.run(command, capture_output=True, text=True, check=False)
        self.assertEqual(first.returncode, 0, first.stderr)
        receipt = json.loads(output.read_text(encoding="utf-8"))
        self.assertEqual(receipt["schemaVersion"], "1.1")
        self.assertEqual(receipt["exitStatus"], 0)
        self.assertFalse(receipt["runner"]["shell"])
        self.assertRegex(receipt["transcriptSha256"], r"^[a-f0-9]{64}$")
        for stream in ("stdout", "stderr"):
            sidecar = workspace / receipt[f"{stream}Artifact"]["locator"]
            self.assertTrue(sidecar.is_file())
            self.assertEqual(receipt[f"{stream}Artifact"]["sha256"], hashlib.sha256(sidecar.read_bytes()).hexdigest())
        second = subprocess.run(command, capture_output=True, text=True, check=False)
        self.assertNotEqual(second.returncode, 0)
        self.assertIn("refusing to overwrite", second.stderr + second.stdout)

    def test_fresh_codex_mcp_probe_requires_a_completed_structured_tool_call(self):
        events = [
            {"type": "thread.started", "thread_id": "01a07e7e-2023-7390-a1a2-25f0b01eec2b"},
            {"type": "turn.started"},
            {"type": "item.started", "item": {
                "id": "item_2", "type": "mcp_tool_call", "server": "kgj-design",
                "tool": "get_ontology", "arguments": {}, "result": None, "error": None,
                "status": "in_progress",
            }},
            {"type": "item.completed", "item": {
                "id": "item_2", "type": "mcp_tool_call", "server": "kgj-design",
                "tool": "get_ontology", "arguments": {},
                "result": {"structured_content": {"ontologyId": "kgj-design-ontology", "version": "1.2.0"}},
                "error": None, "status": "completed",
            }},
            {"type": "item.completed", "item": {
                "id": "item_3", "type": "agent_message",
                "text": json.dumps({
                    "invokedTool": "mcp__kgj_design__get_ontology", "ok": True,
                    "ontologyId": "kgj-design-ontology", "ontologyVersion": "1.2.0",
                }, separators=(",", ":")),
            }},
            {"type": "turn.completed", "usage": {}},
        ]
        stdout = "\n".join(json.dumps(event, separators=(",", ":")) for event in events) + "\n"
        self.assertEqual(KGJ.validate_codex_mcp_probe_output(stdout, ""), [])

    def test_fresh_codex_mcp_probe_rejects_approval_failure_or_narrative_only_claim(self):
        failed_events = [
            {"type": "thread.started", "thread_id": "01a07e76-606c-7082-a61e-5fb2372b10f8"},
            {"type": "turn.started"},
            {"type": "item.started", "item": {
                "id": "item_2", "type": "mcp_tool_call", "server": "kgj-design",
                "tool": "get_ontology", "arguments": {}, "result": None, "error": None,
                "status": "in_progress",
            }},
            {"type": "item.completed", "item": {
                "id": "item_2", "type": "mcp_tool_call", "server": "kgj-design",
                "tool": "get_ontology", "arguments": {}, "result": None,
                "error": {"message": "MCP tool call requires approval, but approval policy is never"},
                "status": "failed",
            }},
            {"type": "item.completed", "item": {
                "id": "item_3", "type": "agent_message",
                "text": json.dumps({
                    "invokedTool": "mcp__kgj_design__get_ontology", "ok": False,
                    "ontologyId": None, "ontologyVersion": None,
                }, separators=(",", ":")),
            }},
            {"type": "turn.completed", "usage": {}},
        ]
        failed_stdout = "\n".join(json.dumps(event, separators=(",", ":")) for event in failed_events) + "\n"
        failed_issues = KGJ.validate_codex_mcp_probe_output(failed_stdout, "approval policy is never")
        self.assertTrue(any("completed MCP call" in issue for issue in failed_issues), failed_issues)
        self.assertTrue(any("approval policy" in issue for issue in failed_issues), failed_issues)

        narrative_only = "\n".join(json.dumps(event, separators=(",", ":")) for event in [
            failed_events[0],
            failed_events[1],
            {"type": "item.completed", "item": {
                "id": "item_3", "type": "agent_message",
                "text": json.dumps({
                    "invokedTool": "mcp__kgj_design__get_ontology", "ok": True,
                    "ontologyId": "kgj-design-ontology", "ontologyVersion": "1.2.0",
                }, separators=(",", ":")),
            }},
            failed_events[-1],
        ]) + "\n"
        narrative_issues = KGJ.validate_codex_mcp_probe_output(narrative_only, "")
        self.assertTrue(any("completed MCP call" in issue for issue in narrative_issues), narrative_issues)

    @mock.patch.object(KGJ, "validate_browser_receipt", side_effect=accept_unit_browser_receipt)
    def test_quality_gate_requires_exactly_three_rounds_and_9_9(self, _browser_receipt):
        workspace = self.workspace("quality")
        path, registry_path, valid, registry = self.quality_fixture(workspace)
        with self.assertRaisesRegex(KGJ.ValidationError, "evidence-registry"):
            KGJ.quality_gate(path)
        result = KGJ.quality_gate(path, registry_path)
        self.assertEqual(result["status"], "PASS")
        self.assertEqual(result["weightedScore"], 10.0)
        self.assertEqual(len(result["roundScores"]), 3)
        manual = json.loads(json.dumps(valid))
        manual["rounds"][0]["finalScore"] = 10
        manual_path = workspace / "manual-score.json"
        manual_path.write_text(json.dumps(manual), encoding="utf-8")
        with self.assertRaisesRegex(KGJ.ValidationError, "missing or unknown fields"):
            KGJ.quality_gate(manual_path, registry_path)
        forged = json.loads(json.dumps(valid))
        forged["rounds"][0]["findings"] = [{
            "id": "finding.p1-forged",
            "severity": "P1",
            "status": "open",
            "summary": "This finding remains open and must hard-block release.",
        }]
        forged_path = workspace / "forged-supersession.json"
        forged_path.write_text(json.dumps(forged), encoding="utf-8")
        with self.assertRaisesRegex(KGJ.ValidationError, "open P0/P1"):
            KGJ.quality_gate(forged_path, registry_path)
        invalid = json.loads(json.dumps(valid))
        invalid["rounds"] = valid["rounds"][:2]
        bad_path = workspace / "invalid.json"
        bad_path.write_text(json.dumps(invalid), encoding="utf-8")
        with self.assertRaises(KGJ.ValidationError):
            KGJ.quality_gate(bad_path, registry_path)
        runtime_install = json.loads(json.dumps(registry))
        install_record = next(item for item in runtime_install["records"] if item["id"] == "evidence.r3.clean-install-readback")
        install_record["proofLevel"] = "runtime"
        runtime_install_path = workspace / "runtime-install.json"
        runtime_install_path.write_text(json.dumps(runtime_install), encoding="utf-8")
        with self.assertRaisesRegex(KGJ.ValidationError, "requires proofLevel install"):
            KGJ.quality_gate(path, runtime_install_path)
        missing_motion = json.loads(json.dumps(registry))
        motion_record = next(item for item in missing_motion["records"] if item["id"] == "evidence.r2.browser-replay")
        motion_record["coverage"].remove("reduced-motion")
        missing_motion_path = workspace / "missing-motion.json"
        missing_motion_path.write_text(json.dumps(missing_motion), encoding="utf-8")
        with self.assertRaisesRegex(KGJ.ValidationError, "reduced-motion"):
            KGJ.quality_gate(path, missing_motion_path)

    def test_plugin_contract_validates(self):
        result = KGJ.validate_plugin(ROOT)
        self.assertTrue(result["ok"])
        self.assertEqual(result["skills"], 11)
        self.assertGreaterEqual(result["dnaProfiles"], 4)

    def test_project_contract_initializes_fail_closed_then_becomes_ready(self):
        workspace = self.workspace("contract")
        initialized = KGJ.init_project(workspace, "assurance-console", "Assurance Console", "Regulated operations", "Product Design", True)
        self.assertEqual(initialized["status"], "draft")
        contract_path = workspace / "kgj.design.json"
        held = KGJ.doctor_project(contract_path)
        self.assertEqual(held["status"], "hold")
        self.assertTrue(any("not ready" in issue for issue in held["holds"]))
        contract = json.loads(contract_path.read_text(encoding="utf-8"))
        KGJ.compile_dna(workspace / contract["paths"]["dna"], workspace / contract["paths"]["tokenOutput"])
        contract["state"] = "ready"
        contract["unresolved"] = []
        contract_path.write_text(json.dumps(contract, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        ready = KGJ.doctor_project(contract_path)
        self.assertEqual(ready["status"], "ready", ready["holds"])
        dna_path = workspace / contract["paths"]["dna"]
        dna = json.loads(dna_path.read_text(encoding="utf-8"))
        dna["tokens"]["foundation"]["color.accent"]["$value"] = "#A7F35A"
        dna_path.write_text(json.dumps(dna), encoding="utf-8")
        stale = KGJ.doctor_project(contract_path)
        self.assertEqual(stale["status"], "hold")
        self.assertTrue(any("compiled output is stale" in issue for issue in stale["holds"]), stale["holds"])

    def test_lineage_lock_resolves_and_forbids_semantic_override(self):
        source = ROOT / "examples" / "dna" / "regulated-operations.json"
        result = KGJ.resolve_lineage(source)
        self.assertEqual(result["lock"]["status"], "resolved")
        self.assertEqual(result["lock"]["ancestors"][0]["id"], "operations-console")
        workspace = self.workspace("lineage")
        parent = workspace / "operations-console.json"
        child = workspace / "regulated-operations.json"
        shutil.copyfile(ROOT / "examples" / "dna" / "operations-console.json", parent)
        value = json.loads(source.read_text(encoding="utf-8"))
        value["tokens"]["semantic"]["action.accent"]["$value"] = "{foundation.color.ink}"
        child.write_text(json.dumps(value), encoding="utf-8")
        with self.assertRaisesRegex(KGJ.ValidationError, "forbidden semantic override"):
            KGJ.resolve_lineage(child)

    def test_project_doctor_rejects_parent_only_lineage_drift(self):
        workspace = self.workspace("parent-drift")
        parent = workspace / "operations-console.json"
        child = workspace / "regulated-operations.json"
        shutil.copyfile(ROOT / "examples" / "dna" / "operations-console.json", parent)
        shutil.copyfile(ROOT / "examples" / "dna" / "regulated-operations.json", child)
        evidence_root = workspace / "evidence"
        evidence_root.mkdir()
        evidence_registry = workspace / "evidence.json"
        evidence_registry.write_text(json.dumps({"schemaVersion": "1.1", "productId": "regulated-operations", "records": []}), encoding="utf-8")
        lineage_lock = workspace / "regulated-operations.lock.json"
        KGJ.resolve_lineage(child, lineage_lock)
        token_output = workspace / "tokens.css"
        KGJ.compile_dna(child, token_output, lineage_lock)
        contract = {
            "schemaVersion": "1.0",
            "project": {"id": "regulated-operations", "name": "Regulated Operations", "domain": "High-risk operations", "owner": "Product Design"},
            "state": "ready",
            "paths": {"dna": child.name, "tokenOutput": token_output.name, "evidenceRegistry": evidence_registry.name, "evidenceRoot": evidence_root.name},
            "surfaces": ["web-app"],
            "themes": ["dark"],
            "locales": ["ko-KR"],
            "unresolved": [],
        }
        contract_path = workspace / "kgj.design.json"
        contract_path.write_text(json.dumps(contract), encoding="utf-8")
        self.assertEqual(KGJ.doctor_project(contract_path)["status"], "ready")
        parent_value = json.loads(parent.read_text(encoding="utf-8"))
        parent_value["tokens"]["foundation"]["color.canvas"]["$value"] = "#0D1218"
        parent.write_text(json.dumps(parent_value), encoding="utf-8")
        stale = KGJ.doctor_project(contract_path)
        self.assertEqual(stale["status"], "hold")
        self.assertTrue(any("current lineage lock" in issue for issue in stale["holds"]), stale["holds"])

    def test_dna_diff_and_migration_separate_expression_from_breaking_change(self):
        cross_product = KGJ.diff_dna(
            ROOT / "examples" / "dna" / "operations-console.json",
            ROOT / "examples" / "dna" / "regulated-operations.json",
        )
        self.assertEqual(cross_product["compatibility"], "breaking")
        self.assertTrue(any(item["classification"] == "product-identity-change" for item in cross_product["changes"]))
        workspace = self.workspace("migration")
        current = workspace / "operations-current.json"
        next_value = workspace / "operations-next.json"
        shutil.copyfile(ROOT / "examples" / "dna" / "operations-console.json", current)
        evolved = json.loads(current.read_text(encoding="utf-8"))
        evolved["tokens"]["foundation"]["color.accent"]["$value"] = "#B6FF72"
        next_value.write_text(json.dumps(evolved), encoding="utf-8")
        difference = KGJ.diff_dna(current, next_value)
        self.assertEqual(difference["compatibility"], "review-required")
        self.assertTrue(any(item["classification"] == "expression-change" for item in difference["changes"]))

        self.assertRegex(difference["from"]["sourceSha256"], r"^[a-f0-9]{64}$")
        self.assertRegex(difference["from"]["genomeSha256"], r"^[a-f0-9]{64}$")
        self.assertRegex(difference["from"]["ancestrySha256"], r"^[a-f0-9]{64}$")
        plan = KGJ.migration_plan(current, next_value)
        self.assertEqual(plan["plan"]["releaseDecision"], "hold")
        self.assertTrue(plan["plan"]["holdReasons"])
        self.assertEqual(len(plan["plan"]["stages"]), 4)
        runtime_claims = sorted(KGJ.MIGRATION_REQUIRED_CLAIMS - {"browser-regression"})
        registry_path = self.evidence_registry(workspace, {
            "migration.runtime-proof": {"claims": runtime_claims, "proofLevel": "runtime"},
            "migration.browser-proof": {"claims": ["browser-regression"], "proofLevel": "browser"},
        })
        ready = KGJ.migration_plan(
            current,
            next_value,
            evidence_registry_path=registry_path,
            evidence_refs=["migration.runtime-proof", "migration.browser-proof"],
            owner="Product Design",
            rollback_target="operations-console@1.0",
        )
        self.assertEqual(ready["plan"]["releaseDecision"], "ready-for-canary")
        self.assertEqual(set(ready["plan"]["verifiedClaims"]), KGJ.MIGRATION_REQUIRED_CLAIMS)
        self.assertEqual(ready["plan"]["genomePaths"], [])
        invalid_registry = json.loads(registry_path.read_text(encoding="utf-8"))
        invalid_registry["records"][0]["proofLevel"] = "declaration"
        invalid_registry["records"][0]["environment"] = {"runtime": None, "browser": None, "browserVersion": None, "viewport": None}
        invalid_registry_path = workspace / "declaration-only-evidence.json"
        invalid_registry_path.write_text(json.dumps(invalid_registry), encoding="utf-8")
        with self.assertRaisesRegex(KGJ.ValidationError, "claim .* requires proofLevel"):
            KGJ.migration_plan(
                current,
                next_value,
                evidence_registry_path=invalid_registry_path,
                evidence_refs=["migration.runtime-proof", "migration.browser-proof"],
                owner="Product Design",
                rollback_target="operations-console@1.0",
            )

        nonzero_registry = json.loads(registry_path.read_text(encoding="utf-8"))
        nonzero_registry["records"][0]["exitStatus"] = 1
        nonzero_registry_path = workspace / "nonzero-exit-evidence.json"
        nonzero_registry_path.write_text(json.dumps(nonzero_registry), encoding="utf-8")
        with self.assertRaisesRegex(KGJ.ValidationError, "requires exitStatus 0"):
            KGJ.migration_plan(
                current,
                next_value,
                evidence_registry_path=nonzero_registry_path,
                evidence_refs=["migration.runtime-proof", "migration.browser-proof"],
                owner="Product Design",
                rollback_target="operations-console@1.0",
            )

    def test_preview_dna_is_external_hash_bound_and_never_applies_sources(self):
        workspace = self.workspace("preview")
        current = workspace / "current.json"
        next_value = workspace / "next.json"
        shutil.copy2(ROOT / "examples" / "dna" / "operations-console.json", current)
        shutil.copy2(ROOT / "examples" / "dna" / "research-report.json", next_value)
        before_current, before_next = current.read_bytes(), next_value.read_bytes()
        output = workspace.parent / f"{workspace.name}-preview"
        result = KGJ.preview_dna(current, next_value, output, KGJ.sha256_file(current), KGJ.sha256_file(next_value))
        self.assertTrue(result["ok"])
        self.assertFalse(result["applyAllowed"])
        self.assertTrue((output / "index.html").is_file())
        self.assertTrue((output / "preview.json").is_file())
        self.assertEqual(current.read_bytes(), before_current)
        self.assertEqual(next_value.read_bytes(), before_next)
        with self.assertRaisesRegex(KGJ.ValidationError, "stale"):
            KGJ.preview_dna(current, next_value, workspace.parent / f"{workspace.name}-stale", "0" * 64, KGJ.sha256_file(next_value))

    def test_preview_dna_refuses_source_change_during_generation_and_retains_failed_staging(self):
        workspace = self.workspace("preview-race")
        current = workspace / "current.json"
        next_value = workspace / "next.json"
        shutil.copy2(ROOT / "examples" / "dna" / "operations-console.json", current)
        shutil.copy2(ROOT / "examples" / "dna" / "research-report.json", next_value)
        output = workspace.parent / f"{workspace.name}-preview"
        expected_current, expected_next = KGJ.sha256_file(current), KGJ.sha256_file(next_value)
        original_compile = KGJ.compile_dna

        def compile_then_mutate(source, target, lineage_lock=None):
            result = original_compile(source, target, lineage_lock)
            if target.name == "before.css":
                changed = json.loads(next_value.read_text(encoding="utf-8"))
                changed["tokens"]["foundation"]["color.accent"]["$value"] = "#123456"
                next_value.write_text(json.dumps(changed), encoding="utf-8")
            return result

        with mock.patch.object(KGJ, "compile_dna", side_effect=compile_then_mutate):
            with self.assertRaisesRegex(KGJ.ValidationError, "changed during generation"):
                KGJ.preview_dna(current, next_value, output, expected_current, expected_next)
        self.assertFalse(output.exists())
        staging = list(workspace.parent.glob(f".{output.name}.failed-*"))
        self.assertEqual(len(staging), 1)
        status = json.loads((staging[0] / "preview-status.json").read_text(encoding="utf-8"))
        self.assertEqual(status["status"], "failed")
        self.assertTrue((staging[0] / "after.css").is_file())

    @mock.patch.object(KGJ, "validate_browser_receipt", side_effect=accept_unit_browser_receipt)
    def test_strict_quality_resolves_active_hashed_evidence(self, _browser_receipt):
        workspace = self.workspace("evidence")
        ledger_path, registry_path, ledger, registry = self.quality_fixture(workspace)
        self.assertEqual(KGJ.quality_gate(ledger_path, registry_path)["evidenceRecords"], 9)
        proof_record = next(item for item in registry["records"] if item["id"] == "evidence.r1.node-dictionary-tests")
        proof = workspace / proof_record["locator"]
        original_proof = proof.read_bytes()
        proof.write_text("drifted\n", encoding="utf-8")
        with self.assertRaisesRegex(KGJ.ValidationError, "hash mismatch"):
            KGJ.quality_gate(ledger_path, registry_path)
        proof.write_bytes(original_proof)
        closed = json.loads(json.dumps(ledger))
        closed["rounds"][0]["findings"] = [{
            "id": "finding.bound-closure",
            "severity": "P2",
            "status": "closed",
            "summary": "The resolved finding must be named by its evidence receipt.",
            "evidenceRef": "evidence.r1.node-dictionary-tests",
        }]
        closed_path = workspace / "closed.json"
        closed_path.write_text(json.dumps(closed), encoding="utf-8")
        with self.assertRaisesRegex(KGJ.ValidationError, "does not bind this finding"):
            KGJ.quality_gate(closed_path, registry_path)
        linked_registry = json.loads(json.dumps(registry))
        linked_record = next(item for item in linked_registry["records"] if item["id"] == "evidence.r1.node-dictionary-tests")
        linked_record["findingRefs"] = ["finding.bound-closure"]
        linked_registry_path = workspace / "linked-evidence.json"
        linked_registry_path.write_text(json.dumps(linked_registry), encoding="utf-8")
        result = KGJ.quality_gate(closed_path, linked_registry_path)
        self.assertEqual(result["roundScores"][0]["initialScore"], 9.9)
        self.assertEqual(result["roundScores"][0]["finalScore"], 10.0)

    def test_attestation_verifier_rejects_receipt_and_sidecar_tampering(self):
        workspace = self.workspace("attestation-tamper")
        registry_path = self.evidence_registry(workspace, {"evidence.command-tamper": {"proofLevel": "runtime", "rounds": [1]}})
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
        record = registry["records"][0]
        receipt_path = workspace / record["locator"]
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
        receipt["exitStatus"] = 9
        receipt_path.write_text(json.dumps(receipt), encoding="utf-8")
        record["sha256"] = hashlib.sha256(receipt_path.read_bytes()).hexdigest()
        registry_path.write_text(json.dumps(registry), encoding="utf-8")
        _, issues = KGJ.validate_evidence_registry(registry_path, verify_files=True, source_root=workspace)
        self.assertTrue(any("canonical hash mismatch" in issue for issue in issues), issues)

        registry_path = self.evidence_registry(workspace, {"evidence.sidecar-tamper": {"proofLevel": "runtime", "rounds": [1]}})
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
        record = registry["records"][0]
        receipt_path = workspace / record["locator"]
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
        stdout_path = receipt_path.parent / receipt["stdoutArtifact"]["locator"]
        stdout_path.write_bytes(b"tampered\n")
        _, issues = KGJ.validate_evidence_registry(registry_path, verify_files=True, source_root=workspace)
        self.assertTrue(any("bound sha256 mismatch" in issue for issue in issues), issues)

    def test_scored_command_plan_rejects_successful_irrelevant_command(self):
        workspace = self.workspace("command-plan-echo")
        (workspace / ".codex-plugin").mkdir(parents=True)
        (workspace / ".codex-plugin" / "plugin.json").write_text(json.dumps({"version": "1.2.2+codex.test"}), encoding="utf-8")
        (workspace / "package.json").write_text(json.dumps({"version": "1.2.2"}), encoding="utf-8")
        plan_id = "evidence.r1.python-governance-tests"
        plan = KGJ.COMMAND_EVIDENCE_PLANS[plan_id]
        registry_path = self.evidence_registry(workspace, {
            plan_id: {"proofLevel": "runtime", "rounds": [1], "coverage": sorted(plan["coverage"]), "planId": plan_id},
        })
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
        record = registry["records"][0]
        receipt_path = workspace / record["locator"]
        receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
        receipt["command"] = ["python", "-c", "print('success')"]
        receipt["transcriptSha256"] = hashlib.sha256(KGJ.canonical_json({key: value for key, value in receipt.items() if key != "transcriptSha256"}).encode()).hexdigest()
        receipt_path.write_text(json.dumps(receipt), encoding="utf-8")
        record["sha256"] = hashlib.sha256(receipt_path.read_bytes()).hexdigest()
        record["attestation"]["transcriptSha256"] = receipt["transcriptSha256"]
        registry_path.write_text(json.dumps(registry), encoding="utf-8")
        _, issues = KGJ.validate_evidence_registry(registry_path, verify_files=True, source_root=workspace)
        self.assertTrue(any("plan command drift" in issue for issue in issues), issues)

    def test_browser_replay_rejects_arbitrary_five_file_proof(self):
        workspace = self.workspace("browser-five-files")
        registry_path = self.evidence_registry(workspace, {
            "evidence.r2.browser-replay": {"proofLevel": "browser", "rounds": [2], "coverage": sorted(set().union(*KGJ.BROWSER_REPLAY_CHECKS.values())), "method": "browser"},
        })
        _, issues = KGJ.validate_evidence_registry(registry_path, verify_files=True, source_root=workspace)
        self.assertTrue(any("invalid PNG artifact" in issue or "not parseable JSONL" in issue for issue in issues), issues)

    def test_release_attestation_rejects_transcript_tampering(self):
        workspace = self.workspace("release-attestation-tamper")
        attestation = workspace / "release-attestation.json"
        attestation.write_text(json.dumps({
            "schemaVersion": "1.0",
            "id": "kgj-release-test",
            "status": "PASS",
            "version": "test",
            "createdAt": "2026-08-27T07:00:01.000Z",
            "issuer": {},
            "subjects": {},
            "bindings": {key: {} for key in ("manifest", "ledger", "registry", "marketplace", "qualityReceipt", "qualityStdout", "qualityStderr")},
            "verification": {},
            "limitations": [],
            "transcriptSha256": "0" * 64,
        }), encoding="utf-8")
        with self.assertRaisesRegex(KGJ.ValidationError, "transcript hash mismatch"):
            KGJ.verify_release_attestation(attestation)

    def test_release_timeline_rejects_future_and_naive_timestamps(self):
        now = KGJ.datetime(2026, 9, 2, 1, 30, 0, tzinfo=KGJ.timezone.utc)
        with self.assertRaisesRegex(KGJ.ValidationError, "future clock-skew bound"):
            KGJ.validate_release_timeline(
                "2026-09-02T01:35:01.000Z",
                "2026-09-02T01:29:59.000Z",
                now=now,
            )
        with self.assertRaisesRegex(KGJ.ValidationError, "must include a UTC offset"):
            KGJ.validate_release_timeline(
                "2026-09-02T01:30:00",
                "2026-09-02T01:29:59.000Z",
                now=now,
            )
        created, completed = KGJ.validate_release_timeline(
            "2026-09-02T01:35:00.000Z",
            "2026-09-02T01:29:59.000Z",
            now=now,
        )
        self.assertGreaterEqual(created, completed)

    def test_stable_pattern_requires_six_passes_and_two_evidence_refs(self):
        workspace = self.workspace("pattern")
        value = {
            "schemaVersion": "1.0", "id": "decision-spine", "name": "Decision spine", "stage": "stable", "owner": "Product Design",
            "scope": ["high-risk operations"],
            "criteria": {key: "pass" for key in KGJ.PATTERN_CRITERIA},
            "evidenceRefs": ["evidence.usability", "evidence.accessibility"],
            "migration": {"replacement": None, "deadline": None, "notes": "No migration required."}
        }
        path = workspace / "pattern.json"
        path.write_text(json.dumps(value), encoding="utf-8")
        with self.assertRaisesRegex(KGJ.ValidationError, "evidence-registry"):
            KGJ.validate_pattern_candidate(path)
        registry_path = self.evidence_registry(workspace, {"evidence.usability": [], "evidence.accessibility": []})
        self.assertTrue(KGJ.validate_pattern_candidate(path, registry_path)["binding"])
        nonzero_registry = json.loads(registry_path.read_text(encoding="utf-8"))
        nonzero_registry["records"][0]["exitStatus"] = 1
        nonzero_path = workspace / "nonzero-pattern-evidence.json"
        nonzero_path.write_text(json.dumps(nonzero_registry), encoding="utf-8")
        with self.assertRaisesRegex(KGJ.ValidationError, "not usable"):
            KGJ.validate_pattern_candidate(path, nonzero_path)
        value["criteria"]["accessible"] = "hold"
        path.write_text(json.dumps(value), encoding="utf-8")
        with self.assertRaisesRegex(KGJ.ValidationError, "six passing criteria"):
            KGJ.validate_pattern_candidate(path, registry_path)

    def test_demo_contract_scopes_tabs_and_exposes_adversarial_fixtures(self):
        html = (ROOT / "assets" / "demo" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "assets" / "demo" / "app.js").read_text(encoding="utf-8")
        self.assertNotIn("document.querySelectorAll('[role=\"tab\"]')", script)
        self.assertIn("root.querySelectorAll('[role=\"tab\"]')", script)
        self.assertIn('root: document.querySelector(".phenotype-tabs")', script)
        self.assertIn('root: document.querySelector(".system-tabs")', script)
        for fixture in ('"long-ko"', '"partial"', '"error"'):
            self.assertIn(fixture, script)
        self.assertIn("forcedReducedMotion", script)
        self.assertIn("window.__kgjDemoDiagnostics", script)
        self.assertIn('id="chart-summary"', html)
        self.assertIn('id="nav-toggle"', html)
        self.assertIn('<dialog class="evidence-panel"', html)
        self.assertIn('aria-labelledby="evidence-title"', html)
        self.assertIn('aria-controls="evidence-panel"', html)
        self.assertIn('aria-expanded="false"', html)


if __name__ == "__main__":
    unittest.main()

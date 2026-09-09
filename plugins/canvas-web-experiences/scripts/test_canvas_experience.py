from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from canvas_experience import REQUIRED_CORE_CLAIM_IDS, REQUIRED_STAGE_IDS, validate_receipt  # noqa: E402


def valid_receipt(root: Path) -> dict:
    artifacts = root / "evidence"
    artifacts.mkdir(parents=True)
    for filename in ("concept.png", "desktop.png", "mobile.png", "keyboard.png", "fallback.png", "console.txt"):
        (artifacts / filename).write_bytes(b"proof")

    commands = [
        {"id": "static", "label": "static", "exitCode": 0, "status": "passed"},
        {"id": "build", "label": "build", "exitCode": 0, "status": "passed"},
        {"id": "browser", "label": "browser", "exitCode": 0, "status": "passed"},
        {"id": "package", "label": "package", "exitCode": 0, "status": "passed"},
    ]
    evidence = [
        {"id": "static-spec", "level": "static", "commandId": "static", "result": "passed", "assertion": "spec valid"},
        {"id": "build-proof", "level": "build", "commandId": "build", "result": "passed", "assertion": "build valid"},
        {"id": "package-proof", "level": "build", "commandId": "package", "result": "passed", "assertion": "package valid"},
    ]
    browser_items = {
        "concept-browser": "concept.png",
        "desktop-browser": "desktop.png",
        "mobile-browser": "mobile.png",
        "keyboard-browser": "keyboard.png",
        "fallback-browser": "fallback.png",
        "console-browser": "console.txt",
    }
    for evidence_id, filename in browser_items.items():
        evidence.append({
            "id": evidence_id,
            "level": "browser",
            "commandId": "browser",
            "result": "passed",
            "assertion": f"{evidence_id} asserted",
            "browserName": "Chrome",
            "browserVersion": "test",
            "viewport": "1440x900" if evidence_id != "mobile-browser" else "390x844",
            "postCondition": f"{evidence_id} post-condition passed",
            "artifact": f"evidence/{filename}",
        })
    claim_evidence = {
        "ontology-valid": ("static", "static-spec"),
        "concept-fidelity": ("browser", "concept-browser"),
        "build-valid": ("build", "build-proof"),
        "runtime-load": ("browser", "desktop-browser"),
        "browser-primary": ("browser", "desktop-browser"),
        "browser-mobile": ("browser", "mobile-browser"),
        "browser-keyboard": ("browser", "keyboard-browser"),
        "browser-fallback": ("browser", "fallback-browser"),
        "browser-console-clean": ("browser", "console-browser"),
        "package-valid": ("build", "package-proof"),
    }
    claims = [
        {"id": claim_id, "kind": "core", "status": "passed", "requiredLevel": level, "statement": claim_id, "evidenceIds": [evidence_id]}
        for claim_id, (level, evidence_id) in claim_evidence.items()
    ]
    return {
        "schemaVersion": "one-call-receipt/1.0",
        "runId": "test-run",
        "project": "test-project",
        "startedAt": "2026-08-21T00:00:00Z",
        "endedAt": "2026-08-21T00:01:00Z",
        "stages": [
            {"id": stage_id, "status": "passed", "evidenceIds": ["static-spec"]}
            for stage_id in REQUIRED_STAGE_IDS
        ],
        "commands": commands,
        "evidence": evidence,
        "claims": claims,
        "substitutions": [],
        "unresolvedRequiredProof": [],
        "gate": {
            "rounds": [
                {"id": "architecture-security", "status": "passed"},
                {"id": "browser-ux-a11y-performance", "status": "passed"},
                {"id": "reproducibility-package-install", "status": "passed"},
            ],
            "score": 99,
            "openP0": 0,
            "openP1": 0,
            "status": "passed",
        },
    }


class ReceiptTests(unittest.TestCase):
    def test_valid_receipt_passes(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            receipt = valid_receipt(root)
            self.assertEqual(set(item["id"] for item in receipt["claims"]), REQUIRED_CORE_CLAIM_IDS)
            self.assertEqual(validate_receipt(receipt, root), [])

    def test_legacy_unstructured_receipt_fails(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            errors = validate_receipt({"project": "legacy", "evidence": ["claimed"]}, Path(directory))
            self.assertTrue(any("missing top-level keys" in error for error in errors))
            self.assertTrue(any("schemaVersion" in error for error in errors))

    def test_failed_command_needs_successful_replacement(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            receipt = valid_receipt(root)
            receipt["commands"].append({"id": "stale-click", "label": "click", "exitCode": 1, "status": "failed"})
            errors = validate_receipt(receipt, root)
            self.assertTrue(any("supersededBy" in error for error in errors))
            fixed = deepcopy(receipt)
            fixed["commands"][-1]["supersededBy"] = "browser"
            self.assertEqual(validate_receipt(fixed, root), [])

    def test_only_learning_may_remain_pending_before_append(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            receipt = valid_receipt(root)
            receipt["stages"][-1]["status"] = "pending"
            receipt["unresolvedRequiredProof"] = ["learning-append-pending"]
            receipt["gate"]["status"] = "bounded"
            self.assertNotEqual(validate_receipt(receipt, root), [])
            self.assertEqual(validate_receipt(receipt, root, allow_learning_pending=True), [])

    def test_validate_accepts_spec_option_alias(self) -> None:
        root = SCRIPT_DIR.parent
        result = subprocess.run(
            [sys.executable, str(SCRIPT_DIR / "canvas_experience.py"), "validate", "--spec", str(root / "canvas-experience.json")],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()

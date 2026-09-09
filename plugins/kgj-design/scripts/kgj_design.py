#!/usr/bin/env python3
"""Deterministic project, lineage, evidence, packaging, and quality tools for KGJ Design."""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path, PurePosixPath

FIXED_ZIP_TIME = (1980, 1, 1, 0, 0, 0)
MAX_RELEASE_CLOCK_SKEW_SECONDS = 300
EXCLUDED_PARTS = {".git", ".playwright-cli", ".pytest_cache", "__pycache__", "node_modules", "outputs", "work"}
EXCLUDED_SUFFIXES = {".pyc", ".pyo", ".tmp"}
EXPECTED_SKILLS = {
    "kgj-design-orchestrator",
    "inherit-product-dna",
    "design-web-experience",
    "design-html-report",
    "design-markdown-artifact",
    "evolve-kgj-design",
    "audit-kgj-design",
    "curate-kgj-dictionary",
    "adopt-kgj-design",
    "govern-design-patterns",
    "conduct-kgj-design-review",
}
EXPECTED_WEIGHTS = {1: 0.40, 2: 0.35, 3: 0.25}
DNA_SCHEMA_VERSIONS = {"1.0", "1.1", "1.2"}
GENOME_KEYS = {"semantics", "behavior", "accessibility", "contentLocale", "dataTruth", "permissionsPrivacy", "recovery"}
BREAKING_CHANGE_CLASSES = {"breaking", "product-identity-change", "lineage-contract-change"}
REVIEW_CHANGE_CLASSES = {"genome-change", "lineage-source-change", "lineage-governance-change", "product-context-change", "expression-change", "provenance-change", "genome-unscoped", "compatible-addition"}
TOKEN_TYPES = {"color", "dimension", "fontFamily", "fontWeight", "number", "duration", "cubicBezier", "string"}
TOKEN_LAYERS = ("foundation", "semantic", "component")
TOKEN_NAME = re.compile(r"^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$")
TOKEN_ALIAS = re.compile(r"^\{(foundation|semantic|component)\.([a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+)\}$")
REQUIRED_SEMANTIC = {
    "surface.canvas", "surface.panel", "text.primary", "text.muted", "border.default",
    "action.accent", "action.on-accent", "type.body", "type.code", "space.unit",
    "shape.control", "shape.panel", "motion.fast", "motion.standard", "motion.easing",
}
REQUIRED_COMPONENT = {"panel.background", "panel.border", "button.background", "button.text", "button.radius", "focus.ring", "data.accent"}
EVIDENCE_KINDS = {"source", "observation", "decision", "mutation", "run", "artifact", "verification"}
PROOF_LEVELS = {"declaration", "static", "build", "runtime", "browser", "install", "deployment", "user-research"}
EVIDENCE_STATUSES = {"active", "superseded", "rejected", "expired"}
EVIDENCE_RESULTS = {"pass", "fail", "hold"}
EVIDENCE_CLAIMS = {
    "conversion", "behavior-preservation", "differential-probe", "browser-regression", "rollback-rehearsal",
    "package-determinism", "install-readback", "deployment-readback", "lineage-impact", "genome-review", "quality-rubric",
}
CLAIM_PROOF_LEVELS = {
    "conversion": {"static", "build", "runtime", "browser"},
    "behavior-preservation": {"build", "runtime", "browser", "install"},
    "differential-probe": {"runtime", "browser"},
    "browser-regression": {"browser"},
    "rollback-rehearsal": {"runtime", "browser"},
    "package-determinism": {"build"},
    "install-readback": {"install"},
    "deployment-readback": {"deployment"},
    "lineage-impact": {"static", "runtime"},
    "genome-review": {"static", "runtime", "user-research"},
    "quality-rubric": {"runtime", "install"},
}
MIGRATION_REQUIRED_CLAIMS = {
    "conversion", "behavior-preservation", "differential-probe", "browser-regression",
    "rollback-rehearsal", "lineage-impact", "genome-review",
}
PATTERN_STAGES = {"experimental", "candidate", "stable", "deprecated", "removed"}
PATTERN_CRITERIA = {"useful", "unique", "usable", "accessible", "consistent", "versatile"}
PORTABLE_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$")
PRODUCT_ID = re.compile(r"^[a-z0-9][a-z0-9-]{2,63}$")
PATTERN_ID = re.compile(r"^[a-z0-9][a-z0-9-]{2,79}$")
SHA256 = re.compile(r"^[a-f0-9]{64}$")
SLUG = re.compile(r"^[a-z0-9][a-z0-9-]{1,39}$")
LOCALE = re.compile(r"^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$")
CONTRACT_KEYS = {"schemaVersion", "project", "state", "paths", "surfaces", "themes", "locales", "unresolved"}
PROJECT_KEYS = {"id", "name", "domain", "owner"}
PROJECT_PATH_KEYS = {"dna", "tokenOutput", "evidenceRegistry", "evidenceRoot"}
REGISTRY_KEYS = {"schemaVersion", "productId", "records"}
EVIDENCE_KEYS = {"id", "kind", "proofLevel", "status", "locator", "sha256", "capturedAt", "supersedes", "limitations", "action", "result", "exitStatus", "postCondition", "environment", "claims", "coverage", "findingRefs", "rounds", "attestation"}
PATTERN_KEYS = {"schemaVersion", "id", "name", "stage", "owner", "scope", "criteria", "evidenceRefs", "migration"}
MIGRATION_KEYS = {"replacement", "deadline", "notes"}
QUALITY_LEDGER_KEYS = {"schemaVersion", "rubricVersion", "artifact", "artifactType", "releaseTarget", "rounds", "coreFlows"}
QUALITY_ROUND_KEYS = {"round", "lens", "weight", "checks", "findings"}
QUALITY_CHECK_KEYS = {"id", "evidenceRef"}
QUALITY_FINDING_KEYS = {"id", "severity", "status", "summary", "fix", "owner", "evidenceRef", "supersededBy"}
QUALITY_FINDING_STATUSES = {"open", "fixed", "closed", "deferred", "superseded"}
QUALITY_FLOW_KEYS = {"name", "evidenceRef"}
QUALITY_SCHEMA_VERSION = "2.0"
QUALITY_RUBRIC_VERSION = "kgj-quality-1.0"
FINDING_PENALTIES = {"P0": 10.0, "P1": 1.0, "P2": 0.10, "P3": 0.02}
RESOLVED_FINDING_STATUSES = {"fixed", "closed", "superseded"}
QUALITY_RUBRIC = {
    1: {
        "lens": "architecture-security-ontology-integrity",
        "weight": 0.40,
        "checks": {
            "r1.genome-lineage-compatibility": ({"static", "runtime"}, {"genome-lineage"}),
            "r1.dictionary-integrity-recovery": ({"runtime"}, {"dictionary-integrity", "recovery"}),
            "r1.security-privacy-permission": ({"runtime"}, {"security", "privacy", "permission"}),
            "r1.evidence-trust-provenance": ({"static", "runtime"}, {"evidence-trust", "provenance"}),
            "r1.compatibility-rollback": ({"runtime", "browser"}, {"compatibility", "rollback"}),
        },
    },
    2: {
        "lens": "browser-ux-accessibility-data-truth",
        "weight": 0.35,
        "checks": {
            "r2.primary-alternate-states": ({"browser"}, {"desktop", "mobile-390", "primary-state", "alternate-state", "data-truth"}),
            "r2.keyboard-focus-assistive": ({"browser"}, {"keyboard", "focus", "assistive", "tablists-isolated", "dialog-focus-return"}),
            "r2.desktop-mobile-zoom-overflow": ({"browser"}, {"desktop", "mobile-390", "zoom-200", "overflow"}),
            "r2.long-korean-data-truth": ({"browser"}, {"long-korean", "data-truth"}),
            "r2.reduced-motion-performance-console": ({"browser"}, {"reduced-motion", "performance", "console-clean"}),
        },
    },
    3: {
        "lens": "reproducibility-package-install-readback",
        "weight": 0.25,
        "checks": {
            "r3.manifest-skills-mcp": ({"static", "runtime"}, {"manifest", "skills", "mcp"}),
            "r3.deterministic-build-package": ({"build"}, {"deterministic-package"}),
            "r3.clean-install-enabled-readback": ({"install"}, {"marketplace-readback", "installed-cache-readback", "enabled-readback"}),
            "r3.version-source-cache-identity": ({"install"}, {"version-readback", "source-cache-match"}),
            "r3.receipt-reproduction": ({"runtime", "install"}, {"receipt-reproduction"}),
        },
    },
}
BROWSER_REPLAY_CHECKS = {
    "desktop-primary-data-truth": {"desktop", "primary-state", "data-truth"},
    "isolated-keyboard-tablists": {"keyboard", "focus", "assistive", "tablists-isolated"},
    "dialog-focus-recovery": {"focus", "assistive", "dialog-focus-return"},
    "mobile-390-navigation-reflow": {"mobile-390", "overflow", "long-korean"},
    "zoom-200-long-korean": {"zoom-200", "overflow", "long-korean"},
    "alternate-and-recovery-states": {"alternate-state"},
    "reduced-motion-performance-console": {"reduced-motion", "performance", "console-clean"},
    "contrast-and-semantic-representation": {"assistive"},
    "skip-link-target": {"keyboard", "focus"},
}
BROWSER_REPLAY_NEGATIVE_CONTROLS = {
    "mutant-global-tab-selector",
    "mutant-stale-phenotype-data",
    "mutant-dialog-expanded-state",
    "mutant-mobile-navigation-state",
    "mutant-reduced-motion-frame-request",
    "mutant-zoom-overflow",
}
BROWSER_REPLAY_SOURCE_PATHS = {
    "assets/demo/index.html",
    "assets/demo/styles.css",
    "assets/demo/app.js",
    "tests/browser/round2-replay.js",
    "scripts/Invoke-KgjBrowserReplay.ps1",
}
BROWSER_REPLAY_REQUIRED_ARTIFACTS = {
    "03-browser-replay.stdout.log",
    "03-browser-replay.stderr.log",
    "04-semantic-snapshot.stdout.log",
    "05-console-errors.stdout.log",
    "browser-replay-result.json",
    "desktop-operations.png",
    "mobile-390-long-ko.png",
    "zoom-200-long-ko.png",
    "reduced-motion-a.png",
    "reduced-motion-b.png",
}
COMMAND_EVIDENCE_PLANS = {
    "evidence.r2.browser-replay-execution": {
        "kind": "pwsh-browser", "rounds": set(), "coverage": set(), "registry": False,
    },
    "evidence.r1.python-governance-tests": {
        "kind": "python-unittest", "minimumTests": 18, "rounds": {1},
        "coverage": {"genome-lineage", "evidence-trust", "provenance", "compatibility", "rollback"},
    },
    "evidence.r1.node-dictionary-tests": {
        "kind": "npm-test", "minimumTests": 17, "rounds": {1},
        "coverage": {"dictionary-integrity", "recovery", "security", "privacy", "permission"},
    },
    "evidence.r3.plugin-contract-validation": {
        "kind": "kgj-json", "subcommand": "validate", "rounds": {3},
        "coverage": {"manifest", "skills", "mcp"},
    },
    "evidence.r3.mcp-contract-tests": {
        "kind": "node-mcp-test", "minimumTests": 4, "rounds": {3},
        "coverage": {"mcp"},
    },
    "evidence.r3.desktop-mcp-fresh-session": {
        "kind": "codex-mcp-probe", "rounds": {3},
        "coverage": {"fresh-session-mcp", "mcp-safety-annotations"},
    },
    "evidence.r3.package-determinism": {
        "kind": "kgj-json", "subcommand": "package-compare", "rounds": {3},
        "coverage": {"deterministic-package"},
    },
    "evidence.r3.clean-install-readback": {
        "kind": "kgj-json", "subcommand": "install-readback", "rounds": {3},
        "coverage": {"marketplace-readback", "installed-cache-readback", "enabled-readback"},
    },
    "evidence.r3.install-audit": {
        "kind": "kgj-json", "subcommand": "install-audit", "rounds": {3},
        "coverage": {"version-readback", "source-cache-match"},
    },
    "evidence.r3.receipt-reproduction": {
        "kind": "kgj-json", "subcommand": "evidence-check", "rounds": {3},
        "coverage": {"receipt-reproduction"},
    },
    "evidence.release.quality-gate": {
        "kind": "kgj-json", "subcommand": "quality", "rounds": set(),
        "coverage": {"quality-rubric"}, "registry": False,
    },
}

FRESH_MCP_PROBE_PROMPT = (
    "Perform exactly one read-only action: invoke the installed KGJ Design MCP tool get_ontology. "
    "Do not run shell commands and do not edit files. Return compact JSON only with keys "
    "invokedTool, ok, ontologyId, ontologyVersion."
)


class ValidationError(RuntimeError):
    pass


def read_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValidationError(f"{path}: {exc}") from exc


def canonical_json(value) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def png_dimensions(path: Path) -> tuple[int, int]:
    header = path.read_bytes()[:24]
    if len(header) != 24 or header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        raise ValidationError(f"invalid PNG artifact: {path}")
    return struct.unpack(">II", header[16:24])


def read_json_lines(path: Path, label: str) -> list[dict]:
    records = []
    try:
        with path.open("r", encoding="utf-8") as handle:
            for number, line in enumerate(handle, start=1):
                if not line.strip():
                    continue
                value = json.loads(line)
                if not isinstance(value, dict):
                    raise ValidationError(f"{label} line {number} is not an object")
                records.append(value)
    except (OSError, json.JSONDecodeError) as error:
        raise ValidationError(f"{label} is not parseable JSONL: {error}") from error
    return records


def validate_codex_mcp_probe_output(stdout: str, stderr: str) -> list[str]:
    issues = []
    if "\ufffd" in stdout or "\ufffd" in stderr:
        issues.append("fresh Codex MCP probe contains a Unicode replacement character")
    events = []
    for number, line in enumerate(stdout.splitlines(), start=1):
        if not line.strip():
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as error:
            issues.append(f"fresh Codex MCP probe stdout line {number} is not JSON: {error}")
            continue
        if not isinstance(value, dict):
            issues.append(f"fresh Codex MCP probe stdout line {number} is not an object")
            continue
        events.append(value)
    thread_events = [event for event in events if event.get("type") == "thread.started"]
    if len(thread_events) != 1 or not re.fullmatch(r"[0-9a-f-]{36}", str(thread_events[0].get("thread_id", "")) if thread_events else ""):
        issues.append("fresh Codex MCP probe does not contain exactly one new thread identity")
    if len([event for event in events if event.get("type") == "turn.started"]) != 1:
        issues.append("fresh Codex MCP probe does not contain exactly one turn start")
    if len([event for event in events if event.get("type") == "turn.completed"]) != 1:
        issues.append("fresh Codex MCP probe does not contain exactly one completed turn")
    item_events = [event.get("item") for event in events if isinstance(event.get("item"), dict)]
    disallowed = sorted({
        str(item.get("type")) for item in item_events
        if item.get("type") in {"command_execution", "file_change"}
    })
    if disallowed:
        issues.append(f"fresh Codex MCP probe performed a disallowed action: {', '.join(disallowed)}")
    mcp_events = [item for item in item_events if item.get("type") == "mcp_tool_call"]
    started = [item for item in mcp_events if item.get("status") == "in_progress"]
    completed = [item for item in mcp_events if item.get("status") == "completed"]
    if len(mcp_events) != 2 or len(started) != 1 or len(completed) != 1:
        issues.append("fresh Codex MCP probe must contain one started and one completed MCP call")
    else:
        start_item = started[0]
        completed_item = completed[0]
        if (
            start_item.get("id") != completed_item.get("id")
            or start_item.get("server") != "kgj-design"
            or completed_item.get("server") != "kgj-design"
            or start_item.get("tool") != "get_ontology"
            or completed_item.get("tool") != "get_ontology"
            or start_item.get("arguments") != {}
            or completed_item.get("arguments") != {}
            or completed_item.get("error") is not None
        ):
            issues.append("fresh Codex MCP probe tool identity, arguments, or completion status drifted")
        result = completed_item.get("result")
        structured = result.get("structured_content") if isinstance(result, dict) else None
        if not isinstance(structured, dict) or structured.get("ontologyId") != "kgj-design-ontology" or structured.get("version") != "1.2.0":
            issues.append("fresh Codex MCP probe result does not bind the KGJ ontology identity")
    agent_messages = [item for item in item_events if item.get("type") == "agent_message"]
    expected_message = {
        "invokedTool": "mcp__kgj_design__get_ontology",
        "ok": True,
        "ontologyId": "kgj-design-ontology",
        "ontologyVersion": "1.2.0",
    }
    if len(agent_messages) != 1:
        issues.append("fresh Codex MCP probe must contain exactly one final agent message")
    else:
        try:
            message = json.loads(agent_messages[0].get("text", ""))
        except json.JSONDecodeError as error:
            issues.append(f"fresh Codex MCP probe final message is not JSON: {error}")
        else:
            if message != expected_message:
                issues.append("fresh Codex MCP probe final message contract drifted")
    combined = f"{stdout}\n{stderr}".lower()
    if "mcp tool call requires approval" in combined or "approval policy is never" in combined:
        issues.append("fresh Codex MCP probe was blocked by approval policy")
    return issues


def normalized_browser_result(value: object) -> object:
    if not isinstance(value, dict):
        return value
    normalized = copy.deepcopy(value)
    for key in ("startedAt", "completedAt"):
        try:
            normalized[key] = datetime.fromisoformat(str(normalized.get(key, "")).replace("Z", "+00:00")).timestamp()
        except ValueError:
            pass
    return normalized


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def verify_bound_file(base: Path, binding: object, label: str) -> tuple[Path | None, list[str]]:
    issues = []
    if not isinstance(binding, dict) or set(binding) != {"locator", "bytes", "sha256"}:
        return None, [f"{label}: binding must contain exactly locator, bytes, and sha256"]
    normalized, path_issues = portable_relative_path(binding.get("locator"), f"{label}.locator")
    issues.extend(path_issues)
    if not normalized:
        return None, issues
    target = (base / normalized).resolve()
    boundary = base.resolve()
    if boundary != target.parent and boundary not in target.parents:
        issues.append(f"{label}: bound file escapes its receipt directory")
        return None, issues
    if not target.is_file():
        issues.append(f"{label}: bound file is missing")
        return target, issues
    if not isinstance(binding.get("bytes"), int) or binding["bytes"] < 0 or target.stat().st_size != binding["bytes"]:
        issues.append(f"{label}: bound byte length mismatch")
    if not SHA256.fullmatch(str(binding.get("sha256", ""))) or sha256_file(target) != binding.get("sha256"):
        issues.append(f"{label}: bound sha256 mismatch")
    return target, issues


def verify_source_binding(source_root: Path | None, binding: object, label: str) -> list[str]:
    if source_root is None:
        return [f"{label}: --source-root is required to verify browser source bindings"]
    if not isinstance(binding, dict) or set(binding) != {"path", "bytes", "sha256"}:
        return [f"{label}: source binding must contain exactly path, bytes, and sha256"]
    normalized, issues = portable_relative_path(binding.get("path"), f"{label}.path")
    if not normalized:
        return issues
    target = (source_root.resolve() / normalized).resolve()
    if source_root.resolve() != target.parent and source_root.resolve() not in target.parents:
        issues.append(f"{label}: source binding escapes source root")
        return issues
    if not target.is_file():
        issues.append(f"{label}: source-bound file is missing")
        return issues
    if not isinstance(binding.get("bytes"), int) or binding["bytes"] < 0 or target.stat().st_size != binding["bytes"]:
        issues.append(f"{label}: source-bound byte length mismatch")
    if not SHA256.fullmatch(str(binding.get("sha256", ""))) or sha256_file(target) != binding.get("sha256"):
        issues.append(f"{label}: source-bound sha256 mismatch")
    return issues


def command_executable_name(value: object) -> str:
    name = Path(str(value or "")).name.lower()
    for suffix in (".exe", ".cmd", ".bat"):
        if name.endswith(suffix):
            name = name[:-len(suffix)]
    return name


def expected_plugin_cache(version: str) -> Path:
    codex_home = Path(os.environ.get("CODEX_HOME") or (Path.home() / ".codex")).resolve()
    return (codex_home / "plugins" / "cache" / "personal" / "kgj-design" / version).resolve()


def validate_command_evidence_plan(record: dict, receipt_path: Path, receipt: dict, source_root: Path | None, label: str) -> list[str]:
    issues = []
    plan_id = receipt.get("planId")
    plan = COMMAND_EVIDENCE_PLANS.get(plan_id)
    if not plan or plan_id != receipt.get("id") or plan_id != record.get("id"):
        return [f"{label}: command receipt does not bind a known evidence plan"]
    if source_root is None:
        return [f"{label}: source root is required for a scored command evidence plan"]
    source_root = source_root.resolve()
    cwd = Path(str(receipt.get("cwd", ""))).resolve()
    if cwd != source_root:
        issues.append(f"{label}: planned command cwd does not equal the canonical source")
    try:
        manifest_version = read_json(source_root / ".codex-plugin" / "plugin.json").get("version")
        runtime_version = read_json(source_root / "package.json").get("version")
    except ValidationError as error:
        return issues + [f"{label}: command plan cannot bind source versions: {error}"]
    release_root = receipt_path.parent.parent if receipt_path.parent.name == "evidence" else receipt_path.parent
    package_a = (release_root / "package" / f"kgj-design-{runtime_version}-a.zip").resolve()
    package_b = (release_root / "package" / f"kgj-design-{runtime_version}-b.zip").resolve()
    immutable_source = (source_root.parent / "kgj-design-releases" / str(manifest_version)).resolve()
    installed_cache = expected_plugin_cache(str(manifest_version))
    if plan.get("registry", True):
        if set(record.get("rounds", [])) != plan["rounds"]:
            issues.append(f"{label}: command evidence rounds exceed its closed plan")
        if set(record.get("coverage", [])) != plan["coverage"]:
            issues.append(f"{label}: command evidence coverage exceeds its closed plan")
    command = receipt.get("command")
    if not isinstance(command, list) or not command or not all(isinstance(item, str) for item in command):
        return issues + [f"{label}: planned command vector is invalid"]
    executable = command_executable_name(command[0])
    kind = plan["kind"]
    if kind == "python-unittest":
        if executable not in {"python", "python3", "py"} or command[1:] != ["-B", "-m", "unittest", "discover", "-s", "tests", "-v"]:
            issues.append(f"{label}: Python governance plan command drift")
    elif kind == "npm-test":
        if executable != "npm" or command[1:] != ["test"]:
            issues.append(f"{label}: Node governance plan command drift")
    elif kind == "node-mcp-test":
        if executable != "node" or [item.replace("\\", "/") for item in command[1:]] != ["--test", "tests/mcp.test.mjs"]:
            issues.append(f"{label}: MCP contract plan command drift")
    elif kind == "pwsh-browser":
        expected_script = (source_root / "scripts" / "Invoke-KgjBrowserReplay.ps1").resolve()
        expected_output = (receipt_path.parent / "round2-browser-replay").resolve()
        try:
            port = int(command[7]) if len(command) == 8 else 0
        except ValueError:
            port = 0
        if (
            executable not in {"pwsh", "powershell"} or len(command) != 8
            or command[1] != "-NoProfile" or command[2] != "-File" or Path(command[3]).resolve() != expected_script
            or command[4] != "-OutputDirectory" or Path(command[5]).resolve() != expected_output
            or command[6] != "-Port" or not 1024 <= port <= 65535
        ):
            issues.append(f"{label}: browser execution plan command or target drift")
    elif kind == "codex-mcp-probe":
        expected_wrapper = (Path.home() / ".codex" / "scripts" / "Invoke-FreshCodexCli.ps1").resolve()
        valid_model = len(command) == 17 and re.fullmatch(r"gpt-[a-z0-9.-]+", command[6]) is not None
        if (
            executable not in {"pwsh", "powershell"}
            or len(command) != 17
            or command[1:6] != ["-NoProfile", "-File", str(expected_wrapper), "exec", "-m"]
            or not valid_model
            or command[7:15] != [
                "-c", 'model_reasoning_effort="low"', "-s", "read-only", "--ephemeral", "--json",
                "--skip-git-repo-check", "-C",
            ]
            or Path(command[15]).resolve() != source_root
            or command[16] != FRESH_MCP_PROBE_PROMPT
        ):
            issues.append(f"{label}: fresh Codex MCP probe command or safety boundary drift")
        try:
            audit = install_audit(immutable_source, installed_cache, package_a)
            if not (audit.get("canonicalFiles") == audit.get("cacheFiles") == audit.get("packageFiles")):
                issues.append(f"{label}: fresh Codex MCP probe installation identity is incomplete")
            marketplace = read_json(Path.home() / ".agents" / "plugins" / "marketplace.json")
            plugin = next((
                item for item in marketplace.get("plugins", [])
                if isinstance(item, dict) and item.get("name") == "kgj-design"
            ), None)
            expected_marketplace_path = f"./plugins/kgj-design-releases/{manifest_version}"
            if (
                not plugin
                or plugin.get("source", {}).get("source") != "local"
                or plugin.get("source", {}).get("path") != expected_marketplace_path
            ):
                issues.append(f"{label}: fresh Codex MCP probe marketplace pin drift")
            probe_started = datetime.fromisoformat(str(receipt.get("startedAt", "")).replace("Z", "+00:00")).astimezone(timezone.utc)
            cache_created = datetime.fromtimestamp(installed_cache.stat().st_ctime, timezone.utc)
            if probe_started < cache_created - timedelta(seconds=5):
                issues.append(f"{label}: fresh Codex MCP probe predates the installed cache")
        except (ValidationError, OSError, ValueError) as error:
            issues.append(f"{label}: fresh Codex MCP probe cannot bind the installed release: {error}")
    elif kind == "kgj-json":
        if len(command) < 4 or executable not in {"python", "python3", "py"} or command[1] != "-B":
            issues.append(f"{label}: KGJ CLI plan command prefix drift")
        else:
            script = Path(command[2])
            script = script.resolve() if script.is_absolute() else (Path(str(receipt.get("cwd", ""))) / script).resolve()
            if script != (source_root.resolve() / "scripts" / "kgj_design.py") or command[3] != plan["subcommand"]:
                issues.append(f"{label}: KGJ CLI plan source or subcommand drift")
            tail = command[4:]
            if plan["subcommand"] == "validate":
                if len(tail) != 1 or (cwd / tail[0]).resolve() != source_root:
                    issues.append(f"{label}: plugin validation plan target drift")
            elif plan["subcommand"] == "package-compare":
                if len(tail) != 2 or Path(tail[0]).resolve() != package_a or Path(tail[1]).resolve() != package_b:
                    issues.append(f"{label}: package determinism plan target drift")
            elif plan["subcommand"] in {"install-audit", "install-readback"}:
                if len(tail) != 4 or tail[2] != "--package":
                    issues.append(f"{label}: install plan arguments drift")
                else:
                    source_arg = Path(tail[0]).resolve()
                    cache_arg = Path(tail[1]).resolve()
                    package_arg = Path(tail[3]).resolve()
                    if source_arg != immutable_source or package_arg != package_a or cache_arg != installed_cache:
                        issues.append(f"{label}: install plan target drift")
            elif plan["subcommand"] == "evidence-check":
                expected_registry = (receipt_path.parent / "evidence-registry.json").resolve()
                if len(tail) != 4 or tail[1] != "--verify-files" or tail[2] != "--source-root" or Path(tail[0]).resolve() != expected_registry or Path(tail[3]).resolve() != source_root:
                    issues.append(f"{label}: receipt reproduction plan target drift")
            elif plan["subcommand"] == "quality":
                expected_registry = (receipt_path.parent / "evidence-registry.json").resolve()
                expected_ledger = (source_root / "quality" / "quality-ledger.json").resolve()
                if len(tail) != 3 or tail[1] != "--evidence-registry" or Path(tail[0]).resolve() != expected_ledger or Path(tail[2]).resolve() != expected_registry:
                    issues.append(f"{label}: quality plan target drift")
    stdout_path = receipt_path.parent / receipt.get("stdoutArtifact", {}).get("locator", "")
    stderr_path = receipt_path.parent / receipt.get("stderrArtifact", {}).get("locator", "")
    try:
        stdout = stdout_path.read_bytes().decode("utf-8", errors="strict")
        stderr = stderr_path.read_bytes().decode("utf-8", errors="strict")
    except (OSError, UnicodeDecodeError) as error:
        return issues + [f"{label}: command plan output cannot be read: {error}"]
    if "\ufffd" in stdout or "\ufffd" in stderr:
        issues.append(f"{label}: command plan output contains a Unicode replacement character")
    if kind == "python-unittest":
        match = re.search(r"Ran\s+(\d+)\s+tests?", stdout + "\n" + stderr)
        if not match or int(match.group(1)) < plan["minimumTests"] or not re.search(r"(?:^|\n)OK(?:\s|$)", stdout + "\n" + stderr):
            issues.append(f"{label}: Python governance plan lacks the minimum passing test result")
    elif kind in {"npm-test", "node-mcp-test"}:
        tests = re.search(r"# tests\s+(\d+)", stdout)
        passes = re.search(r"# pass\s+(\d+)", stdout)
        failures = re.search(r"# fail\s+(\d+)", stdout)
        if not tests or not passes or not failures or int(tests.group(1)) < plan["minimumTests"] or tests.group(1) != passes.group(1) or failures.group(1) != "0":
            issues.append(f"{label}: Node plan lacks the minimum passing TAP result")
    elif kind == "pwsh-browser":
        try:
            output = json.loads(stdout)
            inner_path = (receipt_path.parent / "round2-browser-replay" / "browser-replay-receipt.json").resolve()
            inner = read_json(inner_path)
            if (
                output.get("ok") is not True or output.get("status") != "PASS" or output.get("checks") != 9
                or output.get("negativeControls") != len(BROWSER_REPLAY_NEGATIVE_CONTROLS)
                or Path(str(output.get("receipt", ""))).resolve() != inner_path
                or output.get("transcriptSha256") != inner.get("transcriptSha256")
            ):
                issues.append(f"{label}: browser execution plan output contract drift")
        except (json.JSONDecodeError, ValidationError, OSError) as error:
            issues.append(f"{label}: browser execution plan output is invalid: {error}")
    elif kind == "codex-mcp-probe":
        issues.extend(f"{label}: {issue}" for issue in validate_codex_mcp_probe_output(stdout, stderr))
    elif kind == "kgj-json":
        try:
            output = json.loads(stdout)
        except json.JSONDecodeError as error:
            issues.append(f"{label}: KGJ plan stdout is not JSON: {error}")
            output = {}
        if output.get("ok") is not True:
            issues.append(f"{label}: KGJ plan output is not ok")
        subcommand = plan["subcommand"]
        if subcommand == "validate" and (output.get("skills") != len(EXPECTED_SKILLS) or output.get("dnaProfiles") != 4 or Path(str(output.get("root", ""))).resolve() != source_root):
            issues.append(f"{label}: plugin validation output contract drift")
        elif subcommand == "package-compare" and (
            output.get("status") != "PASS" or output.get("byteIdentical") is not True
            or Path(str(output.get("first", {}).get("path", ""))).resolve() != package_a
            or Path(str(output.get("second", {}).get("path", ""))).resolve() != package_b
        ):
            issues.append(f"{label}: package determinism output contract drift")
        elif subcommand in {"install-readback", "install-audit"}:
            audit = output.get("installAudit") if subcommand == "install-readback" else output
            if not isinstance(audit, dict):
                audit = {}
            expected_source = immutable_source
            expected_cache = Path(command[-3]).resolve() if len(command) >= 3 else Path()
            if (
                (subcommand == "install-readback" and (output.get("status") != "PASS" or output.get("installed") is not True or output.get("enabled") is not True or output.get("mcpEnabled") is not True))
                or not (audit.get("canonicalFiles") == audit.get("cacheFiles") == audit.get("packageFiles"))
                or Path(str(audit.get("source", ""))).resolve() != expected_source
                or Path(str(audit.get("cache", ""))).resolve() != expected_cache
                or Path(str(audit.get("package", ""))).resolve() != package_a
            ):
                issues.append(f"{label}: install output contract drift")
        elif subcommand == "evidence-check" and output.get("verifiedFiles") is not True:
            issues.append(f"{label}: receipt reproduction output contract drift")
        elif subcommand == "quality" and (output.get("status") != "PASS" or output.get("weightedScore", 0) < 9.9 or output.get("openP0P1") != 0):
            issues.append(f"{label}: quality output contract drift")
    return issues


def validate_command_receipt(record: dict, receipt_path: Path, receipt: dict, source_root: Path | None, label: str) -> list[str]:
    issues = []
    base_keys = {
        "schemaVersion", "id", "command", "cwd", "startedAt", "completedAt", "timeoutSeconds", "timedOut",
        "exitStatus", "stdoutBytes", "stdoutSha256", "stdoutArtifact", "stderrBytes", "stderrSha256",
        "stderrArtifact", "captureTruncated", "runner", "transcriptSha256",
    }
    planned = isinstance(receipt.get("planId"), str)
    expected_keys = base_keys | ({"planId"} if planned else set())
    if set(receipt) != expected_keys:
        issues.append(f"{label}: command receipt must contain the closed schema fields")
    expected_schema = "1.2" if planned else "1.1"
    if receipt.get("schemaVersion") != expected_schema:
        issues.append(f"{label}: command receipt schemaVersion must be {expected_schema}")
    runner = receipt.get("runner")
    if not isinstance(runner, dict) or set(runner) != {"name", "version", "shell"} or runner.get("name") != "kgj-attest" or runner.get("shell") is not False:
        issues.append(f"{label}: command receipt runner is invalid")
        runner = {}
    elif planned and runner.get("version") != "1.4.0":
        issues.append(f"{label}: planned command receipt requires kgj-attest 1.4.0")
    transcript = {key: value for key, value in receipt.items() if key != "transcriptSha256"}
    expected_hash = sha256_text(canonical_json(transcript))
    if receipt.get("transcriptSha256") != expected_hash:
        issues.append(f"{label}: command transcript canonical hash mismatch")
    for stream in ("stdout", "stderr"):
        _, binding_issues = verify_bound_file(receipt_path.parent, receipt.get(f"{stream}Artifact"), f"{label}.{stream}Artifact")
        issues.extend(binding_issues)
        artifact = receipt.get(f"{stream}Artifact") if isinstance(receipt.get(f"{stream}Artifact"), dict) else {}
        if artifact.get("bytes") != receipt.get(f"{stream}Bytes") or artifact.get("sha256") != receipt.get(f"{stream}Sha256"):
            issues.append(f"{label}: {stream} sidecar does not match transcript fields")
    if receipt.get("timedOut") is not False or receipt.get("captureTruncated") is not False:
        issues.append(f"{label}: timed out or truncated command receipt is unusable")
    if receipt.get("exitStatus") != 0 or receipt.get("exitStatus") != record.get("exitStatus"):
        issues.append(f"{label}: command exit status does not bind the evidence record")
    if receipt.get("id") != record.get("id"):
        issues.append(f"{label}: command receipt id does not bind the evidence record")
    attestation = record.get("attestation", {})
    if receipt.get("startedAt") != attestation.get("startedAt") or receipt.get("completedAt") != attestation.get("completedAt"):
        issues.append(f"{label}: command receipt timestamps do not bind the registry attestation")
    if runner.get("version") != attestation.get("toolVersion"):
        issues.append(f"{label}: command runner version does not bind the registry attestation")
    if receipt.get("transcriptSha256") != attestation.get("transcriptSha256"):
        issues.append(f"{label}: command transcript hash does not bind the registry attestation")
    if planned:
        plan_issues = validate_command_evidence_plan(record, receipt_path, receipt, source_root, label)
        issues.extend(plan_issues)
        if not plan_issues:
            record["_commandPlanVerified"] = True
    return issues


def browser_envelope_binding(base: Path, path: Path) -> dict:
    path = path.resolve()
    return {"locator": path.relative_to(base.resolve()).as_posix(), "bytes": path.stat().st_size, "sha256": sha256_file(path)}


def validate_browser_envelope(record: dict, envelope_path: Path, envelope: dict, source_root: Path | None, label: str) -> list[str]:
    issues = []
    expected_keys = {
        "schemaVersion", "id", "result", "exitStatus", "startedAt", "completedAt", "runner", "environment",
        "browserReceipt", "executionReceipt", "limitations", "transcriptSha256",
    }
    if set(envelope) != expected_keys or envelope.get("schemaVersion") != "1.1":
        issues.append(f"{label}: browser evidence envelope schema is invalid")
    transcript = {key: value for key, value in envelope.items() if key != "transcriptSha256"}
    if envelope.get("transcriptSha256") != sha256_text(canonical_json(transcript)):
        issues.append(f"{label}: browser evidence envelope transcript hash mismatch")
    browser_path, browser_binding_issues = verify_bound_file(envelope_path.parent, envelope.get("browserReceipt"), f"{label}.browserReceipt")
    execution_path, execution_binding_issues = verify_bound_file(envelope_path.parent, envelope.get("executionReceipt"), f"{label}.executionReceipt")
    issues.extend(browser_binding_issues)
    issues.extend(execution_binding_issues)
    if not browser_path or not execution_path or issues:
        return issues
    try:
        browser_receipt = read_json(browser_path)
        execution_receipt = read_json(execution_path)
    except ValidationError as error:
        return issues + [f"{label}: browser envelope child receipt is invalid: {error}"]
    browser_runner = browser_receipt.get("runner", {}) if isinstance(browser_receipt, dict) else {}
    inner_record = {
        "id": browser_receipt.get("id"), "exitStatus": browser_receipt.get("exitStatus"),
        "coverage": record.get("coverage", []), "environment": record.get("environment", {}),
        "attestation": {
            "method": "browser", "startedAt": browser_receipt.get("startedAt"), "completedAt": browser_receipt.get("completedAt"),
            "toolVersion": browser_runner.get("version"), "transcriptSha256": browser_receipt.get("transcriptSha256"),
        },
    }
    issues.extend(validate_browser_receipt(inner_record, browser_path, browser_receipt, source_root, f"{label}.browserReceipt"))
    execution_runner = execution_receipt.get("runner", {}) if isinstance(execution_receipt, dict) else {}
    execution_record = {
        "id": execution_receipt.get("id"), "exitStatus": execution_receipt.get("exitStatus"), "coverage": [], "rounds": [],
        "attestation": {
            "method": "command", "startedAt": execution_receipt.get("startedAt"), "completedAt": execution_receipt.get("completedAt"),
            "toolVersion": execution_runner.get("version"), "transcriptSha256": execution_receipt.get("transcriptSha256"),
        },
    }
    issues.extend(validate_command_receipt(execution_record, execution_path, execution_receipt, source_root, f"{label}.executionReceipt"))
    if execution_record.get("_commandPlanVerified") is not True:
        issues.append(f"{label}: browser execution receipt lacks the closed replay command plan")
    if envelope.get("startedAt") != browser_receipt.get("startedAt") or envelope.get("completedAt") != execution_receipt.get("completedAt"):
        issues.append(f"{label}: browser envelope timeline does not bind its child receipts")
    try:
        execution_started = datetime.fromisoformat(str(execution_receipt.get("startedAt", "")).replace("Z", "+00:00"))
        browser_started = datetime.fromisoformat(str(browser_receipt.get("startedAt", "")).replace("Z", "+00:00"))
        browser_completed = datetime.fromisoformat(str(browser_receipt.get("completedAt", "")).replace("Z", "+00:00"))
        execution_completed = datetime.fromisoformat(str(execution_receipt.get("completedAt", "")).replace("Z", "+00:00"))
        if not execution_started <= browser_started <= browser_completed <= execution_completed:
            issues.append(f"{label}: browser execution timeline is impossible")
    except ValueError as error:
        issues.append(f"{label}: browser execution timestamp is invalid: {error}")
    if canonical_json(envelope.get("environment")) != canonical_json(browser_receipt.get("environment")):
        issues.append(f"{label}: browser envelope environment drift")
    if not issues:
        record["_browserReplayVerified"] = True
    return issues


def validate_browser_receipt(record: dict, receipt_path: Path, receipt: dict, source_root: Path | None, label: str) -> list[str]:
    issues = []
    runner = receipt.get("runner")
    attestation = record.get("attestation", {})
    if not isinstance(runner, dict) or runner.get("shell") is not False:
        return [f"{label}: browser receipt runner is invalid"]
    if receipt.get("id") != record.get("id") or receipt.get("result") != "pass" or receipt.get("exitStatus") != 0:
        issues.append(f"{label}: browser receipt result or identity does not bind the evidence record")
    if receipt.get("startedAt") != attestation.get("startedAt") or receipt.get("completedAt") != attestation.get("completedAt"):
        issues.append(f"{label}: browser receipt timestamps do not bind the registry attestation")
    if runner.get("version") != attestation.get("toolVersion"):
        issues.append(f"{label}: browser runner version does not bind the registry attestation")
    if receipt.get("transcriptSha256") != attestation.get("transcriptSha256"):
        issues.append(f"{label}: browser transcript hash does not bind the registry attestation")
    if runner.get("name") == "kgj-browser-evidence-envelope":
        return issues + validate_browser_envelope(record, receipt_path, receipt, source_root, label)
    if runner.get("name") != "kgj-browser-replay":
        transcript = {key: value for key, value in receipt.items() if key != "transcriptSha256"}
        if receipt.get("transcriptSha256") != sha256_text(canonical_json(transcript)):
            issues.append(f"{label}: generic browser receipt canonical hash mismatch")
        return issues
    required_keys = {
        "schemaVersion", "id", "result", "exitStatus", "startedAt", "completedAt", "runner", "environment",
        "checks", "negativeControls", "consoleEntries", "pageErrors", "sourceBindings", "artifacts", "limitations",
        "transcriptSha256",
    }
    if set(receipt) != required_keys or receipt.get("schemaVersion") != "1.0":
        issues.append(f"{label}: KGJ browser replay receipt schema is invalid")
    material = {
        "schemaVersion": "1.0",
        "runner": "kgj-browser-replay",
        "runnerVersion": runner.get("version"),
        "playwrightCli": runner.get("playwrightCli"),
        "sourceBindings": receipt.get("sourceBindings"),
        "artifacts": receipt.get("artifacts"),
    }
    material_json = json.dumps(material, ensure_ascii=False, separators=(",", ":"))
    if receipt.get("transcriptSha256") != sha256_text(material_json):
        issues.append(f"{label}: browser replay transcript canonical hash mismatch")
    checks = receipt.get("checks")
    check_ids = {item.get("id") for item in checks if isinstance(item, dict)} if isinstance(checks, list) else set()
    if (
        not isinstance(checks, list)
        or len(checks) != len(BROWSER_REPLAY_CHECKS)
        or check_ids != set(BROWSER_REPLAY_CHECKS)
        or any(set(item) != {"id", "status", "observed"} or item.get("status") != "pass" for item in checks if isinstance(item, dict))
    ):
        issues.append(f"{label}: browser replay must pass the exact nine Round 2 checks")
    controls = receipt.get("negativeControls")
    control_ids = {item.get("id") for item in controls if isinstance(item, dict)} if isinstance(controls, list) else set()
    if (
        not isinstance(controls, list)
        or len(controls) != len(BROWSER_REPLAY_NEGATIVE_CONTROLS)
        or control_ids != BROWSER_REPLAY_NEGATIVE_CONTROLS
        or any(set(item) != {"id", "status", "detected", "observedFailure"} or item.get("status") != "pass" or item.get("detected") is not True for item in controls if isinstance(item, dict))
    ):
        issues.append(f"{label}: browser replay negative controls did not fail closed")
    expected_coverage = set().union(*BROWSER_REPLAY_CHECKS.values())
    if set(record.get("coverage", [])) != expected_coverage:
        issues.append(f"{label}: browser registry coverage must be derived from the replay checks")
    if receipt.get("consoleEntries") or receipt.get("pageErrors"):
        issues.append(f"{label}: browser replay contains console or page errors")
    source_bindings = receipt.get("sourceBindings")
    bound_source_paths = {item.get("path") for item in source_bindings if isinstance(item, dict)} if isinstance(source_bindings, list) else set()
    if not isinstance(source_bindings, list) or len(source_bindings) != len(BROWSER_REPLAY_SOURCE_PATHS) or bound_source_paths != BROWSER_REPLAY_SOURCE_PATHS:
        issues.append(f"{label}: browser replay requires the exact five source bindings")
    else:
        for index, binding in enumerate(source_bindings):
            issues.extend(verify_source_binding(source_root, binding, f"{label}.sourceBindings[{index}]"))
    artifacts = receipt.get("artifacts")
    artifact_paths = set()
    if not isinstance(artifacts, list) or len(artifacts) < len(BROWSER_REPLAY_REQUIRED_ARTIFACTS):
        issues.append(f"{label}: browser replay requires preserved trace artifacts")
    else:
        for index, binding in enumerate(artifacts):
            target, binding_issues = verify_bound_file(receipt_path.parent, {
                "locator": binding.get("path") if isinstance(binding, dict) else None,
                "bytes": binding.get("bytes") if isinstance(binding, dict) else None,
                "sha256": binding.get("sha256") if isinstance(binding, dict) else None,
            }, f"{label}.artifacts[{index}]")
            issues.extend(binding_issues)
            if target:
                artifact_paths.add(target.resolve())
        actual_paths = {path.resolve() for path in receipt_path.parent.rglob("*") if path.is_file() and path.resolve() != receipt_path.resolve()}
        if actual_paths != artifact_paths:
            issues.append(f"{label}: browser replay artifact manifest is incomplete or contains undeclared files")
        relative_artifacts = {path.relative_to(receipt_path.parent).as_posix() for path in artifact_paths}
        missing_required = sorted(BROWSER_REPLAY_REQUIRED_ARTIFACTS - relative_artifacts)
        if missing_required:
            issues.append(f"{label}: browser replay is missing required artifacts: {', '.join(missing_required)}")
        if not any(path.startswith(".playwright-cli/traces/") and path.endswith(".trace") for path in relative_artifacts):
            issues.append(f"{label}: browser replay is missing the Playwright action trace")
        if not any(path.startswith(".playwright-cli/traces/") and path.endswith(".network") for path in relative_artifacts):
            issues.append(f"{label}: browser replay is missing the Playwright network trace")
        result_path = receipt_path.parent / "browser-replay-result.json"
        raw_path = receipt_path.parent / "03-browser-replay.stdout.log"
        semantic_path = receipt_path.parent / "04-semantic-snapshot.stdout.log"
        try:
            replay_result = read_json(result_path)
            raw_envelope = read_json(raw_path)
            raw_result = json.loads(raw_envelope.get("result", "")) if isinstance(raw_envelope, dict) else None
            expected_result = {
                "schemaVersion": "1.0",
                "id": "kgj-round2-browser-replay",
                "startedAt": receipt.get("startedAt"),
                "completedAt": receipt.get("completedAt"),
                "status": "pass",
                "environment": receipt.get("environment"),
                "checks": receipt.get("checks"),
                "negativeControls": receipt.get("negativeControls"),
                "consoleEntries": receipt.get("consoleEntries"),
                "pageErrors": receipt.get("pageErrors"),
                "limitations": receipt.get("limitations"),
            }
            if canonical_json(normalized_browser_result(replay_result)) != canonical_json(normalized_browser_result(expected_result)) or canonical_json(normalized_browser_result(raw_result)) != canonical_json(normalized_browser_result(expected_result)):
                issues.append(f"{label}: raw replay output, replay result, and receipt are not structurally identical")
            if not semantic_path.is_file() or semantic_path.stat().st_size == 0:
                issues.append(f"{label}: semantic snapshot is empty")
        except (ValidationError, json.JSONDecodeError, TypeError, OSError) as error:
            issues.append(f"{label}: browser replay semantic artifacts are invalid: {error}")
        try:
            png_widths = {
                "desktop-operations.png": 1280,
                "mobile-390-long-ko.png": 390,
                "zoom-200-long-ko.png": 1280,
                "reduced-motion-a.png": 390,
                "reduced-motion-b.png": 390,
            }
            for name, expected_width in png_widths.items():
                width, height = png_dimensions(receipt_path.parent / name)
                if width != expected_width or height < 720:
                    issues.append(f"{label}: browser screenshot dimensions drifted for {name}")
            if (receipt_path.parent / "reduced-motion-a.png").read_bytes() != (receipt_path.parent / "reduced-motion-b.png").read_bytes():
                issues.append(f"{label}: reduced-motion frames are not byte-stable")
            trace_paths = sorted(path for path in artifact_paths if path.suffix == ".trace")
            network_paths = sorted(path for path in artifact_paths if path.suffix == ".network")
            if len(trace_paths) != 1 or len(network_paths) != 1:
                issues.append(f"{label}: browser replay requires exactly one trace and one network log")
            else:
                trace_records = read_json_lines(trace_paths[0], f"{label}.trace")
                network_records = read_json_lines(network_paths[0], f"{label}.network")
                contexts = [item for item in trace_records if item.get("type") == "context-options"]
                actions = [item for item in trace_records if item.get("type") in {"before", "after", "event"}]
                if trace_paths[0].stat().st_size < 10_000 or len(actions) < 20 or not contexts or contexts[0].get("browserName") != "chromium" or contexts[0].get("channel") != "chrome":
                    issues.append(f"{label}: Playwright action trace is not a Chrome replay trace")
                snapshots = [item.get("snapshot") for item in network_records if item.get("type") == "resource-snapshot" and isinstance(item.get("snapshot"), dict)]
                expected_resources = {"/": "assets/demo/index.html", "/styles.css": "assets/demo/styles.css", "/app.js": "assets/demo/app.js"}
                for suffix, source_relative in expected_resources.items():
                    snapshot = next((item for item in snapshots if str(item.get("request", {}).get("url", "")).split("?", 1)[0].endswith(suffix)), None)
                    content_locator = snapshot.get("response", {}).get("content", {}).get("_file") if snapshot else None
                    resource = (network_paths[0].parent / str(content_locator)).resolve() if content_locator else None
                    if not snapshot or snapshot.get("response", {}).get("status") != 200 or not resource or resource not in artifact_paths or resource.read_bytes() != (source_root / source_relative).read_bytes():
                        issues.append(f"{label}: Playwright network trace does not bind exact served {source_relative}")
                open_log = (receipt_path.parent / "01-open.stdout.log").read_text(encoding="utf-8")
                start_log = (receipt_path.parent / "02-tracing-start.stdout.log").read_text(encoding="utf-8")
                stop_log = (receipt_path.parent / "06-tracing-stop.stdout.log").read_text(encoding="utf-8")
                console_log = (receipt_path.parent / "05-console-errors.stdout.log").read_text(encoding="utf-8")
                if "Browser `kgj-round2-" not in open_log or "Page Title: KGJ Design — Lineage Lab" not in open_log or trace_paths[0].name not in start_log or trace_paths[0].name not in stop_log or "Errors: 0, Warnings: 0" not in console_log:
                    issues.append(f"{label}: Playwright runner lifecycle logs are incomplete")
        except (ValidationError, OSError, struct.error) as error:
            issues.append(f"{label}: browser replay binary or trace artifact is invalid: {error}")
    environment = receipt.get("environment")
    if not isinstance(environment, dict) or environment.get("browserVersion") != record.get("environment", {}).get("browserVersion"):
        issues.append(f"{label}: browser environment does not bind the evidence record")
    return issues


def validate_attestation_receipt(record: dict, receipt_path: Path, source_root: Path | None, label: str) -> list[str]:
    try:
        receipt = read_json(receipt_path)
    except ValidationError as error:
        return [f"{label}: attestation locator is not valid JSON: {error}"]
    if not isinstance(receipt, dict):
        return [f"{label}: attestation receipt must be an object"]
    method = record.get("attestation", {}).get("method")
    if method == "command":
        return validate_command_receipt(record, receipt_path, receipt, source_root, label)
    if method == "browser":
        return validate_browser_receipt(record, receipt_path, receipt, source_root, label)
    if method == "expert-review":
        transcript = {key: value for key, value in receipt.items() if key != "transcriptSha256"}
        issues = []
        if receipt.get("id") != record.get("id") or receipt.get("result") != "pass":
            issues.append(f"{label}: expert review identity or result mismatch")
        if receipt.get("transcriptSha256") != sha256_text(canonical_json(transcript)):
            issues.append(f"{label}: expert review canonical hash mismatch")
        if receipt.get("transcriptSha256") != record.get("attestation", {}).get("transcriptSha256"):
            issues.append(f"{label}: expert review transcript does not bind the registry")
        return issues
    return [f"{label}: unsupported attestation method"]


def parse_instant(value: object, label: str) -> str | None:
    if not isinstance(value, str):
        return f"{label}: must be an ISO 8601 instant"
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return f"{label}: must be an ISO 8601 instant"
    if parsed.tzinfo is None:
        return f"{label}: timezone is required"
    return None


def portable_relative_path(value: object, label: str) -> tuple[str | None, list[str]]:
    issues = []
    if not isinstance(value, str) or not value.strip() or len(value) > 240:
        return None, [f"{label}: must be a non-empty relative path"]
    normalized = value.replace("\\", "/")
    pure = PurePosixPath(normalized)
    if pure.is_absolute() or re.match(r"^[A-Za-z]:", normalized) or ".." in pure.parts:
        issues.append(f"{label}: must stay inside the project and cannot contain '..'")
    if any(part in {"", "."} for part in pure.parts):
        issues.append(f"{label}: contains an invalid path segment")
    return pure.as_posix(), issues


def is_included(path: Path, root: Path) -> bool:
    relative = path.relative_to(root)
    return not any(part in EXCLUDED_PARTS for part in relative.parts) and path.suffix.lower() not in EXCLUDED_SUFFIXES


def source_files(root: Path):
    files = [path for path in root.rglob("*") if path.is_file() and is_included(path, root)]
    files.sort(key=lambda path: path.relative_to(root).as_posix())
    return files


def file_records(root: Path, files: list[Path]) -> list[dict]:
    return [
        {
            "path": path.relative_to(root).as_posix(),
            "bytes": path.stat().st_size,
            "sha256": sha256_file(path),
        }
        for path in sorted(files, key=lambda item: item.relative_to(root).as_posix())
    ]


def records_hash(records: list[dict]) -> str:
    return sha256_text(canonical_json(records))


def allowed_source_runtime_residue(path: Path, root: Path) -> bool:
    relative = path.relative_to(root)
    return "__pycache__" in relative.parts and path.suffix.lower() in {".pyc", ".pyo"}


def install_audit(source_root: Path, cache_root: Path, package_path: Path | None = None) -> dict:
    source_root = source_root.resolve()
    cache_root = cache_root.resolve()
    if not source_root.is_dir() or not cache_root.is_dir():
        raise ValidationError("install-audit requires existing source and cache directories")
    issues = []
    source_all = [path for path in source_root.rglob("*") if path.is_file()]
    cache_all = [path for path in cache_root.rglob("*") if path.is_file()]
    source_links = [path for path in source_root.rglob("*") if path.is_symlink()]
    cache_links = [path for path in cache_root.rglob("*") if path.is_symlink()]
    if source_links or cache_links:
        issues.append("install-audit rejects symlinks in source or cache")
    canonical = source_files(source_root)
    canonical_records = file_records(source_root, canonical)
    canonical_by_path = {item["path"]: item for item in canonical_records}
    ignored_source = [path for path in source_all if path not in canonical]
    unexpected_source = [path.relative_to(source_root).as_posix() for path in ignored_source if not allowed_source_runtime_residue(path, source_root)]
    if unexpected_source:
        issues.append(f"source contains unclassified excluded files: {', '.join(sorted(unexpected_source))}")
    cache_records = file_records(cache_root, cache_all)
    cache_by_path = {item["path"]: item for item in cache_records}
    missing_cache = sorted(set(canonical_by_path) - set(cache_by_path))
    extra_cache = sorted(set(cache_by_path) - set(canonical_by_path))
    changed_cache = sorted(path for path in set(canonical_by_path) & set(cache_by_path) if canonical_by_path[path]["sha256"] != cache_by_path[path]["sha256"])
    if missing_cache:
        issues.append(f"installed cache is missing package files: {', '.join(missing_cache)}")
    if extra_cache:
        issues.append(f"installed cache contains undeclared files, including ignored executables: {', '.join(extra_cache)}")
    if changed_cache:
        issues.append(f"installed cache content drifted: {', '.join(changed_cache)}")
    package_records = []
    if package_path is not None:
        package_path = package_path.resolve()
        if not package_path.is_file():
            issues.append("install package is missing")
        else:
            try:
                with zipfile.ZipFile(package_path) as archive:
                    names = [name for name in archive.namelist() if not name.endswith("/")]
                    if len(names) != len(set(names)):
                        issues.append("install package contains duplicate entries")
                    for name in sorted(names):
                        pure = PurePosixPath(name)
                        if pure.is_absolute() or ".." in pure.parts:
                            issues.append(f"install package contains unsafe entry: {name}")
                            continue
                        value = archive.read(name)
                        package_records.append({"path": pure.as_posix(), "bytes": len(value), "sha256": hashlib.sha256(value).hexdigest()})
            except (OSError, zipfile.BadZipFile) as error:
                issues.append(f"install package is unreadable: {error}")
            package_by_path = {item["path"]: item for item in package_records}
            if set(package_by_path) != set(canonical_by_path):
                issues.append("install package inventory does not equal canonical source inventory")
            elif any(package_by_path[path]["sha256"] != canonical_by_path[path]["sha256"] for path in canonical_by_path):
                issues.append("install package bytes do not equal canonical source bytes")
    if issues:
        raise ValidationError("\n".join(issues))
    ignored_records = file_records(source_root, ignored_source)
    return {
        "ok": True,
        "source": str(source_root),
        "cache": str(cache_root),
        "package": str(package_path) if package_path else None,
        "canonicalFiles": len(canonical_records),
        "cacheFiles": len(cache_records),
        "packageFiles": len(package_records) if package_path else None,
        "canonicalTreeHash": records_hash(canonical_records),
        "cacheFullTreeHash": records_hash(cache_records),
        "packageTreeHash": records_hash(package_records) if package_path else None,
        "sourceRuntimeResidue": ignored_records,
        "unexpectedCacheFiles": [],
    }


def compare_packages(first: Path, second: Path) -> dict:
    first = first.resolve()
    second = second.resolve()
    if not first.is_file() or not second.is_file():
        raise ValidationError("package-compare requires two existing package files")
    first_bytes = first.read_bytes()
    second_bytes = second.read_bytes()
    first_hash = hashlib.sha256(first_bytes).hexdigest()
    second_hash = hashlib.sha256(second_bytes).hexdigest()
    if first_bytes != second_bytes or first_hash != second_hash:
        raise ValidationError("deterministic package bytes differ")
    try:
        with zipfile.ZipFile(first) as first_zip, zipfile.ZipFile(second) as second_zip:
            first_names = first_zip.namelist()
            second_names = second_zip.namelist()
            if first_names != second_names or any(first_zip.read(name) != second_zip.read(name) for name in first_names):
                raise ValidationError("deterministic package entry order or content differs")
    except (OSError, zipfile.BadZipFile) as error:
        raise ValidationError(f"package-compare cannot read package: {error}") from error
    return {
        "ok": True,
        "status": "PASS",
        "byteIdentical": True,
        "first": release_file_binding(first),
        "second": release_file_binding(second),
        "sha256": first_hash,
    }


def fresh_codex_cli_command(*arguments: str) -> list[str]:
    pwsh = shutil.which("pwsh")
    wrapper = (Path.home() / ".codex" / "scripts" / "Invoke-FreshCodexCli.ps1").resolve()
    if not pwsh:
        raise ValidationError("fresh Codex CLI invocation cannot find pwsh")
    if not wrapper.is_file():
        raise ValidationError(f"fresh Codex CLI wrapper is missing: {wrapper}")
    return [pwsh, "-NoProfile", "-File", str(wrapper), *arguments]


def parse_codex_mcp_readback(stdout: str) -> dict[str, str]:
    lines = stdout.splitlines()
    if not lines or lines[0] != "kgj-design" or any(not line for line in lines):
        raise ValidationError("install-readback MCP output has an invalid identity or blank line")
    fields: dict[str, str] = {}
    for line in lines[1:]:
        match = re.fullmatch(r"  ([a-z]+): (.+)", line)
        if not match or match.group(1) in fields:
            raise ValidationError("install-readback MCP output is not a unique structured field list")
        fields[match.group(1)] = match.group(2)
    required = {"enabled", "transport", "command", "args", "cwd", "env", "remove"}
    if set(fields) != required:
        raise ValidationError("install-readback MCP output fields differ from the closed contract")
    return fields


def install_readback(marketplace_source: Path, cache_root: Path, package_path: Path) -> dict:
    marketplace_source = marketplace_source.resolve()
    cache_root = cache_root.resolve()
    package_path = package_path.resolve()
    audit = install_audit(marketplace_source, cache_root, package_path)
    manifest = read_json(marketplace_source / ".codex-plugin" / "plugin.json")
    version = manifest.get("version")
    plugin_command = fresh_codex_cli_command("plugin", "list", "--json")
    mcp_command = fresh_codex_cli_command("mcp", "get", "kgj-design")
    try:
        plugin_run = subprocess.run(
            plugin_command, cwd=marketplace_source, shell=False,
            capture_output=True, text=True, encoding="utf-8", errors="strict", timeout=30, check=False,
        )
        mcp_run = subprocess.run(
            mcp_command, cwd=marketplace_source, shell=False,
            capture_output=True, text=True, encoding="utf-8", errors="strict", timeout=30, check=False,
        )
    except (OSError, subprocess.TimeoutExpired, UnicodeError) as error:
        raise ValidationError(f"install-readback could not invoke Codex CLI: {error}") from error
    cli_streams = (plugin_run.stdout, plugin_run.stderr, mcp_run.stdout, mcp_run.stderr)
    if any("\ufffd" in stream for stream in cli_streams):
        raise ValidationError("install-readback Codex CLI output contains U+FFFD")
    if plugin_run.returncode != 0 or mcp_run.returncode != 0:
        raise ValidationError("install-readback Codex CLI command failed")
    try:
        installed = json.loads(plugin_run.stdout).get("installed", [])
    except json.JSONDecodeError as error:
        raise ValidationError(f"install-readback plugin list is not JSON: {error}") from error
    plugin = next((item for item in installed if isinstance(item, dict) and item.get("pluginId") == "kgj-design@personal"), None)
    if not plugin or plugin.get("installed") is not True or plugin.get("enabled") is not True or plugin.get("version") != version:
        raise ValidationError("install-readback did not find the exact enabled KGJ plugin version")
    plugin_source = Path(str(plugin.get("source", {}).get("path", ""))).resolve()
    if plugin_source != marketplace_source:
        raise ValidationError("install-readback plugin source is not the immutable marketplace source")
    mcp = parse_codex_mcp_readback(mcp_run.stdout)
    try:
        mcp_cwd = Path(mcp["cwd"]).resolve()
    except OSError as error:
        raise ValidationError(f"install-readback MCP cwd cannot be resolved: {error}") from error
    expected_mcp = {
        "enabled": "true",
        "transport": "stdio",
        "command": "node",
        "args": "./mcp/server.mjs",
        "cwd": mcp["cwd"],
        "env": "-",
        "remove": "codex mcp remove kgj-design",
    }
    if mcp != expected_mcp or mcp_cwd != cache_root:
        raise ValidationError("install-readback MCP fields do not bind the installed cache contract")
    return {
        "ok": True,
        "status": "PASS",
        "pluginId": "kgj-design@personal",
        "version": version,
        "installed": True,
        "enabled": True,
        "marketplaceSource": str(marketplace_source),
        "cache": str(cache_root),
        "mcpEnabled": True,
        "cliWrapper": plugin_command[3],
        "installAudit": audit,
    }


def create_browser_evidence_envelope(source_root: Path, browser_receipt_path: Path, execution_receipt_path: Path, output_path: Path) -> dict:
    source_root = source_root.resolve()
    browser_receipt_path = browser_receipt_path.resolve()
    execution_receipt_path = execution_receipt_path.resolve()
    output_path = output_path.resolve()
    if output_path.exists():
        raise ValidationError(f"browser evidence envelope refuses to overwrite: {output_path}")
    if output_path.parent != execution_receipt_path.parent or browser_receipt_path.parent.parent != output_path.parent:
        raise ValidationError("browser evidence envelope inputs must use one release evidence root")
    browser_receipt = read_json(browser_receipt_path)
    execution_receipt = read_json(execution_receipt_path)
    browser_runner = browser_receipt.get("runner", {})
    coverage = sorted(set().union(*BROWSER_REPLAY_CHECKS.values()))
    browser_record = {
        "id": browser_receipt.get("id"), "exitStatus": browser_receipt.get("exitStatus"), "coverage": coverage,
        "environment": browser_receipt.get("environment", {}),
        "attestation": {
            "method": "browser", "startedAt": browser_receipt.get("startedAt"), "completedAt": browser_receipt.get("completedAt"),
            "toolVersion": browser_runner.get("version"), "transcriptSha256": browser_receipt.get("transcriptSha256"),
        },
    }
    issues = validate_browser_receipt(browser_record, browser_receipt_path, browser_receipt, source_root, "browserReceipt")
    execution_runner = execution_receipt.get("runner", {})
    execution_record = {
        "id": execution_receipt.get("id"), "exitStatus": execution_receipt.get("exitStatus"), "coverage": [], "rounds": [],
        "attestation": {
            "method": "command", "startedAt": execution_receipt.get("startedAt"), "completedAt": execution_receipt.get("completedAt"),
            "toolVersion": execution_runner.get("version"), "transcriptSha256": execution_receipt.get("transcriptSha256"),
        },
    }
    issues.extend(validate_command_receipt(execution_record, execution_receipt_path, execution_receipt, source_root, "executionReceipt"))
    if execution_record.get("_commandPlanVerified") is not True:
        issues.append("executionReceipt: browser execution receipt lacks the closed replay command plan")
    if issues:
        raise ValidationError("\n".join(issues))
    payload = {
        "schemaVersion": "1.1",
        "id": "evidence.r2.browser-replay",
        "result": "pass",
        "exitStatus": 0,
        "startedAt": browser_receipt["startedAt"],
        "completedAt": execution_receipt["completedAt"],
        "runner": {"name": "kgj-browser-evidence-envelope", "version": "1.0.0", "shell": False},
        "environment": browser_receipt["environment"],
        "browserReceipt": browser_envelope_binding(output_path.parent, browser_receipt_path),
        "executionReceipt": browser_envelope_binding(output_path.parent, execution_receipt_path),
        "limitations": browser_receipt.get("limitations", []) + ["The command receipt is a local unsigned execution attestation."],
    }
    transcript_hash = sha256_text(canonical_json(payload))
    artifact = {**payload, "transcriptSha256": transcript_hash}
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("x", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(artifact, ensure_ascii=False, indent=2) + "\n")
        handle.flush()
        os.fsync(handle.fileno())
    return {"ok": True, "status": "PASS", "artifact": str(output_path), "sha256": sha256_file(output_path), "transcriptSha256": transcript_hash}


def release_file_binding(path: Path) -> dict:
    path = path.resolve()
    if not path.is_file():
        raise ValidationError(f"release binding requires an existing file: {path}")
    return {"path": str(path), "bytes": path.stat().st_size, "sha256": sha256_file(path)}


def command_binds_path(command: object, cwd: Path, target: Path) -> bool:
    if not isinstance(command, list) or not all(isinstance(item, str) for item in command):
        return False
    target = target.resolve()
    for item in command:
        candidate = Path(item)
        try:
            resolved = candidate.resolve() if candidate.is_absolute() else (cwd / candidate).resolve()
        except OSError:
            continue
        if resolved == target:
            return True
    return False


def validate_quality_command_receipt(receipt_path: Path, source_root: Path) -> tuple[dict, list[str]]:
    receipt = read_json(receipt_path)
    if not isinstance(receipt, dict):
        return {}, ["terminal quality receipt must be an object"]
    record = {
        "id": receipt.get("id"),
        "exitStatus": receipt.get("exitStatus"),
        "attestation": {
            "method": "command",
            "startedAt": receipt.get("startedAt"),
            "completedAt": receipt.get("completedAt"),
            "toolVersion": receipt.get("runner", {}).get("version") if isinstance(receipt.get("runner"), dict) else None,
            "transcriptSha256": receipt.get("transcriptSha256"),
        },
    }
    issues = validate_command_receipt(record, receipt_path, receipt, source_root, "terminal quality receipt")
    if Path(str(receipt.get("cwd", ""))).resolve() != source_root.resolve():
        issues.append("terminal quality receipt cwd does not equal canonical source")
    stdout_binding = receipt.get("stdoutArtifact") if isinstance(receipt.get("stdoutArtifact"), dict) else {}
    stdout_path = (receipt_path.parent / str(stdout_binding.get("locator", ""))).resolve()
    quality_output = {}
    if stdout_path.is_file():
        try:
            quality_output = json.loads(stdout_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            issues.append(f"terminal quality stdout is not JSON: {error}")
    if quality_output.get("status") != "PASS" or not isinstance(quality_output.get("weightedScore"), (int, float)) or quality_output.get("weightedScore", 0) < 9.9:
        issues.append("terminal quality stdout does not contain a passing 9.9 gate")
    return quality_output, issues


def validate_release_timeline(created_value, quality_completed_value, *, now: datetime | None = None) -> tuple[datetime, datetime]:
    """Fail closed when a detached release receipt has an impossible or unbounded clock."""
    parsed = []
    for label, value in (("release attestation", created_value), ("terminal quality receipt", quality_completed_value)):
        try:
            instant = datetime.fromisoformat(str(value or "").replace("Z", "+00:00"))
        except ValueError as error:
            raise ValidationError(f"{label} timestamp is invalid: {error}") from error
        if instant.tzinfo is None or instant.utcoffset() is None:
            raise ValidationError(f"{label} timestamp must include a UTC offset")
        parsed.append(instant.astimezone(timezone.utc))
    created_at, quality_completed_at = parsed
    reference_now = now or datetime.now(timezone.utc)
    if reference_now.tzinfo is None or reference_now.utcoffset() is None:
        raise ValidationError("release verification clock must include a UTC offset")
    reference_now = reference_now.astimezone(timezone.utc)
    if created_at < quality_completed_at:
        raise ValidationError("release attestation predates the terminal quality gate")
    if created_at > reference_now + timedelta(seconds=MAX_RELEASE_CLOCK_SKEW_SECONDS):
        raise ValidationError(
            f"release attestation exceeds the {MAX_RELEASE_CLOCK_SKEW_SECONDS}-second future clock-skew bound"
        )
    return created_at, quality_completed_at


def create_release_attestation(
    source_root: Path,
    marketplace_source: Path,
    cache_root: Path,
    package_path: Path,
    ledger_path: Path,
    registry_path: Path,
    quality_receipt_path: Path,
    marketplace_path: Path,
    output_path: Path,
) -> dict:
    source_root = source_root.resolve()
    marketplace_source = marketplace_source.resolve()
    cache_root = cache_root.resolve()
    package_path = package_path.resolve()
    ledger_path = ledger_path.resolve()
    registry_path = registry_path.resolve()
    quality_receipt_path = quality_receipt_path.resolve()
    marketplace_path = marketplace_path.resolve()
    output_path = output_path.resolve()
    if output_path.exists():
        raise ValidationError(f"release attestation refuses to overwrite: {output_path}")
    protected_roots = (source_root, marketplace_source, cache_root)
    if any(root == output_path.parent or root in output_path.parents for root in protected_roots):
        raise ValidationError("release attestation output must stay outside source, immutable marketplace source, and installed cache")
    required_files = [package_path, ledger_path, registry_path, quality_receipt_path, marketplace_path]
    if any(not path.is_file() for path in required_files):
        raise ValidationError("release attestation input file is missing")
    source_digest, source_records = digest_tree(source_root)
    immutable_digest, immutable_records = digest_tree(marketplace_source)
    if canonical_json(source_records) != canonical_json(immutable_records) or source_digest != immutable_digest:
        raise ValidationError("canonical source and immutable marketplace source differ")
    install_result = install_audit(marketplace_source, cache_root, package_path)
    if install_result["sourceRuntimeResidue"]:
        raise ValidationError("immutable marketplace source must not contain runtime residue")
    source_manifest = read_json(source_root / ".codex-plugin" / "plugin.json")
    immutable_manifest = read_json(marketplace_source / ".codex-plugin" / "plugin.json")
    cache_manifest = read_json(cache_root / ".codex-plugin" / "plugin.json")
    version = source_manifest.get("version")
    if not version or immutable_manifest.get("version") != version or cache_manifest.get("version") != version:
        raise ValidationError("release manifest versions do not agree")
    runtime_version = read_json(source_root / "package.json").get("version")
    expected_marketplace_source = (source_root.parent / "kgj-design-releases" / version).resolve()
    expected_cache = expected_plugin_cache(version)
    expected_package = (registry_path.parent.parent / "package" / f"kgj-design-{runtime_version}-a.zip").resolve()
    if marketplace_source != expected_marketplace_source or cache_root != expected_cache or package_path != expected_package:
        raise ValidationError("release subjects do not match the closed Round 3 plan targets")
    marketplace = read_json(marketplace_path)
    plugin = next((item for item in marketplace.get("plugins", []) if isinstance(item, dict) and item.get("name") == "kgj-design"), None)
    expected_marketplace_path = f"./plugins/kgj-design-releases/{version}"
    if not plugin or plugin.get("source", {}).get("source") != "local" or plugin.get("source", {}).get("path") != expected_marketplace_path:
        raise ValidationError("personal marketplace is not pinned to the immutable versioned source")
    records, registry_issues = validate_evidence_registry(registry_path, verify_files=True, source_root=source_root)
    if registry_issues:
        raise ValidationError("\n".join(registry_issues))
    quality_result = quality_gate(ledger_path, registry_path)
    quality_receipt_result, quality_receipt_issues = validate_quality_command_receipt(quality_receipt_path, source_root)
    if quality_receipt_issues:
        raise ValidationError("\n".join(quality_receipt_issues))
    quality_receipt = read_json(quality_receipt_path)
    receipt_command = quality_receipt.get("command", [])
    if not command_binds_path(receipt_command, source_root, ledger_path):
        raise ValidationError("terminal quality command does not bind the quality ledger")
    if not command_binds_path(receipt_command, source_root, registry_path):
        raise ValidationError("terminal quality command does not bind the evidence registry")
    if "quality" not in receipt_command or "--evidence-registry" not in receipt_command:
        raise ValidationError("terminal quality command is not the KGJ quality-gate invocation")
    if canonical_json(quality_receipt_result) != canonical_json(quality_result):
        raise ValidationError("terminal quality stdout does not equal the recomputed quality gate")
    stdout_path = quality_receipt_path.parent / quality_receipt["stdoutArtifact"]["locator"]
    stderr_path = quality_receipt_path.parent / quality_receipt["stderrArtifact"]["locator"]
    release_clock = datetime.now(timezone.utc)
    created_at = release_clock.isoformat(timespec="milliseconds").replace("+00:00", "Z")
    validate_release_timeline(created_at, quality_receipt.get("completedAt"), now=release_clock)
    payload = {
        "schemaVersion": "1.0",
        "id": f"kgj-release-{version}",
        "status": "PASS",
        "version": version,
        "createdAt": created_at,
        "issuer": {"name": "kgj-terminal-attest", "version": "1.0.0", "method": "detached-local"},
        "subjects": {
            "canonicalSource": {"path": str(source_root), "files": len(source_records), "treeHash": source_digest},
            "immutableMarketplaceSource": {"path": str(marketplace_source), "files": len(immutable_records), "treeHash": immutable_digest},
            "installedCache": {"path": str(cache_root), "files": install_result["cacheFiles"], "fullTreeHash": install_result["cacheFullTreeHash"]},
            "package": release_file_binding(package_path),
        },
        "bindings": {
            "manifest": release_file_binding(source_root / ".codex-plugin" / "plugin.json"),
            "ledger": release_file_binding(ledger_path),
            "registry": release_file_binding(registry_path),
            "marketplace": release_file_binding(marketplace_path),
            "qualityReceipt": release_file_binding(quality_receipt_path),
            "qualityStdout": release_file_binding(stdout_path),
            "qualityStderr": release_file_binding(stderr_path),
        },
        "verification": {
            "evidenceRecords": len(records),
            "installAudit": install_result,
            "qualityGate": quality_result,
            "qualityReceiptResult": quality_receipt_result,
        },
        "limitations": [
            "This is a detached local terminal attestation, not a signed external CI identity.",
            "It proves the named personal-marketplace install and does not claim public deployment.",
        ],
    }
    transcript_hash = sha256_text(canonical_json(payload))
    artifact = {**payload, "transcriptSha256": transcript_hash}
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("x", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(artifact, ensure_ascii=False, indent=2) + "\n")
        handle.flush()
        os.fsync(handle.fileno())
    return {"ok": True, "status": "PASS", "artifact": str(output_path), "sha256": sha256_file(output_path), "transcriptSha256": transcript_hash, "version": version}


def verify_release_attestation(path: Path) -> dict:
    path = path.resolve()
    value = read_json(path)
    if not isinstance(value, dict) or value.get("schemaVersion") != "1.0" or value.get("status") != "PASS":
        raise ValidationError("release attestation schema or status is invalid")
    expected_keys = {"schemaVersion", "id", "status", "version", "createdAt", "issuer", "subjects", "bindings", "verification", "limitations", "transcriptSha256"}
    if set(value) != expected_keys or set(value.get("bindings", {})) != {"manifest", "ledger", "registry", "marketplace", "qualityReceipt", "qualityStdout", "qualityStderr"}:
        raise ValidationError("release attestation does not use the closed schema")
    transcript = {key: item for key, item in value.items() if key != "transcriptSha256"}
    if value.get("transcriptSha256") != sha256_text(canonical_json(transcript)):
        raise ValidationError("release attestation transcript hash mismatch")
    for name, binding in value.get("bindings", {}).items():
        target = Path(str(binding.get("path", ""))).resolve() if isinstance(binding, dict) else Path()
        if not target.is_file() or target.stat().st_size != binding.get("bytes") or sha256_file(target) != binding.get("sha256"):
            raise ValidationError(f"release attestation binding drift: {name}")
    subjects = value.get("subjects", {})
    source = Path(subjects.get("canonicalSource", {}).get("path", ""))
    marketplace_source = Path(subjects.get("immutableMarketplaceSource", {}).get("path", ""))
    cache = Path(subjects.get("installedCache", {}).get("path", ""))
    package = Path(subjects.get("package", {}).get("path", ""))
    version = value.get("version")
    runtime_version = read_json(source.resolve() / "package.json").get("version")
    registry_binding_path = Path(value.get("bindings", {}).get("registry", {}).get("path", "")).resolve()
    expected_marketplace_source = (source.resolve().parent / "kgj-design-releases" / str(version)).resolve()
    expected_cache = expected_plugin_cache(str(version))
    expected_package = (registry_binding_path.parent.parent / "package" / f"kgj-design-{runtime_version}-a.zip").resolve()
    if marketplace_source.resolve() != expected_marketplace_source or cache.resolve() != expected_cache or package.resolve() != expected_package:
        raise ValidationError("release attestation subject target drift")
    source_digest, source_records = digest_tree(source.resolve())
    immutable_digest, immutable_records = digest_tree(marketplace_source.resolve())
    if source_digest != subjects.get("canonicalSource", {}).get("treeHash") or immutable_digest != subjects.get("immutableMarketplaceSource", {}).get("treeHash"):
        raise ValidationError("release attestation source tree drift")
    if canonical_json(source_records) != canonical_json(immutable_records):
        raise ValidationError("release attestation immutable source drift")
    install_result = install_audit(marketplace_source, cache, package)
    if install_result["sourceRuntimeResidue"]:
        raise ValidationError("release attestation immutable source contains runtime residue")
    if subjects.get("package") != release_file_binding(package):
        raise ValidationError("release attestation package binding drift")
    if subjects.get("canonicalSource", {}).get("files") != len(source_records) or subjects.get("immutableMarketplaceSource", {}).get("files") != len(immutable_records):
        raise ValidationError("release attestation source inventory drift")
    installed_subject = subjects.get("installedCache", {})
    if installed_subject.get("files") != install_result["cacheFiles"] or installed_subject.get("fullTreeHash") != install_result["cacheFullTreeHash"]:
        raise ValidationError("release attestation installed-cache drift")
    ledger = Path(value["bindings"]["ledger"]["path"])
    registry = Path(value["bindings"]["registry"]["path"])
    quality_receipt = Path(value["bindings"]["qualityReceipt"]["path"])
    quality_result = quality_gate(ledger, registry)
    quality_receipt_result, receipt_issues = validate_quality_command_receipt(quality_receipt, source)
    if receipt_issues:
        raise ValidationError("\n".join(receipt_issues))
    quality_receipt_value = read_json(quality_receipt)
    validate_release_timeline(value.get("createdAt"), quality_receipt_value.get("completedAt"))
    receipt_command = read_json(quality_receipt).get("command", [])
    if not command_binds_path(receipt_command, source, ledger) or not command_binds_path(receipt_command, source, registry):
        raise ValidationError("release attestation quality command binding drift")
    verification = value.get("verification", {})
    expected_verification = {
        "evidenceRecords": quality_result["evidenceRecords"],
        "installAudit": install_result,
        "qualityGate": quality_result,
        "qualityReceiptResult": quality_receipt_result,
    }
    if canonical_json(verification) != canonical_json(expected_verification):
        raise ValidationError("release attestation verification result drift")
    manifest = read_json(Path(value["bindings"]["manifest"]["path"]))
    immutable_manifest = read_json(marketplace_source / ".codex-plugin" / "plugin.json")
    cache_manifest = read_json(cache / ".codex-plugin" / "plugin.json")
    if value.get("version") != manifest.get("version") or immutable_manifest.get("version") != value.get("version") or cache_manifest.get("version") != value.get("version"):
        raise ValidationError("release attestation version drift")
    marketplace = read_json(Path(value["bindings"]["marketplace"]["path"]))
    plugin = next((item for item in marketplace.get("plugins", []) if isinstance(item, dict) and item.get("name") == "kgj-design"), None)
    if not plugin or plugin.get("source", {}).get("source") != "local" or plugin.get("source", {}).get("path") != f"./plugins/kgj-design-releases/{value.get('version')}":
        raise ValidationError("release attestation marketplace pin drift")
    return {"ok": True, "status": "PASS", "artifact": str(path), "version": value.get("version"), "transcriptSha256": value.get("transcriptSha256")}


def validate_token_graph(tokens, label: str) -> list[str]:
    issues = []
    if not isinstance(tokens, dict) or set(tokens) != set(TOKEN_LAYERS):
        return [f"{label}: tokens must contain exactly foundation, semantic, and component"]
    registry = {}
    for layer in TOKEN_LAYERS:
        values = tokens.get(layer)
        if not isinstance(values, dict) or not values:
            issues.append(f"{label}: tokens.{layer} must be a non-empty object")
            continue
        for name, token in values.items():
            qualified = f"{layer}.{name}"
            if not TOKEN_NAME.fullmatch(name):
                issues.append(f"{label}: invalid token name {qualified}")
                continue
            if not isinstance(token, dict) or set(token) != {"$type", "$value"}:
                issues.append(f"{label}: {qualified} must contain only $type and $value")
                continue
            if token["$type"] not in TOKEN_TYPES:
                issues.append(f"{label}: {qualified} has unsupported type {token['$type']}")
            if not isinstance(token["$value"], (str, int, float)) or isinstance(token["$value"], bool):
                issues.append(f"{label}: {qualified} has an invalid value")
            registry[qualified] = token
    for layer in TOKEN_LAYERS:
        for name, token in (tokens.get(layer) or {}).items():
            if not isinstance(token, dict) or "$value" not in token:
                continue
            alias = TOKEN_ALIAS.fullmatch(str(token["$value"]))
            if layer == "foundation":
                if alias:
                    issues.append(f"{label}: foundation token {name} cannot be an alias")
                continue
            expected_parent = "foundation" if layer == "semantic" else "semantic"
            if not alias or alias.group(1) != expected_parent:
                issues.append(f"{label}: {layer} token {name} must alias {expected_parent}")
                continue
            target_name = f"{alias.group(1)}.{alias.group(2)}"
            target = registry.get(target_name)
            if target is None:
                issues.append(f"{label}: {layer} token {name} references missing {target_name}")
            elif target.get("$type") != token.get("$type"):
                issues.append(f"{label}: {layer} token {name} type does not match {target_name}")
    missing_semantic = sorted(REQUIRED_SEMANTIC - set((tokens.get("semantic") or {}).keys()))
    missing_component = sorted(REQUIRED_COMPONENT - set((tokens.get("component") or {}).keys()))
    if missing_semantic:
        issues.append(f"{label}: missing required semantic tokens {', '.join(missing_semantic)}")
    if missing_component:
        issues.append(f"{label}: missing required component tokens {', '.join(missing_component)}")
    return issues


def digest_tree(root: Path) -> tuple[str, list[dict]]:
    digest = hashlib.sha256()
    records = []
    for path in source_files(root):
        relative = path.relative_to(root).as_posix()
        content = path.read_bytes()
        file_hash = hashlib.sha256(content).hexdigest()
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(file_hash.encode("ascii"))
        digest.update(b"\n")
        records.append({"path": relative, "size": len(content), "sha256": file_hash})
    return digest.hexdigest(), records


def validate_dna(value: dict, label: str) -> list[str]:
    issues = []
    required = {"schemaVersion", "id", "name", "domain", "jobs", "character", "avoid", "traits", "tokens"}
    missing = sorted(required - set(value))
    if missing:
        issues.append(f"{label}: missing {', '.join(missing)}")
    if value.get("schemaVersion") not in DNA_SCHEMA_VERSIONS:
        issues.append(f"{label}: schemaVersion must be 1.0, 1.1, or 1.2")
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,63}", str(value.get("id", ""))):
        issues.append(f"{label}: invalid id")
    if not isinstance(value.get("jobs"), list) or not value.get("jobs"):
        issues.append(f"{label}: jobs must be a non-empty list")
    if not isinstance(value.get("character"), list) or len(value.get("character", [])) < 2:
        issues.append(f"{label}: character needs at least two traits")
    if not isinstance(value.get("avoid"), list) or not value.get("avoid"):
        issues.append(f"{label}: avoid must be a non-empty list")
    genome = value.get("genome")
    if value.get("schemaVersion") == "1.2":
        if not isinstance(genome, dict) or set(genome) != GENOME_KEYS:
            issues.append(f"{label}: schemaVersion 1.2 requires the closed genome keys {', '.join(sorted(GENOME_KEYS))}")
        else:
            for key in sorted(GENOME_KEYS):
                statements = genome.get(key)
                if (
                    not isinstance(statements, list)
                    or not 1 <= len(statements) <= 8
                    or len(statements) != len(set(statements))
                    or any(not isinstance(item, str) or not 3 <= len(item.strip()) <= 200 for item in statements)
                ):
                    issues.append(f"{label}: genome.{key} must contain 1-8 unique bounded statements")
    elif genome is not None:
        issues.append(f"{label}: genome requires schemaVersion 1.2")
    issues.extend(validate_token_graph(value.get("tokens"), label))
    lineage = value.get("lineage")
    if lineage is not None:
        if value.get("schemaVersion") not in {"1.1", "1.2"}:
            issues.append(f"{label}: lineage requires schemaVersion 1.1 or 1.2")
        if not isinstance(lineage, dict) or lineage.get("policy") != "semantic-contract":
            issues.append(f"{label}: lineage.policy must be semantic-contract")
        else:
            parents = lineage.get("parents")
            if not isinstance(parents, list) or not 1 <= len(parents) <= 8:
                issues.append(f"{label}: lineage.parents must contain 1-8 parents")
            else:
                parent_ids = []
                for index, parent in enumerate(parents):
                    if not isinstance(parent, dict):
                        issues.append(f"{label}: lineage.parents[{index}] must be an object")
                        continue
                    parent_id = parent.get("id")
                    parent_ids.append(parent_id)
                    if not PRODUCT_ID.fullmatch(str(parent_id or "")):
                        issues.append(f"{label}: lineage.parents[{index}].id is invalid")
                    if parent_id == value.get("id"):
                        issues.append(f"{label}: a DNA profile cannot inherit from itself")
                    normalized, path_issues = portable_relative_path(parent.get("path"), f"{label}: lineage.parents[{index}].path")
                    issues.extend(path_issues)
                    if normalized and not normalized.endswith(".json"):
                        issues.append(f"{label}: lineage parent paths must name JSON files")
                    if parent.get("minSchemaVersion") not in DNA_SCHEMA_VERSIONS:
                        issues.append(f"{label}: lineage.parents[{index}].minSchemaVersion is invalid")
                if len(parent_ids) != len(set(parent_ids)):
                    issues.append(f"{label}: lineage parent IDs must be unique")
            allowed = lineage.get("allowedOverrides")
            if not isinstance(allowed, list) or not allowed:
                issues.append(f"{label}: lineage.allowedOverrides must be non-empty")
            else:
                for pattern in allowed:
                    if pattern.startswith("semantic."):
                        issues.append(f"{label}: semantic token overrides are forbidden by the semantic-contract policy")
                    if not re.fullmatch(r"(?:foundation|component|traits)\.(?:\*|[a-z][a-z0-9.-]*)|signatureMoment", str(pattern)):
                        issues.append(f"{label}: invalid lineage override pattern {pattern}")
    return issues


def validate_plugin(root: Path) -> dict:
    issues = []
    required_files = [
        ".codex-plugin/plugin.json",
        ".mcp.json",
        "README.md",
        "ontology/kgj-ontology.json",
        "references/architecture.md",
        "references/ontology-and-dictionary.md",
        "references/quality-gates.md",
        "references/source-catalog.json",
        "references/schemas/product-dna.schema.json",
        "references/schemas/dictionary-entry.schema.json",
        "references/schemas/quality-ledger.schema.json",
        "references/schemas/project-contract.schema.json",
        "references/schemas/evidence-registry.schema.json",
        "references/schemas/pattern-candidate.schema.json",
        "references/schemas/expert-review.schema.json",
        "references/quality-rubric.json",
        "references/expert-review-board.md",
        "references/project-contract-and-evidence.md",
        "references/pattern-lifecycle.md",
        "references/productization-insights.md",
        "scripts/kgj_design.py",
        "scripts/kgj_dictionary.mjs",
        "scripts/kgj_attest.py",
        "scripts/Invoke-KgjBrowserReplay.ps1",
        "tests/browser/round2-replay.js",
        "mcp/server.mjs",
        "assets/demo/index.html",
        "assets/templates/html-report/index.html",
        "assets/templates/markdown-artifact.md",
        "data/templates/product-dna.json",
        "data/templates/quality-ledger.json",
        "data/templates/project-contract.json",
        "data/templates/evidence-registry.json",
        "data/templates/pattern-candidate.json",
        "data/templates/expert-review.json",
    ]
    for relative in required_files:
        if not (root / relative).is_file():
            issues.append(f"missing required file: {relative}")

    manifest_path = root / ".codex-plugin" / "plugin.json"
    if manifest_path.is_file():
        manifest = read_json(manifest_path)
        if manifest.get("name") != "kgj-design":
            issues.append("manifest name must be kgj-design")
        if manifest.get("mcpServers") != "./.mcp.json":
            issues.append("manifest must reference ./.mcp.json")
        prompts = manifest.get("interface", {}).get("defaultPrompt")
        if not isinstance(prompts, list) or not 1 <= len(prompts) <= 3 or any(not isinstance(item, str) or not item.strip() for item in prompts):
            issues.append("manifest interface.defaultPrompt must contain 1-3 usable prompts")
        package_path = root / "package.json"
        if package_path.is_file() and manifest.get("version", "").split("+", 1)[0] != read_json(package_path).get("version"):
            issues.append("manifest and runtime package versions must match")

    ontology_path = root / "ontology" / "kgj-ontology.json"
    if ontology_path.is_file():
        ontology = read_json(ontology_path)
        if ontology.get("promise") != "portable-learning-not-portable-identity":
            issues.append("ontology promise is missing")
        if ontology.get("privacy", {}).get("crossUserPooling") is not False:
            issues.append("ontology must disable cross-user pooling")
        if ontology.get("version") != "1.2.0":
            issues.append("ontology version must be 1.2.0")
        if len(ontology.get("entryTypes", [])) != 7:
            issues.append("ontology must define seven entry types")
        if set(ontology.get("portablePrinciples", [])) != {
            "preserve-semantic-state", "surface-evidence-boundary", "use-progressive-disclosure", "adapt-density-to-task",
            "keep-recovery-visible", "separate-identity-from-learning", "prefer-product-local-pattern",
        }:
            issues.append("ontology portable principles do not match the closed export vocabulary")

    rubric_path = root / "references" / "quality-rubric.json"
    if rubric_path.is_file():
        rubric_value = read_json(rubric_path)
        if rubric_value.get("rubricVersion") != QUALITY_RUBRIC_VERSION:
            issues.append("quality rubric version mismatch")
        declared = {item.get("round"): item for item in rubric_value.get("rounds", []) if isinstance(item, dict)}
        for number, contract in QUALITY_RUBRIC.items():
            item = declared.get(number, {})
            if item.get("lens") != contract["lens"] or item.get("weight") != contract["weight"] or set(item.get("checks", [])) != set(contract["checks"]):
                issues.append(f"quality rubric round {number} does not match the runner contract")

    skills_root = root / "skills"
    actual_skills = {path.name for path in skills_root.iterdir() if path.is_dir()} if skills_root.is_dir() else set()
    if actual_skills != EXPECTED_SKILLS:
        issues.append(f"skill set mismatch: expected {sorted(EXPECTED_SKILLS)}, got {sorted(actual_skills)}")
    for name in sorted(actual_skills):
        skill_file = skills_root / name / "SKILL.md"
        agent_file = skills_root / name / "agents" / "openai.yaml"
        if not skill_file.is_file():
            issues.append(f"{name}: missing SKILL.md")
            continue
        text = skill_file.read_text(encoding="utf-8")
        if not text.startswith("---\n") or f"name: {name}\n" not in text:
            issues.append(f"{name}: invalid frontmatter")
        if "TODO" in text or "TBD" in text:
            issues.append(f"{name}: unfinished placeholder")
        if not agent_file.is_file():
            issues.append(f"{name}: missing agents/openai.yaml")

    for json_path in source_files(root):
        if json_path.suffix.lower() == ".json":
            try:
                read_json(json_path)
            except ValidationError as exc:
                issues.append(str(exc))

    examples = sorted((root / "examples" / "dna").glob("*.json")) if (root / "examples" / "dna").is_dir() else []
    if len(examples) < 4:
        issues.append("at least four example DNA profiles are required")
    for example in examples:
        issues.extend(validate_dna(read_json(example), example.relative_to(root).as_posix()))

    digest, records = digest_tree(root)
    if issues:
        raise ValidationError("\n".join(issues))
    return {"ok": True, "root": str(root), "files": len(records), "treeHash": digest, "skills": len(actual_skills), "dnaProfiles": len(examples)}


def css_name(value: str) -> str:
    first = re.sub(r"([a-z0-9])([A-Z])", r"\1-\2", value)
    return re.sub(r"[^a-zA-Z0-9-]+", "-", first).strip("-").lower()


def compile_dna(source: Path, target: Path, lineage_lock: Path | None = None) -> dict:
    value = read_json(source)
    issues = validate_dna(value, str(source))
    if issues:
        raise ValidationError("\n".join(issues))
    resolved_lock = None
    if value.get("lineage"):
        if lineage_lock is None:
            raise ValidationError("lineage DNA requires --lineage-lock produced by resolve-lineage")
        resolved_lock = resolve_lineage(source)["lock"]
        supplied_lock = read_json(lineage_lock)
        if canonical_json(supplied_lock) != canonical_json(resolved_lock):
            raise ValidationError("lineage lock does not match the current child and parent content")
    elif lineage_lock is not None:
        raise ValidationError("--lineage-lock is only valid for a DNA profile with lineage")
    lineage_lock_hash = hashlib.sha256(canonical_json(resolved_lock).encode("utf-8")).hexdigest() if resolved_lock else None
    lines = [
        "/* Generated by KGJ Design. Edit the DNA JSON, not this file. */",
        f"/* DNA: {value['id']} | source-sha256: {hashlib.sha256(source.read_bytes()).hexdigest()} */",
        f"/* lineage-lock-sha256: {lineage_lock_hash or 'none'} */",
        f":root[data-kgj-dna=\"{value['id']}\"], .kgj-dna-{value['id']} {{",
    ]
    for layer in TOKEN_LAYERS:
        for key in sorted(value["tokens"][layer]):
            token = value["tokens"][layer][key]
            alias = TOKEN_ALIAS.fullmatch(str(token["$value"]))
            rendered = f"var(--kgj-{css_name(alias.group(1))}-{css_name(alias.group(2))})" if alias else str(token["$value"])
            lines.append(f"  --kgj-{css_name(layer)}-{css_name(key)}: {rendered}; /* {token['$type']} */")
    lines.extend(["}", ""])
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    return {"ok": True, "source": str(source), "target": str(target), "variables": sum(len(group) for group in value["tokens"].values()), "layers": list(TOKEN_LAYERS), "lineageLockHash": lineage_lock_hash}


def package_plugin(root: Path, output: Path) -> dict:
    root = root.resolve()
    output = output.resolve()
    if output == root or root in output.parents:
        raise ValidationError("package output must be outside the plugin tree")
    files = source_files(root)
    for path in files:
        if path.is_symlink():
            raise ValidationError(f"symlinks are not packageable: {path}")
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in files:
            relative = path.relative_to(root).as_posix()
            info = zipfile.ZipInfo(relative, FIXED_ZIP_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            info.create_system = 3
            archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    return {
        "ok": True,
        "output": str(output),
        "files": len(files),
        "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
        "size": output.stat().st_size,
    }


def validate_project_contract(value: dict, label: str) -> list[str]:
    issues = []
    required = CONTRACT_KEYS
    missing = sorted(required - set(value)) if isinstance(value, dict) else sorted(required)
    if missing:
        issues.append(f"{label}: missing {', '.join(missing)}")
        return issues
    unknown = sorted(set(value) - CONTRACT_KEYS)
    if unknown:
        issues.append(f"{label}: unknown fields {', '.join(unknown)}")
    if value.get("schemaVersion") != "1.0":
        issues.append(f"{label}: schemaVersion must be 1.0")
    project = value.get("project")
    if not isinstance(project, dict):
        issues.append(f"{label}: project must be an object")
    else:
        if set(project) != PROJECT_KEYS:
            issues.append(f"{label}: project must contain exactly {', '.join(sorted(PROJECT_KEYS))}")
        if not PRODUCT_ID.fullmatch(str(project.get("id", ""))):
            issues.append(f"{label}: project.id is invalid")
        for key, maximum in (("name", 80), ("domain", 120), ("owner", 80)):
            field = project.get(key)
            if not isinstance(field, str) or not 2 <= len(field.strip()) <= maximum:
                issues.append(f"{label}: project.{key} is invalid")
    if value.get("state") not in {"draft", "ready", "hold"}:
        issues.append(f"{label}: state must be draft, ready, or hold")
    paths = value.get("paths")
    if not isinstance(paths, dict):
        issues.append(f"{label}: paths must be an object")
    else:
        if set(paths) != PROJECT_PATH_KEYS:
            issues.append(f"{label}: paths must contain exactly {', '.join(sorted(PROJECT_PATH_KEYS))}")
        for key in ("dna", "tokenOutput", "evidenceRegistry", "evidenceRoot"):
            _, path_issues = portable_relative_path(paths.get(key), f"{label}: paths.{key}")
            issues.extend(path_issues)
    for key, maximum in (("surfaces", 16), ("themes", 12), ("locales", 20)):
        items = value.get(key)
        if not isinstance(items, list) or not items or len(items) > maximum or len(items) != len(set(items)):
            issues.append(f"{label}: {key} must be a non-empty unique list")
        elif key in {"surfaces", "themes"} and any(not isinstance(item, str) or not SLUG.fullmatch(item) for item in items):
            issues.append(f"{label}: {key} values must be taxonomy slugs")
        elif key == "locales" and any(not isinstance(item, str) or not LOCALE.fullmatch(item) for item in items):
            issues.append(f"{label}: locales contains an invalid locale tag")
    unresolved = value.get("unresolved")
    if not isinstance(unresolved, list) or len(unresolved) > 40 or any(not isinstance(item, str) or not 3 <= len(item) <= 240 for item in unresolved):
        issues.append(f"{label}: unresolved must be a bounded string list")
    if value.get("state") == "ready" and unresolved:
        issues.append(f"{label}: a ready contract cannot contain unresolved decisions")
    return issues


def validate_evidence_registry(
    path: Path,
    verify_files: bool = False,
    allowed_root: Path | None = None,
    source_root: Path | None = None,
) -> tuple[dict[str, dict], list[str]]:
    registry = read_json(path)
    label = str(path)
    issues = []
    if not isinstance(registry, dict):
        return {}, [f"{label}: registry must be an object"]
    if set(registry) != REGISTRY_KEYS:
        issues.append(f"{label}: registry must contain exactly {', '.join(sorted(REGISTRY_KEYS))}")
    if registry.get("schemaVersion") not in {"1.0", "1.1"}:
        issues.append(f"{label}: schemaVersion must be 1.0 or 1.1")
    if not PRODUCT_ID.fullmatch(str(registry.get("productId", ""))):
        issues.append(f"{label}: productId is invalid")
    values = registry.get("records")
    if not isinstance(values, list) or len(values) > 2000:
        return {}, issues + [f"{label}: records must be an array with at most 2,000 items"]
    records = {}
    for index, record in enumerate(values):
        item_label = f"{label}: records[{index}]"
        if not isinstance(record, dict):
            issues.append(f"{item_label} must be an object")
            continue
        required_record = {"id", "kind", "proofLevel", "status", "locator", "sha256", "capturedAt", "limitations", "action", "result", "exitStatus", "postCondition", "environment", "claims"}
        if registry.get("schemaVersion") == "1.1":
            required_record.update({"coverage", "findingRefs", "rounds", "attestation"})
        missing_record = sorted(required_record - set(record))
        unknown_record = sorted(set(record) - EVIDENCE_KEYS)
        if missing_record:
            issues.append(f"{item_label}: missing {', '.join(missing_record)}")
        if unknown_record:
            issues.append(f"{item_label}: unknown fields {', '.join(unknown_record)}")
        record_id = record.get("id")
        if not PORTABLE_ID.fullmatch(str(record_id or "")):
            issues.append(f"{item_label}.id is invalid")
            continue
        if record_id in records:
            issues.append(f"{item_label}.id duplicates {record_id}")
        records[record_id] = record
        if record.get("kind") not in EVIDENCE_KINDS:
            issues.append(f"{item_label}.kind is invalid")
        if record.get("proofLevel") not in PROOF_LEVELS:
            issues.append(f"{item_label}.proofLevel is invalid")
        if record.get("status") not in EVIDENCE_STATUSES:
            issues.append(f"{item_label}.status is invalid")
        if record.get("result") not in EVIDENCE_RESULTS:
            issues.append(f"{item_label}.result is invalid")
        if record.get("exitStatus") is not None and not isinstance(record.get("exitStatus"), int):
            issues.append(f"{item_label}.exitStatus must be an integer or null")
        for field, maximum in (("action", 500), ("postCondition", 500)):
            text = record.get(field)
            if not isinstance(text, str) or not 3 <= len(text.strip()) <= maximum:
                issues.append(f"{item_label}.{field} is invalid")
        environment = record.get("environment")
        environment_keys = {"runtime", "browser", "browserVersion", "viewport"}
        if not isinstance(environment, dict) or set(environment) != environment_keys:
            issues.append(f"{item_label}.environment must contain exactly {', '.join(sorted(environment_keys))}")
            environment = {}
        elif any(value is not None and (not isinstance(value, str) or len(value) > 120) for value in environment.values()):
            issues.append(f"{item_label}.environment values must be bounded strings or null")
        if record.get("proofLevel") == "browser" and any(not environment.get(key) for key in ("browser", "browserVersion", "viewport")):
            issues.append(f"{item_label}: browser proof requires browser, browserVersion, and viewport")
        if record.get("proofLevel") in {"build", "runtime", "install", "deployment"} and not environment.get("runtime"):
            issues.append(f"{item_label}: executable proof requires environment.runtime")
        claims = record.get("claims")
        if not isinstance(claims, list) or len(claims) > 10 or len(claims) != len(set(claims)) or any(claim not in EVIDENCE_CLAIMS for claim in claims):
            issues.append(f"{item_label}.claims is invalid")
        else:
            proof_level = record.get("proofLevel")
            if claims and record.get("exitStatus") != 0:
                issues.append(f"{item_label}: claim-bearing passing evidence requires exitStatus 0")
            for claim in claims:
                if proof_level not in CLAIM_PROOF_LEVELS[claim]:
                    allowed = ", ".join(sorted(CLAIM_PROOF_LEVELS[claim]))
                    issues.append(f"{item_label}: claim {claim} requires proofLevel {allowed}")
        coverage = record.get("coverage", [])
        if not isinstance(coverage, list) or len(coverage) > 50 or len(coverage) != len(set(coverage)) or any(not isinstance(item, str) or not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,79}", item) for item in coverage):
            issues.append(f"{item_label}.coverage must be a unique bounded taxonomy list")
        finding_refs = record.get("findingRefs", [])
        if not isinstance(finding_refs, list) or len(finding_refs) > 50 or len(finding_refs) != len(set(finding_refs)) or any(not isinstance(item, str) or not PORTABLE_ID.fullmatch(item) for item in finding_refs):
            issues.append(f"{item_label}.findingRefs is invalid")
        rounds = record.get("rounds", [])
        if not isinstance(rounds, list) or len(rounds) > 3 or len(rounds) != len(set(rounds)) or any(item not in {1, 2, 3} for item in rounds):
            issues.append(f"{item_label}.rounds is invalid")
        attestation = record.get("attestation")
        attestation_keys = {"issuer", "method", "startedAt", "completedAt", "toolVersion", "transcriptSha256"}
        if registry.get("schemaVersion") == "1.1":
            if not isinstance(attestation, dict) or set(attestation) != attestation_keys:
                issues.append(f"{item_label}.attestation must contain exactly {', '.join(sorted(attestation_keys))}")
            else:
                if not isinstance(attestation.get("issuer"), str) or not 3 <= len(attestation["issuer"]) <= 120:
                    issues.append(f"{item_label}.attestation.issuer is invalid")
                if attestation.get("method") not in {"command", "browser", "expert-review"}:
                    issues.append(f"{item_label}.attestation.method is invalid")
                started_issue = parse_instant(attestation.get("startedAt"), f"{item_label}.attestation.startedAt")
                completed_issue = parse_instant(attestation.get("completedAt"), f"{item_label}.attestation.completedAt")
                if started_issue:
                    issues.append(started_issue)
                if completed_issue:
                    issues.append(completed_issue)
                if not started_issue and not completed_issue and attestation["completedAt"] < attestation["startedAt"]:
                    issues.append(f"{item_label}.attestation completes before it starts")
                if not isinstance(attestation.get("toolVersion"), str) or not 1 <= len(attestation["toolVersion"]) <= 120:
                    issues.append(f"{item_label}.attestation.toolVersion is invalid")
                if not SHA256.fullmatch(str(attestation.get("transcriptSha256", ""))):
                    issues.append(f"{item_label}.attestation.transcriptSha256 is invalid")
        if parse_instant(record.get("capturedAt"), f"{item_label}.capturedAt"):
            issues.append(parse_instant(record.get("capturedAt"), f"{item_label}.capturedAt"))
        limitations = record.get("limitations")
        if not isinstance(limitations, list) or len(limitations) > 20 or any(not isinstance(item, str) or not 3 <= len(item) <= 240 for item in limitations):
            issues.append(f"{item_label}.limitations must be a bounded string list")
        digest = record.get("sha256")
        if digest is not None and not SHA256.fullmatch(str(digest)):
            issues.append(f"{item_label}.sha256 is invalid")
        locator = record.get("locator")
        if not isinstance(locator, str) or not locator or len(locator) > 500:
            issues.append(f"{item_label}.locator is invalid")
            continue
        if "://" not in locator:
            normalized, path_issues = portable_relative_path(locator, f"{item_label}.locator")
            issues.extend(path_issues)
            if verify_files and normalized:
                target = (path.parent / normalized).resolve()
                boundary = (allowed_root or path.parent).resolve()
                if boundary not in target.parents:
                    issues.append(f"{item_label}: evidence locator escapes the allowed evidence root")
                elif digest is None:
                    issues.append(f"{item_label}: local evidence requires sha256 when file verification is enabled")
                elif not target.is_file():
                    issues.append(f"{item_label}: hashed evidence file is missing")
                elif sha256_file(target) != digest:
                    issues.append(f"{item_label}: evidence hash mismatch")
                else:
                    attestation_issues = validate_attestation_receipt(record, target, source_root, item_label)
                    issues.extend(attestation_issues)
                    if not attestation_issues:
                        record["_attestationVerified"] = True
                        receipt_value = read_json(target)
                        record["_attestationRunner"] = receipt_value.get("runner", {}).get("name") if isinstance(receipt_value, dict) else None
    for record_id, record in records.items():
        supersedes = record.get("supersedes")
        if supersedes is not None and supersedes not in records:
            issues.append(f"{label}: {record_id} supersedes missing record {supersedes}")
        if supersedes == record_id:
            issues.append(f"{label}: {record_id} cannot supersede itself")
    return records, issues


def usable_evidence(record: dict | None) -> bool:
    return bool(
        record
        and record.get("status") == "active"
        and record.get("result") == "pass"
        and isinstance(record.get("sha256"), str)
        and SHA256.fullmatch(record["sha256"])
        and isinstance(record.get("locator"), str)
        and "://" not in record["locator"]
        and isinstance(record.get("postCondition"), str)
        and record["postCondition"].strip()
        and record.get("exitStatus") == 0
        and isinstance(record.get("coverage"), list)
        and isinstance(record.get("findingRefs"), list)
        and isinstance(record.get("rounds"), list)
        and isinstance(record.get("attestation"), dict)
        and record.get("_attestationVerified") is True
        and SHA256.fullmatch(str(record.get("attestation", {}).get("transcriptSha256", "")))
        and all(record.get("proofLevel") in CLAIM_PROOF_LEVELS.get(claim, set()) for claim in record.get("claims", []))
    )


def doctor_project(contract_path: Path) -> dict:
    contract = read_json(contract_path)
    issues = validate_project_contract(contract, str(contract_path))
    holds = list(issues)
    warnings = []
    if issues:
        return {"ok": False, "status": "hold", "contract": str(contract_path), "holds": holds, "warnings": warnings}
    root = contract_path.parent.resolve()
    paths = {key: (root / value.replace("\\", "/")).resolve() for key, value in contract["paths"].items()}
    for key, resolved in paths.items():
        if root not in resolved.parents and resolved != root:
            holds.append(f"paths.{key}: resolved path escapes the project root")
    for key in ("dna", "evidenceRegistry"):
        if not paths[key].is_file():
            holds.append(f"paths.{key}: linked file is missing")
    if not paths["evidenceRoot"].is_dir():
        holds.append("paths.evidenceRoot: linked directory is missing")
    resolved_lineage = None
    if paths["dna"].is_file():
        dna = read_json(paths["dna"])
        holds.extend(validate_dna(dna, str(paths["dna"])))
        if dna.get("id") != contract["project"]["id"]:
            holds.append("project.id does not match DNA id")
        if dna.get("lineage"):
            try:
                resolved_lineage = resolve_lineage(paths["dna"])["lock"]
            except ValidationError as exc:
                holds.extend(str(exc).splitlines())
    if paths["evidenceRegistry"].is_file():
        records, evidence_issues = validate_evidence_registry(
            paths["evidenceRegistry"], verify_files=True, allowed_root=paths["evidenceRoot"], source_root=root
        )
        holds.extend(evidence_issues)
        registry = read_json(paths["evidenceRegistry"])
        if registry.get("productId") != contract["project"]["id"]:
            holds.append("project.id does not match evidence registry productId")
    else:
        records = {}
    if not paths["tokenOutput"].is_file():
        message = "paths.tokenOutput: compiled token output is missing"
        (holds if contract["state"] == "ready" else warnings).append(message)
    elif paths["dna"].is_file():
        token_output = paths["tokenOutput"].read_text(encoding="utf-8", errors="replace")
        source_marker = f"source-sha256: {sha256_file(paths['dna'])}"
        expected_lineage_hash = hashlib.sha256(canonical_json(resolved_lineage).encode("utf-8")).hexdigest() if resolved_lineage else "none"
        lineage_marker = f"lineage-lock-sha256: {expected_lineage_hash}"
        if source_marker not in token_output:
            holds.append("paths.tokenOutput: compiled output is stale for the current DNA source")
        if lineage_marker not in token_output:
            holds.append("paths.tokenOutput: compiled output is stale for the current lineage lock")
    if contract["state"] != "ready":
        holds.append(f"contract state is {contract['state']}, not ready")
    return {
        "ok": not holds,
        "status": "ready" if not holds else "hold",
        "contract": str(contract_path),
        "productId": contract["project"]["id"],
        "evidenceRecords": len(records),
        "holds": holds,
        "warnings": warnings,
    }


def write_json_new_or_same(path: Path, value: dict) -> str:
    content = f"{json.dumps(value, ensure_ascii=False, indent=2)}\n"
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        if path.read_text(encoding="utf-8") == content:
            return "unchanged"
        raise ValidationError(f"refusing to overwrite existing file with different content: {path}")
    path.write_text(content, encoding="utf-8", newline="\n")
    return "created"


def init_project(target: Path, product_id: str, name: str, domain: str, owner: str, confirm_create: bool) -> dict:
    if not confirm_create:
        raise ValidationError("--confirm-create is required")
    if not PRODUCT_ID.fullmatch(product_id):
        raise ValidationError("product id is invalid")
    root = target.resolve()
    plugin_root = Path(__file__).resolve().parents[1]
    contract = copy.deepcopy(read_json(plugin_root / "data" / "templates" / "project-contract.json"))
    dna = copy.deepcopy(read_json(plugin_root / "data" / "templates" / "product-dna.json"))
    evidence = copy.deepcopy(read_json(plugin_root / "data" / "templates" / "evidence-registry.json"))
    contract["project"] = {"id": product_id, "name": name, "domain": domain, "owner": owner}
    dna.update({"id": product_id, "name": name, "domain": domain})
    evidence["productId"] = product_id
    contract_path = root / "kgj.design.json"
    dna_path = root / contract["paths"]["dna"]
    evidence_path = root / contract["paths"]["evidenceRegistry"]
    existing = [str(path) for path in (contract_path, dna_path, evidence_path) if path.exists()]
    if existing:
        raise ValidationError(f"initialization refuses existing contract sources: {', '.join(existing)}")
    root.mkdir(parents=True, exist_ok=True)
    (root / contract["paths"]["evidenceRoot"]).mkdir(parents=True, exist_ok=True)
    statuses = {
        str(contract_path): write_json_new_or_same(contract_path, contract),
        str(dna_path): write_json_new_or_same(dna_path, dna),
        str(evidence_path): write_json_new_or_same(evidence_path, evidence),
    }
    return {"ok": True, "status": "draft", "root": str(root), "created": statuses, "next": "replace template assumptions, add evidence, compile tokens, then set the contract to ready"}


def version_tuple(value: str) -> tuple[int, ...]:
    try:
        return tuple(int(part) for part in value.split("."))
    except (AttributeError, ValueError):
        return ()


def override_allowed(qualified: str, patterns: list[str]) -> bool:
    return any(pattern == qualified or (pattern.endswith(".*") and qualified.startswith(pattern[:-1])) for pattern in patterns)


def resolve_lineage(source: Path, target: Path | None = None) -> dict:
    if source.is_symlink():
        raise ValidationError("lineage source cannot be a symlink")
    source = source.resolve()
    lineage_root = source.parent
    ancestors: dict[str, dict] = {}

    def visit(path: Path, stack: tuple[Path, ...]) -> tuple[dict, list[str]]:
        if path in stack:
            return {}, [f"lineage cycle detected at {path.name}"]
        if not path.is_file():
            return {}, [f"lineage parent is missing: {path.name}"]
        value = read_json(path)
        issues = validate_dna(value, path.name)
        lineage = value.get("lineage")
        if not lineage:
            return value, issues
        parent_values = []
        for parent in lineage["parents"]:
            normalized, path_issues = portable_relative_path(parent["path"], f"{path.name}: parent path")
            issues.extend(path_issues)
            if not normalized:
                continue
            parent_candidate = path.parent / normalized
            parent_path = parent_candidate.resolve()
            if lineage_root not in parent_path.parents or parent_candidate.is_symlink():
                issues.append(f"{path.name}: lineage parent escapes the lineage root or is a symlink")
                continue
            parent_value, parent_issues = visit(parent_path, (*stack, path))
            issues.extend(parent_issues)
            if not parent_value:
                continue
            if parent_value.get("id") != parent["id"]:
                issues.append(f"{path.name}: declared parent {parent['id']} does not match {parent_value.get('id')}")
            if version_tuple(parent_value.get("schemaVersion")) < version_tuple(parent["minSchemaVersion"]):
                issues.append(f"{path.name}: parent {parent['id']} is below minimum schema version")
            digest = sha256_file(parent_path)
            prior = ancestors.get(parent["id"])
            record = {"id": parent["id"], "path": parent["path"], "schemaVersion": parent_value.get("schemaVersion"), "sha256": digest}
            if prior and prior["sha256"] != digest:
                issues.append(f"{path.name}: diamond lineage conflict for {parent['id']}")
            ancestors[parent["id"]] = record
            parent_values.append((parent, parent_value))
        merged = {layer: {} for layer in TOKEN_LAYERS}
        for parent, parent_value in parent_values:
            for layer in TOKEN_LAYERS:
                for name, token in parent_value["tokens"][layer].items():
                    current = merged[layer].get(name)
                    if current is not None and canonical_json(current) != canonical_json(token):
                        issues.append(f"{path.name}: parent token conflict at {layer}.{name}")
                    else:
                        merged[layer][name] = token
        allowed = lineage["allowedOverrides"]
        for layer in TOKEN_LAYERS:
            for name, parent_token in merged[layer].items():
                qualified = f"{layer}.{name}"
                child_token = value["tokens"][layer].get(name)
                if child_token is None:
                    issues.append(f"{path.name}: inherited token removed at {qualified}")
                elif canonical_json(child_token) != canonical_json(parent_token):
                    if layer == "semantic":
                        issues.append(f"{path.name}: forbidden semantic override at {qualified}")
                    elif not override_allowed(qualified, allowed):
                        issues.append(f"{path.name}: undeclared override at {qualified}")
        return value, issues

    child, issues = visit(source, ())
    if not child.get("lineage"):
        issues.append(f"{source.name}: no lineage declaration")
    if issues:
        raise ValidationError("\n".join(dict.fromkeys(issues)))
    lock = {
        "schemaVersion": "1.0",
        "policy": "semantic-contract",
        "child": {"id": child["id"], "path": source.name, "schemaVersion": child["schemaVersion"], "sha256": sha256_file(source)},
        "ancestors": [ancestors[key] for key in sorted(ancestors)],
        "resolvedTokenHash": hashlib.sha256(canonical_json(child["tokens"]).encode("utf-8")).hexdigest(),
        "status": "resolved",
    }
    write_status = write_json_new_or_same(target.resolve(), lock) if target else None
    return {"ok": True, "lock": lock, "writeStatus": write_status, "output": str(target.resolve()) if target else None}


def flatten_tokens(value: dict) -> dict[str, dict]:
    return {f"{layer}.{name}": token for layer in TOKEN_LAYERS for name, token in value["tokens"][layer].items()}


def genome_fingerprint(value: dict) -> str | None:
    genome = value.get("genome")
    if not isinstance(genome, dict) or set(genome) != GENOME_KEYS:
        return None
    return hashlib.sha256(canonical_json(genome).encode("utf-8")).hexdigest()


def resolved_ancestry(path: Path, value: dict) -> dict:
    lineage = value.get("lineage")
    if not lineage:
        basis = {"policy": None, "parents": [], "allowedOverrides": [], "ancestors": []}
    else:
        lock = resolve_lineage(path)["lock"]
        parents = sorted(
            ({"id": item["id"], "path": item["path"], "minSchemaVersion": item["minSchemaVersion"]} for item in lineage["parents"]),
            key=lambda item: (item["id"], item["path"], item["minSchemaVersion"]),
        )
        ancestors = sorted(lock["ancestors"], key=lambda item: (item["id"], item["path"], item["sha256"]))
        basis = {
            "policy": lineage["policy"],
            "parents": parents,
            "allowedOverrides": sorted(lineage["allowedOverrides"]),
            "ancestors": ancestors,
        }
    return {**basis, "ancestrySha256": hashlib.sha256(canonical_json(basis).encode("utf-8")).hexdigest()}


def append_change(changes: list[dict], path: str, change: str, classification: str, before=None, after=None) -> None:
    item = {"path": path, "change": change, "classification": classification}
    if before is not None:
        item["beforeSha256"] = hashlib.sha256(canonical_json(before).encode("utf-8")).hexdigest()
    if after is not None:
        item["afterSha256"] = hashlib.sha256(canonical_json(after).encode("utf-8")).hexdigest()
    changes.append(item)


def diff_dna(current_path: Path, next_path: Path) -> dict:
    current = read_json(current_path)
    next_value = read_json(next_path)
    issues = validate_dna(current, str(current_path)) + validate_dna(next_value, str(next_path))
    if issues:
        raise ValidationError("\n".join(issues))
    before = flatten_tokens(current)
    after = flatten_tokens(next_value)
    current_ancestry = resolved_ancestry(current_path.resolve(), current)
    next_ancestry = resolved_ancestry(next_path.resolve(), next_value)
    changes: list[dict] = []
    if current["id"] != next_value["id"]:
        append_change(changes, "id", "changed", "product-identity-change", current["id"], next_value["id"])
    for key in sorted(set(before) | set(after)):
        if key not in before:
            classification = "compatible-addition"
            change = "added"
        elif key not in after:
            classification = "breaking"
            change = "removed"
        elif canonical_json(before[key]) == canonical_json(after[key]):
            continue
        else:
            layer = key.split(".", 1)[0]
            classification = "breaking" if layer in {"semantic", "component"} or before[key].get("$type") != after[key].get("$type") else "expression-change"
            change = "changed"
        append_change(changes, f"tokens.{key}", change, classification, before.get(key), after.get(key))
    for field in ("schemaVersion", "name", "domain", "audience", "jobs", "character", "avoid", "traits", "signatureMoment"):
        if canonical_json(current.get(field)) != canonical_json(next_value.get(field)):
            append_change(changes, field, "changed", "product-context-change", current.get(field), next_value.get(field))
    if canonical_json(current.get("evidence")) != canonical_json(next_value.get("evidence")):
        append_change(changes, "evidence", "changed", "provenance-change", current.get("evidence"), next_value.get("evidence"))
    if genome_fingerprint(current) is None or genome_fingerprint(next_value) is None:
        append_change(changes, "genome", "unscoped", "genome-unscoped", current.get("genome"), next_value.get("genome"))
    else:
        for key in sorted(GENOME_KEYS):
            if canonical_json(current["genome"][key]) != canonical_json(next_value["genome"][key]):
                append_change(changes, f"genome.{key}", "changed", "genome-change", current["genome"][key], next_value["genome"][key])
    for key in ("policy", "parents"):
        if canonical_json(current_ancestry[key]) != canonical_json(next_ancestry[key]):
            append_change(changes, f"lineage.{key}", "changed", "lineage-contract-change", current_ancestry[key], next_ancestry[key])
    if canonical_json(current_ancestry["allowedOverrides"]) != canonical_json(next_ancestry["allowedOverrides"]):
        append_change(changes, "lineage.allowedOverrides", "changed", "lineage-governance-change", current_ancestry["allowedOverrides"], next_ancestry["allowedOverrides"])
    if current_ancestry["ancestrySha256"] != next_ancestry["ancestrySha256"] and canonical_json(current_ancestry["parents"]) == canonical_json(next_ancestry["parents"]):
        append_change(changes, "lineage.ancestors", "changed", "lineage-source-change", current_ancestry["ancestors"], next_ancestry["ancestors"])
    classifications = {item["classification"] for item in changes}
    breaking = sum(1 for item in changes if item["classification"] in BREAKING_CHANGE_CLASSES)
    review_required = sum(1 for item in changes if item["classification"] in REVIEW_CHANGE_CLASSES)
    compatibility = "breaking" if classifications & BREAKING_CHANGE_CLASSES else "review-required" if changes else "compatible"
    return {
        "ok": True,
        "from": {"id": current["id"], "schemaVersion": current["schemaVersion"], "sourceSha256": sha256_file(current_path), "genomeSha256": genome_fingerprint(current), "ancestrySha256": current_ancestry["ancestrySha256"]},
        "to": {"id": next_value["id"], "schemaVersion": next_value["schemaVersion"], "sourceSha256": sha256_file(next_path), "genomeSha256": genome_fingerprint(next_value), "ancestrySha256": next_ancestry["ancestrySha256"]},
        "compatibility": compatibility,
        "counts": {
            "changes": len(changes),
            "breaking": breaking,
            "reviewRequired": review_required,
            "genome": sum(1 for item in changes if item["path"].startswith("genome")),
            "lineage": sum(1 for item in changes if item["path"].startswith("lineage")),
        },
        "changes": changes,
    }


def migration_plan(
    current_path: Path,
    next_path: Path,
    target: Path | None = None,
    evidence_registry_path: Path | None = None,
    evidence_refs: list[str] | None = None,
    owner: str | None = None,
    rollback_target: str | None = None,
) -> dict:
    difference = diff_dna(current_path, next_path)
    breaking_paths = [item["path"] for item in difference["changes"] if item["classification"] in BREAKING_CHANGE_CLASSES]
    review_paths = [item["path"] for item in difference["changes"] if item["classification"] in REVIEW_CHANGE_CLASSES]
    genome_paths = [item["path"] for item in difference["changes"] if item["path"].startswith("genome")]
    lineage_paths = [item["path"] for item in difference["changes"] if item["path"].startswith("lineage")]
    refs = list(evidence_refs or [])
    hold_reasons = []
    verified_claims = set()
    if breaking_paths:
        hold_reasons.append("breaking product, token, or lineage contract paths require an explicit compatibility redesign")
    if difference["from"]["id"] != difference["to"]["id"]:
        hold_reasons.append("migration requires the same product identity; parent-child adoption is a separate workflow")
    if difference["from"]["genomeSha256"] is None or difference["to"]["genomeSha256"] is None:
        hold_reasons.append("both DNA versions must use schemaVersion 1.2 with a closed genome before canary release")
    if not isinstance(owner, str) or not 2 <= len(owner.strip()) <= 80:
        hold_reasons.append("a bounded migration owner is required")
    if not isinstance(rollback_target, str) or not 3 <= len(rollback_target.strip()) <= 240:
        hold_reasons.append("a concrete rollback target is required")
    if len(refs) != len(set(refs)):
        hold_reasons.append("evidence references must be unique")
    if not evidence_registry_path:
        hold_reasons.append("a verified evidence registry is required")
    elif not refs:
        hold_reasons.append("at least one evidence reference is required")
    else:
        records, registry_issues = validate_evidence_registry(evidence_registry_path, verify_files=True, source_root=evidence_registry_path.parent)
        if registry_issues:
            raise ValidationError("\n".join(registry_issues))
        for ref in refs:
            record = records.get(ref)
            if record is None:
                hold_reasons.append(f"migration evidence reference is missing: {ref}")
            elif not usable_evidence(record):
                hold_reasons.append(f"migration evidence is not usable: {ref}")
            else:
                verified_claims.update(record.get("claims", []))
        missing_claims = sorted(MIGRATION_REQUIRED_CLAIMS - verified_claims)
        if missing_claims:
            hold_reasons.append(f"migration evidence claims are missing: {', '.join(missing_claims)}")
    plan = {
        "schemaVersion": "1.1",
        "migrationId": f"{difference['from']['id']}-{difference['from']['sourceSha256'][:12]}-to-{difference['to']['sourceSha256'][:12]}",
        "compatibility": difference["compatibility"],
        "fingerprints": {
            "from": {"source": difference["from"]["sourceSha256"], "genome": difference["from"]["genomeSha256"], "ancestry": difference["from"]["ancestrySha256"]},
            "to": {"source": difference["to"]["sourceSha256"], "genome": difference["to"]["genomeSha256"], "ancestry": difference["to"]["ancestrySha256"]},
        },
        "breakingPaths": breaking_paths,
        "reviewPaths": review_paths,
        "genomePaths": genome_paths,
        "lineagePaths": lineage_paths,
        "stages": [
            {"stage": "convert", "requirement": "Generate the new token and contract shape without mutating the current release."},
            {"stage": "preserve", "requirement": "Run existing behavior, accessibility, locale, and data-truth regressions against both versions."},
            {"stage": "differentiate", "requirement": "Probe changed and hidden states, then record counterexamples and product-specific exceptions."},
            {"stage": "canary", "requirement": "Adopt in one bounded surface with a rollback owner and measured acceptance criteria."},
        ],
        "requiredEvidence": sorted(MIGRATION_REQUIRED_CLAIMS),
        "evidenceRefs": refs,
        "verifiedClaims": sorted(verified_claims),
        "owner": owner,
        "rollbackTarget": rollback_target,
        "holdReasons": hold_reasons,
        "releaseDecision": "hold" if hold_reasons else "ready-for-canary",
    }
    write_status = write_json_new_or_same(target.resolve(), plan) if target else None
    return {"ok": True, "plan": plan, "writeStatus": write_status, "output": str(target.resolve()) if target else None}


def validate_pattern_candidate(path: Path, evidence_registry_path: Path | None = None) -> dict:
    value = read_json(path)
    issues = []
    if not isinstance(value, dict) or set(value) != PATTERN_KEYS:
        issues.append(f"pattern must contain exactly {', '.join(sorted(PATTERN_KEYS))}")
    if value.get("schemaVersion") != "1.0":
        issues.append("pattern schemaVersion must be 1.0")
    if not PATTERN_ID.fullmatch(str(value.get("id", ""))):
        issues.append("pattern id is invalid")
    for key, maximum in (("name", 100), ("owner", 80)):
        field = value.get(key)
        if not isinstance(field, str) or not 2 <= len(field.strip()) <= maximum:
            issues.append(f"pattern {key} is invalid")
    scope = value.get("scope")
    if not isinstance(scope, list) or not 1 <= len(scope) <= 20 or any(not isinstance(item, str) or not 1 <= len(item) <= 120 for item in scope):
        issues.append("pattern scope must contain 1-20 bounded strings")
    stage = value.get("stage")
    if stage not in PATTERN_STAGES:
        issues.append("pattern stage is invalid")
    criteria = value.get("criteria")
    if not isinstance(criteria, dict) or set(criteria) != PATTERN_CRITERIA or any(result not in {"pass", "hold", "fail"} for result in criteria.values()):
        issues.append("pattern criteria must contain exactly six pass, hold, or fail values")
    refs = value.get("evidenceRefs")
    if not isinstance(refs, list) or len(refs) > 50 or len(refs) != len(set(refs)):
        issues.append("pattern evidenceRefs must be a unique bounded list")
        refs = []
    if stage == "stable" and (not criteria or any(result != "pass" for result in criteria.values()) or len(refs) < 2):
        issues.append("stable patterns require six passing criteria and at least two evidence records")
    if stage == "stable" and evidence_registry_path is None:
        issues.append("stable patterns require --evidence-registry with verified local evidence")
    migration = value.get("migration")
    if not isinstance(migration, dict):
        issues.append("pattern migration must be an object")
    else:
        if set(migration) != MIGRATION_KEYS:
            issues.append(f"pattern migration must contain exactly {', '.join(sorted(MIGRATION_KEYS))}")
        replacement = migration.get("replacement")
        deadline = migration.get("deadline")
        notes = migration.get("notes")
        if replacement is not None and (not isinstance(replacement, str) or len(replacement) > 120):
            issues.append("pattern migration replacement is invalid")
        if deadline is not None:
            try:
                datetime.strptime(deadline, "%Y-%m-%d")
            except (TypeError, ValueError):
                issues.append("pattern migration deadline must be an ISO date")
        if not isinstance(notes, str) or len(notes) > 400:
            issues.append("pattern migration notes are invalid")
        if stage == "deprecated" and not (replacement or deadline):
            issues.append("deprecated patterns require a replacement or deadline")
        if stage == "removed" and not (replacement and deadline):
            issues.append("removed patterns require both a replacement and deadline")
    evidence_count = 0
    if evidence_registry_path:
        records, registry_issues = validate_evidence_registry(evidence_registry_path, verify_files=True, source_root=evidence_registry_path.parent)
        issues.extend(registry_issues)
        for ref in refs:
            record = records.get(ref)
            if record is None:
                issues.append(f"pattern evidence reference is missing: {ref}")
            elif not usable_evidence(record):
                issues.append(f"pattern evidence reference is not usable: {ref}")
            else:
                evidence_count += 1
    if issues:
        raise ValidationError("\n".join(issues))
    return {"ok": True, "stage": stage, "criteria": criteria, "evidenceRecords": evidence_count if evidence_registry_path else len(refs), "binding": stage == "stable"}


def ledger_evidence_refs(ledger: dict) -> set[str]:
    refs = set()
    for item in ledger.get("rounds", []):
        if not isinstance(item, dict):
            continue
        for check in item.get("checks", []):
            if isinstance(check, dict) and isinstance(check.get("evidenceRef"), str):
                refs.add(check["evidenceRef"])
        for finding in item.get("findings", []):
            if isinstance(finding, dict) and isinstance(finding.get("evidenceRef"), str):
                refs.add(finding["evidenceRef"])
    for flow in ledger.get("coreFlows", []):
        if isinstance(flow, dict) and isinstance(flow.get("evidenceRef"), str):
            refs.add(flow["evidenceRef"])
    return refs


def derive_round_scores(round_item: dict) -> tuple[float, float]:
    findings = [item for item in round_item.get("findings", []) if isinstance(item, dict) and item.get("severity") in FINDING_PENALTIES]
    initial = max(0.0, 10.0 - sum(FINDING_PENALTIES[item["severity"]] for item in findings))
    unresolved = [item for item in findings if item.get("status") not in RESOLVED_FINDING_STATUSES]
    final = max(0.0, 10.0 - sum(FINDING_PENALTIES[item["severity"]] for item in unresolved))
    return round(initial, 3), round(final, 3)


def quality_gate(path: Path, evidence_registry_path: Path | None = None) -> dict:
    ledger = read_json(path)
    issues = []
    if not isinstance(ledger, dict):
        raise ValidationError("quality ledger must be an object")
    if set(ledger) != QUALITY_LEDGER_KEYS:
        issues.append(f"quality ledger must contain exactly {', '.join(sorted(QUALITY_LEDGER_KEYS))}")
    if ledger.get("schemaVersion") != QUALITY_SCHEMA_VERSION:
        issues.append(f"quality ledger schemaVersion must be {QUALITY_SCHEMA_VERSION}; legacy score inputs require conversion")
    if ledger.get("rubricVersion") != QUALITY_RUBRIC_VERSION:
        issues.append(f"quality ledger rubricVersion must be {QUALITY_RUBRIC_VERSION}")
    if not isinstance(ledger.get("artifact"), str) or not 1 <= len(ledger["artifact"].strip()) <= 160:
        issues.append("quality ledger artifact is invalid")
    if ledger.get("artifactType") not in {"codex-plugin", "web-experience", "html-report", "markdown-artifact"}:
        issues.append("quality ledger artifactType is invalid")
    if not isinstance(ledger.get("releaseTarget"), str) or not 3 <= len(ledger["releaseTarget"].strip()) <= 200:
        issues.append("quality ledger releaseTarget is invalid")
    if evidence_registry_path is None:
        issues.append("quality gate requires --evidence-registry with verified local evidence")
        records = {}
    else:
        registry_value = read_json(evidence_registry_path)
        if registry_value.get("schemaVersion") != "1.1":
            issues.append("quality gate requires evidence registry schemaVersion 1.1 with runner attestations")
        ledger_source_root = path.parent.parent if path.parent.name == "quality" else path.parent
        records, registry_issues = validate_evidence_registry(evidence_registry_path, verify_files=True, source_root=ledger_source_root)
        issues.extend(registry_issues)
    rounds = ledger.get("rounds")
    if not isinstance(rounds, list) or len(rounds) != 3:
        issues.append("quality ledger must contain exactly three rounds")
        rounds = rounds if isinstance(rounds, list) else []
    seen = set()
    weighted = 0.0
    open_blockers = []
    round_scores = []
    check_ref_rounds: dict[str, set[int]] = {}
    for item in rounds:
        if not isinstance(item, dict):
            issues.append("quality round must be an object")
            continue
        if set(item) != QUALITY_ROUND_KEYS:
            issues.append("quality round contains missing or unknown fields")
        number = item.get("round")
        if number in seen or number not in EXPECTED_WEIGHTS:
            issues.append(f"invalid or duplicate round: {number}")
            continue
        seen.add(number)
        weight = item.get("weight")
        rubric = QUALITY_RUBRIC[number]
        if not isinstance(weight, (int, float)) or abs(weight - rubric["weight"]) > 1e-9:
            issues.append(f"round {number}: weight must be {rubric['weight']}")
        if item.get("lens") != rubric["lens"]:
            issues.append(f"round {number}: lens must be {rubric['lens']}")
        checks = item.get("checks")
        if not isinstance(checks, list):
            issues.append(f"round {number}: checks must be a list")
            checks = []
        seen_checks = set()
        for check in checks:
            if not isinstance(check, dict) or set(check) != QUALITY_CHECK_KEYS:
                issues.append(f"round {number}: check contains missing or unknown fields")
                continue
            check_id = check.get("id")
            if check_id in seen_checks:
                issues.append(f"round {number}: duplicate check {check_id}")
                continue
            seen_checks.add(check_id)
            if check_id not in rubric["checks"]:
                issues.append(f"round {number}: unknown check {check_id}")
                continue
            ref = check.get("evidenceRef")
            if not isinstance(ref, str) or not PORTABLE_ID.fullmatch(ref):
                issues.append(f"round {number}: check {check_id} lacks an evidenceRef")
                continue
            check_ref_rounds.setdefault(ref, set()).add(number)
            record = records.get(ref)
            if record is None:
                issues.append(f"round {number}: check evidence is missing for {check_id}: {ref}")
                continue
            if not usable_evidence(record):
                issues.append(f"round {number}: check evidence is not usable for {check_id}: {ref}")
                continue
            if number in {1, 3} and record.get("_commandPlanVerified") is not True:
                issues.append(f"round {number}: check {check_id} requires a source-bound command evidence plan")
            if number == 2 and record.get("_browserReplayVerified") is not True:
                issues.append(f"round {number}: check {check_id} requires a command-bound KGJ browser replay envelope")
            proof_levels, required_coverage = rubric["checks"][check_id]
            if record.get("proofLevel") not in proof_levels:
                issues.append(f"round {number}: check {check_id} requires proofLevel {', '.join(sorted(proof_levels))}")
            if number not in record.get("rounds", []):
                issues.append(f"round {number}: evidence {ref} is not attested for this round")
            missing_coverage = sorted(required_coverage - set(record.get("coverage", [])))
            if missing_coverage:
                issues.append(f"round {number}: evidence {ref} lacks coverage for {check_id}: {', '.join(missing_coverage)}")
        expected_checks = set(rubric["checks"])
        if seen_checks != expected_checks:
            issues.append(f"round {number}: exact rubric checks required; missing {', '.join(sorted(expected_checks - seen_checks)) or 'none'}")
        findings = item.get("findings")
        if not isinstance(findings, list) or len(findings) > 200:
            issues.append(f"round {number}: findings must be a bounded list")
            findings = []
        for finding in findings:
            if not isinstance(finding, dict):
                issues.append(f"round {number}: finding must be an object")
                continue
            if not {"id", "severity", "status", "summary"}.issubset(finding) or set(finding) - QUALITY_FINDING_KEYS:
                issues.append(f"round {number}: finding contains missing or unknown fields")
            if not PORTABLE_ID.fullmatch(str(finding.get("id", ""))):
                issues.append(f"round {number}: finding id is invalid")
            if finding.get("severity") not in {"P0", "P1", "P2", "P3"}:
                issues.append(f"finding {finding.get('id', 'unnamed')}: severity is invalid")
            if finding.get("status") not in QUALITY_FINDING_STATUSES:
                issues.append(f"finding {finding.get('id', 'unnamed')}: status is invalid")
            if not isinstance(finding.get("summary"), str) or not 3 <= len(finding["summary"].strip()) <= 500:
                issues.append(f"finding {finding.get('id', 'unnamed')}: summary is invalid")
            if finding.get("severity") in {"P0", "P1"} and finding.get("status") not in RESOLVED_FINDING_STATUSES:
                open_blockers.append(finding.get("id", "unnamed"))
            if finding.get("status") in RESOLVED_FINDING_STATUSES:
                evidence_ref = finding.get("evidenceRef")
                evidence_record = records.get(evidence_ref) if isinstance(evidence_ref, str) else None
                if not usable_evidence(evidence_record):
                    issues.append(f"finding {finding.get('id', 'unnamed')}: resolved status lacks usable evidence")
                elif finding.get("id") not in evidence_record.get("findingRefs", []):
                    issues.append(f"finding {finding.get('id', 'unnamed')}: evidence does not bind this finding id")
            if finding.get("status") == "deferred" and not finding.get("owner"):
                issues.append(f"finding {finding.get('id', 'unnamed')}: deferred status lacks an owner")
        initial_score, final_score = derive_round_scores(item)
        round_scores.append({"round": number, "initialScore": initial_score, "finalScore": final_score})
        weighted += final_score * rubric["weight"]
    if seen != set(EXPECTED_WEIGHTS):
        issues.append("rounds 1, 2, and 3 are all required")
    for ref, ref_rounds in check_ref_rounds.items():
        if len(ref_rounds) > 1:
            issues.append(f"quality check evidence cannot be reused across rounds: {ref}")
    flows = ledger.get("coreFlows")
    if not isinstance(flows, list):
        issues.append("coreFlows must be a list")
        flows = []
    for flow in flows:
        if not isinstance(flow, dict) or set(flow) != QUALITY_FLOW_KEYS:
            issues.append("core flow contains missing or unknown fields")
            continue
        if not isinstance(flow.get("name"), str) or not 3 <= len(flow["name"].strip()) <= 180:
            issues.append("core flow name is invalid")
        ref = flow.get("evidenceRef")
        flow_record = records.get(ref)
        if not PORTABLE_ID.fullmatch(str(ref or "")) or not usable_evidence(flow_record):
            issues.append(f"core flow is not proven by usable evidence: {flow.get('name', 'unnamed')}")
        elif flow_record.get("attestation", {}).get("method") == "command" and flow_record.get("_commandPlanVerified") is not True:
            issues.append(f"core flow command evidence lacks a source-bound plan: {flow.get('name', 'unnamed')}")
        elif flow_record.get("attestation", {}).get("method") == "browser" and flow_record.get("_browserReplayVerified") is not True:
            issues.append(f"core flow browser evidence lacks KGJ replay: {flow.get('name', 'unnamed')}")
    if not flows:
        issues.append("at least one core flow is required")
    if open_blockers:
        issues.append(f"open P0/P1 findings: {', '.join(open_blockers)}")
    if weighted + 1e-9 < 9.9:
        issues.append(f"weighted score {weighted:.3f} is below 9.9")
    if issues:
        raise ValidationError("\n".join(issues))
    return {
        "ok": True,
        "status": "PASS",
        "rubricVersion": QUALITY_RUBRIC_VERSION,
        "rounds": 3,
        "roundScores": sorted(round_scores, key=lambda item: item["round"]),
        "weightedScore": round(weighted, 3),
        "openP0P1": 0,
        "coreFlows": len(ledger["coreFlows"]),
        "evidenceRecords": len(records),
        "checkedEvidenceRefs": sorted(ledger_evidence_refs(ledger)),
    }


def emit(value) -> None:
    print(json.dumps(value, ensure_ascii=False, indent=2))


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    validate_parser = subparsers.add_parser("validate")
    validate_parser.add_argument("root", type=Path)
    compile_parser = subparsers.add_parser("compile")
    compile_parser.add_argument("source", type=Path)
    compile_parser.add_argument("target", type=Path)
    compile_parser.add_argument("--lineage-lock", type=Path)
    hash_parser = subparsers.add_parser("tree-hash")
    hash_parser.add_argument("root", type=Path)
    install_audit_parser = subparsers.add_parser("install-audit")
    install_audit_parser.add_argument("source", type=Path)
    install_audit_parser.add_argument("cache", type=Path)
    install_audit_parser.add_argument("--package", type=Path)
    install_readback_parser = subparsers.add_parser("install-readback")
    install_readback_parser.add_argument("marketplace_source", type=Path)
    install_readback_parser.add_argument("cache", type=Path)
    install_readback_parser.add_argument("--package", type=Path, required=True)
    package_compare_parser = subparsers.add_parser("package-compare")
    package_compare_parser.add_argument("first", type=Path)
    package_compare_parser.add_argument("second", type=Path)
    browser_envelope_parser = subparsers.add_parser("browser-envelope")
    browser_envelope_parser.add_argument("--source", type=Path, required=True)
    browser_envelope_parser.add_argument("--browser-receipt", type=Path, required=True)
    browser_envelope_parser.add_argument("--execution-receipt", type=Path, required=True)
    browser_envelope_parser.add_argument("--output", type=Path, required=True)
    release_attest_parser = subparsers.add_parser("release-attest")
    release_attest_parser.add_argument("--source", type=Path, required=True)
    release_attest_parser.add_argument("--marketplace-source", type=Path, required=True)
    release_attest_parser.add_argument("--cache", type=Path, required=True)
    release_attest_parser.add_argument("--package", type=Path, required=True)
    release_attest_parser.add_argument("--ledger", type=Path, required=True)
    release_attest_parser.add_argument("--registry", type=Path, required=True)
    release_attest_parser.add_argument("--quality-receipt", type=Path, required=True)
    release_attest_parser.add_argument("--marketplace", type=Path, required=True)
    release_attest_parser.add_argument("--output", type=Path, required=True)
    release_verify_parser = subparsers.add_parser("release-verify")
    release_verify_parser.add_argument("attestation", type=Path)
    package_parser = subparsers.add_parser("package")
    package_parser.add_argument("root", type=Path)
    package_parser.add_argument("output", type=Path)
    quality_parser = subparsers.add_parser("quality")
    quality_parser.add_argument("ledger", type=Path)
    quality_parser.add_argument("--evidence-registry", type=Path, required=True)
    doctor_parser = subparsers.add_parser("doctor")
    doctor_parser.add_argument("contract", type=Path)
    init_parser = subparsers.add_parser("init-project")
    init_parser.add_argument("target", type=Path)
    init_parser.add_argument("--product-id", required=True)
    init_parser.add_argument("--name", required=True)
    init_parser.add_argument("--domain", required=True)
    init_parser.add_argument("--owner", required=True)
    init_parser.add_argument("--confirm-create", action="store_true")
    evidence_parser = subparsers.add_parser("evidence-check")
    evidence_parser.add_argument("registry", type=Path)
    evidence_parser.add_argument("--verify-files", action="store_true")
    evidence_parser.add_argument("--source-root", type=Path)
    lineage_parser = subparsers.add_parser("resolve-lineage")
    lineage_parser.add_argument("source", type=Path)
    lineage_parser.add_argument("--output", type=Path)
    diff_parser = subparsers.add_parser("diff-dna")
    diff_parser.add_argument("current", type=Path)
    diff_parser.add_argument("next", type=Path)
    migration_parser = subparsers.add_parser("migration-plan")
    migration_parser.add_argument("current", type=Path)
    migration_parser.add_argument("next", type=Path)
    migration_parser.add_argument("--output", type=Path)
    migration_parser.add_argument("--evidence-registry", type=Path)
    migration_parser.add_argument("--evidence-ref", action="append", default=[])
    migration_parser.add_argument("--owner")
    migration_parser.add_argument("--rollback-target")
    pattern_parser = subparsers.add_parser("pattern-check")
    pattern_parser.add_argument("candidate", type=Path)
    pattern_parser.add_argument("--evidence-registry", type=Path)
    args = parser.parse_args(argv)
    try:
        if args.command == "validate":
            emit(validate_plugin(args.root.resolve()))
        elif args.command == "compile":
            emit(compile_dna(args.source.resolve(), args.target.resolve(), args.lineage_lock.resolve() if args.lineage_lock else None))
        elif args.command == "tree-hash":
            digest, records = digest_tree(args.root.resolve())
            emit({"ok": True, "root": str(args.root.resolve()), "files": len(records), "treeHash": digest})
        elif args.command == "install-audit":
            emit(install_audit(args.source, args.cache, args.package))
        elif args.command == "install-readback":
            emit(install_readback(args.marketplace_source, args.cache, args.package))
        elif args.command == "package-compare":
            emit(compare_packages(args.first, args.second))
        elif args.command == "browser-envelope":
            emit(create_browser_evidence_envelope(args.source, args.browser_receipt, args.execution_receipt, args.output))
        elif args.command == "release-attest":
            emit(create_release_attestation(
                args.source,
                args.marketplace_source,
                args.cache,
                args.package,
                args.ledger,
                args.registry,
                args.quality_receipt,
                args.marketplace,
                args.output,
            ))
        elif args.command == "release-verify":
            emit(verify_release_attestation(args.attestation))
        elif args.command == "package":
            emit(package_plugin(args.root, args.output))
        elif args.command == "quality":
            emit(quality_gate(args.ledger.resolve(), args.evidence_registry.resolve() if args.evidence_registry else None))
        elif args.command == "doctor":
            emit(doctor_project(args.contract.resolve()))
        elif args.command == "init-project":
            emit(init_project(args.target, args.product_id, args.name, args.domain, args.owner, args.confirm_create))
        elif args.command == "evidence-check":
            records, issues = validate_evidence_registry(
                args.registry.resolve(),
                verify_files=args.verify_files,
                source_root=args.source_root.resolve() if args.source_root else None,
            )
            if issues:
                raise ValidationError("\n".join(issues))
            emit({"ok": True, "registry": str(args.registry.resolve()), "records": len(records), "verifiedFiles": args.verify_files})
        elif args.command == "resolve-lineage":
            emit(resolve_lineage(args.source, args.output))
        elif args.command == "diff-dna":
            emit(diff_dna(args.current.resolve(), args.next.resolve()))
        elif args.command == "migration-plan":
            emit(migration_plan(
                args.current.resolve(),
                args.next.resolve(),
                args.output,
                args.evidence_registry.resolve() if args.evidence_registry else None,
                args.evidence_ref,
                args.owner,
                args.rollback_target,
            ))
        elif args.command == "pattern-check":
            emit(validate_pattern_candidate(args.candidate.resolve(), args.evidence_registry.resolve() if args.evidence_registry else None))
        return 0
    except ValidationError as exc:
        print(f"KGJ_VALIDATION_ERROR\n{exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Create, validate, and extend project-local Canvas experience records."""

from __future__ import annotations

import argparse
import json
import math
import sys
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "assets" / "templates" / "canvas-experience-spec.json"
REQUIRED_TOP_LEVEL = {
    "schemaVersion",
    "project",
    "intent",
    "productDNA",
    "design",
    "architecture",
    "accessibility",
    "qualityGate",
    "learnings",
}
CONCEPT_IDS = {"aligned", "stretch", "frontier"}
QUALITY_ROUNDS = [
    "architecture-security",
    "browser-ux-a11y-performance",
    "reproducibility-package-install",
]
EVIDENCE_LEVELS = {"static", "build", "runtime", "browser", "deployment"}
RECEIPT_SCHEMA_VERSION = "one-call-receipt/1.0"
REQUIRED_STAGE_IDS = ["plan", "design", "implement", "verify", "package", "learn"]
REQUIRED_CORE_CLAIM_IDS = {
    "ontology-valid",
    "concept-fidelity",
    "build-valid",
    "runtime-load",
    "browser-primary",
    "browser-mobile",
    "browser-keyboard",
    "browser-fallback",
    "browser-console-clean",
    "package-valid",
}


def read_object(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"Cannot read JSON from {path}: {error}") from error
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object in {path}")
    return value


def write_object(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def validate_spec(data: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    missing = REQUIRED_TOP_LEVEL - data.keys()
    if missing:
        errors.append(f"missing top-level keys: {', '.join(sorted(missing))}")
    if data.get("schemaVersion") != "1.0":
        errors.append("schemaVersion must be 1.0")

    project = data.get("project")
    if not isinstance(project, dict):
        errors.append("project must be an object")
    else:
        for key in ("name", "domain", "createdAt"):
            if not isinstance(project.get(key), str) or not project[key].strip():
                errors.append(f"project.{key} must be a non-empty string")

    design = data.get("design")
    if not isinstance(design, dict):
        errors.append("design must be an object")
    else:
        concepts = design.get("concepts")
        ids = {
            item.get("id")
            for item in concepts
            if isinstance(item, dict)
        } if isinstance(concepts, list) else set()
        if ids != CONCEPT_IDS:
            errors.append("design.concepts must contain exactly aligned, stretch, and frontier")
        if not isinstance(design.get("fidelityLedger"), list):
            errors.append("design.fidelityLedger must be an array")

    architecture = data.get("architecture")
    if not isinstance(architecture, dict):
        errors.append("architecture must be an object")
    else:
        budgets = architecture.get("budgets")
        if not isinstance(budgets, dict):
            errors.append("architecture.budgets must be an object")
        else:
            for key in ("desktopFrameMs", "mobileFrameMs", "desktopDprMax", "mobileDprMax"):
                value = budgets.get(key)
                if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value) or value <= 0:
                    errors.append(f"architecture.budgets.{key} must be a positive finite number")

    gate = data.get("qualityGate")
    if not isinstance(gate, dict):
        errors.append("qualityGate must be an object")
    else:
        if gate.get("rounds") != QUALITY_ROUNDS:
            errors.append("qualityGate.rounds must contain the exact three governed rounds")
        if not isinstance(gate.get("threshold"), (int, float)) or gate["threshold"] < 99:
            errors.append("qualityGate.threshold must be at least 99")
        if gate.get("openP0") != 0 or gate.get("openP1") != 0:
            errors.append("qualityGate openP0 and openP1 must both be 0")

    learnings = data.get("learnings")
    if not isinstance(learnings, list):
        errors.append("learnings must be an array")
    else:
        for index, learning in enumerate(learnings):
            if not isinstance(learning, dict):
                errors.append(f"learnings[{index}] must be an object")
                continue
            for key in ("observation", "decision", "evidence", "confidence", "reuseBoundary"):
                if key not in learning:
                    errors.append(f"learnings[{index}] missing {key}")
            confidence = learning.get("confidence")
            if not isinstance(confidence, (int, float)) or isinstance(confidence, bool) or not 0 <= confidence <= 1:
                errors.append(f"learnings[{index}].confidence must be from 0 to 1")
            if not isinstance(learning.get("evidence"), list) or not learning.get("evidence"):
                errors.append(f"learnings[{index}].evidence must be a non-empty array")
            if not str(learning.get("reuseBoundary", "")).strip():
                errors.append(f"learnings[{index}].reuseBoundary must be non-empty")
    return errors


def validate_receipt(data: dict[str, Any], base: Path, allow_learning_pending: bool = False) -> list[str]:
    """Validate a fail-closed one-call receipt and its local evidence graph."""
    errors: list[str] = []
    required = {
        "schemaVersion", "runId", "project", "startedAt", "endedAt", "stages",
        "commands", "evidence", "claims", "substitutions", "unresolvedRequiredProof", "gate",
    }
    missing = required - data.keys()
    if missing:
        errors.append(f"receipt missing top-level keys: {', '.join(sorted(missing))}")
    if data.get("schemaVersion") != RECEIPT_SCHEMA_VERSION:
        errors.append(f"receipt schemaVersion must be {RECEIPT_SCHEMA_VERSION}")
    for key in ("runId", "project", "startedAt", "endedAt"):
        if not isinstance(data.get(key), str) or not data[key].strip():
            errors.append(f"receipt.{key} must be a non-empty string")

    commands = data.get("commands")
    command_by_id: dict[str, dict[str, Any]] = {}
    if not isinstance(commands, list) or not commands:
        errors.append("receipt.commands must be a non-empty array")
    else:
        for index, command in enumerate(commands):
            if not isinstance(command, dict):
                errors.append(f"receipt.commands[{index}] must be an object")
                continue
            command_id = command.get("id")
            if not isinstance(command_id, str) or not command_id.strip():
                errors.append(f"receipt.commands[{index}].id must be non-empty")
                continue
            if command_id in command_by_id:
                errors.append(f"duplicate command id: {command_id}")
            command_by_id[command_id] = command
            exit_code = command.get("exitCode")
            status = command.get("status")
            if not isinstance(exit_code, int) or isinstance(exit_code, bool):
                errors.append(f"command {command_id} exitCode must be an integer")
            elif (exit_code == 0) != (status == "passed"):
                errors.append(f"command {command_id} status must agree with exitCode")
            if status not in {"passed", "failed"}:
                errors.append(f"command {command_id} status must be passed or failed")

    for command_id, command in command_by_id.items():
        if command.get("status") == "failed":
            replacement = command.get("supersededBy")
            if not isinstance(replacement, str) or replacement not in command_by_id:
                errors.append(f"failed command {command_id} needs a valid supersededBy command")
            elif command_by_id[replacement].get("status") != "passed":
                errors.append(f"failed command {command_id} replacement {replacement} did not pass")

    evidence = data.get("evidence")
    evidence_by_id: dict[str, dict[str, Any]] = {}
    valid_evidence: set[str] = set()
    if not isinstance(evidence, list) or not evidence:
        errors.append("receipt.evidence must be a non-empty array")
    else:
        for index, item in enumerate(evidence):
            if not isinstance(item, dict):
                errors.append(f"receipt.evidence[{index}] must be an object")
                continue
            evidence_id = item.get("id")
            if not isinstance(evidence_id, str) or not evidence_id.strip():
                errors.append(f"receipt.evidence[{index}].id must be non-empty")
                continue
            if evidence_id in evidence_by_id:
                errors.append(f"duplicate evidence id: {evidence_id}")
            evidence_by_id[evidence_id] = item
            level = item.get("level")
            command_id = item.get("commandId")
            item_errors: list[str] = []
            if level not in EVIDENCE_LEVELS:
                item_errors.append(f"evidence {evidence_id} has invalid level")
            if command_id not in command_by_id:
                item_errors.append(f"evidence {evidence_id} references unknown command {command_id}")
            elif command_by_id[command_id].get("status") != "passed":
                item_errors.append(f"evidence {evidence_id} is backed by a failed command")
            if item.get("result") != "passed":
                item_errors.append(f"evidence {evidence_id} result must be passed")
            if not str(item.get("assertion", "")).strip():
                item_errors.append(f"evidence {evidence_id} needs an assertion")
            if level == "browser":
                for key in ("browserName", "browserVersion", "viewport", "postCondition", "artifact"):
                    if not str(item.get(key, "")).strip():
                        item_errors.append(f"browser evidence {evidence_id} missing {key}")
            artifact = item.get("artifact")
            if artifact:
                artifact_path = (base / str(artifact)).resolve()
                try:
                    artifact_path.relative_to(base.resolve())
                except ValueError:
                    item_errors.append(f"evidence {evidence_id} artifact escapes receipt directory")
                else:
                    if not artifact_path.is_file():
                        item_errors.append(f"evidence {evidence_id} artifact does not exist: {artifact}")
            errors.extend(item_errors)
            if not item_errors:
                valid_evidence.add(evidence_id)

    claims = data.get("claims")
    core_claims: list[dict[str, Any]] = []
    if not isinstance(claims, list) or not claims:
        errors.append("receipt.claims must be a non-empty array")
    else:
        claim_ids: set[str] = set()
        for index, claim in enumerate(claims):
            if not isinstance(claim, dict):
                errors.append(f"receipt.claims[{index}] must be an object")
                continue
            claim_id = claim.get("id")
            if not isinstance(claim_id, str) or not claim_id.strip():
                errors.append(f"receipt.claims[{index}].id must be non-empty")
                continue
            if claim_id in claim_ids:
                errors.append(f"duplicate claim id: {claim_id}")
            claim_ids.add(claim_id)
            if claim.get("kind") == "core":
                core_claims.append(claim)
            if claim.get("kind") not in {"core", "advisory"}:
                errors.append(f"claim {claim_id} kind must be core or advisory")
            if claim.get("status") not in {"passed", "failed", "bounded"}:
                errors.append(f"claim {claim_id} has invalid status")
            ids = claim.get("evidenceIds")
            if not isinstance(ids, list) or not ids:
                errors.append(f"claim {claim_id} needs evidenceIds")
            elif any(evidence_id not in valid_evidence for evidence_id in ids):
                errors.append(f"claim {claim_id} cites missing or invalid evidence")
            if claim.get("requiredLevel") == "browser":
                if not isinstance(ids, list) or not any(
                    evidence_by_id.get(evidence_id, {}).get("level") == "browser" for evidence_id in ids
                ):
                    errors.append(f"browser claim {claim_id} lacks browser evidence")
        present_core_ids = {claim.get("id") for claim in core_claims}
        missing_core_ids = REQUIRED_CORE_CLAIM_IDS - present_core_ids
        if missing_core_ids:
            errors.append(f"receipt missing required core claims: {', '.join(sorted(missing_core_ids))}")

    stages = data.get("stages")
    learning_pending = False
    if not isinstance(stages, list) or not stages:
        errors.append("receipt.stages must be a non-empty array")
    else:
        stage_ids = [stage.get("id") for stage in stages if isinstance(stage, dict)]
        if stage_ids != REQUIRED_STAGE_IDS:
            errors.append("receipt.stages must contain plan, design, implement, verify, package, learn in order")
        for index, stage in enumerate(stages):
            if not isinstance(stage, dict):
                errors.append(f"receipt.stages[{index}] must be an object")
                continue
            is_pending_learning = (
                allow_learning_pending
                and stage.get("id") == "learn"
                and stage.get("status") == "pending"
            )
            if stage.get("status") != "passed" and not is_pending_learning:
                errors.append(f"receipt.stages[{index}] must be passed")
            if is_pending_learning:
                learning_pending = True
            if not isinstance(stage.get("evidenceIds"), list) or not stage["evidenceIds"]:
                errors.append(f"receipt.stages[{index}] needs evidenceIds")
            elif any(evidence_id not in valid_evidence for evidence_id in stage["evidenceIds"]):
                errors.append(f"receipt.stages[{index}] cites invalid evidence")

    unresolved = data.get("unresolvedRequiredProof")
    if not isinstance(unresolved, list):
        errors.append("receipt.unresolvedRequiredProof must be an array")
        unresolved = []
    substitutions = data.get("substitutions")
    if not isinstance(substitutions, list):
        errors.append("receipt.substitutions must be an array")

    gate = data.get("gate")
    if not isinstance(gate, dict):
        errors.append("receipt.gate must be an object")
    else:
        rounds = gate.get("rounds")
        round_names = [item.get("id") for item in rounds if isinstance(item, dict)] if isinstance(rounds, list) else []
        if round_names != QUALITY_ROUNDS:
            errors.append("receipt.gate.rounds must contain the exact three governed rounds")
        elif any(item.get("status") != "passed" for item in rounds):
            errors.append("every receipt gate round must pass")
        score = gate.get("score")
        if not isinstance(score, (int, float)) or isinstance(score, bool) or score < 99:
            errors.append("receipt.gate.score must be at least 99")
        if gate.get("openP0") != 0 or gate.get("openP1") != 0:
            errors.append("receipt gate must have zero open P0 and P1")
        if gate.get("status") == "passed":
            if unresolved:
                errors.append("a passed receipt cannot have unresolved required proof")
            if any(claim.get("status") != "passed" for claim in core_claims):
                errors.append("a passed receipt requires every core claim to pass")
        elif allow_learning_pending and gate.get("status") == "bounded" and learning_pending:
            if unresolved != ["learning-append-pending"]:
                errors.append("a pre-learning receipt must have only learning-append-pending unresolved")
            if any(claim.get("status") != "passed" for claim in core_claims):
                errors.append("a pre-learning receipt requires every core claim to pass")
        elif gate.get("status") not in {"failed", "bounded"}:
            errors.append("receipt.gate.status must be passed, failed, or bounded")
    return errors


def init_spec(args: argparse.Namespace) -> int:
    output = Path(args.output).resolve()
    if output.exists():
        print(f"REFUSED: {output} already exists; no file was overwritten.", file=sys.stderr)
        return 2
    spec = deepcopy(read_object(TEMPLATE))
    spec["project"] = {
        "name": args.project.strip(),
        "domain": args.domain.strip(),
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    spec["design"]["requestedDirection"] = args.direction.strip()
    write_object(output, spec)
    print(f"Created {output}")
    return 0


def validate_command(args: argparse.Namespace) -> int:
    selected = args.spec_option or args.spec
    if not selected:
        print("ERROR: provide a spec path positionally or with --spec", file=sys.stderr)
        return 2
    path = Path(selected).resolve()
    try:
        errors = validate_spec(read_object(path))
    except ValueError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    if errors:
        print(f"Invalid Canvas experience spec; errors={len(errors):,}.", file=sys.stderr)
        return 1
    print(f"Valid Canvas experience spec: {path}")
    return 0


def verify_receipt(args: argparse.Namespace) -> int:
    path = Path(args.receipt).resolve()
    try:
        errors = validate_receipt(read_object(path), path.parent)
    except ValueError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    if errors:
        print(f"Invalid one-call receipt; errors={len(errors):,}.", file=sys.stderr)
        return 1
    print(f"Valid fail-closed one-call receipt: {path}")
    return 0


def learn(args: argparse.Namespace) -> int:
    path = Path(args.spec).resolve()
    try:
        spec = read_object(path)
    except ValueError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    baseline_errors = validate_spec(spec)
    if baseline_errors:
        for error in baseline_errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    receipt_path = Path(args.receipt).resolve()
    try:
        receipt = read_object(receipt_path)
        receipt_errors = validate_receipt(receipt, receipt_path.parent)
    except ValueError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1
    pre_learning = False
    if receipt_errors:
        pre_learning_errors = validate_receipt(receipt, receipt_path.parent, allow_learning_pending=True)
        if pre_learning_errors:
            for error in receipt_errors:
                print(f"ERROR: receipt: {error}", file=sys.stderr)
            return 1
        pre_learning = True
    evidence_by_id = {item["id"]: item for item in receipt["evidence"] if isinstance(item, dict) and "id" in item}
    missing_evidence = [evidence_id for evidence_id in args.evidence_id if evidence_id not in evidence_by_id]
    if missing_evidence:
        print(f"ERROR: receipt lacks evidence ids: {', '.join(missing_evidence)}", file=sys.stderr)
        return 1
    record = {
        "recordedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "project": spec["project"]["name"],
        "context": args.context,
        "observation": args.observation.strip(),
        "decision": args.decision.strip(),
        "evidence": [f"{receipt_path.name}#{evidence_id}" for evidence_id in args.evidence_id],
        "evidenceIds": args.evidence_id,
        "receiptRunId": receipt["runId"],
        "confidence": args.confidence,
        "reuseBoundary": args.boundary.strip(),
    }
    candidate = deepcopy(spec)
    candidate["learnings"].append(record)
    errors = validate_spec(candidate)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1

    candidate_receipt = deepcopy(receipt)
    if pre_learning:
        for stage in candidate_receipt["stages"]:
            if stage.get("id") == "learn":
                stage["status"] = "passed"
                stage["evidenceIds"] = list(args.evidence_id)
        candidate_receipt["unresolvedRequiredProof"] = []
        candidate_receipt["gate"]["status"] = "passed"
        candidate_receipt["endedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        final_receipt_errors = validate_receipt(candidate_receipt, receipt_path.parent)
        if final_receipt_errors:
            for error in final_receipt_errors:
                print(f"ERROR: finalized receipt: {error}", file=sys.stderr)
            return 1

    ledger = path.with_name("canvas-experience.learnings.jsonl")
    write_object(path, candidate)
    if pre_learning:
        write_object(receipt_path, candidate_receipt)
    with ledger.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Recorded learning in {path} and {ledger}")
    return 0


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description=__doc__)
    commands = root.add_subparsers(dest="command", required=True)
    init = commands.add_parser("init", help="Create a new experience spec without overwriting files")
    init.add_argument("--output", required=True)
    init.add_argument("--project", required=True)
    init.add_argument("--domain", required=True)
    init.add_argument("--direction", required=True)
    init.set_defaults(run=init_spec)

    validate = commands.add_parser("validate", help="Validate a Canvas experience spec")
    validate.add_argument("spec", nargs="?")
    validate.add_argument("--spec", dest="spec_option")
    validate.set_defaults(run=validate_command)

    receipt = commands.add_parser("verify-receipt", help="Validate a fail-closed one-call receipt")
    receipt.add_argument("receipt")
    receipt.set_defaults(run=verify_receipt)

    add = commands.add_parser("learn", help="Append an evidence-backed learning")
    add.add_argument("--spec", required=True)
    add.add_argument("--context", action="append", required=True)
    add.add_argument("--observation", required=True)
    add.add_argument("--decision", required=True)
    add.add_argument("--receipt", required=True)
    add.add_argument("--evidence-id", action="append", required=True)
    add.add_argument("--confidence", type=float, required=True)
    add.add_argument("--boundary", required=True)
    add.set_defaults(run=learn)
    return root


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    args = parser().parse_args()
    return args.run(args)


if __name__ == "__main__":
    raise SystemExit(main())

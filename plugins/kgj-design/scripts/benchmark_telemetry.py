#!/usr/bin/env python3
"""Read local benchmark telemetry; never collect usage, append events, contact providers, or certify a run."""
import argparse
from datetime import datetime
from decimal import Decimal, InvalidOperation
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
from urllib.parse import urlsplit

VERSION = "kgj-design-benchmark-telemetry-v1"
PHASES = ("planning", "design", "development", "completion")
COUNTS = ("inputTokens", "cachedInputTokens", "outputTokens", "reasoningOutputTokens")
HEX = re.compile(r"[a-f0-9]{64}")


class TelemetryError(ValueError):
    pass


def require(condition, code):
    if not condition:
        raise TelemetryError(code)


def closed(value, fields):
    require(type(value) is dict and set(value) == set(fields.split()), "OBJECT_FIELDS")


def text(value):
    require(type(value) is str and bool(value.strip()), "TEXT_REQUIRED")


def timestamp(value):
    text(value)
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise TelemetryError("TIMESTAMP") from error
    require(parsed.tzinfo is not None and parsed.utcoffset() is not None, "TIMESTAMP_ZONE")
    return parsed


def unique_objects(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "DUPLICATE_KEY")
        result[key] = value
    return result


def read_json(path):
    # 계약 크기를 넘는 입력은 전체를 적재하지 않고 한 바이트 초과까지만 확인
    with Path(path).open("rb") as stream:
        raw = stream.read(20_000_001)
    require(len(raw) <= 20_000_000, "JSON_SIZE")
    def nonfinite(_):
        raise TelemetryError("NONFINITE")
    try:
        return json.loads(raw.decode("utf-8", errors="strict"),
                          object_pairs_hook=unique_objects, parse_constant=nonfinite)
    except (UnicodeError, json.JSONDecodeError) as error:
        raise TelemetryError("JSON_ENCODING") from error


def sequence(value):
    require(type(value) is list and len(value) <= 10_000, "ARRAY_SIZE")
    return value


def money(value):
    require(type(value) is str, "RATE_DECIMAL_STRING")
    try:
        amount = Decimal(value)
    except InvalidOperation as error:
        raise TelemetryError("RATE") from error
    require(amount.is_finite() and amount >= 0, "RATE")
    return amount


def identifier(value):
    require(type(value) is str and re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}", value), "IDENTIFIER")


def binding(value, root):
    closed(value, "path sha256")
    text(value["path"])
    require(type(value["sha256"]) is str and HEX.fullmatch(value["sha256"]), "SHA256")
    relative = PurePosixPath(value["path"])
    require(not relative.is_absolute() and ".." not in relative.parts and
            "\\" not in value["path"] and ":" not in value["path"], "LOCAL_PATH")
    target = (root / value["path"]).resolve()
    require(target.is_relative_to(root.resolve()), "PATH_ESCAPE")
    require(target.is_file(), "MISSING_FILE")
    require(hashlib.sha256(target.read_bytes()).hexdigest() == value["sha256"], "STALE_FILE")
    return target


def source_digest(files):
    ordered = sorted(files, key=lambda item: item["path"])
    raw = json.dumps(ordered, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def scoped(row, ids):
    artifact, bucket = row["artifactId"], row["sharedBucket"]
    require((artifact is None) != (bucket is None), "ATTRIBUTION_SCOPE")
    if artifact is not None:
        require(artifact in ids, "UNKNOWN_ARTIFACT")
    else:
        identifier(bucket)
        text(row["attributionReason"])
    require(row["phase"] in PHASES or (artifact is None and row["phase"] is None), "PHASE")
    text(row["evidenceRef"])


def elapsed(intervals):
    if not intervals:
        return None
    total = 0
    start, end = sorted(intervals)[0]
    for next_start, next_end in sorted(intervals)[1:]:
        if next_start <= end:
            end = max(end, next_end)
        else:
            total += (end - start).total_seconds()
            start, end = next_start, next_end
    return int((total + (end - start).total_seconds()) * 1000)


def phase_intervals(events, ids):
    segments, event_ids, intervals = {}, set(), {}
    # 같은 구간의 시작·종료를 한 쌍으로 묶어 재시작이나 중복 합산을 거절
    for event in sequence(events):
        closed(event, "id artifactId sharedBucket attributionReason phase segment action at evidenceRef")
        identifier(event["id"])
        require(event["id"] not in event_ids, "DUPLICATE_EVENT")
        event_ids.add(event["id"])
        scoped(event, ids)
        # 같은 구간을 다시 열어 과거 시간을 덮거나 더하지 않도록 시작 상태 확인
        require(event["phase"] in PHASES, "PHASE")
        identifier(event["segment"])
        require(event["action"] in ("start", "end"), "EVENT_ACTION")
        key = (event["artifactId"], event["sharedBucket"], event["phase"], event["segment"])
        action, at = event["action"], timestamp(event["at"])
        if action == "start":
            require(key not in segments, "DUPLICATE_OR_RESET_SEGMENT")
            segments[key] = [at, None]
        else:
            require(key in segments and segments[key][1] is None, "UNPAIRED_OR_DUPLICATE_END")
            require(at >= segments[key][0], "NEGATIVE_DURATION")
            segments[key][1] = at
    for key, (start, end) in segments.items():
        require(end is not None, "OPEN_PHASE_SEGMENT")
        intervals.setdefault(key[:3], []).append((start, end))
    return intervals


def rates_by_id(rates):
    result = {}
    for rate in sequence(rates):
        closed(rate, "id provider actualModelId currency inputPerMillion cachedInputPerMillion outputPerMillion officialSourceUrl retrievedAt conditions")
        identifier(rate["id"])
        require(rate["id"] not in result, "DUPLICATE_RATE")
        for field in ("provider", "actualModelId", "conditions"):
            text(rate[field])
        require(rate["currency"] == "USD", "CURRENCY")
        # URL 형식 확인은 공식 페이지의 사실 확인을 대신하지 않음
        url = urlsplit(rate["officialSourceUrl"])
        require(url.scheme == "https" and bool(url.hostname) and not url.username and not url.password, "PRICING_URL")
        timestamp(rate["retrievedAt"])
        for key in ("inputPerMillion", "cachedInputPerMillion", "outputPerMillion"):
            money(rate[key])
        result[rate["id"]] = rate
    return result


def usage_summary(entries, ids, rates, root):
    seen, requests, result = set(), set(), []
    # 공급자 델타 사용량만 합산하며 cache·reasoning을 이미 포함한 총량에 다시 더하지 않음
    for entry in sequence(entries):
        closed(entry, "id requestId artifactId sharedBucket attributionReason phase provider selectedModelLabel actualModelId modelUnknownReason usageKind inputTokens cachedInputTokens outputTokens reasoningOutputTokens unknownReasons evidenceRef observedAt usageEvidence rateId unpricedCharges")
        identifier(entry["id"])
        text(entry["requestId"])
        require(entry["id"] not in seen and entry["requestId"] not in requests, "DUPLICATE_USAGE")
        seen.add(entry["id"])
        requests.add(entry["requestId"])
        scoped(entry, ids)
        timestamp(entry["observedAt"])
        observed = entry["actualModelId"] is not None or any(entry[key] is not None for key in COUNTS)
        if observed:
            binding(entry["usageEvidence"], root)
        else:
            require(entry["usageEvidence"] is None, "UNOBSERVED_USAGE_EVIDENCE")
        require(entry["usageKind"] == "delta", "CUMULATIVE_OR_RESET_USAGE")
        require(entry["selectedModelLabel"] is None or type(entry["selectedModelLabel"]) is str, "SELECTED_LABEL")
        if entry["actualModelId"] is None:
            text(entry["modelUnknownReason"])
        else:
            text(entry["actualModelId"])
            text(entry["provider"])
            require(entry["modelUnknownReason"] is None, "CONTRADICTORY_MODEL_REASON")
        closed(entry["unknownReasons"], " ".join(COUNTS))
        for field in COUNTS:
            count = entry[field]
            if count is None:
                text(entry["unknownReasons"][field])
            else:
                require(type(count) is int and count >= 0, "TOKEN_COUNT")
                require(entry["unknownReasons"][field] is None, "CONTRADICTORY_TOKEN_REASON")
        for child, parent in (("cachedInputTokens", "inputTokens"), ("reasoningOutputTokens", "outputTokens")):
            require(entry[child] is None or (entry[parent] is not None and entry[child] <= entry[parent]), "TOKEN_SUBSET")
        require(type(entry["unpricedCharges"]) is list and all(type(x) is str and x.strip() for x in entry["unpricedCharges"]), "UNPRICED_CHARGES")
        rate = rates.get(entry["rateId"])
        if entry["rateId"] is not None:
            require(rate is not None, "UNKNOWN_RATE")
            require(rate["provider"] == entry["provider"] and rate["actualModelId"] == entry["actualModelId"], "RATE_MODEL_MISMATCH")
        # 일부 항목만 관찰됐으면 환산액 전체를 계산한 것처럼 표시하지 않음
        cost, reason = None, None
        if entry["actualModelId"] is None:
            reason = "Observed model identity is unavailable."
        elif any(entry[field] is None for field in COUNTS[:3]):
            reason = "Input, cached-input or output count is unavailable."
        elif entry["unpricedCharges"]:
            reason = "Additional charge types are not priced by this token-only calculator."
        elif rate is None:
            reason = "No verified official pricing record was supplied."
        else:
            uncached = entry["inputTokens"] - entry["cachedInputTokens"]
            cost = str((uncached * money(rate["inputPerMillion"]) +
                        entry["cachedInputTokens"] * money(rate["cachedInputPerMillion"]) +
                        entry["outputTokens"] * money(rate["outputPerMillion"])) / Decimal(1_000_000))
        result.append({"id": entry["id"], "artifactId": entry["artifactId"], "sharedBucket": entry["sharedBucket"],
                       "phase": entry["phase"], "provider": entry["provider"],
                       "selectedModelLabel": entry["selectedModelLabel"], "actualModelId": entry["actualModelId"],
                       "modelUnknownReason": entry["modelUnknownReason"], "unknownReasons": entry["unknownReasons"],
                       "observedAt": entry["observedAt"], "usageEvidence": entry["usageEvidence"],
                       "inputTokens": entry["inputTokens"], "cachedInputTokens": entry["cachedInputTokens"],
                       "outputTokens": entry["outputTokens"], "reasoningOutputTokens": entry["reasoningOutputTokens"],
                       "apiEquivalentUsd": cost, "costUnknownReason": reason, "actualBilledUsd": None})
    return result


def lighthouse_summary(snapshots, artifacts, root):
    result, seen = [], set()
    # 실제 원본 보고서와 현재 선언 소스의 해시를 대조하고 보고서를 소스에 넣는 자기참조를 차단
    for snapshot in sequence(snapshots):
        closed(snapshot, "id artifactId route measuredAt completedAt lighthouseVersion sourceSha256 report")
        identifier(snapshot["id"])
        require(snapshot["id"] not in seen, "DUPLICATE_LIGHTHOUSE")
        seen.add(snapshot["id"])
        require(snapshot["artifactId"] in artifacts, "UNKNOWN_ARTIFACT")
        artifact = artifacts[snapshot["artifactId"]]
        require(bool(artifact["sourceFiles"]), "LIGHTHOUSE_SOURCE_REQUIRED")
        require(snapshot["sourceSha256"] == source_digest(artifact["sourceFiles"]), "STALE_LIGHTHOUSE_SOURCE")
        report_path = binding(snapshot["report"], root)
        require(all(report_path != (root / item["path"]).resolve() for item in artifact["sourceFiles"]), "SELF_REFERENTIAL_REPORT")
        # 다른 화면·시각·버전의 보고서를 현재 측정으로 표시하지 않도록 원문 필드 대조
        report = read_json(report_path)
        require(report.get("requestedUrl") == snapshot["route"], "LIGHTHOUSE_ROUTE")
        require(timestamp(report.get("fetchTime")) == timestamp(snapshot["measuredAt"]), "LIGHTHOUSE_TIME")
        require(timestamp(snapshot["completedAt"]) >= timestamp(snapshot["measuredAt"]), "LIGHTHOUSE_COMPLETION")
        require(report.get("lighthouseVersion") == snapshot["lighthouseVersion"], "LIGHTHOUSE_VERSION")
        scores = {}
        require(type(report.get("categories")) is dict, "LIGHTHOUSE_CATEGORIES")
        for category in ("performance", "accessibility", "best-practices", "seo"):
            require(type(report["categories"].get(category)) is dict and "score" in report["categories"][category], "LIGHTHOUSE_CATEGORIES")
            score = report["categories"][category]["score"]
            require(score is None or (type(score) in (int, float) and 0 <= score <= 1), "LIGHTHOUSE_SCORE")
            scores[category] = None if score is None else round(score * 100, 2)
        result.append({"id": snapshot["id"], "artifactId": snapshot["artifactId"], "route": snapshot["route"],
                       "measuredAt": snapshot["measuredAt"], "completedAt": snapshot["completedAt"],
                       "lighthouseVersion": snapshot["lighthouseVersion"],
                       "sourceSha256": snapshot["sourceSha256"], "reportSha256": snapshot["report"]["sha256"],
                       "scores": scores, "scope": "One local Lighthouse snapshot; not complete usability proof."})
    return result


def summarize(document, root):
    require(type(document) is dict, "OBJECT_REQUIRED")
    envelope = document.get("schemaVersion") == "kgj-design-benchmark-run-v1"
    ledger = document.get("telemetry") if envelope else document
    if ledger is None:
        require(envelope, "TELEMETRY_REQUIRED")
        return {"status": "legacy-unknown", "reason": "This v1 run has no telemetry extension; nothing was inferred.",
                "artifacts": [{"id": sample["id"], "elapsedMs": None, "apiEquivalentUsd": None}
                              for sample in document.get("samples", [])], "actualBilledUsd": None}
    closed(ledger, "schemaVersion captureMode artifacts phaseEvents usageEntries priceRates lighthouseSnapshots unknownReason")
    require(ledger["schemaVersion"] == VERSION and ledger["captureMode"] == "active-agent-manual", "TELEMETRY_VERSION_OR_CAPTURE_MODE")
    artifacts = {}
    # 미관찰 단계를 0초로 만들지 않고 해당 단계의 이유와 선언 소스만 확인
    for artifact in sequence(ledger["artifacts"]):
        # 선언한 파일만 읽고 관찰하지 못한 필드는 앱별 이유를 유지
        closed(artifact, "id sourceFiles unknownReasons")
        identifier(artifact["id"])
        require(artifact["id"] not in artifacts, "DUPLICATE_ARTIFACT")
        closed(artifact["unknownReasons"], " ".join(PHASES + ("usage", "lighthouse")))
        paths = set()
        for item in sequence(artifact["sourceFiles"]):
            binding(item, root)
            require(item["path"] not in paths, "DUPLICATE_SOURCE")
            paths.add(item["path"])
        artifacts[artifact["id"]] = artifact
    if envelope and (artifacts or document.get("status") != "not-run"):
        require(set(artifacts) == {sample["id"] for sample in document.get("samples", [])}, "ARTIFACT_COVERAGE")
    if not artifacts:
        text(ledger["unknownReason"])
    ids = set(artifacts)
    intervals = phase_intervals(ledger["phaseEvents"], ids)
    usage = usage_summary(ledger["usageEntries"], ids, rates_by_id(ledger["priceRates"]), root)
    lighthouse = lighthouse_summary(ledger["lighthouseSnapshots"], artifacts, root)
    rows = []
    for artifact in artifacts.values():
        # 공유 기록을 앱별 합계에 나누지 않고 독점 귀속한 값만 요약
        phases = {}
        for phase in PHASES:
            value = elapsed(intervals.get((artifact["id"], None, phase), []))
            reason = artifact["unknownReasons"][phase]
            require(reason is None if value is not None else type(reason) is str and bool(reason.strip()), "PHASE_UNKNOWN_REASON")
            observed = intervals.get((artifact["id"], None, phase), [])
            phases[phase] = {"elapsedMs": value, "unknownReason": reason,
                             "observedIntervals": [{"startedAt": start.isoformat(), "endedAt": end.isoformat()}
                                                   for start, end in sorted(observed)]}
        app_usage = [entry for entry in usage if entry["artifactId"] == artifact["id"]]
        app_lh = [entry for entry in lighthouse if entry["artifactId"] == artifact["id"]]
        for name, observed in (("usage", app_usage), ("lighthouse", app_lh)):
            reason = artifact["unknownReasons"][name]
            require(reason is None if observed else type(reason) is str and bool(reason.strip()), "UNKNOWN_REASON")
        complete = bool(app_usage) and all(row["apiEquivalentUsd"] is not None for row in app_usage)
        cost = str(sum((Decimal(row["apiEquivalentUsd"]) for row in app_usage), Decimal(0))) if complete else None
        rows.append({"id": artifact["id"], "phases": phases, "unknownReasons": artifact["unknownReasons"], "usage": app_usage,
                     "apiEquivalentUsd": cost, "actualBilledUsd": None,
                     "costUnknownReason": None if complete else "No complete artifact-attributed token pricing.",
                     "lighthouse": app_lh})
    shared_phases = [{"sharedBucket": bucket, "phase": phase, "elapsedMs": elapsed(value),
                      "observedIntervals": [{"startedAt": start.isoformat(), "endedAt": end.isoformat()}
                                            for start, end in sorted(value)]}
                     for (artifact, bucket, phase), value in intervals.items() if artifact is None]
    return {"status": "validated-input-only", "captureMode": "active-agent-manual",
            "artifactCount": len(rows), "artifacts": rows, "sharedUsage": [entry for entry in usage if entry["artifactId"] is None],
            "sharedPhases": shared_phases, "actualBilledUsd": None,
            "limits": "No automatic collection, provider verification, billing, runtime or usability attestation."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("validate", "summarize"))
    parser.add_argument("input", type=Path)
    parser.add_argument("--root", type=Path, help="Read-only root for declared source/report files; defaults to input parent.")
    args = parser.parse_args()
    try:
        # 로컬 입력 검사 결과를 실제 사용량 수집이나 실행 성공 영수증으로 바꾸지 않음
        result = summarize(read_json(args.input), args.root or args.input.parent)
        if args.command == "validate":
            result = {"status": result["status"], "artifactCount": len(result["artifacts"]),
                      "scope": "Structure and declared local bindings only; no usage was collected."}
        print(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False))
        return 0
    except (TelemetryError, OSError, TypeError, KeyError, AttributeError) as error:
        print(json.dumps({"status": "invalid", "error": str(error)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

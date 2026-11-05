"""Only newly authored synthetic records; no provider call, personal store, real token or Lighthouse claim."""
import copy
from decimal import Decimal
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "benchmark_telemetry.py"
SPEC = importlib.util.spec_from_file_location("benchmark_telemetry", SCRIPT)
TELEMETRY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(TELEMETRY)


class BenchmarkTelemetryTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix="kgj-telemetry-synthetic-"))
        self.source = self.file("specimen.html", "<main>Synthetic specimen</main>")
        self.receipt = self.file("usage.json", json.dumps({"synthetic": True, "input": 1000, "cache": 400, "output": 200}))
        reasons = {name: "Not observed in this synthetic case." for name in TELEMETRY.PHASES + ("usage", "lighthouse")}
        self.ledger = {"schemaVersion": TELEMETRY.VERSION, "captureMode": "active-agent-manual",
                       "artifacts": [{"id": "example-app", "sourceFiles": [self.source], "unknownReasons": reasons}],
                       "phaseEvents": [], "usageEntries": [], "priceRates": [], "lighthouseSnapshots": [],
                       "unknownReason": None}

    def file(self, name, value):
        raw = value.encode("utf-8")
        (self.root / name).write_bytes(raw)
        return {"path": name, "sha256": hashlib.sha256(raw).hexdigest()}

    def result(self):
        return TELEMETRY.summarize(self.ledger, self.root)

    def usage(self):
        # 요율과 토큰은 계산 경계 검사용 합성 값이며 공급자 실측·공식 단가가 아님
        row = {"id": "usage-one", "requestId": "synthetic-provider:request-one", "artifactId": "example-app",
               "sharedBucket": None, "attributionReason": None, "phase": "development", "provider": "synthetic-provider",
               "selectedModelLabel": "Synthetic selection", "actualModelId": "synthetic-model", "modelUnknownReason": None,
               "usageKind": "delta", "inputTokens": 1000, "cachedInputTokens": 400, "outputTokens": 200,
               "reasoningOutputTokens": 50, "unknownReasons": {key: None for key in TELEMETRY.COUNTS},
               "evidenceRef": "Synthetic usage fixture only.", "observedAt": "2026-01-01T00:00:00Z",
               "usageEvidence": self.receipt, "rateId": "synthetic-rate", "unpricedCharges": []}
        self.ledger["usageEntries"] = [row]
        self.ledger["artifacts"][0]["unknownReasons"]["usage"] = None
        self.ledger["priceRates"] = [{"id": "synthetic-rate", "provider": "synthetic-provider",
            "actualModelId": "synthetic-model", "currency": "USD", "inputPerMillion": "2",
            "cachedInputPerMillion": "0.5", "outputPerMillion": "8",
            "officialSourceUrl": "https://example.com/synthetic-provider/pricing",
            "retrievedAt": "2026-01-01T00:00:00Z", "conditions": "Synthetic arithmetic fixture; not official provider rates."}]
        return row

    def phase(self, segment="segment-one", start="2026-01-01T00:00:00Z", end="2026-01-01T00:00:10Z"):
        # 실제 작업 시각 대신 고정된 합성 구간으로 중복·역전·겹침만 검증
        for action, at in (("start", start), ("end", end)):
            self.ledger["phaseEvents"].append({"id": segment + "-" + action, "artifactId": "example-app",
                "sharedBucket": None, "attributionReason": None, "phase": "planning", "segment": segment,
                "action": action, "at": at, "evidenceRef": "Synthetic clock boundary."})
        self.ledger["artifacts"][0]["unknownReasons"]["planning"] = None

    def lighthouse(self):
        raw = {"requestedUrl": "http://127.0.0.1:8888/#example", "fetchTime": "2026-01-01T00:00:00Z",
               "lighthouseVersion": "synthetic-fixture", "categories": {name: {"score": .8}
               for name in ("performance", "accessibility", "best-practices", "seo")}}
        report = self.file("lighthouse.json", json.dumps(raw))
        self.ledger["lighthouseSnapshots"] = [{"id": "snapshot-one", "artifactId": "example-app",
            "route": raw["requestedUrl"], "measuredAt": raw["fetchTime"], "completedAt": "2026-01-01T00:00:02Z",
            "lighthouseVersion": raw["lighthouseVersion"],
            "sourceSha256": TELEMETRY.source_digest([self.source]), "report": report}]
        self.ledger["artifacts"][0]["unknownReasons"]["lighthouse"] = None
        return raw

    def invalid(self, code):
        with self.assertRaisesRegex(TELEMETRY.TelemetryError, code):
            self.result()

    def test_unknown_is_null_not_zero(self):
        row = self.result()["artifacts"][0]
        self.assertIsNone(row["phases"]["planning"]["elapsedMs"])
        self.assertIsNone(row["apiEquivalentUsd"])
        self.assertIsNone(row["actualBilledUsd"])

    def test_legacy_v1_is_not_retroactively_measured(self):
        result = TELEMETRY.summarize({"schemaVersion": "kgj-design-benchmark-run-v1", "samples": [{"id": "old"}]}, self.root)
        self.assertEqual(result["status"], "legacy-unknown")
        self.assertIsNone(result["artifacts"][0]["elapsedMs"])

    def test_missing_unknown_reason_rejected(self):
        self.ledger["artifacts"][0]["unknownReasons"]["planning"] = None
        self.invalid("PHASE_UNKNOWN_REASON")

    def test_cached_and_reasoning_are_subsets_not_extra_charges(self):
        self.usage()
        self.assertEqual(Decimal(self.result()["artifacts"][0]["apiEquivalentUsd"]), Decimal("0.003"))

    def test_cached_input_unknown_prevents_cost(self):
        row = self.usage()
        row["cachedInputTokens"] = None
        row["unknownReasons"]["cachedInputTokens"] = "Not exposed."
        self.assertIsNone(self.result()["artifacts"][0]["apiEquivalentUsd"])

    def test_selected_label_cannot_stand_in_for_observed_model(self):
        row = self.usage()
        row.update(actualModelId=None, modelUnknownReason="Harness does not expose model ID.", rateId=None)
        self.assertIsNone(self.result()["artifacts"][0]["apiEquivalentUsd"])

    def test_unknown_token_needs_reason(self):
        row = self.usage()
        row["outputTokens"] = None
        row["reasoningOutputTokens"] = None
        self.invalid("TEXT_REQUIRED")

    def test_invalid_token_values(self):
        for value in (-1, 1.5, True, float("inf"), float("nan")):
            with self.subTest(value=value):
                row = self.usage()
                row["inputTokens"] = value
                self.invalid("TOKEN_COUNT")

    def test_subset_bounds(self):
        for field, value in (("cachedInputTokens", 1001), ("reasoningOutputTokens", 201)):
            with self.subTest(field=field):
                row = self.usage()
                row[field] = value
                self.invalid("TOKEN_SUBSET")

    def test_duplicate_and_reset_usage_rejected(self):
        self.usage()
        self.ledger["usageEntries"].append(copy.deepcopy(self.ledger["usageEntries"][0]))
        self.invalid("DUPLICATE_USAGE")
        self.ledger["usageEntries"].pop()
        self.ledger["usageEntries"][0]["usageKind"] = "cumulative-after-reset"
        self.invalid("CUMULATIVE_OR_RESET_USAGE")

    def test_stale_usage_receipt_rejected(self):
        self.usage()
        (self.root / self.receipt["path"]).write_text("changed synthetic receipt", encoding="utf-8")
        self.invalid("STALE_FILE")

    def test_shared_usage_is_not_divided_between_artifacts(self):
        row = self.usage()
        row.update(artifactId=None, sharedBucket="shared-preparation", phase=None, attributionReason="Joint synthetic preparation.")
        self.ledger["artifacts"][0]["unknownReasons"]["usage"] = "No exclusive attribution."
        result = self.result()
        self.assertIsNone(result["artifacts"][0]["apiEquivalentUsd"])
        self.assertEqual(len(result["sharedUsage"]), 1)

    def test_phase_observed_boundaries_and_overlap_union(self):
        self.phase()
        self.phase("segment-two", "2026-01-01T00:00:05Z", "2026-01-01T00:00:15Z")
        phase = self.result()["artifacts"][0]["phases"]["planning"]
        self.assertEqual(phase["elapsedMs"], 15000)
        self.assertEqual(phase["observedIntervals"], [
            {"startedAt": "2026-01-01T00:00:00+00:00", "endedAt": "2026-01-01T00:00:10+00:00"},
            {"startedAt": "2026-01-01T00:00:05+00:00", "endedAt": "2026-01-01T00:00:15+00:00"}])

    def test_phase_missing_reversed_duplicate_or_reset_rejected(self):
        # 누락·역전·중복은 시간을 짐작해 복구하지 않고 별도 실패로 남김
        for kind, code in (("open", "OPEN_PHASE_SEGMENT"), ("reverse", "NEGATIVE_DURATION"),
                           ("duplicate", "DUPLICATE_EVENT"), ("reset", "EVENT_ACTION")):
            with self.subTest(kind=kind):
                self.ledger["phaseEvents"] = []
                self.phase()
                if kind == "open":
                    self.ledger["phaseEvents"].pop()
                elif kind == "reverse":
                    self.ledger["phaseEvents"][1]["at"] = "2025-12-31T23:59:59Z"
                elif kind == "duplicate":
                    self.ledger["phaseEvents"].append(copy.deepcopy(self.ledger["phaseEvents"][0]))
                else:
                    self.ledger["phaseEvents"][0]["action"] = "reset"
                self.invalid(code)

    def test_nonfinite_or_negative_rates(self):
        for value in ("NaN", "Infinity", "-1"):
            with self.subTest(value=value):
                self.usage()
                self.ledger["priceRates"][0]["outputPerMillion"] = value
                self.invalid("RATE")

    def test_additional_charges_make_total_unknown(self):
        self.usage()["unpricedCharges"] = ["Synthetic unsupported image charge."]
        self.assertIsNone(self.result()["artifacts"][0]["apiEquivalentUsd"])

    def test_lighthouse_current_binding(self):
        self.lighthouse()
        self.assertEqual(self.result()["artifacts"][0]["lighthouse"][0]["scores"]["performance"], 80)

    def test_lighthouse_completion_is_observed_aware_and_not_before_start(self):
        for value, code in ((None, "TEXT_REQUIRED"), ("2026-01-01T00:00:02", "TIMESTAMP_ZONE"),
                            ("2025-12-31T23:59:59Z", "LIGHTHOUSE_COMPLETION")):
            with self.subTest(value=value):
                self.lighthouse()
                self.ledger["lighthouseSnapshots"][0]["completedAt"] = value
                self.invalid(code)

    def test_lighthouse_summary_discloses_start_and_completion(self):
        self.lighthouse()
        row = self.result()["artifacts"][0]["lighthouse"][0]
        self.assertEqual(row["measuredAt"], "2026-01-01T00:00:00Z")
        self.assertEqual(row["completedAt"], "2026-01-01T00:00:02Z")

    def test_lighthouse_stale_source(self):
        self.lighthouse()
        (self.root / self.source["path"]).write_text("changed synthetic source", encoding="utf-8")
        self.invalid("STALE_FILE")

    def test_lighthouse_stale_snapshot_source(self):
        self.lighthouse()
        self.ledger["lighthouseSnapshots"][0]["sourceSha256"] = "0" * 64
        self.invalid("STALE_LIGHTHOUSE_SOURCE")

    def test_lighthouse_stale_report(self):
        self.lighthouse()
        (self.root / "lighthouse.json").write_text("{}", encoding="utf-8")
        self.invalid("STALE_FILE")

    def test_lighthouse_wrong_route_time_version(self):
        for field, value, code in (("route", "http://127.0.0.1:8888/#other", "LIGHTHOUSE_ROUTE"),
                                  ("measuredAt", "2026-01-01T00:00:01Z", "LIGHTHOUSE_TIME"),
                                  ("lighthouseVersion", "other-fixture", "LIGHTHOUSE_VERSION")):
            with self.subTest(field=field):
                self.lighthouse()
                self.ledger["lighthouseSnapshots"][0][field] = value
                self.invalid(code)

    def test_lighthouse_report_is_not_a_source_file(self):
        self.lighthouse()
        snapshot = self.ledger["lighthouseSnapshots"][0]
        self.ledger["artifacts"][0]["sourceFiles"].append(snapshot["report"])
        snapshot["sourceSha256"] = TELEMETRY.source_digest(self.ledger["artifacts"][0]["sourceFiles"])
        self.invalid("SELF_REFERENTIAL_REPORT")

    def test_lighthouse_requires_categories(self):
        self.lighthouse()
        raw = {"requestedUrl": "http://127.0.0.1:8888/#example", "fetchTime": "2026-01-01T00:00:00Z",
               "lighthouseVersion": "synthetic-fixture", "categories": {}}
        self.ledger["lighthouseSnapshots"][0]["report"] = self.file("lighthouse.json", json.dumps(raw))
        self.invalid("LIGHTHOUSE_CATEGORIES")

    def test_json_duplicate_and_nonfinite_rejected(self):
        for raw, code in (('{"x":1,"x":2}', "DUPLICATE_KEY"), ('{"x":NaN}', "NONFINITE")):
            with self.subTest(raw=raw):
                path = self.root / "invalid.json"
                path.write_text(raw, encoding="utf-8")
                with self.assertRaisesRegex(TELEMETRY.TelemetryError, code):
                    TELEMETRY.read_json(path)

    def test_summary_preserves_unknown_reason_and_observation_provenance(self):
        row = self.usage()
        row.update(actualModelId=None, modelUnknownReason="Surface omitted ID.", rateId=None)
        row["cachedInputTokens"] = None
        row["unknownReasons"]["cachedInputTokens"] = "Cache count not exposed."
        normalized = self.result()["artifacts"][0]["usage"][0]
        self.assertEqual(normalized["modelUnknownReason"], row["modelUnknownReason"])
        self.assertEqual(normalized["unknownReasons"], row["unknownReasons"])
        self.assertEqual(normalized["observedAt"], row["observedAt"])
        self.assertEqual(normalized["usageEvidence"], self.receipt)

    def test_completed_envelope_cannot_omit_every_artifact(self):
        empty = copy.deepcopy(self.ledger)
        empty["artifacts"] = []
        empty["unknownReason"] = "Not initialized."
        envelope = {"schemaVersion": "kgj-design-benchmark-run-v1", "status": "complete",
                    "samples": [{"id": "example-app"}], "telemetry": empty}
        with self.assertRaisesRegex(TELEMETRY.TelemetryError, "ARTIFACT_COVERAGE"):
            TELEMETRY.summarize(envelope, self.root)

    def test_artifact_unknown_reasons_survive_empty_usage_and_lighthouse(self):
        row = self.result()["artifacts"][0]
        self.assertEqual(row["unknownReasons"], self.ledger["artifacts"][0]["unknownReasons"])
        self.assertEqual(row["phases"]["planning"]["observedIntervals"], [])

    def test_json_input_read_is_bounded_before_size_validation(self):
        stream = mock.mock_open(read_data=b"{}")
        with mock.patch.object(Path, "open", stream):
            self.assertEqual(TELEMETRY.read_json(self.root / "bounded.json"), {})
        stream().read.assert_called_once_with(20_000_001)

    def test_cli_is_read_only_and_not_a_measurement_receipt(self):
        path = self.root / "ledger.json"
        path.write_text(json.dumps(self.ledger), encoding="utf-8")
        before = {file.name: file.read_bytes() for file in self.root.iterdir()}
        run = subprocess.run([sys.executable, "-B", str(SCRIPT), "summarize", str(path)], capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
        self.assertEqual(json.loads(run.stdout)["status"], "validated-input-only")
        self.assertEqual(before, {file.name: file.read_bytes() for file in self.root.iterdir()})


if __name__ == "__main__":
    unittest.main()

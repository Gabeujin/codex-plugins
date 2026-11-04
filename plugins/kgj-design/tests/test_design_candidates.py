"""Synthetic packet regressions; these fixtures are not rendered product or expert evidence."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest
import zlib

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "review_design_candidates.py"
SPEC = importlib.util.spec_from_file_location("review_design_candidates", SCRIPT)
REVIEW = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(REVIEW)


def tiny_png(index):
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
    header = chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
    pixels = chunk(b"IDAT", zlib.compress(bytes((0, index, 100, 150))))
    return b"\x89PNG\r\n\x1a\n" + header + pixels + chunk(b"IEND", b"")


class DesignCandidateTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix="kgj-candidate-regression-"))
        self.packet = self.make_packet(4)

    def file_binding(self, name, content):
        target = self.root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        raw = content.encode("utf-8") if isinstance(content, str) else content
        target.write_bytes(raw)
        return {"path": name, "sha256": hashlib.sha256(raw).hexdigest()}

    def make_packet(self, count):
        brief = self.file_binding("brief.md", "Synthetic design question and frozen criteria.")
        packet = {"schemaVersion": "1.0", "rubricVersion": REVIEW.RUBRIC,
                  "taskId": "synthetic-task", "authorId": "maker-one", "brief": brief, "candidates": []}
        # 실제 업무 자료 대신 서로 다른 파일·픽셀로 후보의 해시 변경과 선정 계산만 검증
        for index in range(count):
            name = f"candidate-{chr(97 + index)}"
            note = self.file_binding(f"{name}/observation.md", f"Synthetic observation for {name}; no browser claim.")
            variants = []
            for variant in range(2):
                asset = self.file_binding(f"{name}/asset-{variant}.svg", f"<svg><text>{name} {variant}</text></svg>")
                variants.append({"file": asset, "origin": "authored", "rights": "Synthetic test fixture only.",
                                 "review": note, "clearance": "cleared"})
            packet["candidates"].append({"id": name, "direction": f"Synthetic direction {index}.",
                "distinction": f"Synthetic structure {index}; not an aesthetic claim.",
                "source": [self.file_binding(f"{name}/index.html", f"<main>Synthetic {index}</main>")],
                "assets": [{"id": "illustration", "purpose": "Synthetic fixture asset role.", "variants": variants,
                            "selected": variants[0]["file"]["path"], "rationale": "Exercise selected-file membership."}],
                "previews": [{"image": self.file_binding(f"{name}/preview.png", tiny_png(index)),
                              "observation": note, "sourceSha256": "0" * 64}], "reviews": []})
        self.bind_reviews(packet)
        return packet

    def bind_reviews(self, packet):
        for index, candidate in enumerate(packet["candidates"]):
            source_hash, _, _ = REVIEW.candidate_snapshot(candidate, packet["brief"], self.root)
            candidate["previews"][0]["sourceSha256"] = source_hash
            _, candidate_hash, _ = REVIEW.candidate_snapshot(candidate, packet["brief"], self.root)
            candidate["reviews"] = [{"role": role, "reviewerId": "maker-one", "mode": "single-agent-lens",
                "candidateSha256": candidate_hash, "score": 10 + index,
                "rationale": "Synthetic scoring fixture; no actual expert participation.",
                "evidence": [candidate["previews"][0]["observation"]], "blockers": []} for role in REVIEW.ROLES]

    def result(self, packet=None):
        return REVIEW.evaluate(packet or self.packet, self.root)

    def assert_invalid(self, packet):
        with self.assertRaises(REVIEW.CandidateError):
            REVIEW.evaluate(packet, self.root)

    def test_four_candidates_select_unique_highest(self):
        result = self.result()
        self.assertEqual((result["status"], result["selectedCandidate"]), ("ranked", "candidate-d"))
        self.assertEqual([r["total"] for r in result["candidates"]], [50, 55, 60, 65])
        self.assertEqual(result["proofLevel"], "static-file-bindings-and-declared-scores")
        self.assertIn("not a release PASS", result["limitations"])

    def test_five_candidates_are_supported(self):
        self.assertEqual(self.result(self.make_packet(5))["selectedCandidate"], "candidate-e")

    def test_candidate_count_is_four_or_five(self):
        for count in (3, 6):
            with self.subTest(count=count):
                self.assert_invalid(self.make_packet(count))

    def test_tied_highest_holds_in_either_order(self):
        for review in self.packet["candidates"][-2]["reviews"]:
            review["score"] = 13
        for candidates in (self.packet["candidates"], list(reversed(self.packet["candidates"]))):
            self.packet["candidates"] = candidates
            result = self.result()
            self.assertEqual((result["status"], result["reason"], result["selectedCandidate"]), ("hold", "tie", None))

    def test_blocked_highest_selects_lower_eligible_candidate(self):
        self.packet["candidates"][-1]["reviews"][0]["blockers"] = ["Synthetic critical-task failure."]
        result = self.result()
        self.assertEqual(result["selectedCandidate"], "candidate-c")
        self.assertFalse(result["candidates"][-1]["eligible"])
        self.assertEqual(result["candidates"][-1]["total"], 65)

    def test_all_blocked_holds(self):
        for candidate in self.packet["candidates"]:
            candidate["reviews"][0]["blockers"] = ["Synthetic unresolved privacy concern."]
        result = self.result()
        self.assertEqual((result["reason"], result["selectedCandidate"]), ("no-eligible-candidate", None))

    def test_null_score_is_ineligible_and_not_a_smaller_denominator(self):
        self.packet["candidates"][-1]["reviews"][0]["score"] = None
        result = self.result()
        self.assertEqual(result["selectedCandidate"], "candidate-c")
        self.assertIsNone(result["candidates"][-1]["total"])
        self.assertFalse(result["candidates"][-1]["eligible"])

    def test_scores_reject_bool_nonfinite_decimal_and_out_of_range(self):
        for score in (True, False, -1, 21, 1.5, "20", float("nan"), float("inf")):
            with self.subTest(score=str(score)):
                packet = copy.deepcopy(self.packet)
                packet["candidates"][0]["reviews"][0]["score"] = score
                self.assert_invalid(packet)

    def test_missing_or_duplicate_lens_rejected(self):
        packet = copy.deepcopy(self.packet)
        packet["candidates"][0]["reviews"].pop()
        self.assert_invalid(packet)
        self.packet["candidates"][0]["reviews"][0]["role"] = "ui-designer"
        self.assert_invalid(self.packet)

    def test_duplicate_candidate_id_rejected(self):
        self.packet["candidates"][1]["id"] = "candidate-a"
        self.bind_reviews(self.packet)
        self.assert_invalid(self.packet)

    def test_duplicate_source_and_selected_asset_bytes_rejected_despite_paths(self):
        candidate = self.packet["candidates"][1]
        candidate["source"][0] = self.file_binding("copy.html", "<main>Synthetic 0</main>")
        variant = candidate["assets"][0]["variants"][0]
        variant["file"] = self.file_binding("copied-selected.svg", "<svg><text>candidate-a 0</text></svg>")
        candidate["assets"][0]["selected"] = "copied-selected.svg"
        self.bind_reviews(self.packet)
        self.assert_invalid(self.packet)

    def test_shared_source_with_different_selected_assets_is_allowed(self):
        self.packet["candidates"][1]["source"][0] = self.file_binding("shared.html", "<main>Synthetic 0</main>")
        self.bind_reviews(self.packet)
        self.assertEqual(self.result()["status"], "ranked")

    def test_duplicate_preview_bytes_rejected_despite_different_paths(self):
        self.packet["candidates"][1]["previews"][0]["image"] = self.file_binding("copy.png", tiny_png(0))
        self.bind_reviews(self.packet)
        self.assert_invalid(self.packet)

    def test_duplicate_asset_bytes_rejected(self):
        group = self.packet["candidates"][0]["assets"][0]
        group["variants"][1]["file"] = self.file_binding("copy.svg", "<svg><text>candidate-a 0</text></svg>")
        self.assert_invalid(self.packet)

    def test_selected_asset_must_belong_to_compared_variants(self):
        self.packet["candidates"][0]["assets"][0]["selected"] = "uncompared.svg"
        self.assert_invalid(self.packet)

    def test_two_asset_alternatives_required(self):
        self.packet["candidates"][0]["assets"][0]["variants"].pop()
        self.assert_invalid(self.packet)

    def test_asset_clearance_blocks_even_high_score(self):
        self.packet["candidates"][-1]["assets"][0]["variants"][0]["clearance"] = "hold"
        self.bind_reviews(self.packet)
        self.assertEqual(self.result()["selectedCandidate"], "candidate-c")

    def test_missing_file_and_changed_file_rejected(self):
        packet = copy.deepcopy(self.packet)
        packet["brief"]["path"] = "missing.md"
        self.assert_invalid(packet)
        (self.root / "brief.md").write_text("Changed synthetic brief.", encoding="utf-8")
        self.assert_invalid(self.packet)

    def test_updated_source_hash_requires_new_preview_binding(self):
        self.packet["candidates"][0]["source"][0] = self.file_binding("candidate-a/index.html", "Changed synthetic source.")
        self.assert_invalid(self.packet)

    def test_updated_preview_binding_requires_new_review_identity(self):
        candidate = self.packet["candidates"][0]
        candidate["previews"][0]["image"] = self.file_binding("candidate-a/preview.png", tiny_png(200))
        self.assert_invalid(self.packet)

    def test_updated_asset_hash_requires_new_preview_binding(self):
        variant = self.packet["candidates"][0]["assets"][0]["variants"][0]
        variant["file"] = self.file_binding("candidate-a/asset-0.svg", "<svg><text>Changed synthetic asset</text></svg>")
        self.assert_invalid(self.packet)

    def test_evaluation_preserves_packet_and_original_artifacts(self):
        expected = copy.deepcopy(self.packet)
        before = {p.relative_to(self.root): hashlib.sha256(p.read_bytes()).hexdigest()
                  for p in self.root.rglob("*") if p.is_file()}
        self.result()
        after = {p.relative_to(self.root): hashlib.sha256(p.read_bytes()).hexdigest()
                 for p in self.root.rglob("*") if p.is_file()}
        self.assertEqual(self.packet, expected)
        self.assertEqual(after, before)

    def test_snapshot_mode_does_not_select_or_rank(self):
        self.packet["candidates"][0]["reviews"] = []
        result = REVIEW.evaluate(self.packet, self.root, snapshot_only=True)
        self.assertEqual(result["status"], "snapshots")
        self.assertNotIn("selectedCandidate", result)
        self.assertTrue(all("total" not in row for row in result["candidates"]))

    def test_independent_mode_rejects_same_author_identity(self):
        self.packet["candidates"][0]["reviews"][0]["mode"] = "independent-agent"
        self.assert_invalid(self.packet)

    def test_caller_cannot_supply_total_or_selected_candidate(self):
        for location, key in ((self.packet, "selectedCandidate"), (self.packet["candidates"][0], "total")):
            location[key] = "candidate-a"
            self.assert_invalid(self.packet)
            location.pop(key)

    def test_path_escape_absolute_and_ambiguous_paths_rejected(self):
        for name in ("../outside.md", "/outside.md", "Z:/outside.md", "a\\b.md", "a//b.md", "./brief.md"):
            with self.subTest(name=name):
                packet = copy.deepcopy(self.packet)
                packet["brief"]["path"] = name
                self.assert_invalid(packet)

    def test_symlink_artifact_rejected(self):
        link = self.root / "linked.md"
        try:
            link.symlink_to(self.root / "brief.md")
        except (OSError, NotImplementedError):
            self.skipTest("Host does not permit synthetic symlink creation.")
        self.packet["brief"]["path"] = "linked.md"
        self.assert_invalid(self.packet)

    def test_packet_root_symlink_alias_uses_canonical_root(self):
        alias = Path(tempfile.mkdtemp(prefix="kgj-candidate-root-alias-")) / "packet-root"
        try:
            alias.symlink_to(self.root, target_is_directory=True)
        except (OSError, NotImplementedError):
            self.skipTest("Host does not permit synthetic directory symlink creation.")
        # 패킷 루트의 별칭 허용을 내부 산출물 링크 차단과 구별해 검증
        result = REVIEW.evaluate(self.packet, alias)
        self.assertEqual((result["status"], result["selectedCandidate"]), ("ranked", "candidate-d"))
        (self.root / "packet.json").write_text(json.dumps(self.packet), encoding="utf-8")
        run = subprocess.run([sys.executable, "-B", str(SCRIPT), str(alias / "packet.json")],
                             capture_output=True, encoding="utf-8", timeout=20)
        self.assertEqual(run.returncode, 0)
        self.assertEqual(json.loads(run.stdout)["selectedCandidate"], "candidate-d")
        self.assertEqual(run.stderr, "")

    def test_strict_reader_rejects_malformed_duplicate_nonfinite_and_unicode(self):
        payloads = [b'{', b'{"key":1,"key":2}', b'{"value":NaN}', b'{"value":Infinity}',
                    b'{"value":1e999}', b'"\xff"', b'"\\ud800"', b'"\\u0000"', b'"\\ufffd"']
        # 손상 입력을 별도 파일에 보존하고 오류에 원문이 다시 포함되지 않는지 확인
        for index, raw in enumerate(payloads):
            with self.subTest(index=index):
                path = self.root / f"invalid-{index}.json"
                path.write_bytes(raw)
                with self.assertRaises(REVIEW.CandidateError):
                    REVIEW.read_packet(path)

    def test_reader_bounds_size_depth_and_node_count(self):
        payloads = [b'"' + b'x' * 2_000_000 + b'"', b'[' * 40 + b'0' + b']' * 40,
                    b'[' + b','.join([b'0'] * 30_001) + b']']
        for index, raw in enumerate(payloads):
            path = self.root / f"large-{index}.json"
            path.write_bytes(raw)
            with self.assertRaises(REVIEW.CandidateError):
                REVIEW.read_packet(path)

    def test_cli_invalid_output_omits_private_input_and_path(self):
        path = self.root / "synthetic-private-marker.json"
        path.write_text('{"private":"SYNTHETIC_DO_NOT_ECHO","private":false}', encoding="utf-8")
        run = subprocess.run([sys.executable, "-B", str(SCRIPT), str(path)], capture_output=True, encoding="utf-8", timeout=20)
        self.assertEqual(run.returncode, 2)
        self.assertEqual(json.loads(run.stdout), {"status": "invalid", "reason": "CANDIDATE_PACKET_INVALID"})
        self.assertEqual(run.stderr, "")
        self.assertNotIn(str(self.root), run.stdout)
        self.assertNotIn("SYNTHETIC_DO_NOT_ECHO", run.stdout)

    def test_cli_ranked_and_hold_exit_codes(self):
        path = self.root / "packet.json"
        for expected in (0, 1):
            if expected == 1:
                for review in self.packet["candidates"][-2]["reviews"]:
                    review["score"] = 13
            path.write_text(json.dumps(self.packet), encoding="utf-8")
            run = subprocess.run([sys.executable, "-B", str(SCRIPT), str(path)], capture_output=True, encoding="utf-8", timeout=20)
            self.assertEqual(run.returncode, expected)
            self.assertEqual(json.loads(run.stdout)["status"], "ranked" if expected == 0 else "hold")


if __name__ == "__main__":
    unittest.main()

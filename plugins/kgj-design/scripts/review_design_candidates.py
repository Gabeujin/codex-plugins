#!/usr/bin/env python3
"""Check local candidate bindings and rank declared design reviews; never certify design quality."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re

ROLES = ("designer", "ui-designer", "ux-designer", "ui-ux-engineer", "product-designer")
RUBRIC = "kgj-candidates-1.0"
HEX = re.compile(r"[a-f0-9]{64}")
IDENTIFIER = re.compile(r"[a-z][a-z0-9-]{1,79}")


class CandidateError(ValueError):
    pass


def require(condition, code):
    if not condition:
        raise CandidateError(code)


def closed(value, keys):
    require(type(value) is dict and set(value) == set(keys.split()), "OBJECT_FIELDS")


def text(value):
    require(type(value) is str and 3 <= len(value.strip()) <= 2000, "TEXT_REQUIRED")


def identifier(value):
    require(type(value) is str and IDENTIFIER.fullmatch(value), "IDENTIFIER")


def sequence(value, minimum, maximum):
    require(type(value) is list and minimum <= len(value) <= maximum, "ARRAY_SIZE")


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                                     separators=(",", ":")).encode("utf-8")).hexdigest()


def read_packet(path):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, "DUPLICATE_KEY")
            result[key] = value
        return result

    def nonfinite(_):
        raise CandidateError("NONFINITE")

    try:
        with path.open("rb") as stream:
            raw = stream.read(2_000_001)
        require(len(raw) <= 2_000_000, "PACKET_SIZE")
        value = json.loads(raw.decode("utf-8", errors="strict"), object_pairs_hook=unique,
                           parse_constant=nonfinite)
        pending = [(value, 0)]
        nodes = 0
        # 과도하게 깊은 입력과 손상된 문자열을 후보 평가 전에 차단
        while pending:
            item, depth = pending.pop()
            nodes += 1
            require(depth <= 32 and nodes <= 30_000, "PACKET_COMPLEXITY")
            if type(item) is dict:
                pending.extend((x, depth + 1) for pair in item.items() for x in pair)
            elif type(item) is list:
                pending.extend((x, depth + 1) for x in item)
            elif type(item) is str:
                require(not any(c in item for c in ("\ufffd", "\x00")) and
                        not any(0xD800 <= ord(c) <= 0xDFFF for c in item), "TEXT_CORRUPT")
            elif type(item) is float:
                require(abs(item) != float("inf"), "NONFINITE")
        return value
    except (OSError, UnicodeError, json.JSONDecodeError, RecursionError):
        raise CandidateError("PACKET_UNREADABLE") from None


def binding(value, root):
    closed(value, "path sha256")
    name = value["path"]
    require(type(name) is str and 1 <= len(name) <= 240 and "\\" not in name and
            ":" not in name and not name.startswith("/") and
            all(p not in ("", ".", "..") for p in name.split("/")), "ARTIFACT_PATH")
    require(type(value["sha256"]) is str and HEX.fullmatch(value["sha256"]), "ARTIFACT_HASH")
    target = root.joinpath(*PurePosixPath(name).parts)
    try:
        # 패킷 밖의 파일이나 링크를 따라 개인 자료를 읽지 않도록 실제 대상을 제한
        require(not any(p.is_symlink() or (hasattr(p, "is_junction") and p.is_junction())
                        for p in (target, *target.parents)), "ARTIFACT_LINK")
        require(target.resolve().is_relative_to(root.resolve()) and target.is_file(), "ARTIFACT_MISSING")
        with target.open("rb") as stream:
            raw = stream.read(10_000_001)
        require(len(raw) <= 10_000_000, "ARTIFACT_SIZE")
        require(hashlib.sha256(raw).hexdigest() == value["sha256"], "ARTIFACT_CHANGED")
    except OSError:
        raise CandidateError("ARTIFACT_UNREADABLE") from None
    return name


def bindings(values, root, minimum=1, maximum=100):
    sequence(values, minimum, maximum)
    names = [binding(v, root) for v in values]
    require(len(names) == len(set(n.casefold() for n in names)), "DUPLICATE_ARTIFACT")
    return names


def candidate_snapshot(candidate, brief, root):
    closed(candidate, "id direction distinction source assets previews reviews")
    identifier(candidate["id"])
    text(candidate["direction"])
    text(candidate["distinction"])
    bindings(candidate["source"], root)
    sequence(candidate["assets"], 1, 10)
    group_ids = []
    cleared = True
    # 에셋 대안의 출처·권리 검토가 바뀌어도 기존 후보 평가를 다시 확인하도록 묶음에 포함
    for group in candidate["assets"]:
        closed(group, "id purpose variants selected rationale")
        identifier(group["id"])
        group_ids.append(group["id"])
        text(group["purpose"])
        text(group["rationale"])
        sequence(group["variants"], 2, 10)
        names = []
        for variant in group["variants"]:
            closed(variant, "file origin rights review clearance")
            names.append(binding(variant["file"], root))
            require(variant["origin"] in ("authored", "generated", "licensed"), "ASSET_ORIGIN")
            text(variant["rights"])
            binding(variant["review"], root)
            require(variant["clearance"] in ("cleared", "hold"), "ASSET_CLEARANCE")
            cleared = cleared and variant["clearance"] == "cleared"
        require(len(names) == len(set(n.casefold() for n in names)) and
                group["selected"] in names, "ASSET_SELECTION")
        require(len({v["file"]["sha256"] for v in group["variants"]}) == len(names), "DUPLICATE_ASSET")
    require(len(group_ids) == len(set(group_ids)), "DUPLICATE_ASSET_GROUP")
    source_hash = digest({"brief": brief, **{k: candidate[k] for k in
                         ("id", "direction", "distinction", "source", "assets")}})
    sequence(candidate["previews"], 1, 10)
    images = []
    for preview in candidate["previews"]:
        closed(preview, "image observation sourceSha256")
        images.append(binding(preview["image"], root))
        require(Path(images[-1]).suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"), "PREVIEW_IMAGE")
        binding(preview["observation"], root)
    require(len(images) == len(set(images)), "DUPLICATE_PREVIEW")
    return source_hash, digest({"sourceSha256": source_hash, "previews": candidate["previews"]}), cleared


def evaluate(packet, root, snapshot_only=False):
    closed(packet, "schemaVersion rubricVersion taskId authorId brief candidates")
    require(packet["schemaVersion"] == "1.0" and packet["rubricVersion"] == RUBRIC, "SCHEMA_VERSION")
    identifier(packet["taskId"])
    identifier(packet["authorId"])
    binding(packet["brief"], root)
    sequence(packet["candidates"], 4, 5)
    rows = []
    sources = []
    all_images = []
    # 다섯 관점의 점수만 합산하고 미확인 점수를 평균 계산에서 제외하지 않도록 처리
    for candidate in packet["candidates"]:
        source_hash, candidate_hash, cleared = candidate_snapshot(candidate, packet["brief"], root)
        row = {"id": candidate["id"], "sourceSha256": source_hash, "candidateSha256": candidate_hash}
        selected_assets = [v["file"]["sha256"] for g in candidate["assets"]
                           for v in g["variants"] if v["file"]["path"] == g["selected"]]
        sources.append(digest({"sources": sorted(f["sha256"] for f in candidate["source"]),
                               "selectedAssets": sorted(selected_assets)}))
        all_images.extend(p["image"]["sha256"] for p in candidate["previews"])
        if not snapshot_only:
            require(all(p["sourceSha256"] == source_hash for p in candidate["previews"]), "STALE_PREVIEW")
            reviews = candidate["reviews"]
            sequence(reviews, 5, 5)
            require(all(type(r) is dict for r in reviews) and
                    sorted(r.get("role", "") for r in reviews) == sorted(ROLES), "REVIEW_ROLES")
            eligible = cleared
            scores = []
            for review in reviews:
                closed(review, "role reviewerId mode candidateSha256 score rationale evidence blockers")
                identifier(review["reviewerId"])
                require(review["mode"] in ("single-agent-lens", "independent-agent", "human"), "REVIEW_MODE")
                require(review["mode"] != "independent-agent" or review["reviewerId"] != packet["authorId"], "SELF_REVIEW")
                require(review["candidateSha256"] == candidate_hash, "STALE_REVIEW")
                score = review["score"]
                require(score is None or type(score) is int and 0 <= score <= 20, "REVIEW_SCORE")
                text(review["rationale"])
                bindings(review["evidence"], root, maximum=10)
                sequence(review["blockers"], 0, 20)
                for blocker in review["blockers"]:
                    text(blocker)
                eligible = eligible and score is not None and not review["blockers"]
                scores.append(score)
            row.update(total=sum(scores) if None not in scores else None, eligible=bool(eligible))
        rows.append(row)
    require(len({r["id"] for r in rows}) == len(rows), "DUPLICATE_CANDIDATE")
    require(len(set(sources)) == len(sources) and len(set(all_images)) == len(all_images), "DUPLICATE_DRAFT")
    if snapshot_only:
        return {"status": "snapshots", "candidates": rows, "proofLevel": "static-file-bindings"}
    eligible_rows = [r for r in rows if r["eligible"]]
    leaders = [r for r in eligible_rows if r["total"] == max(x["total"] for x in eligible_rows)] if eligible_rows else []
    winner = leaders[0]["id"] if len(leaders) == 1 else None
    return {"status": "ranked" if winner else "hold", "selectedCandidate": winner,
            "reason": "unique-highest-eligible" if winner else "tie" if leaders else "no-eligible-candidate",
            "rubricVersion": RUBRIC, "candidates": rows, "packetSha256": digest(packet),
            "proofLevel": "static-file-bindings-and-declared-scores",
            "limitations": "Does not verify visual distinction, render truth, rights, review independence, or aesthetic quality; not a release PASS."}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("packet", type=Path)
    parser.add_argument("--snapshot", action="store_true", help="Print identities before reviews; does not rank or authorize implementation")
    args = parser.parse_args(argv)
    try:
        # 오류 응답에 입력 원문과 로컬 경로를 복사하지 않도록 고정된 결과만 출력
        result = evaluate(read_packet(args.packet), args.packet.absolute().parent, args.snapshot)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result["status"] in ("ranked", "snapshots") else 1
    except (CandidateError, TypeError, KeyError, ValueError):
        print(json.dumps({"status": "invalid", "reason": "CANDIDATE_PACKET_INVALID"}))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

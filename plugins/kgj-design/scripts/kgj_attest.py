#!/usr/bin/env python3
"""Run one bounded command without a shell and emit an immutable KGJ evidence artifact."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import secrets
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

TOOL_VERSION = "1.4.0"
MAX_CAPTURE_BYTES = 1_000_000


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def canonical(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def digest(value: bytes | str) -> str:
    if isinstance(value, str):
        value = value.encode("utf-8")
    return hashlib.sha256(value).hexdigest()


def write_bytes_exclusive(path: Path, value: bytes) -> None:
    with path.open("xb") as handle:
        handle.write(value)
        handle.flush()
        os.fsync(handle.fileno())


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--id", required=True)
    parser.add_argument("--plan-id")
    parser.add_argument("--cwd", type=Path, default=Path.cwd())
    parser.add_argument("--timeout-seconds", type=int, default=2700)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args(argv)
    command = args.command[1:] if args.command[:1] == ["--"] else args.command
    if not command:
        parser.error("a command is required after --")
    if args.plan_id and args.plan_id != args.id:
        parser.error("--plan-id must equal --id so the command plan cannot be relabeled")
    if not 1 <= args.timeout_seconds <= 5400:
        parser.error("--timeout-seconds must be between 1 and 5,400")
    output = args.output.resolve()
    if output.exists():
        raise SystemExit(f"refusing to overwrite existing evidence artifact: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)
    nonce = secrets.token_hex(8)
    stdout_artifact = output.with_name(f"{output.name}.{nonce}.stdout.bin")
    stderr_artifact = output.with_name(f"{output.name}.{nonce}.stderr.bin")
    started_at = now()
    timed_out = False
    try:
        completed = subprocess.run(
            command,
            cwd=args.cwd.resolve(),
            shell=False,
            capture_output=True,
            timeout=args.timeout_seconds,
            check=False,
        )
        exit_status = completed.returncode
        stdout = completed.stdout
        stderr = completed.stderr
    except subprocess.TimeoutExpired as error:
        timed_out = True
        exit_status = 124
        stdout = error.stdout or b""
        stderr = error.stderr or b""
    completed_at = now()
    capture_truncated = len(stdout) > MAX_CAPTURE_BYTES or len(stderr) > MAX_CAPTURE_BYTES
    write_bytes_exclusive(stdout_artifact, stdout)
    write_bytes_exclusive(stderr_artifact, stderr)
    transcript = {
        "schemaVersion": "1.2" if args.plan_id else "1.1",
        "id": args.id,
        "command": command,
        "cwd": str(args.cwd.resolve()),
        "startedAt": started_at,
        "completedAt": completed_at,
        "timeoutSeconds": args.timeout_seconds,
        "timedOut": timed_out,
        "exitStatus": exit_status,
        "stdoutBytes": len(stdout),
        "stdoutSha256": digest(stdout),
        "stdoutArtifact": {
            "locator": stdout_artifact.name,
            "bytes": len(stdout),
            "sha256": digest(stdout),
        },
        "stderrBytes": len(stderr),
        "stderrSha256": digest(stderr),
        "stderrArtifact": {
            "locator": stderr_artifact.name,
            "bytes": len(stderr),
            "sha256": digest(stderr),
        },
        "captureTruncated": capture_truncated,
        "runner": {"name": "kgj-attest", "version": TOOL_VERSION, "shell": False},
    }
    if args.plan_id:
        transcript["planId"] = args.plan_id
    transcript_hash = digest(canonical(transcript))
    artifact = {**transcript, "transcriptSha256": transcript_hash}
    payload = json.dumps(artifact, ensure_ascii=False, indent=2) + "\n"
    with output.open("x", encoding="utf-8", newline="\n") as handle:
        handle.write(payload)
        handle.flush()
        os.fsync(handle.fileno())
    result = {
        "ok": exit_status == 0 and not capture_truncated,
        "artifact": str(output),
        "sha256": digest(payload),
        "exitStatus": exit_status,
        "attestation": {
            "issuer": "kgj-attest",
            "method": "command",
            "startedAt": started_at,
            "completedAt": completed_at,
            "toolVersion": TOOL_VERSION,
            "transcriptSha256": transcript_hash,
        },
        "limitation": "stdout and stderr are preserved as hash-bound sidecars; capture above 1,000,000 bytes is a HOLD.",
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

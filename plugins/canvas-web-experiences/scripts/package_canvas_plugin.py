#!/usr/bin/env python3
"""Create a deterministic Canvas Web Experiences ZIP without local caches."""

from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parents[1]
EXCLUDED_DIRS = {
    "node_modules",
    "dist",
    "__pycache__",
    ".git",
    ".vite",
    ".playwright-cli",
    "coverage",
}
EXCLUDED_SUFFIXES = {".pyc", ".pyo", ".log", ".tsbuildinfo"}
EXCLUDED_FILENAME_PREFIXES = ("installation-readback-",)


def is_excluded_filename(path: Path) -> bool:
    return path.suffix.lower() == ".json" and path.name.startswith(EXCLUDED_FILENAME_PREFIXES)


def included_files() -> list[Path]:
    return sorted(
        (
            path
            for path in ROOT.rglob("*")
            if path.is_file()
            and not any(part in EXCLUDED_DIRS for part in path.relative_to(ROOT).parts)
            and path.suffix.lower() not in EXCLUDED_SUFFIXES
            and not is_excluded_filename(path)
        ),
        key=lambda path: path.relative_to(ROOT).as_posix(),
    )


def content_tree_summary(paths: list[Path]) -> tuple[int, int, str]:
    records = [
        f"{path.relative_to(ROOT).as_posix()}\t{hashlib.sha256(path.read_bytes()).hexdigest()}"
        for path in paths
    ]
    digest = hashlib.sha256("\n".join(records).encode("utf-8")).hexdigest().upper()
    return len(paths), sum(path.stat().st_size for path in paths), digest


def build(output: Path) -> tuple[int, str, int, int, str]:
    output = output.resolve()
    try:
        output.relative_to(ROOT)
    except ValueError:
        pass
    else:
        raise ValueError("Package output must be outside the plugin root to avoid self-inclusion.")
    output.parent.mkdir(parents=True, exist_ok=True)
    paths = included_files()
    with ZipFile(output, "w", compression=ZIP_DEFLATED, compresslevel=9) as archive:
        for path in paths:
            relative = Path(ROOT.name) / path.relative_to(ROOT)
            info = ZipInfo(relative.as_posix(), date_time=(2026, 8, 21, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes())
    digest = hashlib.sha256(output.read_bytes()).hexdigest().upper()
    entry_count, included_bytes, tree_digest = content_tree_summary(paths)
    return output.stat().st_size, digest, entry_count, included_bytes, tree_digest


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    size, digest, entry_count, included_bytes, tree_digest = build(args.output.resolve())
    print(
        f"Created {args.output.resolve()} ({size:,} bytes, SHA-256 {digest}; "
        f"entries={entry_count:,}; included-bytes={included_bytes:,}; "
        f"content-tree-SHA-256={tree_digest})"
    )
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    raise SystemExit(main())

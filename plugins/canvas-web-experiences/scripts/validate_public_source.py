#!/usr/bin/env python3
"""Validate the sanitization and structural integrity of this public source tree."""

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXPECTED_SKILLS = {
    "canvas-experience-orchestrator", "canvas-project-router", "canvas-html-in-canvas",
    "canvas-experience-design", "canvas-runtime-architecture", "canvas-2d-graphics",
    "canvas-3d-spatial", "canvas-maps-diagrams", "canvas-quality-audit", "canvas-demo-lab",
}
EXCLUDED_DIRECTORIES = {"node_modules", ".playwright-cli", "dist", "output", "evidence", "coverage", "test-results", "playwright-report"}
EXCLUDED_ROOT_FILES = {".localdock.json", "one-call-receipt.json", "VALIDATION.md", "canvas-experience.learnings.jsonl"}


def main() -> int:
    errors: list[str] = []
    manifest_path = ROOT / ".codex-plugin" / "plugin.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        errors.append(f"Cannot parse plugin manifest: {error}")
        manifest = {}
    interface = manifest.get("interface", {}) if isinstance(manifest, dict) else {}
    if manifest.get("name") != "canvas-web-experiences":
        errors.append("plugin name is not canvas-web-experiences")
    if manifest.get("author", {}).get("name") != "Gabeujin" or interface.get("developerName") != "Gabeujin":
        errors.append("publisher identity is not Gabeujin")
    for key, limit in (("displayName", 30), ("shortDescription", 30), ("longDescription", 4000)):
        value = interface.get(key)
        if not isinstance(value, str) or not value or len(value) > limit:
            errors.append(f"interface.{key} violates its public metadata limit")
    prompts = interface.get("defaultPrompt")
    if not isinstance(prompts, list) or not 1 <= len(prompts) <= 3 or any(not isinstance(item, str) or len(item) > 128 for item in prompts):
        errors.append("defaultPrompt does not meet the 1-3 item / 128 character contract")
    skills = {path.name for path in (ROOT / "skills").iterdir() if path.is_dir()} if (ROOT / "skills").is_dir() else set()
    if skills != EXPECTED_SKILLS:
        errors.append("the expected ten skills are not present")
    for relative in ("demo/package.json", "demo/package-lock.json", "demo/src/App.tsx", "demo/src/scene/WebGLSurface.tsx", "scripts/canvas_experience.py", "assets/templates/one-call-receipt.json"):
        if not (ROOT / relative).is_file():
            errors.append(f"required source file is missing: {relative}")
    for path in ROOT.rglob("*"):
        relative = path.relative_to(ROOT)
        if any(part in EXCLUDED_DIRECTORIES for part in relative.parts):
            errors.append(f"excluded generated path present: {relative.as_posix()}")
        if path.is_file() and len(relative.parts) == 1 and path.name in EXCLUDED_ROOT_FILES:
            errors.append(f"excluded historical root file present: {relative.name}")
    for error in errors:
        print(f"ERROR: {error}")
    print(f"Public-source validation: errors={len(errors)}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())

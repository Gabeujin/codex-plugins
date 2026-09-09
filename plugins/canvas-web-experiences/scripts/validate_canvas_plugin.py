#!/usr/bin/env python3
"""Validate the Canvas Web Experiences plugin using only the standard library."""

from __future__ import annotations

import argparse
import json
import hashlib
import re
import sys
from pathlib import Path
from typing import Any
from urllib.parse import unquote
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_SOURCE = False
IGNORED_PARTS = {"node_modules", "__pycache__", ".git", ".vite", ".playwright-cli", "dist", "coverage"}
PACKAGE_EXCLUDED_SUFFIXES = {".pyc", ".pyo", ".log", ".tsbuildinfo"}
PACKAGE_EXCLUDED_PREFIXES = ("installation-readback-",)
EXPECTED_SKILLS = {
    "canvas-experience-orchestrator",
    "canvas-project-router",
    "canvas-html-in-canvas",
    "canvas-experience-design",
    "canvas-runtime-architecture",
    "canvas-2d-graphics",
    "canvas-3d-spatial",
    "canvas-maps-diagrams",
    "canvas-quality-audit",
    "canvas-demo-lab",
}
REQUIRED_SOURCE_IDS = {
    "chrome-html-in-canvas-origin-trial",
    "wicg-html-in-canvas",
    "whatwg-html-issue-10650",
    "whatwg-canvas-standard",
    "chrome-status-html-in-canvas",
    "google-modern-web-guidance",
    "three-htmltexture",
    "playcanvas-html-texture",
    "pixijs-htmlsource",
    "babylon-htmltexture",
    "pixijs",
    "phaser",
    "threejs",
    "babylonjs",
    "maplibre-gl-js",
    "cesiumjs",
    "deckgl",
    "excalidraw",
    "tldraw",
}


class Validation:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def error(self, message: str) -> None:
        self.errors.append(message)

    def warning(self, message: str) -> None:
        self.warnings.append(message)


def plugin_files(pattern: str) -> list[Path]:
    return [
        path
        for path in ROOT.rglob(pattern)
        if not any(part in IGNORED_PARTS for part in path.relative_to(ROOT).parts)
    ]


def load_json(path: Path, result: Validation) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError) as error:
        result.error(f"Cannot parse {path.relative_to(ROOT)}: {error}")
        return {}
    if not isinstance(data, dict):
        result.error(f"Expected object in {path.relative_to(ROOT)}")
        return {}
    return data


def validate_manifest(result: Validation) -> None:
    path = ROOT / ".codex-plugin" / "plugin.json"
    data = load_json(path, result)
    for key in ("name", "version", "description", "author", "skills", "interface"):
        if not data.get(key):
            result.error(f"plugin.json missing {key}")
    if data.get("name") != "canvas-web-experiences":
        result.error("plugin.json name must be canvas-web-experiences")
    if data.get("skills") != "./skills/":
        result.error("plugin.json skills must point to ./skills/")
    interface = data.get("interface", {})
    prompts = interface.get("defaultPrompt") if isinstance(interface, dict) else None
    if not isinstance(prompts, list) or not 1 <= len(prompts) <= 3:
        result.error("interface.defaultPrompt must contain 1 to 3 prompts")
    elif any(not isinstance(prompt, str) or not prompt.strip() or len(prompt) > 128 for prompt in prompts):
        result.error("every interface.defaultPrompt item must be a non-empty string of at most 128 characters")
    capabilities = interface.get("capabilities") if isinstance(interface, dict) else None
    if not isinstance(capabilities, list) or not capabilities:
        result.error("interface.capabilities must be a non-empty array")


def parse_frontmatter(text: str) -> dict[str, str]:
    if not text.startswith("---\n"):
        return {}
    end = text.find("\n---\n", 4)
    if end == -1:
        return {}
    values: dict[str, str] = {}
    for line in text[4:end].splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            values[key.strip()] = value.strip().strip('"')
    return values


def validate_skills(result: Validation) -> None:
    skills_root = ROOT / "skills"
    present = {path.name for path in skills_root.iterdir() if path.is_dir()}
    missing = EXPECTED_SKILLS - present
    extra = present - EXPECTED_SKILLS
    if missing:
        result.error(f"Missing skills: {', '.join(sorted(missing))}")
    if extra:
        result.warning(f"Unexpected skill directories: {', '.join(sorted(extra))}")

    for name in sorted(EXPECTED_SKILLS & present):
        skill_path = skills_root / name / "SKILL.md"
        agent_path = skills_root / name / "agents" / "openai.yaml"
        if not skill_path.is_file():
            result.error(f"{name} missing SKILL.md")
            continue
        text = skill_path.read_text(encoding="utf-8")
        metadata = parse_frontmatter(text)
        if metadata.get("name") != name:
            result.error(f"{name} frontmatter name mismatch")
        description = metadata.get("description", "")
        if len(description) < 40 or "TODO" in description:
            result.error(f"{name} needs a complete trigger description")
        if "##" not in text or "Workflow" not in text:
            result.error(f"{name} needs structured workflow instructions")
        if not agent_path.is_file():
            result.error(f"{name} missing agents/openai.yaml")
        else:
            agent_text = agent_path.read_text(encoding="utf-8")
            if "interface:" not in agent_text or "default_prompt:" not in agent_text:
                result.error(f"{name} openai.yaml is incomplete")
            if f"${name}" not in agent_text:
                result.error(f"{name} default prompt must invoke ${name}")
            for icon_key in ("icon_small", "icon_large"):
                match = re.search(rf"^\s*{icon_key}:\s*[\"']?([^\"'\n]+)", agent_text, flags=re.MULTILINE)
                if match and ".." in Path(match.group(1).strip()).parts:
                    result.error(f"{name} {icon_key} must resolve under plugin assets without '..'")


def validate_catalog(result: Validation) -> None:
    path = ROOT / "references" / "source-catalog.json"
    data = load_json(path, result)
    items = data.get("items")
    if not isinstance(items, list):
        result.error("source-catalog.json items must be an array")
        return
    ids: set[str] = set()
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            result.error(f"Catalog item {index} is not an object")
            continue
        missing = [
            key
            for key in (
                "id",
                "title",
                "kind",
                "categories",
                "evidence_status",
                "maturity",
                "authority",
                "url",
                "license",
                "notes",
            )
            if key not in item
        ]
        if missing:
            result.error(f"Catalog item {index} missing: {', '.join(missing)}")
            continue
        item_id = str(item["id"])
        if item_id in ids:
            result.error(f"Duplicate catalog id: {item_id}")
        ids.add(item_id)
        if not isinstance(item["categories"], list) or not item["categories"]:
            result.error(f"Catalog item {item_id} needs categories")
        if not str(item["url"]).startswith(("https://", "http://")):
            result.error(f"Catalog item {item_id} has invalid URL")
    missing_sources = REQUIRED_SOURCE_IDS - ids
    if missing_sources:
        result.error(f"Catalog missing required sources: {', '.join(sorted(missing_sources))}")


def validate_internal_links(result: Validation) -> None:
    link_pattern = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
    reference_pattern = re.compile(r"`((?:\.\./)+[^`]+\.(?:md|json))`")
    for path in plugin_files("*.md"):
        text = path.read_text(encoding="utf-8")
        raw_targets = link_pattern.findall(text) + reference_pattern.findall(text)
        for raw_target in raw_targets:
            target = raw_target.strip().split("#", 1)[0]
            if not target or target.startswith(("http://", "https://", "mailto:")):
                continue
            target = unquote(target).strip("<>")
            resolved = (path.parent / target).resolve()
            try:
                resolved.relative_to(ROOT.resolve())
            except ValueError:
                result.error(f"Link escapes plugin: {path.relative_to(ROOT)} -> {raw_target}")
                continue
            if not resolved.exists():
                result.error(f"Broken link: {path.relative_to(ROOT)} -> {raw_target}")


def validate_content_contract(result: Validation) -> None:
    text_files = plugin_files("*.md") + plugin_files("*.json")
    joined = "\n".join(path.read_text(encoding="utf-8") for path in text_files)
    for token in (
        "drawElementImage",
        "texElementImage2D",
        "copyElementImageToTexture",
        "layoutSubtree",
        "requestPaint()",
        "captureElementImage()",
        "getElementTransform()",
    ):
        if token not in joined:
            result.error(f"Missing exact experimental API name: {token}")
    for marker in ("[TODO", "PLACEHOLDER"):
        if marker in joined:
            result.error(f"Unresolved scaffold marker: {marker}")
    if "early-adopter" not in joined and "early adopter" not in joined:
        result.error("Missing early-adopter adoption guidance")


def validate_demo_lab(result: Validation) -> None:
    demo_root = ROOT / "demo"
    required_files = (
        "package.json",
        "index.html",
        "src/App.tsx",
        "src/catalog.ts",
        "src/scene/drawScene.ts",
        "src/scene/WebGLSurface.tsx",
        "src/runtime/htmlInCanvas.ts",
        "src/runtime/runtime.test.ts",
    )
    for relative in required_files:
        if not (demo_root / relative).is_file():
            result.error(f"Demo lab missing {relative}")
    catalog_path = demo_root / "src" / "catalog.ts"
    if catalog_path.is_file():
        catalog_text = catalog_path.read_text(encoding="utf-8")
        demo_ids = re.findall(r"\bid:\s*'([a-z]+)'", catalog_text)
        if len(demo_ids) != 12 or len(set(demo_ids)) != 12:
            result.error(f"Demo lab must declare 12 unique domains; found {len(set(demo_ids))}")
    production_sources = [
        path
        for path in (demo_root / "src").rglob("*.ts*")
        if ".test." not in path.name
    ]
    source_text = "\n".join(path.read_text(encoding="utf-8") for path in production_sources)
    runtime_contracts = {
        "Canvas 2D context": ("getContext('2d'", 'getContext("2d"'),
        "WebGL context": ("getContext('webgl2'", 'getContext("webgl2"', "getContext('webgl'", 'getContext("webgl"'),
        "Canvas 2D element draw": ("drawElementImage",),
        "WebGL element upload": ("texElementImage2D",),
        "WebGPU element upload": ("copyElementImageToTexture",),
        "worker element capture": ("captureElementImage",),
        "DOM fallback": ("dom-overlay",),
    }
    for label, alternatives in runtime_contracts.items():
        if not any(token in source_text for token in alternatives):
            result.error(f"Demo lab missing runtime evidence contract: {label}")
    if re.search(r"\bdangerouslySetInnerHTML\s*=", source_text):
        result.error("Demo lab must not accept arbitrary HTML through dangerouslySetInnerHTML")
    index_text = (demo_root / "index.html").read_text(encoding="utf-8") if (demo_root / "index.html").is_file() else ""
    if "Content-Security-Policy" not in index_text:
        result.error("Demo lab missing CSP")
    if not PUBLIC_SOURCE and not (ROOT / ".localdock.json").is_file():
        result.error("Demo lab missing LocalDock registration")


def validate_one_shot_system(result: Validation) -> None:
    required_files = [
        "canvas-experience.json",
        "references/work-ontology.md",
        "references/one-shot-operating-system.md",
        "schemas/canvas-experience.schema.json",
        "assets/templates/canvas-experience-spec.json",
        "scripts/canvas_experience.py",
        "schemas/one-call-receipt.schema.json",
        "assets/templates/one-call-receipt.json",
    ]
    if not PUBLIC_SOURCE:
        required_files.extend((
            "canvas-experience.learnings.jsonl",
            "references/concept-fidelity-ledger.md",
        ))
    for relative in required_files:
        if not (ROOT / relative).is_file():
            result.error(f"One-shot operating system missing {relative}")

    ontology = ROOT / "references" / "work-ontology.md"
    if ontology.is_file():
        ontology_text = ontology.read_text(encoding="utf-8")
        relations = (
            "Intent -> defines -> ProductDNA",
            "DesignDirection -> explores -> Concept[3]",
            "Renderer -> degradesTo -> Fallback",
            "Change -> verifiedBy -> Test + BrowserReceipt",
            "Learning -> reusableWhen -> ReuseBoundary",
        )
        for relation in relations:
            if relation not in ontology_text:
                result.error(f"Work ontology missing relation: {relation}")

    schema = load_json(ROOT / "schemas" / "canvas-experience.schema.json", result)
    template = load_json(ROOT / "assets" / "templates" / "canvas-experience-spec.json", result)
    required = schema.get("required")
    if not isinstance(required, list) or set(required) != {
        "schemaVersion", "project", "intent", "productDNA", "design",
        "architecture", "accessibility", "qualityGate", "learnings",
    }:
        result.error("Canvas experience schema has an incomplete top-level contract")
    if template.get("schemaVersion") != "1.0":
        result.error("Canvas experience template must use schemaVersion 1.0")
    concepts = template.get("design", {}).get("concepts", []) if isinstance(template.get("design"), dict) else []
    if {item.get("id") for item in concepts if isinstance(item, dict)} != {"aligned", "stretch", "frontier"}:
        result.error("Canvas experience template must include aligned, stretch, and frontier concepts")
    rounds = template.get("qualityGate", {}).get("rounds", []) if isinstance(template.get("qualityGate"), dict) else []
    if len(rounds) != 3:
        result.error("Canvas experience template must declare exactly three quality rounds")

    script = ROOT / "scripts" / "canvas_experience.py"
    if script.is_file():
        script_text = script.read_text(encoding="utf-8")
        for token in ("REFUSED:", "canvas-experience.learnings.jsonl", "reuseBoundary", "validate_spec"):
            if token not in script_text:
                result.error(f"Canvas experience CLI missing behavior token: {token}")
        for token in ("validate_receipt", "verify-receipt", "REQUIRED_CORE_CLAIM_IDS", "supersededBy", "evidence-id"):
            if token not in script_text:
                result.error(f"Canvas one-call CLI missing fail-closed token: {token}")

    receipt_schema = load_json(ROOT / "schemas" / "one-call-receipt.schema.json", result)
    receipt_template = load_json(ROOT / "assets" / "templates" / "one-call-receipt.json", result)
    receipt_required = receipt_schema.get("required")
    expected_receipt_keys = {
        "schemaVersion", "runId", "project", "startedAt", "endedAt", "stages",
        "commands", "evidence", "claims", "substitutions", "unresolvedRequiredProof", "gate",
    }
    if not isinstance(receipt_required, list) or set(receipt_required) != expected_receipt_keys:
        result.error("One-call receipt schema has an incomplete top-level contract")
    if receipt_template.get("schemaVersion") != "one-call-receipt/1.0":
        result.error("One-call receipt template must use one-call-receipt/1.0")
    stage_ids = [item.get("id") for item in receipt_template.get("stages", []) if isinstance(item, dict)]
    if stage_ids != ["plan", "design", "implement", "verify", "package", "learn"]:
        result.error("One-call receipt template must declare the six ordered stages")
    claim_ids = {item.get("id") for item in receipt_template.get("claims", []) if isinstance(item, dict)}
    required_claims = {
        "ontology-valid", "concept-fidelity", "build-valid", "runtime-load", "browser-primary",
        "browser-mobile", "browser-keyboard", "browser-fallback", "browser-console-clean", "package-valid",
    }
    if not required_claims.issubset(claim_ids):
        result.error("One-call receipt template is missing core claims")

    learning_ledger = ROOT / "canvas-experience.learnings.jsonl"
    if not PUBLIC_SOURCE and learning_ledger.is_file():
        lines = [line for line in learning_ledger.read_text(encoding="utf-8").splitlines() if line.strip()]
        if not lines:
            result.error("Canvas learning ledger must contain at least one validated learning")
        for index, line in enumerate(lines):
            try:
                learning = json.loads(line)
            except json.JSONDecodeError as error:
                result.error(f"Canvas learning ledger line {index + 1} is invalid JSON: {error}")
                continue
            for key in ("evidence", "confidence", "reuseBoundary"):
                if key not in learning:
                    result.error(f"Canvas learning ledger line {index + 1} missing {key}")

    concept_assets = (
        "concept-atlas-expression-data.png",
        "concept-atlas-worldmaking.png",
        "concept-atlas-spatial-operations.png",
        "concept-mobile-interaction-states.png",
    )
    for filename in concept_assets:
        source = ROOT / "assets" / "concepts" / filename
        public = ROOT / "demo" / "public" / "concepts" / filename
        source_size = source.stat().st_size if source.is_file() else 0
        if source_size < 100_000:
            result.error(f"Missing detailed concept asset: {filename}")
        if not public.is_file() or public.stat().st_size != source_size:
            result.error(f"Demo concept asset mismatch: {filename}")
    for filename in ("commerce-scene-plate.png", "signal-runner-scene-plate.png"):
        path = ROOT / "demo" / "public" / "assets" / filename
        if not path.is_file() or path.stat().st_size < 100_000:
            result.error(f"Missing runtime scene plate: {filename}")


def validate_quality_receipt(result: Validation) -> None:
    path = ROOT / "VALIDATION.md"
    if not path.is_file():
        result.error("Missing VALIDATION.md")
        return
    text = path.read_text(encoding="utf-8")
    rounds = re.findall(r"^### Round ([123])\b", text, flags=re.MULTILINE)
    if rounds != ["1", "2", "3"]:
        result.error("Validation receipt must contain exactly Round 1, Round 2, Round 3")
    score_match = re.search(r"Final score:\s*([0-9.]+)\s*/\s*10", text)
    if not score_match or float(score_match.group(1)) < 9.9:
        result.error("Validation receipt final score must be at least 9.9/10")
    if "Open P0: 0" not in text or "Open P1: 0" not in text:
        result.error("Validation receipt must record zero open P0 and P1")


def demo_source_tree_hash() -> tuple[str, int]:
    demo = ROOT / "demo"
    paths = sorted(
        [path for path in (demo / "src").rglob("*") if path.is_file()]
        + [demo / "package.json", demo / "package-lock.json", demo / "index.html"],
        key=lambda path: path.as_posix(),
    )
    lines = [
        f"{path.relative_to(ROOT).as_posix()}\t{hashlib.sha256(path.read_bytes()).hexdigest()}"
        for path in paths
    ]
    return hashlib.sha256("\n".join(lines).encode("utf-8")).hexdigest(), len(paths)


def screenshot_directory_hash(relative_dir: str) -> tuple[str, int, int]:
    directory = ROOT / relative_dir
    paths = sorted(directory.glob("*.png"), key=lambda path: path.name)
    lines = [f"{path.name}\t{hashlib.sha256(path.read_bytes()).hexdigest()}" for path in paths]
    digest = hashlib.sha256("\n".join(lines).encode("utf-8")).hexdigest()
    return digest, len(paths), sum(path.stat().st_size for path in paths)


def package_included_paths(root: Path) -> list[Path]:
    return sorted(
        (
            path
            for path in root.rglob("*")
            if path.is_file()
            and not any(part in IGNORED_PARTS for part in path.relative_to(root).parts)
            and path.suffix.lower() not in PACKAGE_EXCLUDED_SUFFIXES
            and not (
                path.suffix.lower() == ".json"
                and path.name.startswith(PACKAGE_EXCLUDED_PREFIXES)
            )
        ),
        key=lambda path: path.relative_to(root).as_posix(),
    )


def package_tree_summary(root: Path) -> tuple[int, int, str, dict[str, str]]:
    paths = package_included_paths(root)
    hashes = {
        path.relative_to(root).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in paths
    }
    records = [f"{relative}\t{digest}" for relative, digest in hashes.items()]
    tree_digest = hashlib.sha256("\n".join(records).encode("utf-8")).hexdigest()
    return len(paths), sum(path.stat().st_size for path in paths), tree_digest, hashes


def archive_tree_summary(path: Path, root_name: str) -> tuple[int, int, str, dict[str, str]]:
    prefix = f"{root_name}/"
    with ZipFile(path) as archive:
        entries = [item for item in archive.infolist() if not item.is_dir()]
        hashes: dict[str, str] = {}
        total_bytes = 0
        for item in entries:
            relative = item.filename[len(prefix):] if item.filename.startswith(prefix) else item.filename
            payload = archive.read(item)
            hashes[relative] = hashlib.sha256(payload).hexdigest()
            total_bytes += len(payload)
    hashes = dict(sorted(hashes.items(), key=lambda item: item[0]))
    records = [f"{relative}\t{digest}" for relative, digest in hashes.items()]
    tree_digest = hashlib.sha256("\n".join(records).encode("utf-8")).hexdigest()
    return len(hashes), total_bytes, tree_digest, hashes


def validate_installation_readback(result: Validation) -> None:
    path = ROOT / "demo" / "evidence" / "installation-readback-v16-20260826.json"
    if not path.is_file():
        return
    receipt = load_json(path, result)
    if not receipt:
        return
    if receipt.get("schemaVersion") != "canvas-web-experiences-installation-readback/1.0":
        result.error("Installation readback must use the v1 canonical contract")
    if receipt.get("runId") != "canvas-web-experiences-v160-user-chrome-20260826":
        result.error("Installation readback runId must match the v1.6 Chrome receipt")

    plugin = receipt.get("plugin", {})
    manifest = load_json(ROOT / ".codex-plugin" / "plugin.json", result)
    if plugin.get("version") != manifest.get("version"):
        result.error("Installation readback version does not match the plugin manifest")
    if set(plugin.get("status", [])) != {"installed", "enabled"}:
        result.error("Installation readback must record installed and enabled status")

    roots = [ROOT, Path(str(plugin.get("marketplaceSource", ""))), Path(str(plugin.get("installedCache", "")))]
    if not all(root.is_dir() for root in roots):
        result.error("Installation readback project, marketplace, or cache root is missing")
        return
    summaries = [package_tree_summary(root) for root in roots]
    expected = receipt.get("packageIncludedTree", {})
    expected_count = expected.get("includedFiles")
    expected_bytes = expected.get("includedBytes")
    expected_digest = str(expected.get("sha256", "")).lower()
    for label, summary in zip(("project", "marketplace", "installed cache"), summaries):
        count, total_bytes, digest, _ = summary
        if (count, total_bytes, digest) != (expected_count, expected_bytes, expected_digest):
            result.error(f"Installation readback {label} canonical tree does not match its receipt")
    if not (summaries[0][3] == summaries[1][3] == summaries[2][3]):
        result.error("Installation readback project, marketplace, and installed cache files differ")
    for key in (
        "projectMarketplaceMismatches",
        "projectInstalledCacheMismatches",
        "marketplaceInstalledCacheMismatches",
    ):
        if expected.get(key) != 0:
            result.error(f"Installation readback {key} must be zero")

    archives = receipt.get("deterministicArchives", [])
    if not isinstance(archives, list) or len(archives) != 2:
        result.error("Installation readback must bind exactly two deterministic archives")
        return
    archive_digests: list[str] = []
    for item in archives:
        archive_path = Path(str(item.get("path", "")))
        if not archive_path.is_file():
            result.error(f"Installation readback archive is missing: {archive_path}")
            continue
        archive_digest = hashlib.sha256(archive_path.read_bytes()).hexdigest()
        archive_digests.append(archive_digest)
        if archive_digest != str(item.get("sha256", "")).lower() or archive_path.stat().st_size != item.get("bytes"):
            result.error(f"Installation readback archive hash/size mismatch: {archive_path}")
        count, total_bytes, tree_digest, hashes = archive_tree_summary(archive_path, ROOT.name)
        if (
            count != item.get("entries")
            or count != expected_count
            or total_bytes != expected_bytes
            or tree_digest != expected_digest
            or hashes != summaries[0][3]
        ):
            result.error(f"Installation readback archive canonical tree mismatch: {archive_path}")
    if len(archive_digests) == 2 and archive_digests[0] != archive_digests[1]:
        result.error("Installation readback archives are not byte-identical")

    policy = receipt.get("archivePolicy", {})
    for key in ("outputOutsidePluginRoot", "installationReadbackExcluded", "byteIdentical"):
        if policy.get(key) is not True:
            result.error(f"Installation readback archive policy must pass: {key}")
    if policy.get("forbiddenEntries") != 0:
        result.error("Installation readback archive must contain zero forbidden entries")

    build = receipt.get("buildBinding", {})
    demo_hash, demo_count = demo_source_tree_hash()
    regression_path = ROOT / "demo" / "evidence" / "chrome-151-v16-regression-20260826" / "regression-receipt-v2.json"
    if build.get("demoSourceFiles") != demo_count or build.get("demoSourceSha256") != demo_hash:
        result.error("Installation readback demo source binding is stale")
    if build.get("regressionReceiptSha256") != hashlib.sha256(regression_path.read_bytes()).hexdigest():
        result.error("Installation readback regression receipt hash is stale")
    if build.get("testFiles", 0) < 13 or build.get("tests", 0) < 67 or build.get("productionBuild") != "passed":
        result.error("Installation readback automated build binding is incomplete")


def validate_final_chrome_evidence(result: Validation) -> None:
    path = ROOT / "demo" / "evidence" / "chrome-151-v16-regression-20260826" / "regression-receipt-v2.json"
    receipt = load_json(path, result)
    if not receipt:
        return
    if receipt.get("schemaVersion") != "canvas-web-experiences-regression-receipt/v2":
        result.error("Final Chrome receipt must use the v2 evidence contract")
    if receipt.get("runId") != "canvas-web-experiences-v160-user-chrome-20260826":
        result.error("Final Chrome receipt must have the v1.6 build-bound runId")

    browser = receipt.get("browser", {})
    if browser.get("controlledSurface") != "user-chrome":
        result.error("Final Chrome receipt must identify the user's Chrome control surface")
    if browser.get("activationMechanism") != "unobserved" or browser.get("channel") != "unobserved":
        result.error("Final Chrome receipt must not infer an unobserved flag, channel, or activation mechanism")
    if browser.get("originTrialMetaToken") is not False:
        result.error("Final Chrome receipt must record that no origin-trial meta token was present")

    official = receipt.get("officialSnapshot", {})
    if official.get("wicgCommit") != "d4433e329697c4341a9f915f75dbd9608f3939fa":
        result.error("Final Chrome receipt must bind the reviewed WICG commit")
    if official.get("chromeStatus") != "In development" or official.get("originTrialThroughMilestone") != 154:
        result.error("Final Chrome receipt must retain the unreleased Chrome Status boundary")
    if official.get("whatwgStage") != 2:
        result.error("Final Chrome receipt must retain the open WHATWG Stage 2 boundary")

    expected_hash, expected_count = demo_source_tree_hash()
    build = receipt.get("demoSource", {})
    if build.get("release") != "1.6.0" or build.get("sha256") != expected_hash or build.get("fileCount") != expected_count:
        result.error("Final Chrome receipt source-tree hash does not match the current v1.6 demo runtime")

    capability = receipt.get("capabilities", {})
    for key in (
        "layoutSubtree", "paintEvent", "requestPaint", "drawElementImage",
        "texElementImage2D", "captureElementImage", "getElementTransform",
    ):
        if capability.get(key) is not True:
            result.error(f"Final Chrome receipt lacks positive raw capability evidence: {key}")
    if capability.get("copyElementImageToTexture") != "supported":
        result.error("Final Chrome receipt lacks positive WebGPU copyElementImageToTexture evidence")

    expected_ids = [
        "portfolio", "motion", "game", "spatial", "map", "diagram",
        "floorplan", "data", "media", "science", "commerce", "twin",
    ]
    expected_set = set(expected_ids)
    routes = receipt.get("desktopRouteSweep", [])
    if [item.get("id") for item in routes if isinstance(item, dict)] != expected_ids:
        result.error("Final Chrome receipt desktop route order must cover all 12 domains exactly once")
    passed_routes = set()
    for item in routes:
        if not isinstance(item, dict):
            continue
        tolerance = 4 if item.get("lane") in {"webgl", "webgpu"} else 2
        if (
            item.get("ready") is True
            and item.get("failure") == "none"
            and item.get("alignment") == "pass"
            and 0 <= item.get("alignmentPx", -1) <= tolerance
            and item.get("snapshot") == "current"
            and item.get("interactiveCount") == 1
            and item.get("sourceCount") == 1
            and item.get("sameElement") is True
            and item.get("instance") == "interactive-native-source"
            and item.get("inert") is False
            and item.get("ariaHidden") is None
            and item.get("tabIndex") == 0
            and item.get("pointerEvents") == "auto"
            and item.get("paint", 0) > 0
            and item.get("upload", 0) > 0
        ):
            passed_routes.add(item.get("id"))
    if passed_routes != expected_set:
        result.error("Final Chrome receipt must prove a single interactive native source on all 12 desktop routes")
    if {item.get("lane") for item in routes if isinstance(item, dict)} != {"canvas-2d", "webgl", "webgpu", "worker"}:
        result.error("Final Chrome receipt must bind exact execution for all four native lanes")

    interactions = receipt.get("directNativeInteractions", [])
    passed_interactions = {
        item.get("id")
        for item in interactions
        if isinstance(item, dict)
        and item.get("passed") is True
        and item.get("persisted") is True
        and item.get("focusInside") is True
        and item.get("interactiveCount") == 1
        and item.get("sourceCount") == 1
        and item.get("sameElement") is True
    }
    if passed_interactions != expected_set or len(interactions) != len(expected_ids):
        result.error("Final Chrome receipt must pass 12 direct-native task changes with route rehydration")
    pointer = receipt.get("nativePointerHitTest", {})
    if not (pointer.get("passed") is True and pointer.get("before") != pointer.get("after") and pointer.get("focusInside") is True):
        result.error("Final Chrome receipt must prove pointer hit testing on the actual native source")

    roundtrips = receipt.get("fallbackRoundtrip", [])
    passed_roundtrips = {
        item.get("id")
        for item in roundtrips
        if isinstance(item, dict)
        and item.get("statePreserved") is True
        and item.get("interactiveCounts") == [1, 1, 1]
        and item.get("sourceCounts") == [1, 0, 1]
        and item.get("snapshots") == ["current", "not-applicable", "current"]
        and item.get("instances") == ["interactive-native-source", "fallback-overlay", "interactive-native-source"]
    }
    if passed_roundtrips != expected_set or len(roundtrips) != len(expected_ids):
        result.error("Final Chrome receipt must pass native-fallback-native state preservation on all 12 routes")

    mobile390 = receipt.get("mobile390", {})
    mobile390_records = mobile390.get("routes", [])
    passed_390 = {
        item.get("id")
        for item in mobile390_records
        if isinstance(item, dict)
        and item.get("native") is True
        and item.get("collapsed") is True
        and item.get("surfaceExpanded") is True
        and item.get("controlPanelExpanded") is True
        and item.get("minimumEffectiveTargetPx", 0) >= 44
        and item.get("horizontalOverflowPx") == 0
        and item.get("interactiveCount") == 1
        and item.get("sourceCount") == 1
    }
    if mobile390.get("viewport") != {"width": 390, "height": 844} or passed_390 != expected_set:
        result.error("Final Chrome receipt must pass collapsed and expanded 390px coverage for all 12 native routes")

    mobile320 = receipt.get("mobile320", {})
    guarded_ids = {"portfolio", "game", "map", "diagram", "data", "science"}
    native_ids = expected_set - guarded_ids
    if set(mobile320.get("guardedRoutes", [])) != guarded_ids or set(mobile320.get("nativeRoutes", [])) != native_ids:
        result.error("Final Chrome receipt must identify the exact 320px responsive-guard split")
    passed_320 = set()
    for item in mobile320.get("routes", []):
        if not isinstance(item, dict):
            continue
        route_id = item.get("id")
        common = (
            item.get("collapsed") is True
            and item.get("surfaceExpanded") is True
            and item.get("controlPanelExpanded") is True
            and item.get("minimumEffectiveTargetPx", 0) >= 44
            and item.get("horizontalOverflowPx") == 0
            and item.get("interactiveCount") == 1
        )
        guarded = route_id in guarded_ids and item.get("mode") == "dom-overlay" and item.get("snapshot") == "not-applicable" and item.get("instance") == "fallback-overlay" and item.get("sourceCount") == 0
        native = route_id in native_ids and str(item.get("mode", "")).startswith("native-") and item.get("snapshot") == "current" and item.get("instance") == "interactive-native-source" and item.get("sourceCount") == 1
        if common and (guarded or native):
            passed_320.add(route_id)
    if mobile320.get("viewport") != {"width": 320, "height": 844} or passed_320 != expected_set:
        result.error("Final Chrome receipt must pass all 12 collapsed and expanded 320px routes")

    worker = receipt.get("workerOwnership", {})
    hard = worker.get("hardStall", {})
    recovery = worker.get("recovery", {})
    if not (
        hard.get("captured") == hard.get("transferred") == hard.get("terminalReleased") == 1
        and hard.get("closed") == hard.get("outstanding") == 0
        and hard.get("failure") == "context-or-device-lost"
        and hard.get("sourceInert") is True
        and hard.get("sourceAriaHidden") == "true"
        and recovery.get("captured", 0) > 0
        and recovery.get("captured") == recovery.get("transferred") == recovery.get("closed")
        and recovery.get("terminalReleased") == recovery.get("outstanding") == 0
        and recovery.get("ready") is True
        and recovery.get("failure") == "none"
    ):
        result.error("Final Chrome receipt must prove Worker explicit close and terminal-release ownership")

    expected_screenshot_dirs = {
        "demo/evidence/chrome-151-v16-regression-20260826/desktop-native-interaction-final",
        "demo/evidence/chrome-151-v16-regression-20260826/mobile-390x844-native-viewport-final",
        "demo/evidence/chrome-151-v16-regression-20260826/mobile-390x844-native-surface-expanded-final",
        "demo/evidence/chrome-151-v16-regression-20260826/mobile-320x844-guard-viewport-final",
        "demo/evidence/chrome-151-v16-regression-20260826/mobile-320x844-guard-surface-expanded-final",
    }
    screenshot_rows = receipt.get("screenshots", [])
    if {item.get("relativeDir") for item in screenshot_rows if isinstance(item, dict)} != expected_screenshot_dirs:
        result.error("Final Chrome receipt must bind the five current-source screenshot sets")
    for item in screenshot_rows:
        if not isinstance(item, dict) or not isinstance(item.get("relativeDir"), str):
            continue
        digest, count, total_bytes = screenshot_directory_hash(item["relativeDir"])
        if item.get("aggregateSha256") != digest or item.get("fileCount") != count or item.get("totalBytes") != total_bytes or count != 12:
            result.error(f"Screenshot receipt mismatch: {item.get('relativeDir')}")

    console = receipt.get("console", {})
    if console.get("warnings") != 0 or console.get("errors") != 0:
        result.error("Final Chrome receipt must end with zero console warnings/errors")
    automated = receipt.get("automatedVerification", {})
    if automated.get("testFiles", 0) < 13 or automated.get("tests", 0) < 67 or automated.get("build") != "passed":
        result.error("Final Chrome receipt must bind the current regression suite and production build")


def validate_accessibility_runtime_evidence(result: Validation) -> None:
    path = ROOT / "demo" / "output" / "playwright" / "accessibility-runtime-receipt.json"
    receipt = load_json(path, result)
    if not receipt:
        return
    if not re.fullmatch(r"151\.0\.\d+\.\d+", str(receipt.get("browserVersion", ""))):
        result.error("Accessibility runtime receipt must identify Chromium 151")
    routes = receipt.get("routes")
    expected_ids = {
        "portfolio", "motion", "game", "spatial", "map", "diagram",
        "floorplan", "data", "media", "science", "commerce", "twin",
    }
    if not isinstance(routes, list):
        result.error("Accessibility runtime receipt routes must be an array")
        routes = []
    route_by_id = {
        item.get("id"): item
        for item in routes
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    }
    if set(route_by_id) != expected_ids:
        result.error("Accessibility runtime receipt must cover all 12 domains")
    for route_id, item in route_by_id.items():
        if item.get("mode") != "dom-overlay":
            result.error(f"Accessibility route {route_id} must identify the supplemental DOM fallback")
        if item.get("emptyAccessibleNames") != 0:
            result.error(f"Accessibility route {route_id} contains an unnamed control")
        if not isinstance(item.get("selectedTextLength"), int) or item["selectedTextLength"] <= 0:
            result.error(f"Accessibility route {route_id} lacks selectable text evidence")
        if not str(item.get("ariaSnapshot", "")).startswith("- main:"):
            result.error(f"Accessibility route {route_id} lacks a main accessibility snapshot")

    reduced = receipt.get("reducedMotion", {})
    if not (
        reduced.get("queryMatches") is True
        and reduced.get("focusOutlineStyle") == "solid"
        and reduced.get("horizontalOverflow") == 0
    ):
        result.error("Reduced-motion runtime evidence is incomplete")
    forced = receipt.get("forcedColors", {})
    if not (
        forced.get("queryMatches") is True
        and forced.get("focusOutlineStyle") == "solid"
        and forced.get("horizontalOverflow") == 0
    ):
        result.error("Forced-colors runtime evidence is incomplete")
    if receipt.get("consoleEntries") != [] or receipt.get("pageErrors") != []:
        result.error("Accessibility runtime receipt must have zero scoped console and page errors")

    data_route = route_by_id.get("data", {})
    if data_route.get("tableCaption") != "선택 구간의 기후 관측값" or data_route.get("tableRowCount") != 3:
        result.error("Accessibility runtime receipt lacks the captioned three-row data table")
    science_route = route_by_id.get("science", {})
    if science_route.get("hasMathMl") is not True or not science_route.get("mathLabel"):
        result.error("Accessibility runtime receipt lacks named MathML")
    if route_by_id.get("map", {}).get("hasRtl") is not True:
        result.error("Accessibility runtime receipt lacks RTL content")
    screenshot = path.parent / "forced-colors-portfolio.png"
    if not screenshot.is_file() or screenshot.stat().st_size < 10_000:
        result.error("Forced-colors runtime screenshot is missing or too small")

    packer = (ROOT / "scripts" / "package_canvas_plugin.py").read_text(encoding="utf-8")
    for excluded in ('"dist"', '".playwright-cli"', '"node_modules"'):
        if excluded not in packer:
            result.error(f"Package script must exclude ephemeral directory {excluded}")


def main() -> int:
    global PUBLIC_SOURCE
    parser = argparse.ArgumentParser(description="Validate the Canvas Web Experiences plugin")
    parser.add_argument("--public-source", action="store_true", help="validate a source-only distribution without local receipts or LocalDock")
    args = parser.parse_args()
    PUBLIC_SOURCE = args.public_source
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    result = Validation()
    validate_manifest(result)
    validate_skills(result)
    validate_catalog(result)
    validate_internal_links(result)
    validate_content_contract(result)
    validate_demo_lab(result)
    validate_one_shot_system(result)
    if not PUBLIC_SOURCE:
        validate_quality_receipt(result)
        validate_final_chrome_evidence(result)
        validate_accessibility_runtime_evidence(result)
        validate_installation_readback(result)

    for message in result.warnings:
        print(f"WARNING: {message}")
    for message in result.errors:
        print(f"ERROR: {message}")
    print(
        f"Validated {len(EXPECTED_SKILLS):,} skills; "
        f"warnings={len(result.warnings):,}; errors={len(result.errors):,}."
    )
    return 1 if result.errors else 0


if __name__ == "__main__":
    raise SystemExit(main())

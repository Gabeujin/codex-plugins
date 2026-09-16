#!/usr/bin/env python3
"""Focused regressions for source-commit binding in package-release check mode.

Fixtures are retained below the OS temporary directory for review. This test never
packages the working repository.
"""
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest
import zipfile


REPO = Path(__file__).resolve().parents[1]
FIXTURE_PARENT = Path(tempfile.gettempdir()) / 'codex-package-regression-fixtures'
FIXTURE_PARENT.mkdir(parents=True, exist_ok=True)
SPEC = importlib.util.spec_from_file_location("package_release", REPO / "scripts" / "package-release.py")
PACKAGE_RELEASE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACKAGE_RELEASE)


def git(root, *args):
    return subprocess.check_output(["git", "-C", str(root), *args], text=True).strip()


def write(root, relative, text):
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def commit(root, message):
    subprocess.run(["git", "-C", str(root), "add", "."], check=True)
    subprocess.run(
        ["git", "-C", str(root), "-c", "user.name=Regression", "-c", "user.email=regression@example.invalid", "commit", "-m", message],
        check=True,
        stdout=subprocess.DEVNULL,
    )
    return git(root, "rev-parse", "HEAD")


def archive_files(root, commit_id):
    payload = subprocess.check_output(["git", "-C", str(root), "archive", "--format=tar", commit_id])
    files = {}
    with tarfile.open(fileobj=io.BytesIO(payload), mode="r:") as archive:
        for member in archive:
            if member.isfile():
                files[member.name] = archive.extractfile(member).read()
    return files


def make_archive(root, commit_id, claimed_commit, output):
    files = archive_files(root, commit_id)
    manifest = PACKAGE_RELEASE.release_manifest(claimed_commit, files)
    with zipfile.ZipFile(output, "x", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, data in sorted(files.items()):
            archive.writestr(name, data)
        archive.writestr("release-manifest.json", json.dumps(manifest, sort_keys=True).encode("utf-8"))


class PackageReleaseRegressionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = Path(tempfile.mkdtemp(prefix="package-release-", dir=FIXTURE_PARENT))
        subprocess.run(["git", "init", "-q", str(cls.root)], check=True)
        write(cls.root, ".agents/plugins/marketplace.json", json.dumps({
            "name": "gabeujin-plugins",
            "plugins": [
                {"name": name, "source": {"source": "local", "path": f"./plugins/{name}"}}
                for name in ["k-tech-radar", "canvas-web-experiences", "kgj-design", "codex-daily-check"]
            ],
        }))
        for name in ["k-tech-radar", "canvas-web-experiences", "kgj-design", "codex-daily-check"]:
            write(cls.root, f"plugins/{name}/.codex-plugin/plugin.json", json.dumps({"name": name, "version": "0.0.1", "skills": "./skills", "mcpServers": "./.mcp.json"}))
            write(cls.root, f"plugins/{name}/.mcp.json", "{}")
            write(cls.root, f"plugins/{name}/skills/README.md", "fixture\n")
        for script in ["public-safety.mjs", "verify-public-source.mjs"]:
            write(cls.root, f"scripts/{script}", (REPO / "scripts" / script).read_text(encoding="utf-8"))
        write(cls.root, "README.md", "first exact tree\n")
        cls.first = commit(cls.root, "first")
        write(cls.root, "README.md", "second exact tree\n")
        cls.second = commit(cls.root, "second")

    def test_exact_claimed_commit_passes(self):
        archive = self.root / "exact-first.zip"
        make_archive(self.root, self.first, self.first, archive)
        manifest = PACKAGE_RELEASE.check(archive, self.root)
        self.assertEqual(manifest["sourceCommit"], self.first)

    def test_rejects_unreachable_forged_claim(self):
        archive = self.root / "forged-unreachable.zip"
        make_archive(self.root, self.first, "0" * 40, archive)
        with self.assertRaises(subprocess.CalledProcessError):
            PACKAGE_RELEASE.check(archive, self.root)

    def test_rejects_existing_but_wrong_commit_claim(self):
        archive = self.root / "forged-existing.zip"
        make_archive(self.root, self.first, self.second, archive)
        with self.assertRaisesRegex(ValueError, "exact source commit tree|differs from claimed|claims differ"):
            PACKAGE_RELEASE.check(archive, self.root)


if __name__ == "__main__":
    unittest.main(verbosity=2)

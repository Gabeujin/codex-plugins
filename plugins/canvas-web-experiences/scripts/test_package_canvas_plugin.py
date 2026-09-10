from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[1]
PACKER = ROOT / "scripts" / "package_canvas_plugin.py"


class CanvasPackageTests(unittest.TestCase):
    def test_concept_images_are_shipped_once_from_the_runtime_public_path(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            archive_path = Path(directory) / "canvas.zip"
            subprocess.run([sys.executable, str(PACKER), "--output", str(archive_path)], check=True, capture_output=True, text=True)
            with ZipFile(archive_path) as archive:
                names = set(archive.namelist())
            concept_entries = [
                name for name in names
                if name.endswith("/concepts/concept-atlas-worldmaking.png")
            ]
            self.assertEqual(
                concept_entries,
                ["canvas-web-experiences/demo/public/concepts/concept-atlas-worldmaking.png"],
            )


if __name__ == "__main__":
    unittest.main()

from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("create_canvas_starter.py")


class CanvasStarterTests(unittest.TestCase):
    def test_every_starter_is_standalone_and_contains_the_fallback_contract(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for kind in ("2d", "3d", "map-diagram"):
                output = root / kind
                result = subprocess.run(
                    [sys.executable, str(SCRIPT), "--kind", kind, "--output", str(output)],
                    check=True, capture_output=True, text=True,
                )
                self.assertIn("Created", result.stdout)
                self.assertEqual({path.name for path in output.iterdir()}, {"README.md", "app.js", "index.html", "styles.css"})
                app = (output / "app.js").read_text(encoding="utf-8")
                if kind == "3d":
                    self.assertIn("getContext('webgl'", app)
                    self.assertIn("gl.drawArrays(gl.TRIANGLES", app)
                else:
                    self.assertIn("getContext('2d')", app)
                self.assertNotIn("drawElementImage", app)
                self.assertNotIn("texElementImage2D", app)
                self.assertIn("fallback-advance", app)
                subprocess.run(["node", "--check", str(output / "app.js")], check=True, capture_output=True, text=True)

    def test_refuses_to_overwrite_an_existing_folder(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "existing"
            output.mkdir()
            result = subprocess.run(
                [sys.executable, str(SCRIPT), "--kind", "2d", "--output", str(output)],
                capture_output=True, text=True,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Refusing to overwrite", result.stderr)


if __name__ == "__main__":
    unittest.main()

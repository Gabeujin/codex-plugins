#!/usr/bin/env python3
"""Create a small, dependency-free Canvas starter without experimental APIs."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


STARTERS = {
    "2d": {
        "title": "Accessible Canvas 2D starter",
        "task": "Move the marker with the button or arrow keys.",
        "draw": "ctx.fillStyle = '#45d6e8'; ctx.beginPath(); ctx.arc(x, height / 2, 18, 0, Math.PI * 2); ctx.fill();",
        "state": "marker position",
    },
    "3d": {
        "title": "Small Canvas 3D starter",
        "task": "Rotate the cube with the button or arrow keys.",
        "state": "rotation",
    },
    "map-diagram": {
        "title": "Accessible map and diagram starter",
        "task": "Move focus between nodes with the button or arrow keys.",
        "draw": "ctx.strokeStyle = '#63e6be'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(72, height / 2); ctx.lineTo(width - 72, height / 2); ctx.stroke(); ctx.fillStyle = '#ffca6e'; ctx.beginPath(); ctx.arc(x, height / 2, 22, 0, Math.PI * 2); ctx.fill();",
        "state": "selected node",
    },
}


def index_html(title: str, task: str) -> str:
    return f"""<!doctype html>
<html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>{title}</title><link rel=\"stylesheet\" href=\"./styles.css\"></head>
<body><main><h1>{title}</h1><p id=\"instruction\">{task}</p><canvas id=\"scene\" width=\"640\" height=\"360\" tabindex=\"0\" role=\"region\" aria-describedby=\"instruction fallback\">Canvas scene</canvas><div class=\"controls\"><button id=\"advance\" type=\"button\">Advance task</button><button id=\"reset\" type=\"button\">Reset</button></div><p id=\"status\" role=\"status\"></p><section id=\"fallback\"><h2>Semantic fallback</h2><p>This task remains usable if Canvas is unavailable.</p><button id=\"fallback-advance\" type=\"button\">Advance task without Canvas</button></section></main><script type=\"module\" src=\"./app.js\"></script></body></html>\n"""


def app_js(kind: str, draw: str, state: str) -> str:
    if kind == "3d":
        return """const canvas = document.querySelector('#scene');
const status = document.querySelector('#status');
const fallback = document.querySelector('#fallback');
const gl = canvas?.getContext('webgl', { antialias: true });
let value = 0;
const format = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

const vertexSource = `attribute vec3 position;
uniform float angle;
varying float depth;
void main() {
  float c = cos(angle), s = sin(angle);
  vec3 turned = vec3(position.x * c - position.z * s, position.y, position.x * s + position.z * c);
  depth = turned.z;
  gl_Position = vec4(turned.xy * 0.52, turned.z * 0.16, 1.0);
}`;
const fragmentSource = `precision mediump float;
varying float depth;
void main() { gl_FragColor = vec4(0.42 + depth * 0.22, 0.56 + depth * 0.12, 0.93, 1.0); }`;
const cube = new Float32Array([
  -1,-1, 1,  1,-1, 1,  1, 1, 1,  -1,-1, 1,  1, 1, 1, -1, 1, 1,
  -1,-1,-1, -1, 1,-1,  1, 1,-1, -1,-1,-1,  1, 1,-1,  1,-1,-1,
  -1, 1,-1, -1, 1, 1,  1, 1, 1, -1, 1,-1,  1, 1, 1,  1, 1,-1,
  -1,-1,-1,  1,-1,-1,  1,-1, 1, -1,-1,-1,  1,-1, 1, -1,-1, 1,
   1,-1,-1,  1, 1,-1,  1, 1, 1,  1,-1,-1,  1, 1, 1,  1,-1, 1,
  -1,-1,-1, -1,-1, 1, -1, 1, 1, -1,-1,-1, -1, 1, 1, -1, 1,-1,
]);
function compile(type, source) {
  const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}
function setup() {
  try {
    const vertex = compile(gl.VERTEX_SHADER, vertexSource), fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vertex || !fragment) return null;
    const program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    gl.useProgram(program);
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, cube, gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position'); const angle = gl.getUniformLocation(program, 'angle');
    if (position < 0 || !angle) return null;
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0);
    return { angle };
  } catch { return null; }
}
const uniforms = gl && setup();
function render() {
  status.textContent = `rotation: ${format.format(value)}`;
  canvas.dataset.rotation = String(value);
  if (!gl || !uniforms) { canvas.dataset.renderer = 'fallback'; canvas.hidden = true; fallback.hidden = false; return; }
  canvas.dataset.renderer = 'webgl';
  gl.viewport(0, 0, canvas.width, canvas.height); gl.enable(gl.DEPTH_TEST); gl.clearColor(.035, .071, .094, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.uniform1f(uniforms.angle, value * Math.PI / 12); gl.drawArrays(gl.TRIANGLES, 0, cube.length / 3);
}
function advance() { value += 1; render(); }
document.querySelector('#advance').addEventListener('click', advance);
document.querySelector('#fallback-advance').addEventListener('click', advance);
document.querySelector('#reset').addEventListener('click', () => { value = 0; render(); });
canvas?.addEventListener('keydown', (event) => { if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); advance(); } });
fallback.hidden = Boolean(gl);
render();
"""
    return f"""const canvas = document.querySelector('#scene');
const status = document.querySelector('#status');
const fallback = document.querySelector('#fallback');
const context = canvas?.getContext('2d');
let value = 0;
const format = new Intl.NumberFormat(undefined, {{ maximumFractionDigits: 0 }});

function label() {{ return `{state}: ${{format.format(value)}}`; }}
function render() {{
  status.textContent = label();
  if (!context) {{ canvas.hidden = true; fallback.hidden = false; return; }}
  const {{ width, height }} = canvas;
  context.clearRect(0, 0, width, height);
  context.fillStyle = '#10202a'; context.fillRect(0, 0, width, height);
  const x = 88 + (value % 6) * 92;
  const angle = value * Math.PI / 12;
  {draw}
}}
function advance() {{ value += 1; render(); }}
document.querySelector('#advance').addEventListener('click', advance);
document.querySelector('#fallback-advance').addEventListener('click', advance);
document.querySelector('#reset').addEventListener('click', () => {{ value = 0; render(); }});
canvas?.addEventListener('keydown', (event) => {{ if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {{ event.preventDefault(); advance(); }} }});
fallback.hidden = Boolean(context);
render();
"""


STYLES = """* { box-sizing: border-box; } [hidden] { display: none !important; } body { margin: 0; background: #091218; color: #edf6f8; font: 16px/1.5 system-ui, sans-serif; } main { width: min(100% - 32px, 760px); margin: 32px auto; } canvas { display: block; width: 100%; height: auto; border: 1px solid #49606b; border-radius: 12px; outline-offset: 4px; } button { min-height: 44px; margin: 12px 8px 0 0; padding: 0 16px; border: 1px solid #78dce8; border-radius: 8px; color: #061316; background: #78dce8; font: inherit; font-weight: 700; } button:focus-visible, canvas:focus-visible { outline: 3px solid #ffca6e; } #fallback { margin-top: 18px; padding: 16px; border: 1px solid #49606b; border-radius: 12px; } @media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto; } }"""


def readme(kind: str, title: str, task: str) -> str:
    return f"""# {title}

This dependency-free starter is generated by `create_canvas_starter.py --kind {kind}`. It uses stable {"WebGL" if kind == "3d" else "Canvas 2D"} plus semantic DOM controls; it does not use HTML-in-Canvas or require image assets.

## Run and check

1. Run `python -m http.server 8000` in this folder and open `http://127.0.0.1:8000`.
2. Run `node --check app.js` as the build/syntax check.
3. Complete the representative task: **{task}** Confirm that the live status changes.
4. To check the fallback, temporarily make `canvas.getContext` return `null` in browser devtools before reload. The semantic fallback button must update the same status.

Use a real browser to verify keyboard focus, narrow layouts, and reduced motion for a product change. This starter itself makes no browser-support or release claim.
"""


def create(kind: str, output: Path) -> None:
    if output.exists():
        raise ValueError(f"Refusing to overwrite existing path: {output}")
    if not output.parent.is_dir():
        raise ValueError(f"Output parent must already exist: {output.parent}")
    item = STARTERS[kind]
    output.mkdir()
    (output / "index.html").write_text(index_html(item["title"], item["task"]), encoding="utf-8")
    (output / "app.js").write_text(app_js(kind, item.get("draw", ""), item["state"]), encoding="utf-8")
    (output / "styles.css").write_text(STYLES + "\n", encoding="utf-8")
    (output / "README.md").write_text(readme(kind, item["title"], item["task"]), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Create a dependency-free Canvas starter")
    parser.add_argument("--kind", choices=sorted(STARTERS), required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    create(args.kind, args.output.resolve())
    print(f"Created {args.kind} starter at {args.output.resolve()}")
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    raise SystemExit(main())

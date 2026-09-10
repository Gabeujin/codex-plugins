# Canvas starters

Create a small, independent starter without copying the 12-domain lab or enabling experimental HTML-in-Canvas APIs:

```text
python scripts/create_canvas_starter.py --kind 2d --output ../my-canvas-2d
python scripts/create_canvas_starter.py --kind 3d --output ../my-canvas-3d
python scripts/create_canvas_starter.py --kind map-diagram --output ../my-canvas-map
```

Each generated folder is dependency-free and contains a stable Canvas 2D rendering path, DOM controls, keyboard interaction, semantic fallback, and its own verification instructions. The generator refuses to overwrite an existing folder.

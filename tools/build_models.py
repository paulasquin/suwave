"""Convert STL (or any trimesh-readable mesh: OBJ, PLY, GLB…) into compact GLB files.

    uv run --with trimesh --with numpy --with scipy --with networkx python -I tools/build_models.py \
        path/to/Part.STL:part path/to/Base.STL:base
    for m in part base; do npx @gltf-transform/cli meshopt assets/models/$m.raw.glb assets/models/$m.glb && rm assets/models/$m.raw.glb; done

Each model is centred on X/Z with its base at y = 0, keeps its units (millimetres for
SolidWorks exports, Y-up) and gets smooth normals split at 28° creases.
STEP files: convert to STL first (FreeCAD: `freecadcmd -c "import Part, Mesh; ..."` or an online converter).
The meshopt step quantises the mesh: always load it through js/kit/models.js, which bakes the node transform.
"""
import sys, pathlib
import numpy as np
import trimesh

out = pathlib.Path("assets/models")
out.mkdir(parents=True, exist_ok=True)
for arg in sys.argv[1:]:
    src, _, name = arg.partition(":")
    m = trimesh.load(src, force="mesh")
    m.merge_vertices()
    lo, hi = m.bounds
    m.apply_translation([-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2])
    s = trimesh.graph.smooth_shade(m, angle=np.radians(28))
    s.export(out / f"{name or pathlib.Path(src).stem.lower()}.raw.glb", include_normals=True)
    print(name, len(s.faces), "faces", np.round(s.bounds, 1).tolist())

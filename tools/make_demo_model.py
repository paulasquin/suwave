"""Build assets/models/demo.glb: a small bell nozzle (revolved profile + flange), in millimetres, Y-up.

    uv run --with trimesh --with numpy --with scipy --with networkx python -I tools/make_demo_model.py
    npx @gltf-transform/cli meshopt assets/models/demo.raw.glb assets/models/demo.glb && rm assets/models/demo.raw.glb
"""
import numpy as np
import trimesh

# Profile (radius, height) of the nozzle wall, outer then inner, closed.
outer = [(22, 0), (24, 4), (14, 26), (11, 34), (12, 40), (26, 66), (34, 80)]
inner = [(31, 80), (23.5, 66), (10, 40), (9, 34), (12, 26), (20, 6), (18, 2)]
prof = np.array(outer + inner + [outer[0]], float)
wall = trimesh.creation.revolve(prof, sections=96)
flange = trimesh.creation.annulus(r_min=17, r_max=30, height=4, sections=96)
flange.apply_translation([0, 0, 2])
bolts = [trimesh.creation.cylinder(radius=2.2, height=5, sections=24) for _ in range(8)]
for k, b in enumerate(bolts):
    a = k * np.pi / 4
    b.apply_translation([26 * np.cos(a), 26 * np.sin(a), 2.5])
m = trimesh.util.concatenate([wall, flange, *bolts])
m.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0]))  # Z-up -> Y-up
lo, hi = m.bounds
m.apply_translation([-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2])
s = trimesh.graph.smooth_shade(m, angle=np.radians(30))
s.export("assets/models/demo.raw.glb", include_normals=True)
print("demo.raw.glb", len(s.faces), "faces", np.round(s.bounds, 1).tolist())
